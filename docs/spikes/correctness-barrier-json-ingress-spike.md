---
title: "H1：非 JSON 数组能否进入真实承诺链路"
category: "correctness"
status: "Completed"
priority: "Low"
timebox: "20 分钟"
created: 2026-10-12
updated: 2026-10-13
owner: "Crystra"
tags: [technical-spike, barrier, evidence]
---

# H1：非 JSON 数组能否进入真实承诺链路

主问题：稀疏数组、带额外属性的数组，能否经当前 DSH 工具入口成为持久化的有效承诺？

静态观察：canonical 的数组处理存在不同 JS 形状同键的可能；DSH agent-loop 对工具参数使用 JSON.parse，JSON 本身不能表达数组空洞和额外数组属性。Controller 的直接 JS 调用是另一条受信任宿主入口，不能混为模型输入。

实验：
1. 直接调用 helper，比较 []、Array(1)、[null]、带额外属性数组，覆盖 expected/actions/path。此组仅是阳性对照。
2. 同一组经真实 DSH 工具参数入口；不能表示的形状记录为“不可表达”，不得先 JSON.stringify 后把得到的 null 当原输入。
3. 独立测试宿主直接 Controller 调用和 DSH 的 JSON 快照边界，记录谁拒绝、谁归一化；对成功接受的合法数组做原生持久化恢复。

完成标准：明确模型入口、宿主入口和 helper 的值域及实际落盘结果。只有当前支持入口接受且导致错误闭合，才归为运行缺陷；helper 独立成立不够。

## 边界与交付

来源：`artifacts/backend-rebuild/four-capabilities-live/run-1791815846921/reflection.json` 中无实验 evidence 的对应推测。当前仅完成源码路径分析，本 spike 尚未执行。安排于下一轮补证，当前不阻塞、不作为缺陷清单。

只增加独立实验脚本、测试和证据，不修改产品逻辑，不接触已有验收原始轨迹。无需额外模型调用。交付原始输入、入口、接受/拒绝阶段、状态前后差异、运行版本与结论；无法确定时明确保留未知。

## 决策

待实验结果决定：上游已隔离 / helper 限制 / 受信任宿主误用 / 当前调用可达的失效 / 实测规模边界 / 证据不足。研究成功不要求找到缺陷。修复另行根据证据决定。

## 状态记录

- 2026-10-12：完成静态调用链分析与实验设计；尚未运行。

## 2026-10-13 实验结论

已完成本轮补证；当前路径隔离或未出现需要处理的故障，本轮关闭，不继续追查。详见[实验结果](../backend-rebuild/reflection-hypotheses-results.md)。先前“未执行”说明为设计阶段记录，以上结果取代当前状态。
