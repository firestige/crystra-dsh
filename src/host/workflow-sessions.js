import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createLocalWorkflowQuery } from "../../modules/studio/src/workflows/local-workflow-query.js";
/** Workflow identity owns topics; revisions and display names do not own Sessions. */
export function createWorkflowSessions({
  bindingFile,
  stateRoot = dirname(bindingFile),
  create,
  isRunning = () => false,
  firstMessage = () => undefined,
}) {
  const query = createLocalWorkflowQuery(bindingFile),
    tails = new Map();
  async function access(operation, payload) {
    const fields = {
      read: ["definitionId"],
      create: ["definitionId", "groupId"],
      select: ["definitionId", "groupId", "topicId"],
      rename: ["definitionId", "topicId", "title"],
    }[operation];
    if (
      !fields ||
      !payload ||
      Object.keys(payload).length !== fields.length ||
      fields.some((k) => typeof payload[k] !== "string" || !payload[k])
    )
      throw Error("WORKFLOW_TOPIC_REQUEST_INVALID");
    const source = (await query.snapshot()).items.find(
      (w) => w.definitionId === payload.definitionId,
    );
    if (!source) throw Error("WORKFLOW_NOT_BOUND");
    const key = createHash("sha256")
      .update(JSON.stringify([source.directory, source.definitionId]))
      .digest("hex");
    const action = async () => {
      const file = join(stateRoot, "workflow-topics", key + ".json");
      let state;
      try {
        state = JSON.parse(await readFile(file, "utf8"));
        if (
          state.schemaVersion !== "crystra.workflow-topics@1" ||
          state.definitionId !== source.definitionId ||
          state.directory !== source.directory ||
          !Array.isArray(state.topics) ||
          !state.topics.some((t) => t.id === state.selectedTopicId)
        )
          throw Error("WORKFLOW_TOPICS_INVALID");
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        const id = randomUUID();
        state = {
          schemaVersion: "crystra.workflow-topics@1",
          definitionId: source.definitionId,
          directory: source.directory,
          selectedTopicId: id,
          topics: [
            {
              id,
              sessionId: "crystra-workflow-" + key,
              title: "工作流设计",
              autoTitle: true,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      const before = JSON.stringify(state);
      const busy = () => state.topics.some((t) => isRunning(t.sessionId));
      if (["create", "select"].includes(operation)) {
        if (busy()) throw Error("WORKFLOW_TOPIC_BUSY");
        if (payload.groupId !== key)
          throw Error("WORKFLOW_TOPIC_GROUP_UNKNOWN");
      }
      if (operation === "create") {
        const topic = {
          id: randomUUID(),
          sessionId: "crystra-workflow-" + key + "-" + randomUUID(),
          title: "新主题",
          autoTitle: true,
          createdAt: new Date().toISOString(),
        };
        const result = await create({
          sessionId: topic.sessionId,
          cwd: source.directory,
        });
        if (result.sessionId !== topic.sessionId)
          throw Error("WORKFLOW_SESSION_IDENTITY_MISMATCH");
        state.topics.push(topic);
        state.selectedTopicId = topic.id;
      } else if (operation === "select") {
        if (!state.topics.some((t) => t.id === payload.topicId))
          throw Error("WORKFLOW_TOPIC_UNKNOWN");
        state.selectedTopicId = payload.topicId;
      } else if (operation === "rename") {
        const topic = state.topics.find((t) => t.id === payload.topicId);
        if (!topic) throw Error("WORKFLOW_TOPIC_UNKNOWN");
        if (!payload.title.trim() || payload.title.length > 120)
          throw Error("TOPIC_TITLE_INVALID");
        topic.title = payload.title.trim();
        topic.autoTitle = false;
      }
      for (const topic of state.topics)
        if (topic.autoTitle) {
          const text = await firstMessage(topic.sessionId);
          if (text?.trim()) {
            topic.title = Array.from(text.trim().replace(/\s+/g, " "))
              .slice(0, 48)
              .join("");
            topic.autoTitle = false;
          }
        }
      // Always establish/adopt the chosen native Session before exposing its identity.
      const selected = state.topics.find((t) => t.id === state.selectedTopicId);
      const result = await create({
        sessionId: selected.sessionId,
        cwd: source.directory,
      });
      if (result.sessionId !== selected.sessionId)
        throw Error("WORKFLOW_SESSION_IDENTITY_MISMATCH");
      // Initial reads also persist the original Session's membership.
      let exists = true;
      try {
        await readFile(file);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
        exists = false;
      }
      if (!exists || JSON.stringify(state) !== before) {
        await mkdir(dirname(file), { recursive: true, mode: 0o700 });
        const temp = file + "." + randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(state) + "\n", { mode: 0o600 });
        await rename(temp, file);
      }
      const group = {
        id: key,
        title: source.title || source.definitionId,
        selectedTopicId: selected.id,
      };
      return {
        definitionId: source.definitionId,
        directory: source.directory,
        sessionId: selected.sessionId,
        group,
        currentGroup: group,
        groups: [group],
        topics: state.topics,
        selected,
        busy: busy(),
      };
    };
    const next = (tails.get(key) || Promise.resolve()).then(action),
      tail = next.catch(() => {});
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return next;
  }
  return { ensure: (payload) => access("read", payload), topics: access };
}
