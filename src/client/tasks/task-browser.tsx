import { useRef, useState } from "react";
import {
  TaskBrowserSurface,
  ResourceDialog,
  Button,
  TextInput,
} from "crystra-ui-core";
import { useTasks } from "./use-tasks";
import { TasksFeedback } from "./task-views";
import type { Task, TaskUpdate } from "./types";
type Edit =
  | { kind: "rename"; task: Task }
  | { kind: "thumbnail"; task: Task }
  | { kind: "archive"; tasks: Task[]; archived: boolean };
/** Browser workflow only; all persistence is an Execution command through the shared resource. */
export function TaskBrowser({
  onNavigate,
  hostRoot = false,
}: {
  onNavigate: (path: string) => void;
  hostRoot?: boolean;
}) {
  const tasks = useTasks(),
    [archiveView, setArchiveView] = useState(false),
    [edit, setEdit] = useState<Edit | null>(null),
    [name, setName] = useState(""),
    [image, setImage] = useState<string | null | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [undo, setUndo] = useState<
      { taskId: string; expectedRevision: number; archived: boolean }[]
    >([]);
  const lock = useRef(false),
    imageGeneration = useRef(0);
  const open = (kind: "rename" | "thumbnail", id: string) => {
    const task = tasks.items.find((t) => t.id === id);
    if (!task) return;
    setError("");
    setName(task.title);
    setImage(undefined);
    setEdit({ kind, task });
  };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const update = (
    task: Task,
    patch: Omit<TaskUpdate, "taskId" | "expectedRevision">,
  ) =>
    tasks.actions.update({
      taskId: task.id,
      expectedRevision: task.presentationRevision ?? 0,
      ...patch,
    });
  const save = () =>
    void run(async () => {
      if (!edit) return;
      if (edit.kind === "archive") {
        const success: typeof undo = [],
          failed: string[] = [];
        for (const task of edit.tasks) {
          try {
            await update(task, { archived: edit.archived });
            success.push({
              taskId: task.id,
              expectedRevision: (task.presentationRevision ?? 0) + 1,
              archived: !edit.archived,
            });
          } catch (e) {
            failed.push(
              `${task.title}：${e instanceof Error ? e.message : "失败"}`,
            );
          }
        }
        setUndo(success);
        setNotice(
          `${edit.archived ? "已归档" : "已恢复"} ${success.length} 个任务`,
        );
        setEdit(null);
        if (failed.length) setError(failed.join("；"));
        return;
      }
      if (edit.kind === "rename")
        await update(edit.task, { displayTitle: name });
      else {
        if (image === undefined) throw new Error("请选择图片或恢复默认图标");
        await update(edit.task, { thumbnailPng: image });
      }
      setNotice("已保存");
      setEdit(null);
    });
  const chooseImage = async (file: File) => {
    const generation = ++imageGeneration.current;
    setError("");
    setImage(undefined);
    try {
      if (
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          file.type,
        ) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("请选择不超过 10MB 的 PNG、JPEG、WebP 或 GIF 图片");
      const bitmap = await createImageBitmap(file);
      try {
        const ratio = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("无法处理图片");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const encoded = canvas.toDataURL("image/png").split(",")[1];
        if (encoded.length > 349000)
          throw new Error("图片内容过于复杂，请选择较小图片");
        if (generation === imageGeneration.current) setImage(encoded);
      } finally {
        bitmap.close();
      }
    } catch (e) {
      if (generation === imageGeneration.current)
        setError(e instanceof Error ? e.message : "图片读取失败，原图未改变");
    }
  };
  return (
    <>
      <TaskBrowserSurface
        items={tasks.items.filter((t) => !!t.archivedAt === archiveView)}
        busy={busy}
        archiveView={archiveView}
        onArchiveViewChange={setArchiveView}
        taskHref={(id) =>
          `${hostRoot ? "/#" : ""}/tasks/${encodeURIComponent(id)}`
        }
        feedback={
          <>
            <TasksFeedback state={tasks} />
            {error && <p role="alert">{error}</p>}
            {notice && (
              <div role="status">
                {notice}{" "}
                {undo.length > 0 && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const remaining: typeof undo = [];
                        for (const item of undo) {
                          try {
                            await tasks.actions.update(item);
                          } catch {
                            remaining.push(item);
                          }
                        }
                        setUndo(remaining);
                        if (remaining.length)
                          throw new Error(
                            "部分任务已发生变化，未覆盖它们；请在列表中确认",
                          );
                        setNotice("已撤销");
                      })
                    }
                  >
                    撤销
                  </Button>
                )}
                <Button
                  appearance="ghost"
                  onClick={() => {
                    setNotice("");
                    setUndo([]);
                  }}
                >
                  关闭通知
                </Button>
              </div>
            )}
          </>
        }
        onNewTask={() => onNavigate("/tasks/new")}
        onRename={(id) => open("rename", id)}
        onThumbnail={(id) => open("thumbnail", id)}
        onPin={(id) => {
          const task = tasks.items.find((t) => t.id === id);
          if (task)
            void run(async () => {
              await update(task, { pinned: !task.pinnedAt });
              setNotice(task.pinnedAt ? "已取消 Pin" : "已置顶");
            });
        }}
        onArchive={(ids) => {
          setError("");
          setEdit({
            kind: "archive",
            tasks: tasks.items.filter((t) => ids.includes(t.id)),
            archived: !archiveView,
          });
        }}
      />
      {edit && (
        <ResourceDialog
          title={
            edit.kind === "rename"
              ? "修改任务名称"
              : edit.kind === "thumbnail"
                ? "修改缩略图"
                : edit.archived
                  ? "归档任务"
                  : "恢复任务"
          }
          busy={busy}
          onCancel={() => {
            imageGeneration.current++;
            setEdit(null);
            setError("");
          }}
          onSubmit={save}
          submitLabel={
            edit.kind === "archive" ? (edit.archived ? "归档" : "恢复") : "保存"
          }
        >
          {edit.kind === "rename" ? (
            <label>
              名称
              <TextInput
                type="text"
                aria-label="任务名称"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </label>
          ) : edit.kind === "thumbnail" ? (
            <>
              <input
                aria-label="选择缩略图"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void chooseImage(file);
                }}
              />
              {(image || (image === undefined && edit.task.thumbnail)) && (
                <img
                  style={{
                    maxHeight: 200,
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                  alt="缩略图预览"
                  src={
                    image
                      ? "data:image/png;base64," + image
                      : edit.task.thumbnail
                  }
                />
              )}
              <Button
                disabled={busy}
                onClick={() => {
                  imageGeneration.current++;
                  setImage(null);
                }}
              >
                恢复默认图标
              </Button>
              <p>图片仅用于任务展示；动图使用首帧。</p>
            </>
          ) : (
            <p>
              {edit.tasks.length}{" "}
              个任务。归档仅整理列表，不停止执行、不删除任务；可在“已归档”中恢复。
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </ResourceDialog>
      )}
    </>
  );
}
