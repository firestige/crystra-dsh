# M06：内部角色识别与原生 agent 生命周期

## 提交与范围

进入本轮前的进度已提交为 `20e979f`。本轮仅处理 Astra 评审 M-06：四处内部角色识别，以及反思与结晶 evaluator 重复的原生 agent 创建、取消、等待、flush 和释放过程。不合并业务服务，不新增调度器，不扩展为通用插件框架。

`internal-agents.js` 集中原有两种 session 前缀和 ID 生成规则。`native-config`、`native-plugin`、`project-initialization`、`crystallization-dsh` 使用同一个判断。旧前缀和 UUID 格式保持不变；历史反思记录的读取校验仍由反思服务负责。

`dsh-internal-agent-runner.js` 提供内部使用的 begin/execute/finish 和 close。每个业务服务各有独立的运行集合；DSH 继续负责执行与调度。工具、prompt、报告、证据解释、业务结果及持久化数据结构留在各自服务中。

## 已复现并修复的清理问题

先通过替身注入异常，修复前两个测试均失败：

1. 反思 agent 的 dispose 抛错，原实现跳过最终 journal 写入和 live entry 清理；随后 close 持续等待。
2. close 已开始等待当前反思完成，此时 journal.close 抛错，原实现没有执行 settle，关闭等待无法结束。

这是明确故障注入下的代码路径复现，不声称在用户日常环境自然复现。

共同 helper 用嵌套 finally 保证：即使 dispose 抛错，仍尝试领域持久化收尾；即使领域收尾继续抛错，也释放运行集合并完成关闭等待。错误仍向调用者抛出，不把清理失败当成正常成功。结晶原有的 dispose 异常传播与关闭可结束行为继续保留。

## 保持的行为

- 反思仍研究核心代码正确性、鲁棒性、性能；保留报告验证、源码 hash、实验输出、stale/incomplete 等判定，无权释放 Barrier 责任。
- 结晶仍自行判定 candidate/defer/decline，并由原有独立验证决定准入；候选、usage、历史原始证据及 fallback 策略不变。
- 两者模型参数、超时默认值、超时起算点、取消理由、followup 来源与工具隔离不变。反思仅在取消/超时时调用 whenIdle；结晶保留其始终调用 whenIdle 的行为。
- session ID、反思 journal schema、结晶业务状态、公开返回结构及旧记录恢复格式不变。
- 关闭一个服务只取消其自身的内部 agent，不关闭另一个服务或普通 worker。

## 验证

完整 `npm test`：477 passed，0 failed，0 skipped。

新增回归覆盖上述两个异常、结晶 dispose 抛错、创建过程中关闭、create/flush 失败后再次评估、关闭后拒绝新请求、旧前缀识别，以及内部 agent 不进入项目初始化、项目选择或自动结晶观察。

真实 DSH 0.1.5-rc.2 服务测试使用原生 agent loop、工具隔离和独立 JSONL：同时运行反思与结晶，关闭反思后结晶保持运行；普通 worker 能继续并完成两轮任务；取消结果可从原生日志读取；结晶 setup 失败可重新运行，释放后没有遗留 agent。

既有反思报告完成、取消、超时、无报告、源码变化、证据拒绝、冷恢复测试通过；结晶 happy path 与 defer/decline/incomplete/timeout、自动发现、真实 Python 候选及异常 fallback 回归通过。五项 pi-ai 本地传输测试验证正常、失败、超时和并行会话的自然退出，无 watchdog 强杀。

真实宿主验证中的模型响应由本地测试 adapter/localhost 服务提供；未使用付费模型，未修改日常 Web profile、凭据或网络配置。

测试日志和代码 hash 记录在 `artifacts/backend-rebuild/m06-lifecycle-20261014/`。本轮 M06 修改保留在 worktree，未自动提交或推送。
