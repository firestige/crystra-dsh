# 反思发现的定向修复与补证据

2026-10-12。按用户要求，仅修复原第一项（重叠承诺误拦）与第七项（真实模型进程驻留）；其他项补测试，不直接采用模型建议改实现。

## 第一项：重叠承诺误拦，已修复

旧实现按承诺顺序先到先得。宽条件可能抢走窄条件唯一可用的调用，即使实际执行足以满足全部承诺，也会 NO_GO。

现在先建立动作与可用调用的候选关系，再用确定的最大二分匹配分配不同调用。迭代增广路径可以重新分配已占用的调用；保留每项动作的实际 callSeq/resultSeq。不是按条件数排序，也没有放宽验收条件。

先用四项回归复现失败，再修复通过：宽窄条件排列、同样具体但互相重叠的条件、完成/结果断言混合、拆分责任。另用独立穷举算法核对全部 512 种 3×3 候选图及每图六种声明顺序。Barrier 定向测试现为 19 项。

证据：`artifacts/backend-rebuild/matching-fix/red.log`、`green.log`、`evidence-tests.log`，旧实现保存在同目录 `barrier-before.js`。

## 第七项：反思完成后进程驻留，已修复

根因是当前 pi-ai 0.85.1 的 Codex WebSocket 会话缓存：成功响应后保留连接，并设置有引用的五分钟空闲定时器；当前 DSH agent dispose 没有释放该缓存。离线模型测试不经过这一传输路径，因此原有测试没有覆盖。

增加独立、显式挂载的 `dsh-crystra/pi-ai-lifecycle` 适配插件。监听 DSH 原生 `agent/disposed`，调用 pi-ai 公开导出的 `closeOpenAICodexWebSocketSessions(sessionId)`，仅清理已关闭 agent 对应会话。未修改 DSH/pi-ai 源码，没有强制退出，也没有清理其他会话的连接。直接依赖固定为本次验证的 pi-ai 0.85.1；上游生命周期变化后应复核并移除不再需要的适配。

本地完整 DSH + pi-ai 传输链，使用 localhost WebSocket 服务验证五项：正常完成、公开清理函数对照、另一个会话继续复用原连接、读源码后模型报错、读源码后响应挂起并耗尽预算。全部自然退出，未触发测试看门狗；负向场景仍记录 failed/timed_out 和退出码 1。

再次运行真实 openai-codex/gpt-6-astra：读取原授权四文件，运行两项实验，完成报告，脚本自然退出码 0。反思回归 19/19 通过。记录位于 `artifacts/backend-rebuild/reflection-live-fixed/`；本轮模型没有读取额外调查测试，因此它没有复现下述重复 ID 问题。

## 其他项：补测结果与边界

| 原发现 | 新证据 | 当前处理 |
| --- | --- | --- |
| 序号、错误结果、双重关联、null/缺失、嵌套路径、拆分分支覆盖不足 | 新增边界与分区测试通过；逐一改变发布身份字段仍拒绝旧闭合 | 未发现这些用例的实现错误，保留测试 |
| 结果文本/生产者契约 | 实际 DSH 生产者输出一个结果块，保留 renderer 文本；片段 JSON 可解析，说明文字混合 JSON 会 NO_GO；同一文本 callId 可以跨 step 重复 | 确认独立关联缺陷，详见下段；暂不修改 |
| 无关历史越长核验越慢 | 新诊断继续覆盖 100/1,000/10,000 条噪声；真实模型再次测得约 0.143/0.286/1.701 ms | 未做索引优化，数值是单机测量，不是 SLA |
| 匹配参数但无结果/结果不符的调用会放大扫描成本 | 5 动作下无结果调用 50/100/200 次，事件类型读取 12,750/50,500/201,000；结果不符时 25,500/101,000/402,000。另改变动作数和 payload 大小 | 证实嵌套扫描增长，未实施性能优化；旧/新同输入对照记录保留 |
| split 历史嵌套增长 | 当前 retain/defer 规则保留已完成动作；事实稳定时第二次 split 不合法，测试确认不会形成连续合法嵌套 | 原风险未在当前合法操作路径复现，不能当作已确认缺陷 |

性能脚本：`scripts/backend/reflection-evidence-benchmark.mjs`；原始数据：`artifacts/backend-rebuild/matching-fix/performance-evidence.json`。执行次数诊断与耗时分开记录；当前对照是单进程诊断，不能据此宣称优化收益。

### 新确认但未修复：跨 step 重复 callId 借用结果

实际 DSH 允许两个 step 使用同一文本 callId，并用 `sourceEventSeqs` 指向各自准确的调用。Barrier 当前仅用 callId 与先后顺序关联：第一次操作失败、第二次操作成功时，可能让第一次借用第二次成功结果，错误 GO。

已在原生 DSH 事件上复现。`test/backend/barrier-native-results.test.mjs` 的生产者契约测试通过；`test/integration/barrier-call-identity.test.mjs` 要求 NO_GO，目前实际 GO，保持失败。按本轮范围未修实现。

该调查回归遵循现有 integration 目录约定，不在日常 npm test 集合中。独立运行：`node --test test/integration/barrier-call-identity.test.mjs`。红灯日志：`artifacts/backend-rebuild/matching-fix/call-identity-pending.log`。日常全仓通过不代表这个已知缺陷通过。

## 最终回归

日常全仓 `npm test`：355/355 通过（`artifacts/backend-rebuild/matching-fix/full-tests-final.log`）；`git diff --check` 通过。此前全量有一次旧 intake 启动轮询超时，该文件单独复查 7/7、最终全量也通过，未改旧用例或放宽断言。另有上述独立调查回归 1 项已知失败。真实模型文件版本与原生实验事件核对记录：`artifacts/backend-rebuild/reflection-live-fixed/verification.json`。

后续：重复调用 ID 关联已修复、异常历史嵌套已增加前置拒绝，调查回归已纳入日常测试。当前结果见 [Barrier 后续修复](barrier-follow-up.md)。
