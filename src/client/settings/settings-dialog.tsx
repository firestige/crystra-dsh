import { DisplaySettings } from "./display-settings";
import { Icon, Typography } from "crystra-ui-core";
import { WorkflowSourceSettings } from "./workflow-source-settings";
import { useWorkflowSettings } from "./use-workflow-settings";
import { useEffect, useRef, useState } from "react";
import type { QueryRpc } from "../shared/revision-api";
import "./settings.css";
/** DSH-owned settings surface. Host RPC owns local filesystem access and persistence. */
export function SettingsDialog({
  rpc,
  onClose,
  onSaved,
}: {
  rpc: QueryRpc;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState<"workflow" | "display">("workflow");
  const dialog = useRef<HTMLDialogElement>(null);
  const model = useWorkflowSettings(rpc, onSaved);
  const { busy } = model;
  useEffect(() => {
    const element = dialog.current!;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element.showModal();
    return () => {
      element.close();
      queueMicrotask(() => {
        if (opener?.isConnected) opener.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="crystra-bi crystra-settings"
      data-crystra-theme="dark"
      aria-labelledby="crystra-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <nav className="crystra-settings-index" aria-label="设置分类">
        <Typography as="h2" id="crystra-settings-title" variant="section-title">
          设置
        </Typography>
        <div className="crystra-settings-nav-list">
          <button
            type="button"
            className="crystra-settings-nav-item"
            aria-current={section === "workflow" ? "page" : undefined}
            onClick={() => setSection("workflow")}
            aria-controls="workflow-settings-panel"
          >
            <Icon name="file" size="navigation" />
            工作流
          </button>
          <button
            type="button"
            className="crystra-settings-nav-item"
            aria-current={section === "display" ? "page" : undefined}
            aria-controls="display-settings-panel"
            onClick={() => setSection("display")}
          >
            <Icon name="activity" size="navigation" />
            显示
          </button>
        </div>
      </nav>
      <div className="crystra-settings-main">
        <header className="crystra-settings-header">
          <button
            type="button"
            className="crystra-settings-close"
            aria-label="关闭设置"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="x" size="navigation" />
          </button>
        </header>
        <div
          className="crystra-settings-content"
          id={
            section === "workflow"
              ? "workflow-settings-panel"
              : "display-settings-panel"
          }
        >
          {section === "workflow" ? (
            <WorkflowSourceSettings model={model} />
          ) : (
            <DisplaySettings />
          )}
        </div>
      </div>
    </dialog>
  );
}
