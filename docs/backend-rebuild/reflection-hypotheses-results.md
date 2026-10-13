# 五条反思推测：补证结果

2026-10-13。完成本轮有界补证。结论：H1/H2 在当前封装路径下隔离；H4/H5 未证明需要修复的运行故障，本轮关闭；H3 保留一个有明确前提的异常事件防御缺口。没有修改产品实现，没有调用外部模型，也没有把 helper 独立现象当成正常 agent 链路缺陷。

## 运行与证据

- Node 24.12.0，安装的 DSH 0.1.5-rc.2；本地真实 DSH agent-loop/tools/session/JSONL persistence，离线确定性模型仅用于精确触发工具行为，不代表新一轮强模型自主行为验收。
- 33 个资源配置 × 3 独立子进程 = 99 个资源样本；每进程预热 3 次、测量 5 次，记录中位数。另有 33 个原生工具观察（含一项异常渲染补跑）。
- 每资源样例 15 秒父进程截止、子进程堆 256 MiB、RSS 512 MiB 保护；99 个样本全部完成，结果正确，未触及保护。不是无限规模保证。
- 相关已有回归 202/202，全套后台回归 318/318。实验入口 [reflection-hypotheses-spike.mjs](../../scripts/backend/reflection-hypotheses-spike.mjs)。脚本在实验前后核对 barrier/controller/index/value 源码摘要一致。
- 原始证据 [results.json](../../artifacts/backend-rebuild/reflection-hypotheses/run-1791821244630/results.json)、[异常渲染补证](../../artifacts/backend-rebuild/reflection-hypotheses/run-1791821244630/native-object-supplement.json)、[摘要](../../artifacts/backend-rebuild/reflection-hypotheses/run-1791821244630/summary.json)、[全套回归](../../artifacts/backend-rebuild/reflection-hypotheses/run-1791821244630/full-regressions.log)。

## H1：非 JSON 数组 —— 当前路径关闭

helper 中 Array(1) 及额外属性数组可以与 [] 同键，阳性对照成立；[null] 与 [] 不相等。原生 Session 快照拒绝数组空洞与额外属性。宿主直接调用 Controller 声明稀疏 expected 时，原生 journal 写入拒绝，active 仍为 null，没有有效承诺落盘。正常工具的 [] 结果 GO、[null] 结果 NO_GO，均可持久化恢复。

JSON 参数无法表达这些 JS 专有形状；不将序列化后产生的 [null] 当原空洞输入。结论局限于当前 DSH + 原生 journal，helper 不单独承诺支持任意 JS 值。不修复，不继续追查。

## H2：拆分引用共享 —— 当前路径关闭

helper 的 retained action 共享已复现；原 goal 修改会影响 helper 返回值，而 history/pending 不变。但公共 Controller 中，修改声明输入、snapshot 的 active/history/pending、journal.read 副本，都不能改有效断言。拆分后完成 retained 责任、留下精确 pending；关闭并重新打开原生 journal、重建 Controller 后状态一致，finish 仍为 NO_GO，未丢失待办责任。

这是同进程重新打开持久化和重建 Controller，不冒充进程崩溃恢复试验。未找到有效引用泄漏，不修复，不继续追查。

## H3：异常事件 —— 序号怀疑关闭，结构防御保留

### 确认的条件性问题

受信任宿主插件直接使用原生 Session.append 追加工具结果，若 message.content 缺失或为对象，实时 append 接受，snapshot 将其交给 Controller 后 finish 抛 TypeError。承诺保持原状态，没有假 GO，也没有责任丢失；随后补入正常调用/结果仍会被旧异常记录卡住。原生 JSONL 写入/flush 可以发生，但读取/恢复因结构非法拒绝，直接 Session 恢复也拒绝。

因此强证据支持的是“异常宿主事件可使核验无法收敛为 GO/NO_GO”，不是模型能随意伪造事件，也不是已经观察到正常工具链随机生成这些事件。当前 Crystra 正常工具没有绕过原生生成链路手工制造该缺失字段。若后续处理，应只为核验边界做有限防御，不重写 DSH 事件机制。本轮仅确认，未修复。

### 已被隔离或拒绝的情况

- helper 的 missing/NaN/fractional seq 对照不代表模型可控输入；真实 append 自动分配 seq。删除、重复或小数 seq 的原生恢复均拒绝。本轮关闭序号疑虑。
- 缺少 tool-result block.content、错误 toolCallId：核验 NO_GO，随后正常执行能 GO；恢复拒绝非法结构。
- 正常 DSH 工具 render 返回 undefined：变成规范错误结果，NO_GO，可恢复。
- render 返回缺失 text 的数组：结果断言 NO_GO，可恢复。
- render 错误返回对象 {}：外层 message.content 仍为数组，但 block.content 为对象；result-equals 返回 NO_GO，没有出现上述外层 filter 崩溃，落盘恢复拒绝。这是宿主工具违反渲染契约的上游异常，不能说 DSH 会把所有错误返回统一规范化。证据作为 H3 的边界记录，不另行扩成 Crystra 新需求。

## H4：总体资源 —— 本轮关闭，不新增限制

合法字符串覆盖 4 KiB / 256 KiB / 4 MiB / 16 MiB，分别位于比较目标、参数侧字段、结果侧字段；另有浅宽对象及 tool-completed 对照。

16 MiB 核验三个子进程中位数的中位数：目标字符串约 16.02 ms，参数侧字段约 7.64 ms，结果侧字段约 7.45 ms。对应进程峰值约 257 / 225 / 187 MiB，包含数据构造、编译、预热与多次核验，不是 Barrier 单次增量内存。

真实原生工具链的 16 MiB 结果，工具运行到 flush 约 77–86 ms；result-equals 的额外单次核验约 7 ms，tool-completed 约 0.3 ms；原生记录读取恢复成功。无 Barrier 对照仅跳过核验，保留相同工具和持久化链路；各配置独立进程运行，不能把峰值差简单解释为精确分配归因。

确认了成本随字节增长，但没有证明当前需要字节预算或解析改造。本轮关闭，未来仅在真实工作负载出现新证据时重开。

## H5：匹配规模 —— 本轮关闭，不更换算法

稀疏、稠密、重分配链覆盖 A=1/20/64/256、X=A，以及 A=64/X=256 和无关工具执行。256×256 稠密图有 65,536 条边，三进程中位数的中位数约 14.91 ms，进程峰值最高约 153 MiB；匹配数量、最终判断均正确。20 动作/20 次执行稠密图另通过真实原生工具链验证并恢复，20 个责任分别绑定不同执行事件。

规模趋势符合预期，但未出现超时、错误匹配或内存保护触发，不据理论复杂度推进索引或算法重写。更大输入不在本轮结论内，也不继续放大直到造出故障。

## 实验记录说明与收敛

探针开发阶段修正了 setup 返回值、临时 session 身份、声明先于调用的锚点顺序，以及观察器自身对异常内容的读取。早期运行保留用于追溯，不作为最终结论依据。最终 run 中对象渲染探针因原生恢复拒绝提前退出，单独补跑扩大错误捕获范围，完整记录原生核验 NO_GO 与恢复拒绝；原始失败记录未覆盖或删除。

后续只保留 H3 的条件性防御事项。其余四条从当前待处理清单移除；新模型、宿主或实测负载出现新的具体证据时再讨论，当前不继续投入。


## 2026-10-13 H3 有限防御修复与回归

用户授权后，已修复 Barrier 的证据消费边界：读取结果的 message.content 前检查其为数组且成员为普通对象。缺失、对象、null 内容或 null 成员不成为有效执行证据；既不抛出该内容访问异常，也不阻塞后续独立有效调用的核验。没有修改事件生成、传输、持久化机制，也没有全局吞异常。

结果仍先按原调用锚点聚合，再做内容检查；同一调用的多个结果保持歧义拒绝，不因跳过非法内容而被洗成合法单结果。新的有效执行可闭合，见证绑定新 callSeq/resultSeq。旧异常事件保留不改。

新增 `test/backend/barrier-event-shape-regression.test.mjs` 五条回归：四种结构异常的原生 Session + Controller + 原生状态 journal 路径，以及 tool-completed/多结果歧义/新执行恢复。修改前 5 条均失败，修改后 5 条均通过。测试覆盖未完成责任保留、重新打开状态 journal 后仍 NO_GO、新执行后 GO、闭合状态重新打开后仍 GO。

重跑原 H3 探针，missing-content/object-content 均从抛 TypeError 改为 NO_GO，补入正常执行后 GO；其他异常对照保持预期。针对性回归 9/9，后台全套 323/323。

证据：[修复前失败](../../artifacts/backend-rebuild/event-shape-defense/red.log)、[针对性回归](../../artifacts/backend-rebuild/event-shape-defense/green.log)、[原探针复验](../../artifacts/backend-rebuild/event-shape-defense/boundaries-after.json)、[完整回归](../../artifacts/backend-rebuild/event-shape-defense/full-regressions.log)。

边界：重新打开的是 Crystra 状态 journal；DSH 对包含非法消息的工作 session 日志仍会拒绝恢复，本修复没有改变或承诺修复非法日志。H3 的已确认 Barrier 防御事项已完成，其余四项保持关闭。
