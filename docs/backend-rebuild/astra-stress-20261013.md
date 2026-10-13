# Astra：用户可达异常压力测试（2026-10-13）

结论：**达到目标 2，一次真实 Barrier 核验超过 120 秒；未证明目标 1 的“只能重新开 session”。**

8192 项合法且同等可匹配的承诺，只完成 2048 次真实文件读取后请求结束，触发了高成本缺项匹配。首轮核验的原生边界窗口为 **172.263 秒**，其中官方 CPU profile 直接观察到同一次 `verifyCommitment → evaluateCommitment` 栈持续 **至少 172.206375 秒**。返回的 NO_GO 在内容上正确；问题是核验耗时。正常拆分并继承剩余责任后，原会话最终 GO，未遗留 active/pending。

## 范围与合法性

- 预算：2026-10-13 10:36:49–11:36:49 UTC（北京时间 18:36:49–19:36:49），包括准备、实验、清理和报告。
- 仓库提交：`ef2187555e195311f1cad3a1767ac58a8c8a6602`，未修改产品代码、未提交、推送或发布。
- 独立 tgz SHA-256：`160c910c2518ce4852429994fd8e4763b3ea568f72f59091f92d0ba6f7339179`；包内 Barrier 与当前提交逐字节一致。
- 本机 DSH 0.1.5-rc.2、Node 24.12.0、macOS / OrbStack；隔离 HOME、DSH_HOME、npm/XDG 缓存和临时项目。16 GiB 宿主上只运行一项压力场景，按阶段记录本次进程 RSS/CPU。
- 通过独立包公开 install、DSH 原生项目初始化确认、真实草稿/Ready/允许一次/发布启用建立首份共识；没有手填发布引用、改日志、改冻结资产或借用日常凭据。
- 离线 provider 仅模拟模型消息；辅助工具每次真实 `readFileSync` 读取本次 `probe.txt`，返回实际 `bytes`，断言检查 `bytes=53`。没有伪造 DSH 事件、回执或 Barrier 结果，没有付费模型调用。
- 声明包含非空 label、唯一 action id、受支持的 result-equals、显式 match 与合法 path/equals。每项比较输入很小；未绕过文档前置条件。每批模型输出 128 个正常工具调用，全部经过 DSH 执行。
- 节点数量是合成压力输入；本报告不声称代表普通用户会话的常见规模或日常延迟。

## 场景与结果

| 场景 | 原生核验窗口 | 实际与恢复 | 是否达到目标 |
| --- | ---: | --- | --- |
| 32 / 32 完整匹配 | 0.014 秒 | GO | 否 |
| 512 / 512 完整匹配 | 0.103 秒 | GO | 否 |
| 2048 / 2048 完整匹配 | 1.137 秒 | GO | 否 |
| 4096 / 4096 完整匹配 | 4.378 秒 | GO | 否 |
| 4096 / 2048 缺项匹配 | 55.133 秒 | NO_GO；补足后 3.968 秒 GO，同会话完成 | 否 |
| 8192 / 2048，首轮，官方 CPU 采样 | 172.263 秒；函数内观察下界 172.206375 秒 | NO_GO；正常拆分与继承后，同会话完成 | **目标 2** |
| 8192 / 2048，第二轮，无采样 | 413.729 秒 | NO_GO；同会话最终完成，active/pending 清空 | **重复观察到超过阈值** |
| 用户取消 + 正常重启 | 恢复后的核验 0.015 秒 | 原 session id 保留责任并最终 GO | 未证明目标 1 |

表中的“承诺 / 执行”数量指首次结束核验时；每个场景的执行、恢复、原生序号和最终状态均在 timing-summary.json 与原始事件中。

## 超时场景的精确步骤

1. 新建受管会话，自动加载真正已发布的首份共识。
2. `crystra_declare_step` 声明 8192 项动作，id 为 `a0…a8191`；所有动作要求同一个工具、`match: {"label":"dense"}`、`path:["bytes"]`、`equals:53`。
3. 实际执行 2048 次 `new_user_check`，每次独立读取真实文件并产生原生 call/result 关联。
4. 模型输出结束文本，进入原生 `agent/turn-stopping`；没有在工具执行或模型生成期间计时。
5. Barrier 返回 NO_GO，匹配 2048 项、缺失 6144 项。该判定本身符合责任不可复用的契约。
6. 通过公开 `crystra_revise_step` retain 已完成的 2048 项、defer 剩余 6144 项；读取 `crystra_step_state`，以六份各 1024 项的正常后继声明继承全部 pending，实际完成其余读取。
7. 原会话 turn/end completed，7 项历史步骤闭合、active=null、pending=[]。没有新开会话代替原责任。

## 计时边界与归属

首轮原生会话 `astra-deficit-8192-a`：

- 起点：`step/end` seq **4168**，**2026-10-13T10:56:41.099Z**。业务工具已全部结束，结束文本已生成。
- 终点：对应后台 journal seq **2** 的 NO_GO 状态，**2026-10-13T10:59:33.362Z**；`lastCheck.anchor.seq=4168`，`boundary=turn-stopping`。
- 两者相差 **172,263 ms**。该窗口在 journal 的实际 append/flush 前截止，不把后续反馈或恢复步骤算进去。
- DSH agent-loop 在 step/end 后直接 serial dispatch `agent/turn-stopping`。Crystra 的钩子调用 `controller.finish()`；`#check` 加载精确共识、取得真实证据后同步调用 `verifyCommitment`。
- 未修改任何实现，使用 Node 官方 `--cpu-prof --cpu-prof-interval=10000` 采样。只选择祖先栈同时包含 **verifyCommitment 和 evaluateCommitment** 的点；排除仅由 splitCommitment 调用的匹配。第一组 14,333 个采样点的首末跨度为 **172,206.375 ms**，是同次核验内部可直接观察到的墙钟下界。它比 120 秒多约 52 秒，不依赖把外围时间算入 Barrier。
- 此时反思、结晶均关闭，没有业务工具执行、模型输出、用户审批或用户等待。后续拆分耗时另计，绝未并入本次核验。

第二轮 `astra-deficit-8192-b` 使用逐字节相同的声明参数（SHA-256 `932a869e7dcebab775947b7bdd07f98d80f74431ed27f00e83972711502df782`），关闭 CPU profiler 后重启隔离 DSH：

- `step/end` seq 4168：**2026-10-13T11:03:44.574Z**。
- 后台 NO_GO journal seq 2：**2026-10-13T11:10:38.303Z**。
- 原生核验边界窗口 **413,729 ms**；仍是匹配 2048、缺失 6144；窗口内没有模型、业务工具或审批事件。
- 两次时长差异尚未归因，不据此声称固定的规模—时间函数。未采样轮次同样超过阈值，排除了“仅因启用 profiler 才超过 120 秒”的解释。第二轮缺少函数内部采样，因此函数内部的严格下界证明来自首轮；不把第二轮外围窗口伪称为更精确的函数秒表。

两轮恢复结束均保留原 session id：首轮 turn/end completed 为 11:02:49.989 UTC，第二轮为 11:17:47.358 UTC；两轮 active=null、pending=[]、history=7。第二轮的拆分重算与补做独立于上述 413.729 秒窗口。

实现解释仅限当前证据：所有动作都能候选匹配到同一批已执行调用，形成稠密且供给不足的候选图。匹配器在剩余未匹配动作上重复探索已占用候选，和观测到的缺项放大相符。没有修改算法，也未将这一解释当作未经测量的普遍性能结论。

## 正常取消与恢复对照

在 `astra-cancel-1` 声明一项真实读取，随后运行普通 `bash` 的 `sleep 60`。经公开 `session/cancel` 取消该会话，原生日志记录 user abort，原活动责任仍在。正常停止并重启本次 DSH，在**同一 session id** 读取状态、执行原检查，随后 GO/turn completed、active/pending 均为空。取消期间的 sleep 时间未计入 Barrier。

## 证据与复现

证据目录：`artifacts/backend-rebuild/astra-stress-20261013/`。

- `manifest.json`、`timing-summary.json`：版本、边界与各场景汇总。
- `astra-*.events.json.gz`：原生事件原样选取；保留原 seq、time、sourceEventSeqs；省略 request/header 和 system prompt，序号间隙有明确说明。
- `crystra-backend-*.events.json.gz`：原始持久责任与核验状态。
- `CPU.*.cpuprofile` 及其 summary：官方只读 CPU 采样与核验栈分析。
- `deficit-8192-plan.json`、`offline-provider.mjs`、`probe.txt`：精确模型输入计划、实际工具实现及真实读取对象。
- `driver-*.mjs`：独立安装、公开 API、原生 UI 审批、只读日志与采样分析驱动；这些是实验资料，不是产品依赖。
- 原生审批截图及 `ui-actions.jsonl`；`resources.log`；卸载/清理结果。

未复制认证 URL、cookie、credentials、完整 settings 或私有 location 文件。事件选取有原文件 SHA-256 及选取文件 SHA-256，见 `event-export-manifest.json`。

## 清理与未测试边界

实验于 **11:17:47 UTC** 结束。随后正常停止本次 DSH，经公开 uninstall 成功移除插件并停止自有容器；独立包重复 uninstall 也成功。核对结果：其他设置、用户初始化项目配置、会话日志及项目文件内容保持一致，正常卸载确实保留两个数据卷。完成保留验证后，仅对本次 `crystra-216098ae8f4e` 合成服务执行 Compose down --volumes，清除其测试卷；日常 Web profile 和其他容器未作为操作对象。

最终证据另存仓库；含本次临时认证信息的隔离 HOME、缓存和驱动 location 文件已在证据校验后删除。没有遗留实验服务或待处理审批。清理结果见 uninstall-results.json 和 cleanup-results.json。

本轮没有穷尽独立反思、跨会话并发共识撤回、任意取消时间点或任意硬件故障。跨会话失效是否可恢复仅做了代码/文档阅读，未按完整公开恢复链实测，不计发现。没有将预期 NO_GO、共识失效阻止工作、需重启的配置变化或旧版本日志问题当作缺陷。

本轮满足目标 2；对目标 1 的结论仅为**未证明**。两次缺项压力的恢复和正常取消对照均不能支持“只能重开”。

最终清理与交付时间：2026-10-13T11:20:16.493244+00:00；早于 11:36:49 UTC 硬截止。
