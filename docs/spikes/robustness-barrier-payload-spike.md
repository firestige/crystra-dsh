---
title: "Barrier 异常 payload 的可达性与失败行为"
category: "Architecture & Design"
status: "Completed"
priority: "High"
timebox: "30 分钟"
created: 2026-10-12
updated: 2026-10-12
owner: "Crystra agent"
tags: [technical-spike, barrier, evidence]
---

# Barrier 异常 payload 的可达性与失败行为

## 目标与边界

非有限数和过深 JSON 能否通过真实 DSH 进入 Barrier？进入后是明确拒绝，还是抛异常、卡住或破坏后续状态？

时间盒：30 分钟。本轮先观察，不自动修复实现。输入、随机种子、版本、断言和异常原文全部保存；失败、超时与未完成分开记，不把缺少复现写成安全证明。

## 输入与实验矩阵

| 层次 | 输入 | 需要观察 |
| --- | --- | --- |
| 纯核验基线 | 有限数字、浅层对象、完整合法 JSON | 正常 GO/NO_GO，证明测试通路成立 |
| 参数溢出 | 原始 arguments 中匹配字段为字面量 1e400；另放在不参与匹配字段 | JSON.parse、DSH 参数验证与 Barrier 比较分别如何处理 |
| 结果溢出 | renderer 输出完整 JSON，目标字段为 1e400；另放在不参与核验字段 | 原始 value 有限而展示文本溢出的路径是否可达；目标/非目标字段区别 |
| 深层对象 | 深度 32、256、1024、4096、8192；嵌套对象与数组 | 编译承诺、解析、路径访问、canonical 比较中哪一步拒绝或抛错 |
| 失败后继续 | 异常检查后以正常输入再次核验同一控制器；重建 host 后读取 | 原承诺、pending、journal 是否完整，是否能够继续或必须显式重开 |

深度测试至少包含两种位置：参与比较的子树、不参与比较的旁支。预期承诺使用浅且合法的值，以免只能测到声明阶段异常；另单独测试深层承诺的声明行为。

## 方法与判定依据

1. 纯函数隔离子进程固定输入，分别记录正常返回、同步异常、超时、信号退出，禁止把异常吞掉后记为 NO_GO。
2. 复用真实 DSH + 确定离线 LLM adapter。原始 arguments 必须保留字面量，不能经 JSON.stringify 把 Infinity 转成 null；记录原生 call/result 和准确 sourceEventSeqs。
3. 工具使用合法浅层 execute 返回值、受控 renderer 输出异常文本，区分工具原始输出校验与结果文本校验。若 DSH 上游阻断，记录具体阻断阶段；不人为绕过后声称原生可达。
4. 纯函数可达而原生不可达，归类为防御边界；原生可达且导致未受控异常，归类为真实集成缺陷；明确 NO_GO且状态保留，归类为受控拒绝。

预算：每个子进程最多 5 秒；深度递增遇到首次异常后只补一个较小边界点，不继续无限加深。记录输入字节数与深度。不得修改或损坏正式持久数据。

## 产物

隔离 payload 探针、原生可达性用例、控制器失败后状态对照。证据目录 `artifacts/backend-rebuild/payload-spike/`。

## 完成条件

每个计划用例都有输入、实际结果和证据路径；未执行项明确标记。结论区分已复现、当前边界、未复现与仍待决策。达到时间盒即汇总，不通过扩大场景追求全面证明。

## 研究结果与决策

执行完成：118 个隔离输入观察，Node v24.12.0；DSH agent-loop/tools/session/persistence-jsonl 均为 0.1.5-rc.2。未调用远端模型，未修改生产实现。6 条观察回归通过，**这些测试断言当前缺陷确实存在，不表示已经修复**。

### 非有限数

| 输入位置 | 纯核验 | 真实 DSH + Controller |
| --- | --- | --- |
| arguments 的匹配字段 `x:1e400` | TypeError: Expected a JSON value | DSH lossless JSON 参数校验生成 isError 结果，finish 明确 NO_GO；正常后续执行可 GO |
| arguments 的非匹配旁支 | GO | 同样被 DSH 上游阻断，finish NO_GO；正常后续执行可 GO |
| renderer 完整 JSON 的目标字段 `x:1e400` | TypeError | **原生可达的 TypeError**，finish Promise 拒绝，未收敛为 NO_GO |
| renderer 的非目标旁支 | GO | GO，目标 x=0 的断言满足 |

renderer 实验中 execute 返回浅层合法 `{x:0}`，原始 arguments 为浅层有限 JSON；仅 renderer 的文本为 `{"x":1e400}`。成功原生 tool/result 的 isError 未设置，准确 sourceEventSeqs 指向该调用，因此不是人工成功结果绕过 DSH 校验。JSON.parse 接受 1e400 并生成 Infinity，canonical 比较目标字段时抛异常。

异常承诺值单独编译：把 1e400 解析值作为 match.x 或 equals，纯 compile 抛 TypeError；Controller.declare 捕获并返回 NO_GO，没有创建 active 责任。这与证据核验阶段未捕获错误不同。

### 深度位置与阶段

对象使用 `{"n":...}` 链，数组使用嵌套 `[...]`，末端为 0。深度数字指容器层数，非全局 JSON 节点数。

- **匹配字段子树、结果目标子树**：对象与数组均在 32、256、1024 正常返回；首次计划点 4096 均抛 RangeError: Maximum call stack size exceeded；补测 2048 正常返回。因此只证明当前运行时边界落在这两个观测点之间，没有二分查出精确最大深度。
- 浅层合法承诺预期值保持 0，实际目标是深对象/数组。纯函数和真实 DSH 都可复现 canonical 递归溢出；并非要求承诺预先包含深结构才会触发。
- **非匹配/非目标旁支**：纯核验及原生路径均测到深度 8192，返回 GO。说明此次溢出与参与 canonical 比较的子树有关，不能据此宣布全局 JSON 深度安全。
- **承诺本身含深层 match/equals**：纯 compile 在 4096 抛 RangeError，2048 正常；Controller.declare 对 4096 返回 NO_GO，不创建责任。该项控制器使用隔离内存 journal；不是通过原生模型调用声明工具的可达性证明。
- 所有子进程在 5 秒预算内退出，无超时、信号退出或宿主初始化异常。

### 失败与恢复

真实 DSH 工具执行后通过 Controller.finish 核验，以真实 openJournal 记录责任。比较异常时：

1. active 仍为 step-1，pending=0，history=0，完整控制器快照与核验前相同；未错误闭合，也未丢失责任。
2. 同一原生 DSH agent 再运行一次正常工具调用，生成新的成功 call/result。finish 仍抛原先的 TypeError/RangeError，因为旧异常候选仍被扫描。
3. 关闭 agent、journal 和整个 Context，重建 DSH host，从持久原生 worker 日志加载事件、从 openJournal 恢复控制器；责任仍相同，finish 仍抛异常。

这证明存在**可持久重现的闭合阻塞**；不是数据丢失，不是重新启动即可恢复。实验没有自动清除异常证据、丢弃责任或修改生产代码。这里观测的是 Controller 公共方法，尚未执行整个 Crystra plugin turn-stopping hook 对异常的最终用户表现。

### 结论与建议

原先假设已收敛为两类：DSH 上游能阻断 arguments 中非有限数；renderer 中非有限目标值与两种深度目标子树仍会进入原生成功证据并使确定性检查抛异常。应修复核验输入边界，使无法安全比较的候选被确定性拒绝，而不是让旧异常证据永久阻塞责任。可以使用有限数/深度或节点预算防御，不要求重新设计存储；具体预算尚未选定，本轮不实施。

### 证据与复现

- 完整矩阵：[summary.json](../../artifacts/backend-rebuild/payload-spike/summary.json)，每项相邻同名 JSON/log 保存原生完整事件、异常堆栈、重试及重建结果。
- 结果溢出：[native-result-target-overflow-object.json](../../artifacts/backend-rebuild/payload-spike/native-result-target-overflow-object.json)。
- 深对象参数：[native-args-target-d4096-object.json](../../artifacts/backend-rebuild/payload-spike/native-args-target-d4096-object.json)。
- 深数组结果：[native-result-target-d4096-array.json](../../artifacts/backend-rebuild/payload-spike/native-result-target-d4096-array.json)。
- 回归：[tests.log](../../artifacts/backend-rebuild/payload-spike/tests.log)，`node --test test/backend/payload-spike.test.mjs`，6/6。
- 完整重跑：`node scripts/backend/payload-spike.mjs`。该脚本只修改独立 artifacts 目录，不访问真实账户/持久服务。

已执行计划中的全部位置和形状；4096 首次异常后按原计划停止该序列，8192 只对旁支继续。未执行精确深度阈值搜索、原生声明工具路径、完整插件 hook 异常呈现与修复验证。
