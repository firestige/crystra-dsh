import { useState, useEffect, type ReactNode } from "react";
import { MarkdownText } from "@deepseek-ai/dsh-client-ui-primitives";
import {
  WorkflowStudioPage,
  WorkflowMapWorkbench,
  WorkflowResourceBrowser,
  Tabs,
  Card,
  Button,
} from "crystra-ui-core";
import { useWorkflowStudio } from "./use-workflow-studio";
const labels = {
  code: { copyLabel: "复制", copiedLabel: "已复制" },
  footnotes: "脚注",
};
export function HostWorkflowStudio({
  definitionId,
  revision,
  view = "studio",
  chat,
  onNavigate,
  onQuote,
}: {
  definitionId: string;
  revision?: string;
  view?: string;
  chat: ReactNode;
  onNavigate: (path: string) => void;
  onQuote?: (text: string) => void;
}) {
  const {
    source,
    error,
    projection,
    workspace,
    save,
    mutate,
    setDirty,
    refresh,
  } = useWorkflowStudio(definitionId, revision);
  const [quoteError, setQuoteError] = useState("");
  const [navigation, setNavigation] = useState<HTMLDivElement | null>(null),
    [header, setHeader] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!source) return;
    const hash = window.location.hash.startsWith("#/");
    const current = new URL(
      hash
        ? window.location.hash.slice(1)
        : window.location.pathname + window.location.search,
      window.location.origin,
    );
    if (current.pathname !== "/workflows/" + encodeURIComponent(definitionId))
      return;
    current.searchParams.set("revision", source.revision);
    window.history.replaceState(
      null,
      "",
      hash
        ? window.location.pathname +
            window.location.search +
            "#" +
            current.pathname +
            current.search
        : current.pathname + current.search,
    );
  }, [source?.revision, definitionId]);
  const quote = (text: string) => {
    try {
      if (!onQuote) throw Error("Chat 引用尚未连接");
      onQuote(
        `工作流 ${definitionId}\n本地目录：${source?.directory || ""}\n${text}`,
      );
    } catch (e) {
      setQuoteError((e as Error).message);
    }
  };
  const changeTab = (next: string) => {
    const url = new URL(
      window.location.hash.startsWith("#/")
        ? window.location.hash.slice(1)
        : window.location.pathname + window.location.search,
      window.location.origin,
    );
    url.searchParams.set("view", next);
    if (source) url.searchParams.set("revision", source.revision);
    onNavigate(url.pathname + url.search);
  };
  return (
    <WorkflowStudioPage
      layout="actions"
      title={source?.title || definitionId}
      description={source ? `${source.version} · 本地工作流` : "读取工作流"}
      navigation={<div ref={setNavigation} />}
      context={<div ref={setHeader} style={{ width: "100%" }} />}
      chat={chat}
      bench={
        <div className="crystra-workflow-bench">
          <Tabs
            aria-label="工作流工作面"
            appearance="underline"
            value={view}
            onValueChange={changeTab}
            navigationContainer={navigation}
            items={[
              { value: "studio", label: "流程设计", panel: null },
              { value: "resources", label: "资源配置", panel: null },
              { value: "crystallization", label: "结晶分析", panel: null },
            ]}
          />
          {(error || quoteError) && (
            <p role="alert">
              {source ? "保留上次有效内容。" : ""}
              {error || quoteError}
              <Button
                onClick={() => {
                  setQuoteError("");
                  void refresh();
                }}
              >
                重试
              </Button>
            </p>
          )}
          {projection && "error" in projection ? (
            <p role="alert">{projection.error}</p>
          ) : projection ? (
            <>
              <section
                hidden={view === "resources"}
                className="crystra-workflow-map"
              >
                <WorkflowMapWorkbench
                  workflow={projection.workflow}
                  mode={view}
                  headerContainer={header}
                  onQuote={quote}
                  crystallization={
                    <section
                      className="crystal-workspace"
                      data-section-id="workflow-crystallization"
                    >
                      <Card heading="暂无结晶分析">
                        <p>当前工作流尚无已接入的结晶方案与实测数据。</p>
                      </Card>
                    </section>
                  }
                />
              </section>
              <section
                hidden={view !== "resources"}
                className="crystra-workflow-resources"
              >
                <WorkflowResourceBrowser
                  workspace={workspace}
                  initialPath={
                    workspace?.catalog?.find(resource=>resource.resourceKind==="role-prompt")?.path
                  }
                  onQuote={quote}
                  onSave={save}
                  onMutation={mutate}
                  onDirtyChange={setDirty}
                  renderMarkdown={(text) => (
                    <MarkdownText text={text} labels={labels} />
                  )}
                  saveNotice="已保存本地文件；执行准入与发布校验仍由 Workflow 管理"
                  sourceNotice="文件来自已绑定的本地工作流目录。编辑和资源管理会写入源文件；改名保留资源身份，删除会检查引用。"
                />
              </section>
            </>
          ) : (
            !error && <p role="status">正在读取工作流…</p>
          )}
        </div>
      }
    />
  );
}
