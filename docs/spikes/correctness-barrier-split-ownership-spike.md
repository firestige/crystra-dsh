---
title: "H2：拆分对象共享能否改变运行中的承诺"
category: "correctness"
status: "Completed"
priority: "Low"
timebox: "25 分钟"
created: 2026-10-12
updated: 2026-10-13
owner: "Crystra"
tags: [technical-spike, barrier, evidence]
---

# H2：拆分对象共享能否改变运行中的承诺

主问题：外部调用方能否通过持有的引用修改拆分后正在核验的断言？

静态观察：splitCommitment 的 retained actions 引用了原 goal 的 action；但 Controller 在私有状态的克隆上操作，声明编译、snapshot、journal 读写也有克隆，操作仅返回 GO/NO_GO。尚未找到这条别名泄漏到外部的正常路径。

实验：
1. helper 对照：拆分后修改原 goal 的嵌套 match/expected，确认别名现象；分别观察 revised/history/pending。
2. 公共 Controller：声明后改原始参数；拆分后改调用方持有的 snapshot/history/pending/journal.read 副本。逐项重新获取状态，比较断言和版本记录，再用独立真实 DSH 工具事件核验。
3. 持久化并重建 Controller，重复核验。覆盖 retained 与 deferred 两类责任，修改输入和修改返回副本分开记录。

完成标准：记录每个引用的所有者、修改前后状态及实际 GO/NO_GO。helper 的共享若被 Controller 隔离，结论为封装路径不成立，不为此自动安排产品修复。

## 边界与交付

来源：`artifacts/backend-rebuild/four-capabilities-live/run-1791815846921/reflection.json` 中无实验 evidence 的对应推测。当前仅完成源码路径分析，本 spike 尚未执行。安排于下一轮补证，当前不阻塞、不作为缺陷清单。

只增加独立实验脚本、测试和证据，不修改产品逻辑，不接触已有验收原始轨迹。无需额外模型调用。交付原始输入、入口、接受/拒绝阶段、状态前后差异、运行版本与结论；无法确定时明确保留未知。

## 决策

待实验结果决定：上游已隔离 / helper 限制 / 受信任宿主误用 / 当前调用可达的失效 / 实测规模边界 / 证据不足。研究成功不要求找到缺陷。修复另行根据证据决定。

## 状态记录

- 2026-10-12：完成静态调用链分析与实验设计；尚未运行。

## 2026-10-13 实验结论

已完成本轮补证；当前路径隔离或未出现需要处理的故障，本轮关闭，不继续追查。详见[实验结果](../backend-rebuild/reflection-hypotheses-results.md)。先前“未执行”说明为设计阶段记录，以上结果取代当前状态。
