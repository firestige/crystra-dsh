import { Button, TextInput, SelectField, Typography } from "crystra-ui-core";
import type { Directory, useWorkflowSettings } from "./use-workflow-settings";
/** Settings content can be mounted in the DSH settings section independently of the dev modal. */
export function WorkflowSourceSettings({
  model,
}: {
  model: ReturnType<typeof useWorkflowSettings>;
}) {
  const { settings, busy, error, saved, update, save, reload } = model;
  return (
    <form
      className="crystra-workflow-settings"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <section aria-labelledby="workflow-source-title">
        <div className="crystra-settings-option">
          <div className="crystra-settings-option-copy">
            <Typography as="h3" id="workflow-source-title" variant="body">
              Workflow 来源
            </Typography>
            <Typography as="p" variant="description" tone="muted">
              绑定本机可编辑目录，用于发现和管理工作流。
            </Typography>
          </div>
          <Button
            disabled={!settings || busy || settings.directories.length >= 32}
            onClick={() =>
              update([
                ...(settings?.directories ?? []),
                { path: "", kind: "collection" },
              ])
            }
          >
            添加目录
          </Button>
        </div>
        <div className="crystra-source-list">
          {settings?.directories.map((directory, index) => (
            <div className="crystra-source-row" key={index}>
              <label className="crystra-source-path">
                <Typography as="span" variant="label">
                  目录路径
                </Typography>
                <TextInput
                  type="text"
                  aria-label={`目录路径 ${index + 1}`}
                  value={directory.path}
                  disabled={busy}
                  placeholder="/绝对路径/workflow-package"
                  onChange={(event) =>
                    update(
                      settings.directories.map((item, i) =>
                        i === index
                          ? { ...item, path: event.target.value }
                          : item,
                      ),
                    )
                  }
                  required
                />
              </label>
              <SelectField
                label="目录类型"
                aria-label={`目录类型 ${index + 1}`}
                value={directory.kind}
                disabled={busy}
                options={[
                  { value: "collection", label: "集合目录" },
                  { value: "package", label: "单个 Workflow 包" },
                ]}
                onChange={(event) =>
                  update(
                    settings.directories.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            kind: event.target.value as Directory["kind"],
                          }
                        : item,
                    ),
                  )
                }
              />
              <Button
                appearance="ghost"
                aria-label={`移除目录 ${index + 1}`}
                disabled={busy}
                onClick={() =>
                  update(settings.directories.filter((_, i) => i !== index))
                }
              >
                移除
              </Button>
            </div>
          ))}
        </div>
        {settings && !settings.directories.length && (
          <Typography as="p" variant="body" tone="muted">
            尚未绑定目录。添加来源后，工作流会显示在侧栏和目录页。
          </Typography>
        )}
      </section>
      <div className="crystra-settings-feedback" aria-live="polite">
        {busy && (
          <Typography as="p" variant="body" role="status" tone="muted">
            正在处理…
          </Typography>
        )}
        {error && (
          <Typography as="p" variant="body" role="alert" tone="error">
            {error}
          </Typography>
        )}
        {saved && (
          <Typography as="p" variant="body" role="status">
            来源设置已保存。
          </Typography>
        )}
      </div>
      <footer className="crystra-settings-actions">
        <Button
          appearance="ghost"
          disabled={busy}
          onClick={() => void reload()}
        >
          重新加载
        </Button>
        <Button appearance="solid" type="submit" disabled={!settings || busy}>
          保存
        </Button>
      </footer>
    </form>
  );
}
