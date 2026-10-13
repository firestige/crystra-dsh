# Squidex 受管共识操作：实现与验证

2026-10-12。代码位于 `src/backend/managed-consensus.js`、`squidex-client.js`，通过 `dsh-crystra` 组合进 DSH；默认入口现已切至后台插件。本轮没有修改 Squidex/DSH 核心，没有新增后台服务、调度器或前端。

## 归属与允许动作

Squidex 拥有正文、原生版本、草稿/发布生命周期和历史。Crystra 拥有候选授权、业务操作收据、精确发布引用和装载绑定。DSH 提供原生工具执行、agent loop 和 JSONL 持久化。正文是否正确仍由用户/agent 负责。

| 动作 | 可信主体 | 约束 |
| --- | --- | --- |
| propose / modify | Proposer | 显式对象 UUID；修改必须提供标准 quoted 数字基线；ContentData 是正文，不是 HTTP 参数 |
| draft | Proposer | 只能从没有在途草稿的 Published 创建新草稿；精确基线，不允许借宿主 Owner 凭据触碰 Archived |
| submit / returnDraft | Proposer | 原生工作流负责 Draft→Ready；returnDraft 只允许从 Ready 退回，不开放任意状态变更 |
| authorize / revoke | Publisher，宿主接口 | 授权绑定主体、对象、候选版本、完整 ContentData hash、理由；授权及撤销持久保存 |
| publish | Publisher | 必须使用本主体未撤销的授权；再次检查精确候选，以原基线提交；授权只能绑定一个 operation ID |
| withdraw | Publisher | 按原生 CAS 转 Archived；已知撤销/未决撤销阻止旧绑定 |
| restore | Publisher | 读取精确历史发布正文，创建**新 UUID 的 Draft 候选**，写 reason/supersedes；不恢复旧批准，不承诺跨对象原子性 |

主体由宿主配置以及 `identifyAgent(actualAgent)` 映射提供；工具 JSON 不能自报角色或主体。CMS 写 token 留在宿主闭包内。工具只暴露有限动作，不透传路径、headers、bulk、upsert 或 `doNotValidateWorkflow`。测试中的 U1/A1 是可信测试主体标签，CMS actor 仍是原生 client 身份，不冒充已认证真人。

`crystra_consensus_command` 经 DSH 原生工具调用；授权签发/撤销由宿主调用 `ctx.crystraConsensus.ready` 返回的 service，当前没有用户审批 UI。宿主必须只把有实际权限的 agent 映射为 Publisher；agent 的文字自述不构成权限。

## 操作结果与恢复

每个动作带 UUID operationId。收据绑定 `{ subject, command }` 的 hash；同 ID 改意图拒绝。同 ID 的本地并发串行处理，已完成结果直接回放。另一个写进程由 DSH 原生单写者所有权拒绝。

状态：`prepared`（意图持久化，尚未进入发送阶段）、`pending`（发送前先持久化不确定性）、`confirmed_success`、`confirmed_rejected`。网络中断、5xx、异常 2xx 返回和不可归因的结果保留 Pending，不猜成功，也不盲重发。明确的 400/401/403/404/409/412/422 保存拒绝结果。持久写入失败后 manager 停止继续操作，必须重新从持久事实打开。

发布成功还要求原生发布事件、历史版本、actor、ContentData hash 精确对应。已持久 HTTP 成功响应但历史投影尚不可见时，`reconcile` 可仅查询补齐引用；无持久响应时，不用“当前正文一样”推断原业务操作成功。Pending 不自动变成失败或用新授权重试。

前置非法输入/主体/授权不匹配直接抛出拒绝，不发送 CMS 写请求；经 agent 工具调用时失败记录留在 DSH 原生会话。宿主直接调用者需要保留其拒绝返回，当前没有为所有无效宿主调用另建审计服务。

## 装载与卸载

manifest 固定 `scope/references`。每个引用使用原生发布事件身份，而非普通 GET 的聚合 version。可显式声明：

- `requiredIds`：已知必须存在的共识集合，缺项拒绝。
- `allowedScopes`：允许的正文 scope 集合，错范围拒绝。
- 正文 `dependencies.iv`：精确发布引用数组，缺失或错版依赖拒绝。
- `requiredOperations`：本次决策明确依赖的成功操作；Pending/拒绝/缺失均阻止装载，不全局阻塞无关任务。

这些要求由宿主明确给定，不从任务自然语言自动推导。不能把“没有提供期望集合”解释为代码已经证明共识完整。

每次 DSH prompt 装配重新核验在线效力和固定历史快照。普通新草稿/新发布不追改旧任务；已撤销旧版本即使之后重新发布也不能偷偷复活。两个任务的绑定和实际模型输入按各自会话隔离。

`controller.setManifest(manifestOrNull, { expectedRevision, reason })` 提供显式装载/换版/卸载：比较绑定修订，保存旧绑定和理由。存在 active/pending 承诺时拒绝换绑定，不能借卸载丢责任。全部卸载会暂停后续请求；装载失败保留原绑定，恢复不隐式换版。

## 接入示例

```js
import * as backend from 'dsh-crystra';
await ctx.plugin(backend, {
  consensus: {
    namespace: 'project-p',
    squidex: {
      baseUrl: 'http://127.0.0.1:1946',
      app: 'project-consensus',
      schema: 'agreements',
      managementToken: async () => hostCredentials.management,
      consumerToken: async () => hostCredentials.consumer,
    },
    principals: { agentP: 'Proposer', ownerP: 'Publisher' },
    identifyAgent: agent => hostIdentityMap.get(agent.session.id),
  },
});
const consensus = await ctx.crystraConsensus.ready;
// 由宿主显式确认候选，不能把 agent 自述当确认。
const grantId = await consensus.authorize('ownerP', {
  id, base: '"2"', dataHash, reason: '确认这个具体候选',
});
// 之后使用带 operationId 的 publish 动作；不提供通用 CMS 写 API。
```

`resolveConsensus` 自定义端口仍为上一增量的宿主扩展入口；使用上述 consensus 配置时应让 manager 负责解析，不能另配绕过其 Pending/撤销检查的 resolver。

## 验证矩阵与边界

固定环境：Squidex 7.24.0、PostgreSQL 18.6、PostGIS 3.6.4、DSH 0.1.5-rc.2。真实 CMS/数据库/官方 DSH；模型仅使用离线固定 adapter，零真实模型调用费用。

| 既定场景 | 验证 |
| --- | --- |
| Q1 发布身份、草稿隔离、旧任务快照 | 原生历史/event/actor/hash 对应；新增草稿及普通 v2 发布后 v1 仍精确装载；伪 event 拒绝 |
| Q2 CAS 与修改失败 | 两个真实并发写 200/412；旧基线不刷新；被拒绝正文没有覆盖成功方 |
| Q2 候选/主体/授权 | Ready 不可原地编辑；退回后 A→B 使旧授权失效；错误主体拒绝；撤销授权重建宿主后仍拒绝 |
| Q2 权限接缝 | Reader 不能修改；真实 native bulk 的 bypass flag 仍无法用只读凭据写入；Proposer 不能利用 Owner 代理把 Archived 退回草稿 |
| Q2 历史恢复 | 已撤销历史正文可恢复为新 Draft，并保留 supersedes；不自动生效 |
| Q3 operationId/收据 | 同 ID 同意图回放；换意图拒绝；已确认发布的版本不因回放再增加；授权/收据跨宿主持久恢复 |
| Q3 四个 SIGKILL 位置 | prepared 可继续；发送前 Pending 和 CMS 成功响应未保存均保持 Pending、不重写；持久收据后直接回放 |
| Q3 真实 HTTP 丢响应 | relay 已收到 CMS 200，向调用者断开连接；CMS 已 Published，而业务操作仍诚实 Pending |
| Q4 错误装载 | 必需项缺失、错 scope、草稿伪装生效版在模型前拒绝；动态依赖、Pending、结构错误、写入失败另有快速测试 |
| Q4 卸载/重装载 | 修订 CAS，旧绑定历史，活动责任不丢失；卸载后的实际 DSH 模型调用数不增加 |
| Q4 完整 DSH 进程故障 | 声明落盘后 SIGKILL，新进程 resume；原共识进入实际 adapter 输入，原承诺闭合，声明/动作没有重复 |
| Q4 并发任务 | 两个真实 DSH one-shot 同时装载不同 scope，adapter 输入没有串入对方正文 |
| Q1/Q4 CMS 故障 | 停止 CMS 时读取失败；重启后精确读回，数据库 StartedAt 未变化 |

本轮全仓 `npm test`：328/328；其中后台快速测试35项。真实服务集成12组全部通过；归档权限拒绝另有定向复核，明确检查权限拒绝原因。日志见 `full-tests.log`、`squidex-live.log`、`squidex-withdrawal-recheck.log`。

本地复现：

```sh
docker compose -f test/integration/squidex.compose.yml up -d --wait
npm run test:squidex
docker compose -f test/integration/squidex.compose.yml down
```

此文件是固定镜像 digest 的测试夹具，使用 localhost:1946 和固定实验项目名；不要与另一个正在使用相同端口/项目名的实验并行启停。使用已有镜像环境时已实际验证相同配置和 digest；本轮没有验证全新机器拉取镜像和清洁安装。fixture 设置独立 app/schema/workflow，凭据仅留进程内存，测试角色拒绝在可信接入层与只读 CMS client 两侧分别验证。日志与结构化结果保存在 `artifacts/backend-rebuild/`，不记录 token。夹具创建独立随机 app，不覆盖既有研究对象；服务生命周期由本轮宿主管理，数据库卷保留。本轮验证后已关闭并移除这两个实验容器及其网络，未删除数据卷、未停止其他服务。

未声称覆盖：任意崩溃窗口、数据库掉电、跨 CMS/收据事务、exactly-once、历史无限分页、长期性能、全部第三方 prompt 插件组合/complete prompt 覆盖、真实模型遵守率及内容正确性。没有持久响应的 Pending 目前保留给宿主进一步处理，不提供“强行认定成功”或自动清理。官方压缩/所有装配时序窗口仍有既有 spike 依据，本轮未逐一重新执行，不能标为本轮覆盖。

反思、结晶及默认 bundle/清洁安装验收仍待后续增量。


后续已完成当前macOS宿主上的独立清洁消费环境验收：从安装包启动，Squidex/PostgreSQL使用全新数据卷，12项管理/异常恢复场景全部通过，测试容器及卷已删除。此前“未验证清洁安装”是历史状态；不将本次等同于全新操作系统拉取镜像测试。见 [清洁安装验收](clean-install.md)。
