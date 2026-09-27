# Task 讨论主题候选版

Task 的领域文件是持续事实来源。主题对应原生 DSH Session，承载一次讨论的聊天与输入草稿；新主题不复制旧聊天，也不创建第二个 Task。

## 交互

Chat 顶部显示 Plan 分组与当前主题。主题菜单支持切换、新建、改名；首次用户消息为主题生成标题。新建后为空白聊天，选中主题持久化，刷新后恢复。没有 Plan 时归于“需求与计划”。已有主题可继续讨论当前领域文件。

分组按 Plan revision 的契约值识别，不解析展示文案。首次形成 Plan 或出现新 revision 时，将当前主题关联到新组，不自动重建 Session；同一主题因此可能出现在多个版本分组中。版本分组是讨论索引，不是独立的文件快照。历史分组可回看和接续，Workbench 与后续操作仍读取当前文件；新主题只在当前 Plan 分组创建。

Agent 正在回复或等待交互时禁止切换/新建，避免同一 Task 的并发管控。运行完成通知发给当前选中主题。此规则不等于保证单个主题永不增长；用户通过新主题主动切断上下文。本候选不引入自动压缩或自动切换。

## 分层与身份

- Crystra-ui 的 DiscussionTopicBar 是受控展示组件，复用 Menu、ResourceDialog、Icon，无 RPC、Session 或文件访问。
- Crystra-dsh 的 hook 管理 RPC、轮询与原生 Session 恢复；host 管理 Task/主题成员关系和 Plan 分组。
- 元数据存储在 product-state/task-topics 下，按 taskId 哈希定位、串行原子写入，使用语义 ID 关联。
- 主题 Session 继承同一个 workspaceId，保留同一个 taskId 与领域文件目录。未知的主题 Session 不能通过普通 admission 创建 Task。
- 需求来源校验接受同一 Task 已登记主题的消息 ID，拒绝其他来源；不把旧主题聊天文本注入新主题。每次管控仍读取当前领域文件和正式运行状态。

Workflow 复用相同主题交互，以已绑定工作流身份分组，不按文件修订重新分组。已有隔离会话保留为初始主题，新主题创建在同一个工作流目录中，不继承旧聊天；选择与标题通过 product-state/workflow-topics 原子持久化。Task 与 Workflow 共用受控组件及 RPC/恢复 hook，领域归属与持久化由各自 host 管理。Chat 顶部占满一行，长标题以省略号截断。Task 内主题候选不改变 Execution 计划、Gate 或 Delivery 的业务契约。

## 验证范围

自动测试覆盖 Session 成员关系、持久化、版本关联、忙碌保护、不同 Task 隔离和跨主题来源校验。3085 浏览器验证新建空白主题、改名、刷新恢复、切回原主题及 Task 数量不变，不发送付费模型请求。真实模型长程执行中的使用体验仍需候选验收。
