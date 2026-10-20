# Crystra 后台插件重建起点

> 本文件保留开发起点与各轮增量，以下“当前”“尚未实现”和测试数量均须按所在阶段理解。新接手请先读 [项目方向](../project-direction.md) 与 [当前状态](../current-state.md)，不要把历史未完成项直接作为待办。

2026-10-12。分支 `codex/backend-rebuild`，起点为 `origin/main` 的 `ce0d28ed778b14913481b2ab9db9b932698e534d`。

## 当前安装入口

2026-10-13：已补齐 [DSH 原生配置和自动接入](native-usage.md)，并通过 [原生安装、Web 恢复及负向验收](native-installation-results.md)。

旧套件已删除，默认 `dsh-crystra` 直接加载后台插件；无旧 client/backend 子路径兼容入口。后台全部回归和新的安装验收见 [清洁安装报告](clean-install.md)。下文各增量保留当时的验证边界，不能将历史未完成项当成当前状态。

## 已确认范围

同一仓库内按职责拆分共识管理、承诺与 Barrier、反思、结晶及 DSH 适配；先交付一个 DSH 后台插件。DSH 保持 agent loop、模型、工具执行和会话的所有权。以目标为准复用旧代码，不沿用旧 runtime 作为架构约束。

本轮不开发工作台、JSONIR、前端通信、远端服务、通用 workflow 引擎或新的调度器。

共识管理负责身份、效力、版本、范围和操作的可靠执行，不保证正文正确。Barrier 核验可检查的承诺是否实际兑现，公开结果 GO/NO_GO，允许保留依据和责任去向的修订；它不是 reviewer。反思独立研究核心代码正确性、鲁棒性和性能。结晶由机制主动发现重复机会并推进，agent 决定接受、暂缓及具体方案；先对拍准入，适用条件失效时退回探索，新版本重新验证。

## 首轮开发目标

将共识与 Barrier 接成可安装、可恢复的后台插件：受管共识操作、精确有效引用和装载、持久授权与操作结果、有限明确的承诺检查、自动关联执行依据、保留修订责任、从持久事实恢复。

先验收：未执行不得闭合；旧执行依据不得兑现新版本；合法修订不得丢责任；在已有明确持久边界重启后可接续，已持久执行不被无故重复。空或不支持的检查不得记为核验成功。不承诺任意崩溃窗口、exactly-once 或内容正确性。

本文件记录开发起点，不代表实现完成。开始改代码前核对依赖闭包与适用版本；本轮 worktree 创建时没有升级依赖、安装服务或运行产品测试。

## 研究依据

研究工作区：`/Users/firestige/.codex/.chatgpt-projects/g-p-6ac5999e22b0819186235fabbec71685`。

- `docs/decisions/crystra-positioning-baseline.md`
- `docs/decisions/consensus-state-selection.md`
- `outputs/crystra-I10-automatic-basis/REPORT.md`
- `outputs/crystra-squidex-spikes/REPORT.md`
- `outputs/crystra-S2-state/REPORT.md`
- `outputs/crystra-S4-barrier-version/REPORT.md`
- `outputs/crystra-crystallization-trigger/REPORT.md`
- `outputs/crystra-crystallization-fast/REPORT.md`

反思旧实验只验证受限候选方案的写入前检查，不能作为后来确定的核心代码质量反思闭环已完成的证据。结晶主动发现与失效回退分别已有实验，正式插件中的组合与恢复仍待实现和验证。

## 第一增量：独立后台入口（历史记录）

当时实现位置：`src/backend/`，尚使用独立子路径。现已迁移为默认 `dsh-crystra` 入口，旧套件及旧入口已移除；下表保留首轮验证边界，最新结果见清洁安装报告。

| 已实现 | 当前边界 |
| --- | --- |
| 显式 scope 与精确发布引用装载 | 通过可信 host resolver 装载；当前测试没有启动 Squidex，不代表正式 CMS 接口已接好 |
| 发布身份、正文 hash、有效性核验 | resolver 负责从权威服务取得并认证发布记录；agent 不能提交记录替代 resolver |
| 每次 prompt 装配加载共识和当前承诺/未完成责任 | 绑定由 host 明确提供；不做自然语言相关性判断；尚未验证 complete prompt 覆盖和所有其他 prompt 插件组合 |
| 承诺编译为工具完成/结构化结果相等检查 | 不验证正文正确性、读取理解程度或泛化推论；没有匹配参数的动作暂不支持 |
| 原生 tool/call、tool/result 自动关联 | 当前适配 DSH 0.1.5-rc.2 native tools；PTC 子调用等事件形态未接入 |
| next-step 和 turn-stopping 检查 | GO/NO_GO 不含修复建议；只保证已声明且支持的承诺，不保证 agent 的所有行为都被声明 |
| 基于已完成/未完成事实的有限拆分 | 记录理由与依据并保留责任；只支持 retain/defer，不自动证明理由充分，也不支持任意改写承诺或递归拆分继承责任 |
| DSH JSONL 持久化、写入失败停止修改、单写者、恢复 | 已验证完成边界后重新创建 host/恢复 worker；未覆盖 SIGKILL/任意崩溃窗口、exactly-once、长期可靠性 |

### 接入方式

Host 在 DSH 服务就绪后加载 backend 插件，显式把选定 agent 纳入管理。未 attach 的 agent 不受影响。

```js
import * as backend from 'dsh-crystra';

await ctx.plugin(backend, { resolveConsensus });
let attachment;
const worker = await ctx.agents.create({
  sessionId,
  agentOptions,
  setup(ac, agent) {
    attachment = ctx.crystraBackend.attach(ac, agent, manifest);
    // 工具仍由 DSH/宿主插件提供。
  },
});
await attachment.ready;
// 交给 DSH 正常执行。关闭时先停止 worker，再关闭 attachment。
await worker.dispose();
await attachment.close();
```

`manifest = { scope, references }`。每个 reference 包含 `id, published_version, publication_event_id, actor, data_hash`。`resolveConsensus(reference)` 返回 `{ reference, data, effective: true }`；身份/内容不一致、撤销、查询失败均不能继续核验。普通发布不应静默替换已绑定旧版本；恢复时不得偷偷换 manifest。主动升级/卸载共识的受管操作尚未实现。

工具：`crystra_declare_step`、`crystra_revise_step`、`crystra_step_state`。前两个公开返回 GO/NO_GO，后者返回当前承诺和未完成责任。修订采用明确的 retain/defer 分区；后继声明用 `inherits` 引用 pending id，必须继承原断言。原生会话提供实际工具执行依据，独立 Crystra journal 保存承诺、修订及闭合记录。无需 agent 或用户手填 receipt。

### 本轮验证

`npm run test:backend`：18 项通过。包括实际 DSH loop、实际 Node 测试子进程、JSONL 重建 host 后恢复、竞争写者拒绝。使用固定离线 LLM adapter，零真实模型请求；证明的是机制接入，不能据此声称自主遵守率或长期效果已验证。

全仓最终 `npm test`：311/311 通过（含新增 18 项）。系统重启后重新执行仍全部通过，日志保存在本 worktree 的 `artifacts/backend-rebuild/full-tests.log`。`git diff --check` 通过。

首次验证复用共享依赖符号链接，引起旧 UI metafile 路径断言差异；全量运行还出现一次旧 intake 用例超时。随后串行复查发现旧损坏制品测试复制了 `.crystra-inputs` 符号链接，再写入样本，意外改动共享执行制品。已从本地独立副本按配置锁定 SHA256 恢复原 checkout 制品，并把本 worktree 的 node_modules 与制品改为独立副本。最终全量重跑全部通过，未修改旧测试或放宽断言。

开发依赖沿用已安装的 DSH 0.1.5-rc.2，未升级版本；独立副本测试不等同于清洁安装或发行验收。

### 第二增量：受管共识操作

Squidex HTTP 适配、持久候选授权/撤销、操作收据/Pending、精确发布引用、显式装载/换版/卸载已接入。采用真实服务验证 CAS 冲突、权限/授权漂移、丢响应、指定 SIGKILL 边界、完整 DSH 进程恢复与并发装载。全仓328项、真实服务集成12组通过，归档权限拒绝另有定向复核。详见 [实现与场景矩阵](managed-consensus.md)。上面的第一增量表格和数字保留为当时的边界，不代表当前全部能力。

### 第三增量：独立反思机制

已接入独立 DSH 研究会话、主 agent 按需请求、源码版本绑定、实际回归/性能实验收据、结构化报告和恢复后读取。与 Barrier 的 GO/NO_GO 路径分离。新增9项、全仓337项通过；用户授权后已完成真实 gpt-6-astra 反思：实际读取4个文件、运行两项实验并提出具体建议，结果和收据可恢复；真实模型脚本清洁退出仍待排查。详见 [反思接入与验证边界](reflection.md)。

### 尚未接入

- 更多重启边界、无指导模型的自主声明/修订行为以及其他插件组合验证。
- 反思：发现项的进一步回归/修复、真实模型脚本驻留原因、长期研究质量；自动生成新实验的能力尚未实现。
- 结晶：复用已验证的主动探测、对拍准入与失效回退机制，正式接入 DSH 事件和持久状态。
- 默认 bundle 替换和清洁安装验收。工作台、JSONIR、前端通信继续不在当前范围。

### 反思发现后续

重叠承诺匹配误拦与真实模型进程驻留已修复。其他项追加边界、原生生产者和性能测试；新增确认的跨 step 重复 callId 结果借用问题保持独立失败回归，尚未修复。详见 [定向修复与证据](reflection-follow-up.md)。

后续：重复调用 ID 关联已修复、异常历史嵌套已增加前置拒绝，调查回归已纳入日常测试。当前结果见 [Barrier 后续修复](barrier-follow-up.md)。

剩余疑点并行观察已完成，新增确认异常 payload 会使核验抛错并持续阻塞闭合，尚未修复。全仓563项通过包含对缺陷现状的观察测试，不代表缺陷消除。详见 [实验结果汇总](barrier-spike-results.md)。

后续两项已修复：异常比较受控拒绝并支持正常后继闭合，等价拆分允许提议约束的合法最大分配。全仓568项通过。详见 [修复及回归证据](payload-split-fix.md)；上文未修复状态保留为当时实验记录。

### 第四增量：结晶后台闭环

已接入主动重复探测、独立 DSH 评估 agent、宿主构建工具、逆序历史对拍、冻结版本准入、适用性检查、失效回退与重新评估，以及 JSONL 恢复。拒绝、暂缓、未提交和超时均不得准入。Barrier 与反思保持独立。具体接口、宿主适配责任和验证范围见 [结晶后台增量](crystallization.md)。前文“结晶尚未接入”保留为历史状态。

本增量新增17项测试，全仓最终585/585通过。实际使用 DSH loop、工具与 JSONL，模型为确定性 adapter，未调用外部模型。另验证旧收据不能跨适用上下文重复使用，对拍/接管过程中换版不能交付快路径结果；不适用输入只退回当次请求，避免重复评估。日志保存在 `artifacts/backend-rebuild/crystallization/`。具体任务的局部边界和冻结执行器适配、真实模型复验及清洁安装仍未完成。

### 结晶自动入口补齐

之前漏接了 DSH 普通工作的观察与触发层，现已补齐：配置结晶后默认观察符合 `{input}` 单参数约定的顶层 native 工具，以实际持久结果触发独立评估；候选准入后自动替代后续工具体，不要求业务 agent 调用结晶服务。原输出契约及权限/后置管线仍由 DSH 处理。并发退出导致的观察丢失、最终工具管线错误未撤销接管已补回归并修复。新增11项，结晶28项、全仓596/596通过，零新增外部模型请求。前文局部边界必须由宿主逐次传入的说法已被本次接入替代；冻结执行器、真实模型复验及清洁安装验收仍待完成。详见 [当前结晶契约](crystallization.md)。


## 实际结晶代码执行补齐

已复用原实验的资产快照与 Python 隔离执行实现，直接挂入独立 DSH 评估、对拍和工具体接管。新增13项真实脚本异常/闭环测试，全仓609/609通过。真实 gpt-6-astra 自主生成候选，七批外部验收通过，并证实资产被修改后的回退、重新生成/准入及重启接管。先前“冻结执行器与真实模型复验待完成”在当前 macOS Python JSON 边界内已补齐；清洁安装验收仍是独立未完成事项。见 [实际代码闭环记录](crystallization-code.md)。


## 后台清洁安装验收完成

从自包含 npm tarball、空 HOME/XDG、空缓存和独立消费目录安装成功。发现并修复旧本地file依赖无法从tarball正常安装的问题，改用npm原生bundleDependencies；新增打包回归1项。已安装后台114/114、全新Squidex/PostgreSQL管理场景12/12、全仓610/610和打包清单校验通过，测试服务及新卷已清理。当前整个包仍因旧执行组件及模型工具依赖约297MB。该验收覆盖显式后台入口与支持的DSH rc.2配置，未验证旧UI bundle默认启动、其它平台或外部模型的新凭证接入。前文清洁安装待完成的状态在此范围内已被替代。详见 [清洁安装验收](clean-install.md)。

## 真实模型闭环验收

默认后台入口已通过真实DSH原生agent/loop/provider的四项能力联动验收，包括两类注入故障与持久状态恢复。见 [真实模型完整报告](four-capabilities-live.md)。模型目录配置问题与反思未复现推测已分开留证。
