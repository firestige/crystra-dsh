# 五条反思推测：调用链分析与补证边界

2026-10-12。来源为真实模型验收的 reflection.json 中五条 evidence 为空的条目；它们是源码推测，不是五个已确认缺陷。反思只看了选定四个文件，建议里的“没有边界测试”不代表仓库没有这些测试。

当前入口：DSH agent-loop JSON.parse 工具参数 → 插件工具 → Controller 私有克隆状态；证据由插件 flush 原生 session 后读取 snapshotEvents，agent 不提交 evidence。版本和形状保护需按实时与恢复路径分别判断。

| 假设 | 当前静态判断 | 缺少的证据 |
| --- | --- | --- |
| H1 非 JSON 数组键碰撞 | helper 可存在；标准 JSON 模型参数不能表达原形状；宿主直接 JS API 另论 | 原生工具、宿主 API 和持久化的拒绝/归一化位置 |
| H2 拆分 retained action 共享 | helper 存在共享；Controller 私有副本与对外克隆尚未暴露修改入口 | 公共 API 输入/快照/journal 的修改隔离与恢复 |
| H3 异常事件序号/结构 | 序号由 DSH 生成、恢复校验；实时追加和恢复结构验证存在差异，正常工具链与插件直接追加需分开 | 异常是否真正到达 Barrier、是否误闭合/抛错及恢复行为 |
| H4 总体资源无界 | 子树比较上限不能推导字节与总解析预算；合法大输入条件可达 | DSH 成本与 Barrier 增量、实际包络 |
| H5 候选匹配扩张 | 理论维度存在；已验证较大图正确性，性能未充分测量 | A/X/边密度/无关工具执行对耗时和内存影响 |

已有证据复用：barrier-comparison-budget、payload-spike、payload-hook-regression、large-matching-spike、outcome-spike；不重复宣称这些已覆盖问题仍完全未知。上一轮真实 worker 轨迹为 168 条事件、15 次工具调用、每步最多 1 个 action；最大工具参数约 623 字节、最大结果事件 data JSON 约 10 KB。这仅是该轨迹的量级，不能推出规模安全性。

建议顺序：H1/H2 快速边界排除 → H3 事件链路 → H4/H5 资源测量。总时间盒约 3 小时；各项可提前收敛。先设计后执行，当前不改产品、不启动新模型请求。

## 五个独立实验

- [H1：非 JSON 数组能否进入真实承诺链路](../spikes/correctness-barrier-json-ingress-spike.md)
- [H2：拆分对象共享能否改变运行中的承诺](../spikes/correctness-barrier-split-ownership-spike.md)
- [H3：异常事件能否通过原生证据入口](../spikes/robustness-barrier-native-event-boundary-spike.md)
- [H4：合法大 payload 的实际增量开销](../spikes/performance-barrier-payload-envelope-spike.md)
- [H5：动作与执行规模对匹配成本的影响](../spikes/performance-barrier-matching-envelope-spike.md)

## 2026-10-13 已完成补证

本轮实验已完成，参见[结果与收敛决定](reflection-hypotheses-results.md)。H1/H2/H4/H5 关闭；H3 仅保留有证据的异常事件结构防御缺口。以上“尚未执行”描述为设计阶段历史，不再代表当前状态。
