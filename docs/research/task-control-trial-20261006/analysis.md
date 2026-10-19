# Crystra Host 管控试验：问题分析与日志检查基线

更新时间：2026-10-06。性质：临时共享记忆、分析材料，不是已批准的实现方案。

## 阅读入口与范围

核心判断：**问题不只是 Agent 跑偏，而是一些本应由版本化代码保证的流程责任，仍依赖 Agent 自觉遵守。同时也存在真实的规划信息缺口，不能全部靠增加限制解决。**

本轮用户因流程卡住而宣布试验结束；定时观察 `3085-task` 已暂停。保持现场：不向被观察 Agent 发消息，不代答、确认、推进、重启，不修改运行中的任务文件、配置或产品实现。后续只读分析；本文及分析附件可更新。super project 的引用不更新。

- 实例：`/Users/firestige/.local/share/crystra-joint-validation/20261003-main-d463959`
- 已安装 main：`ce0d28ed778b14913481b2ab9db9b932698e534d`（PR #47 合并）
- Task：`task-4e9b5b55d318e3a1e0b7b05bcad9e1c05dabc040c28a54acaf69146c4b1b48e8`
- Session：`session-20d53bb1-889c-4296-9679-d223f8b115e4`
- workspace：`/Users/firestige/Projects/crystra-test`
- 需求/计划：workspace 下 `.crystra/tasks/<Task>/`
- Session log：实例 `dsh/sessions/--Users-firestige-Projects-crystra-test--/<Session>/session.v3.jsonl.zstd`
- Host 状态：实例 `state/conversations/` 下 task-history、task-confirmations、control-receipts、plan-runs。

本轮只到 Host 管控与 Plan Run；没有观察到 start-wave 或 Delivery 启动，不能据此评价 Workflow Runtime 的执行可靠性。本文结论基于本轮已读取事件，非持续实时状态。

## 已达成的架构边界

1. 模型必须掌握地图，能够发现新问题、修改任务 Plan 和选择路径；业务路径不应全部预定义。
2. Crystra 自身的管控协议、确认规则和状态转换由版本化代码维护，不由 Agent 动态修补。
3. Agent 提供语义判断和 jsonIR；宿主接收真实回答，代码验证、提交、投影并决定是否允许推进。
4. barrier 保证本次理解和地图更新已提交，不裁定下一步必须走某条预设业务路线。
5. 先区分 bug 与可预见错误：bug 应让坏状态不可达；正常可预见失败才定义恢复流程。拒绝非法提案要求修正，不等于让 Agent 修改系统流程。
6. 不引入 Jev；仅讨论过理念相近，用户不要求借鉴或集成。

## 问题清单

| ID | 已观察事实 | 能力归属与初步判断 |
|---|---|---|
| P01 | 连续问答未逐次写 jsonIR；有 answer 的条目仍 pending | Host 缺少回答→提案→提交 barrier；不能依赖 Agent 自觉同步 |
| P02 | Chat 手写编号出现同主题重复编号，预算/轮次与问题数不一致 | Host/UI 应区分稳定问题 ID、调用次数、已解决数、估计预算；不应混作一个计数 |
| P03 | planningCapabilities 只有 Provider 目录和 Workflow 来源；Agent 查压缩包再转向 Studio | Execution 缺少执行包规划契约查询；Host 缺少对应只读工具 |
| P04 | 模型看见 bash/write/子 Agent 等工具，调用后才被职责 guard 拒绝 | DSH/Host 工具暴露与可用权限不一致；统一拒绝文案不足以区分职责与沙箱 |
| P05 | A-00 探测工具链却无执行者；W-01 又以前者产出为前提 | Plan 结构校验未表达/验证动作执行者、能力和证据产出者；不能把语义合理性全交给结构校验 |
| P06 | A-00 check-entry 未消费即被 assess-node 覆盖，后者 NODE_ENTRY_UNCHECKED | control.json 是单个可覆盖文件；Host 到 turn-stopping 才消费，没有每次提交的确定结果保证 |
| P07 | v2 requestConfirmation=true，但 questions 非空，确认卡片未触发且无明确阻塞反馈 | Host 确认协议存在静默停滞；字段语义需先明确，不武断认定所有此类组合必须非法 |
| P08 | 用户“确认 v2”已入历史，正式确认仍是 v1；Agent 猜测异步落盘并等待通知 | 普通聊天确认意图与绑定 digest 的正式确认未衔接；Agent 对系统事实作无依据解释 |
| P09 | ready 展示为执行，尚无 Delivery；写 v2 后页面回到计划 | UI 混淆获准推进、Plan Run 与实际 Delivery；新草案替换当前视图不等于停止旧 Delivery |
| P10 | 消息接收到进入历史间隔约18秒 | DSH 在上下文准备后才写 user/message；Host 同步串行查询 Provider 目录。各步骤具体耗时未测，前端占位空档尚待事件证据 |

Agent 自身错误也需保留：把职责拒绝当可提权错误；把没有探测证据仍判 satisfied 提供给用户选择；把系统回执误称用户回复；没有实际待处理确认却承诺等待落盘通知。

## 已核实的关键事件

以下 seq 均属于上述 Session；时间采用日志 UTC。

- seq 158/168：bash 只是 tar -tzf 查看包内容，均被拒绝。不是创建工程/写 App；第二次是错误提权重试。
- seq 214：写 plan-v1，含 A-00→W-01 的前置矛盾。
- 17:19:55：v1 digest `aa2cc70fffb5c8675030539b043cd9e2433a222c33e9817304332ff98071bd22` 正式确认。
- seq 261/273：M-00 check-entry、assess-node；两条 accepted 回执，M-00 completed。
- seq 285：写 A-00 check-entry；接着原生提问 seq 290，回答 seq 291。
- seq 296：尚未消费的 check-entry 被 assess-node 写入覆盖；后续收到 NODE_ENTRY_UNCHECKED。
- seq 307：再次写 check-entry；接着提问 seq 312，用户 seq 313 选择改计划。
- seq 317：写 plan-v2；17:29:40 记录 v2 digest `ecd0e86bdfa3754286b780cf67d1c8fb6411c12967f78bae87766f17a50a161b`，未确认。旧 Plan Run 保留，Wave 均 pending，无 Delivery。
- seq 325/326：17:33:19.063/.064 用户输入入队、turn/start。
- seq 329：17:33:37.074 用户“确认 v2”入历史；距收到消息约18秒。
- seq 331：Agent 错误猜测确认延迟落盘，提出等待或尝试必然失败的推进。
- seq 333：17:34:08.523 turn/end completed。当前已检查的 v2 有两个顶层 questions，grilling 条目全 answered；确认门槛被顶层 questions 阻塞。

成功守住的边界：禁用 shell 未执行；v1 确认未沿用到 v2；未满足进入检查的评估被拒绝；未凭空启动 Delivery。

## 代码定位

路径相对 `/Users/firestige/Projects/wsr-dsh`，除注明 Execution 的文件。

- `src/host/native-task-control.js`：prompt 组装、工具 guard、文件写入、turn-stopping。
- `src/host/task-chat-control.js`：taskContextFor、确认门槛、控制请求消费及续行。
- `src/host/task-control-request.js`：读取当前 control.json、成功回执、失败仅返回错误。
- `src/host/task-flow.js`：快照历史、digest 确认、requirements/planning/ready 推导。
- `src/host/task-plan-run.js`：运行历史、当前 digest 匹配、节点条件与来源检查。
- `src/host/task-workbench-contract.js`：问题历史、图结构和 readiness 校验。
- `src/client/task-workbench/task-projection.js`：地图计数与 systemFocus。
- `modules/studio/src/workflows/local-workflow-query.js`：编辑态目录，不等同可执行包校验。
- Execution `src/bootstrap/production.ts`：planningCapabilities 暴露范围。
- Execution `src/providers/provider.ts`：模型目录串行查询；Copilot 查询有客户端启动/认证/关闭。
- DSH `dsh-agent-loop/lib/index.js`：turn/start→preStep/assemble→step→user/message。
- DSH `dsh-api-session-controller/lib/client.js`：submission echo 可因 inbox 或 durable event 退休，浏览器竞态未证实。

## 错误分类与待定判断

- 系统 bug 候选：请求静默覆盖、确认没有合法推进/明确阻塞结果、状态展示含混、消息回显空档。
- 可预见输入错误：过期/矛盾 jsonIR、缺字段、错误节点顺序、越职责工具请求。应边界拒绝、关联请求、保留有效状态。
- 能力缺口：包契约查询、动作执行能力关联、请求状态权威反馈。
- 待定：requestConfirmation 是“现在提交”还是“满足条件后希望提交”；语义不同意味着不同校验规则。不可先做恢复通道掩盖定义缺失。
- 先确定回答提交协议、控制请求协议、计划确认状态机，再做实现决策。没有批准修改运行实例或实现这些修复。

## 下一步：event log 完整性审计

用户明确收窄范围：不是建监控平台/诊断 UI，而是验证 event log 能否还原现场及关键迁移原因。

逐条检查五条链：回答→jsonIR；jsonIR→正式确认；控制请求→处理结果；Plan→Plan Run→Delivery；消息接收→历史展示。

检查每条链是否有事件身份、因果关联、顺序/时间、主体、对象版本、前后状态、拒绝或未触发原因，以及可还原输入或不可变快照引用。结果分为“已有 / 缺失 / 无法关联”。

不要把 Agent 叙述当系统事实；不要把现存可变文件当完整日志；不要预先声称全量日志重放可行。只输出证据和最小事件缺口，不修改运行现场。

首轮日志检查结果已另存：[event-log-audit.md](./event-log-audit.md)。后续从该矩阵继续，不需重新扫描整段会话。

两条异常链已逐条复核：[event-log-chain-analysis.md](./event-log-chain-analysis.md)。关键修正：Session 已有 Host 状态快照；P06 的首次请求覆盖与重试请求因计划变化而留存是不同情况。详细文档区分日志直接事实、代码解释与现场文件佐证，保留剩余未验证范围。
