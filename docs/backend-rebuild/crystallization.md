# 结晶：DSH 后台增量

本增量把已验证的主动触发、独立 agent 评估、历史对拍、准入和失效回退接入后台入口。结晶没有挂在 Barrier 上，也不调用反思服务。DSH 仍负责 agent、模型、工具和原生会话；Crystra 保存结晶领域状态。

## 已实现的闭环

1. 配置结晶能力后，插件默认监听 DSH 原生工具执行与完成事件，从符合约定的普通工具调用自动提取边界、输入和执行锚点。业务 agent 不调用结晶接口，也不需要预先申请热点。Crystra 从 DSH 持久事件取结果，不采信 agent 自报的输出。显式 `service.run(...)` 仍可用于宿主在更外层替换局部任务；与自动观察混用时不会重复计入依据。
2. 相同 scope、边界和适用上下文积累至少两个不同输入，自动创建持久评估任务。重复同一输入不增加独立样本数。无需业务 agent 主动申请结晶。
3. 新建独立 DSH agent，使用宿主明确指定的模型。它可读取原执行证据、使用宿主的构建工具，然后选择候选、暂缓或拒绝。没有提交、超时或运行失败不能形成准入。
4. 候选绑定 `id/version/hash`。Crystra 校验冻结材料，与适用的历史原结果逆序对拍，至少两个不同输入通过才准入。对拍使用宿主提供的隔离/无副作用执行能力；不得把历史对拍写进真实业务目标。
5. 后续请求先检查冻结版本和适用 guard，再执行并检查输出。执行及检查后再次确认版本与上下文。输入不满足 guard 时仅该次请求退回原路径，保留对其他输入有效的能力，避免反复触发重建。执行异常、结果检查失败或版本变化时，异常结果不交付，撤销接管并调用原路径；后续可重新评估、修改和对拍准入。
6. 共识或依赖上下文变化，进入新的适用分组，重新积累原路径依据。上下文查不到时停止执行，不以未知共识绕行。

`threshold` 默认 2、最小 2，是可调的观察/对拍策略，不代表最优收益点。暂缓/拒绝后需再增加 threshold 个不同输入才重评；候选验证失败后至少一个新输入才能重评。活动能力失效时允许当次原路径执行后立即重评。guard 不适用的历史样本不用于该候选的对拍。

## 宿主接口与边界

```js
await ctx.plugin(backend, {
  resolveConsensus, // 或已有的 managed consensus 配置
  crystallization: {
    namespace: 'publications',
    // 默认启用自动观察；auto: false 可保留仅显式调用模式。
    // auto: { scope: 'college' } 可覆盖默认 namespace 分组。
    agentOptions: { provider, model }, // 独立评估模型，由部署者选择
    context: async request => effectiveContext,
    // 复用实验的本地 Python 实际执行器；默认挂载独立评估工具。
    code: { root: '/absolute/path/to/code-assets', python: '/usr/bin/python3', timeoutMs: 2000 },
    // 其它执行环境可选：resolve: async reference => frozenCapability,
    setupEvaluator(ac, agent, job) {
      // 用普通 DSH 工具提供构建、检查、冻结资产的能力。
      // 不需要用户选热点；agent 根据原生证据选择局部方案。
    },
  },
});
// 此后业务 agent 正常使用 DSH 工具即可，无需调用结晶工具。
// 宿主在读取完整观察结果前可以等待：
await ctx.crystraCrystallization.whenIdle();
const service = await ctx.crystraCrystallization.ready;
const status = ctx.crystraCrystallization.observationStatus();
```

`context` 是可信适用性解析器，应包括影响复用的有效共识引用、依赖版本、配置版本等。不能把它理解成自动语义分类器，遗漏依赖不能被 hash 自动弥补。适用性应由具体任务集成明确提供，复用已有共识管理的精确引用即可，不另建共识系统。

自动入口当前覆盖顶层 native 工具调用：参数必须恰好为 `{input: JSON值}`，结果必须为一个完整 JSON 值。以工具名形成事件族，scope 默认使用 namespace，适用上下文参与分组。这个限制是当前已接入的结构化事件契约，不是声称自动识别所有自然语言任务或任意脚本中的局部热点。可选的可信 `auto.select(exec)` 能过滤调用或选择 scope，但不能扩大输入形态或改写原生工具与 input。

工具体仍经 DSH 的权限与前置检查，已准入能力在 `tools/execute` 层替代工具体，返回值仍由工具自己的输出契约校验、渲染，并经过后置管线。快路径归属在领域 journal 中记录，引用原生调用和最终结果序号；最终管线报错会撤销对应版本，下一次调用退回原路径。业务 agent 自身仍可能进行模型调用，本增量不声称工具层接管能消除整个业务 agent 的推理。

只接受一个准确关联的成功 tool-result。错误、非 JSON、多结果及含额外参数的默认调用不进入准入依据；快路径结果不作为独立原结果；内部评估、反思会话及 Crystra 管理工具不参与自我发现。依据关联使用原生序号，不以可能重复的 callId 代替。

原生事件观察器不执行异步重入。结果到达后立即异步 flush，再排队处理评估；并发 worker 即使先退出，也不因评估排队丢失落盘结果。观察故障由 `whenIdle()` 和 `observationStatus()` 显式暴露，后续符合约定的调用停止接管与执行，避免静默遗漏。

只有使用显式 `service.run(...)` 时才需要配置 `original(request)`：实际运行原 agent/工具，等待结果持久化后返回 `{sessionId,callSeq,resultSeq}`。在这个显式接口中仍要求工具名等于 boundary、参数包含相同 input。自动观察不需要 original 回调。PTC 子调用、流式文本结果、多个工具结果的语义拼装尚未接入。

`resolve(reference)` 返回：

```js
{
  reference: { id, version, hash },
  material, // 可序列化 JSON，digest(material) 必须等于 hash
  guard(input, context), // 必须明确返回 true 才适用
  run(input, { mode, context }), // mode 为 shadow 或 live
  check(output, { input, context }), // 必须明确返回 true 才通过
}
```

宿主负责让 material 完整描述代码与依赖，并保证执行器确实运行这个冻结版本，提供取消/资源限制及隔离或暂存提交能力。Crystra 不从一段 source 字符串猜测如何安全执行任意程序，也不能仅凭 hash 证明回调和材料一致。评估 agent 的构建工具须遵守同样的资产契约。可以替换 `evaluate` 端口接入其他宿主；它是可信执行适配接口，不能暴露成业务 agent 自报准入的工具。

已经接入结构化 native 调用事件族的自动观察、主动评估和后续工具体接管，不再要求宿主逐次调用 service.run 来喂入发现依据。通用工具流语义切片、通用资产仓库或任意语言执行沙箱仍不在当前实现中。当前内置本地 Python 代码适配；其它执行环境仍由宿主提供。

## 持久化、恢复和成本依据

使用 DSH JSONL 单写者 journal，保存适用分组、独立原结果锚点、评估任务、对拍结果、具体准入版本、回退原因和接管执行时长。评估会话自身也由 DSH 保存；领域记录保留会话 id、终止状态、读取索引和原生 assistant/message 上报的 token usage。usage 未提供时记为空，不猜测成本。

重启只恢复事实，不重复原任务或评估。未完成评估显示 interrupted，不视作成功，不擅自恢复候选执行。写入/flush 失败后服务停止修改；它不保证任意崩溃窗口 exactly-once，实际工作已执行但收据尚未持久化的情况需要宿主按业务策略核对。快路径只适用于隔离、纯计算或有暂存/幂等保障的边界，不能对任意已发生外部副作用的任务自动重跑。

尚未实现货币换算、净收益预测或自动最优阈值；没有把评估和构建开销从收益中排除。已有 native 会话和时长提供后续统计依据。历史样本、执行记录当前累积保存，长期容量与整理策略尚未验证。

## 验证与证据范围

`test/backend/crystallization.test.mjs` 验证域状态和异常路径；`test/backend/crystallization-dsh.test.mjs` 使用真实 DSH agent loop、tools、JSONL 和独立评估会话，模型使用确定性 adapter，零外部模型请求。

覆盖主动触发、重复输入不重复触发、候选构建、拒绝/暂缓、未提交、超时、逆序对拍、错误候选不准入、guard 回退、执行异常、共识变更、冻结版本变化及执行中换版、伪造/复用依据、错误/重复原生结果、并发串行、写入失败、重启恢复和中断状态。

这证明有限边界内的机制及恢复，不证明真实模型自主构建成功率、任意任务适用性、长期可靠性或端到端净收益。自动入口补齐新增11项测试，结晶测试合计28项、全仓596/596通过。覆盖无需显式服务调用的自动发现、独立评估与接管；相同输入去重；内部会话排除；拒绝/暂缓/未提交/超时；错误/非JSON/额外参数不进入依据；异常及换版后的重新准入；显式调用混用不死锁；观察故障可见；并发 worker 退出和重启后恢复；最终 DSH 工具管线拒绝时撤销接管。自动模式仍使用确定性模型 adapter，没有新增外部模型请求。

原生事件已落盘但观察状态尚未落盘的任意崩溃窗口、旧工作会话的全量自动补扫、其它插件对成功结果的任意改写尚未保证。完整日志：`artifacts/backend-rebuild/crystallization/`，自动入口结果见 `auto-focused-tests.log` 和 `auto-full-tests.log`。


## 实际代码执行接入（本次补齐）

复用先前主动结晶实验的 Workspace、Registry 和隔离子进程实现，作为 `code-capabilities.js` + `python/capability_bridge.py` 接入。没有新增一套冻结系统：沿用 `id/version/hash`，material 绑定源文件摘要与四阶段命令。执行前后核对资产及材料，执行器真正读取该快照运行，不再以手写 `cap.run` 作为代码执行证据。

独立评估 agent 的 `crystra_code_register` 接收 `id`、`files`（相对路径到源码的映射）、`validate/guard/execute/check` 四个命令数组。首项必须是已注册脚本路径，不能写解释器或 shell 前缀；后续可带固定参数。适配器追加 `input.json output.json context.json` 三个路径。validate 退出码必须为零；guard/check 输出 JSON boolean；execute 写 JSON 输出文件。注册只完成快照及验证，准入仍须由结晶域独立历史对拍。

每次在临时目录执行实际 Python 子进程，禁止网络、限制写入范围、移除环境凭证，设有超时和输出大小上限；不允许改写资产快照。收据保存阶段、退出码、截断的 stdout/stderr、超时及耗时。对拍和接管记录引用实际执行收据，可通过 `ctx.crystraCodeCapabilities.readReceipt(id)` 查阅。

当前实现仅覆盖 macOS sandbox-exec、配置的本地 Python 和 JSON 文件协议；不是任意语言或任意副作用任务的通用沙箱。资产目录须单写者管理；尚不承诺多进程并发注册或任意崩溃窗口恢复。guard/check 目前有重复调用开销，不能将机制打通等同于性能收益。

本次新增13项：10项实际代码测试、3项原生 DSH 闭环测试。覆盖脚本异常退出、缺失输出、非法/过大 JSON、输出检查失败、超时、验证失败、适用条件拒绝、源文件/命令材料变化、越界写入、错误候选回退后换版重验及新宿主恢复。结晶相关41/41、全仓609/609通过。

另使用真实 gpt-6-astra 在独立 DSH 会话自主生成候选代码，七批外部验收全部通过：1/2原路径，3/4/5实际代码（包含空输入），修改准入快照后的6回退原路径，重新生成和对拍准入后重启，7恢复实际代码接管。业务工作驱动和原实现使用确定性测试 adapter，候选生成由真实模型完成；本实验不代表任意业务 agent 或任务成功率，也未证明净收益。详见 [实际代码闭环记录](crystallization-code.md)。
