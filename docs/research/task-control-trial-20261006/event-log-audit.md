# Event log 完整性：首轮只读检查

基线：[analysis.md](./analysis.md)。检查日期：2026-10-06；样本截至 Session seq 333、turn/end。只判断本轮已有证据，不修改被观察实例，不扩大到监控平台。

## 总结

DSH Session log 能还原消息、工具调用及完整写入提案，也包含 Host 注入的 task-context 快照（Plan digest、confirmed、stage、当前 Run 与近期成功回执）。后续逐条复核修正了首轮对这些快照覆盖范围的低估：部分关键状态不依赖当前可变文件即可恢复。确认为何未触发、请求拒绝的归属与留存请求的处置，仍需结合源码解释；尚不能仅凭日志独立还原所有管控决定。

两条异常链的详细证据与边界见 [event-log-chain-analysis.md](./event-log-chain-analysis.md)，可复核摘录见 [chain-evidence.json](./chain-evidence.json)。下表为范围矩阵，具体结论以逐条复核为准。

这不是要求所有过程 event-sourcing，也不能把缺失日志等同于动作未发生。

## 覆盖矩阵

| 链路 | 已有 | 缺失或无法可靠关联 | 本轮结论 |
|---|---|---|---|
| 用户消息接收→进入历史 | inbox/spliced 与 user/message 含相同 message id/rpcId；turn/start、step/start、时间戳 | 上下文装配及 Provider 查询的分段耗时；浏览器占位撤销/实际显示证据 | 可确认18秒服务端间隔，不能仅凭这些事件归责某个 Provider 或前端竞态 |
| 原生提问→回答 | tool/call 有 callId 和 questions.id；tool/result 有对应 callId 和 sourceEventSeqs | 回答与后续 jsonIR 的明确提交关联；普通回答内容不等于领域状态已提交 | 能还原选项与真实回答，不能直接判断哪个回答被哪次领域提交吸收 |
| jsonIR 写入→校验 | 写文件工具参数保留完整 content；tool/result 说明已保存；task-history 保留部分被读取校验后的版本/digest | 统一的提交ID、校验结果事件、前后digest与回答来源；原子写入不等于领域准入成功 | 可找回中间提案，但“通过校验”不能只信 Agent 叙述；需额外看快照或源码 |
| jsonIR→正式确认 | Session 的 Host 快照包含 digest/confirmed；task-confirmations 另有 answerId、confirmedAt | Host 直接 userQuestions.ask 的确认交互不是本轮普通 ask_user_question 工具事件；缺少确认请求创建/决定/提交事件及未触发原因 | 日志本身可证明 v1 已确认、v2 未确认的采样状态；无法完整重建确认生命周期 |
| control 提交→处理 | 工具参数中有请求ID/完整内容；Host 上下文快照和 accepted 回执文件都有请求ID、digest、操作与时间 | 写入不等于入队；拒绝只返回错误、未保存为同等持久回执；缺消费开始/覆盖/跳过事件和处理结果的因果关联 | 可由写入轨迹及代码解释覆盖；没有一个事件直接证明旧请求的处置结果 |
| Plan版本→Run→Delivery | 版本历史、确认摘要、plan-runs 的版本化运行对象、节点当前状态 | 运行内节点多次迁移并非完整事件序列；缺“当前版本改变”的结构化原因事件；本轮无 Delivery 样本 | 能恢复当前及旧版本运行快照，不能据此保证恢复每次中间迁移；Delivery 事件覆盖待另行样本验证 |
| Agent 解释→系统事实 | assistant/message 与 plugin 来源可区分 | 插件反馈常是自然语言，缺请求/规则/状态的结构化关联；没有真实等待对象的记录 | “等待确认落盘”只是 Agent 声明；本轮不存在已验证的待处理确认操作 |

## 可复核的样本

- seq 325 inbox inserted 与 seq 329 user/message 的 message id 都是 `8083b26c-25a9-4d93-a07e-d7a0e1f36898`，rpcId 都是 `dcdfcaa8-dfbd-4a16-bed4-1b33f9c9129c`。
- seq 291 的 tool/result 通过 sourceEventSeqs=[290] 关联提问，工具调用/结果还共享 callId。这条链已有可靠标识，不需重造。
- seq 285 与296 的完整工具参数保留了两个不同 control 请求；文件只保留最后内容。accepted 回执文件只包含 M-00 的两个成功请求。
- Session 中有51个 tool/call、51个 tool/result；这不等于51个领域操作均成功。写文件回执只保证文件写入。
- 原生正式确认由 `advanceTaskControl` 直接调用 userQuestions.ask；成功后 `flow.confirm` 写 task-confirmations，再通过插件消息继续 Agent。不是普通工具调用链。
- Plan Run 的节点状态保存在可替换 JSON 中，`readInner` 还可刷新状态后保存；文件读取接口本身不必然是纯读取，因此本轮审计直接读取文件，不调用这类 API。

## 最小后续检查范围（尚非实现方案）

1. 先定义领域“提交”的确切边界，再确定事件：提案保存、准入接受不能混为一件事。
2. 确认生命周期必须能关联具体 Plan digest 和真实用户决定；未触发也应有可定位原因，避免只能靠源码推断。
3. 控制请求的每次已接收提交应能找到唯一处置结果；日志不能替代对覆盖 bug 的修复。
4. Plan/Run 迁移记录应说明因果事件、版本及前后状态；禁止把 Agent 声明当迁移事实。
5. 只补关键耗时区间与客户端接收/显示边界的证据，避免声称现有18秒已精确归因。

事件 payload 可引用不可变快照，不需每次重复全文。是否需要额外事件、应由哪个 owner 写入，要在固定管控协议定义清楚后决定。当前检查不宣称精确全量重放已经可行。
