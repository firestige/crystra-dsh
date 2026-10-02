import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
const schemaVersion = "crystra.workflow-directories@1.0.0";
const error = (code, message) => Object.assign(new Error(message), { code });
function shape(directories) {
  if (
    !Array.isArray(directories) ||
    directories.length > 32 ||
    directories.some(
      (entry) =>
        !entry ||
        Object.keys(entry).sort().join(",") !== "kind,path" ||
        typeof entry.path !== "string" ||
        !path.isAbsolute(entry.path) ||
        !["collection", "package"].includes(entry.kind),
    )
  )
    throw error(
      "WORKFLOW_SETTINGS_INVALID",
      "请填写有效的本地绝对路径和目录类型",
    );
}
export function createWorkflowSettings(file) {
  async function read() {
    let bytes;
    try {
      bytes = await readFile(file, "utf8");
    } catch (cause) {
      if (cause.code !== "ENOENT") throw cause;
      return { revision: "missing", directories: [] };
    }
    const value = JSON.parse(bytes);
    if (value.schemaVersion !== schemaVersion)
      throw error("WORKFLOW_SETTINGS_INVALID", "来源配置格式不兼容");
    shape(value.directories);
    return {
      revision: createHash("sha256").update(bytes).digest("hex"),
      directories: value.directories,
    };
  }
  return {
    read,
    async save(input) {
      if (
        !input ||
        Object.keys(input).sort().join(",") !== "directories,revision" ||
        typeof input.revision !== "string"
      )
        throw error("WORKFLOW_SETTINGS_INVALID", "来源设置请求无效");
      shape(input.directories);
      const directories = [];
      const seen = new Set();
      for (const entry of input.directories) {
        let canonical;
        try {
          canonical = await realpath(entry.path);
          if (!(await stat(canonical)).isDirectory()) throw Error();
          if (
            entry.kind === "package" &&
            !(
              await stat(path.join(canonical, "definition/package.json"))
            ).isFile()
          )
            throw Error();
        } catch {
          throw error(
            "WORKFLOW_DIRECTORY_INVALID",
            `目录不存在或类型不匹配：${entry.path}`,
          );
        }
        if (seen.has(canonical))
          throw error("WORKFLOW_SETTINGS_INVALID", "同一目录不能重复绑定");
        seen.add(canonical);
        directories.push({ path: canonical, kind: entry.kind });
      }
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      let lock;
      try {
        lock = await open(file + ".lock", "wx", 0o600);
      } catch (cause) {
        if (cause.code === "EEXIST")
          throw error("WORKFLOW_SETTINGS_BUSY", "其他设置正在保存，请稍后重试");
        throw cause;
      }
      const temporary = file + "." + randomUUID() + ".new";
      try {
        if ((await read()).revision !== input.revision)
          throw error(
            "WORKFLOW_SETTINGS_CONFLICT",
            "来源设置已被其他窗口修改，请重新加载后再保存",
          );
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(
            JSON.stringify({ schemaVersion, directories }, null, 2) + "\n",
          );
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, file);
        return await read();
      } finally {
        await unlink(temporary).catch(() => {});
        await lock.close();
        await unlink(file + ".lock");
      }
    },
  };
}
