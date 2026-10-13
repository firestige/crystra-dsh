# Barrier 关联修复与异常嵌套防御

2026-10-12。承接 reflection-follow-up.md，按用户要求增加防御并修复已确认关联缺陷。

## 准确执行身份

会话由 evidence.sessionId 绑定，单次执行由 tool/call 事件 seq 标识。文本 callId 作为附加核对信息，不再作为最大匹配的去重键。

结果必须有唯一 sourceEventSeqs 条目，准确指向声明之后、核验截止之前的调用；结果序号必须晚于调用，message source.callId 和结果块 toolCallId 仍需吻合，且不能是错误结果。缺失/多源引用、重复结果事件或重复匹配结果块都不能提供证据。不回退到仅按文本 ID 猜测关联。

因此早期失败执行不能借用后来同 ID 的成功结果；两次同 ID 的真实成功执行又能分别完成两项承诺。既有调查测试移入 test/backend/barrier-call-identity.test.mjs，进入日常 npm test，不再保留已知失败测试。

## 异常历史防御

拆分前显式要求 version === 1 且 versions 是空数组。已有历史、嵌套历史、历史形态损坏或异常版本直接拒绝，不再复制进新快照。当前支持每份原承诺一次 retain/defer 拆分，后继承诺通过 pending 继承；没有重设计历史存储。异常持久状态恢复后的控制器测试确认 NO_GO，原承诺与 pending 不被改写。

这是阻止继续产生嵌套的域检查，不是任意巨大或损坏持久文件的通用读取沙箱。正常的一次拆分仍保留原承诺快照。

## 结果字段核验契约

核对当前安装的 DSH 0.1.5-rc.2：工具层验证并持有 execute 的 value，agent-loop 仅把模型可见 content、错误信息与可选 presentation meta 写入 tool/result。通用原始 value 没有进入该事件。meta 是工具自行定义的展示投影，不能普遍当成原始结果。

因此 result-equals 明确限定为完整 JSON 文本的字段检查。分段 JSON 可拼接解析；说明文字混合 JSON 不支持，仍 NO_GO。tool-completed 不要求 JSON，也不代表具体业务结果成功。注入说明已写明边界，不增加启发式提取器或自建结果协议。原生工具测试核对实际生产事件没有通用 value 字段。

## 单次核验索引与测量

先单遍建立调用与准确结果关联，再针对有效执行建立动作候选，参数和结果 JSON 按需每次执行解析一次。保留上一轮最大匹配，匹配键改为 callSeq；候选关系与匹配本身仍有成本，不能声称整个核验恒定时间。

相同诊断输入下，5项动作、无结果调用数50/100/200，旧事件类型读取12,750/50,500/201,000，新实现50/100/200。20项动作、10,000条无关历史，旧401,220，新20,060。该计数证明消除了原先重复扫描结果的增长；耗时也是同机单进程诊断，未作为生产延迟或端到端收益承诺。

原始数据：artifacts/backend-rebuild/association-fix/performance.json。旧实现保留在同目录 barrier-before.js；失败/通过记录为 red.log、green.log。历史报告保留当时的未修复状态，以本文件为当前后续状态。

## 最终验证

先新增六项失败回归，再实施修复。原生关联、异常历史恢复、既有最大匹配穷举及完整后台链均纳入最终全仓验证：`npm test` 362/362 通过；`git diff --check` 通过。日志：`artifacts/backend-rebuild/association-fix/full-tests-final.log`。本轮无真实模型请求，验证使用确定输入和实际 DSH 原生执行链。

## 剩余疑点的观察实验（已执行）

按用户要求设计，先收集证据再决定修复或策略：

1. [异常 payload 的原生可达性与失败行为](../spikes/robustness-barrier-payload-spike.md)
2. [等价匹配下的拆分分配语义](../spikes/architecture-barrier-split-allocation-spike.md)
3. [较大候选图的匹配与证据一致性](../spikes/correctness-barrier-large-matching-spike.md)
4. [结果歧义防御与有界资源观察](../spikes/robustness-barrier-outcome-resource-spike.md)

四组已完成，生产实现未改。发现尚未修复的异常 payload 闭合阻塞，并确认拆分分配的策略差异。见 [观察结果汇总](barrier-spike-results.md)。

后续两项已修复：异常比较受控拒绝并支持正常后继闭合，等价拆分允许提议约束的合法最大分配。全仓568项通过。详见 [修复及回归证据](payload-split-fix.md)；上文未修复状态保留为当时实验记录。
