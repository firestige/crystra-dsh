import { useState } from "react";
import { WorkflowBrowserSurface, type BrowserWorkflow } from "crystra-ui-core";
import { useWorkflows } from "./use-workflows";
import { WorkflowsFeedback } from "./workflow-views";
/** Same catalogue resource as Sidebar; the host resolves exact local revision links. */
export function WorkflowBrowser({
  onNavigate,
  hostRoot = false,
}: {
  onNavigate: (path: string) => void;
  hostRoot?: boolean;
}) {
  const workflows = useWorkflows(),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const path = (w: BrowserWorkflow, view = "studio") =>
    `/workflows/${encodeURIComponent(w.definitionId)}?${new URLSearchParams({ view, revision: w.revision })}`;
  return (
    <WorkflowBrowserSurface
      items={workflows.items}
      busy={workflows.phase === "loading"}
      workflowHref={(w) => (hostRoot ? "/#" : "") + path(w)}
      onOpen={(w, view) => onNavigate(path(w, view))}
      onCopyDirectory={(w) => {
        setError("");
        setNotice("");
        void navigator.clipboard.writeText(w.directory).then(
          () => setNotice("已复制本地路径"),
          () => setError("无法复制本地路径，请检查浏览器剪贴板权限"),
        );
      }}
      feedback={
        <>
          <WorkflowsFeedback state={workflows} />
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </>
      }
    />
  );
}
