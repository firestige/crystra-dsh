# Crystra：当前状态与接续入口

更新于 2026-10-20。先读 [项目方向](project-direction.md)，再依据本文件定位实现。这里记录状态，不从历史探索推导新的实施任务。

## 代码基线与当前任务

- 仓库：`https://github.com/firestige/crystra-dsh`。
- 本次后台重建分支：`codex/backend-rebuild`。
- 最近已交接的实现提交：`55339cc`（M06），前一个提交 `20e979f` 收录 Barrier 性能与 M01–M05 等进度；更早的后台主体为 `ef21875`。
- `55339cc` 已于上次交接提交并推送。新环境应检查实际分支、HEAD 和工作区；若远程或本地有更新，不用此文档中的旧 hash 覆盖更新。
- 本次交接交付项目方向与开发入口文档；这项文档交付不应成为后续 agent 重复执行的任务。**尚未指定下一项功能开发任务**。不自动重做 M01–M06，也不自行推进前端或历史探索。

这些文件是仓库开发入口，不是运行态迁移包。旧机器的绝对路径、登录状态、项目装载、审批和正式共识状态不能自动套用到新设备。

## 当前交付了什么

默认 npm 包 `dsh-crystra` 是 DSH 后台插件，原套件已删除，不做旧套件兼容。仓库包含共识审批的轻量原生 UI 增强，但没有独立工作台或 DSH UI 替代品。各组件在一个仓库中分工，当前不是四个独立热插拔插件。

| 组件 | 当前实现 | 主要阅读入口 |
| --- | --- | --- |
| 共识 | Squidex 受管草稿、提交、用户审批、发布、撤回与历史恢复；精确引用、CAS、授权、operationId/收据与 Pending；装载、卸载与版本切换；持久恢复 | [共识实现](backend-rebuild/managed-consensus.md)、[审批](backend-rebuild/consensus-approval-results.md)、[使用与配置](backend-rebuild/native-usage.md) |
| 承诺与 Barrier | 注入声明指引；工具完成与结构化结果相等检查；原生执行关联；步骤/结束 gate；有限 retain/defer 修订和 pending 继承；持久责任恢复 | `src/backend/controller.js`、`src/backend/barrier.js`、[后续修复](backend-rebuild/barrier-follow-up.md)、[性能修复](backend-rebuild/matching-performance-fix-results.md) |
| 反思 | 独立 DSH 研究 agent；宿主限定源码与实验；实际输出、文件 hash、结构化报告；业务 agent 按需调用；报告持久化及恢复读取 | [反思](backend-rebuild/reflection.md)、[生命周期收口](backend-rebuild/m06-lifecycle-validation-20261014.md) |
| 结晶 | 自动观察支持的重复调用；独立评估与候选构建；实际 Python 文件冻结、hash 验证、历史对拍与准入；局部接管、不适用/异常回退和重新评估；持久恢复 | [结晶](backend-rebuild/crystallization.md)、[实际代码执行](backend-rebuild/crystallization-code.md)、`src/backend/crystallization*.js` |
| 安装与接入 | 薄 CLI 的 install/uninstall/recover/doctor；复用 DSH 插件安装和 settings；环境预检与安装失败回退；首次项目初始化、首份共识原生审批、诊断和自动挂载 | [首次使用](backend-rebuild/first-run.md)、[CLI](backend-rebuild/cli-usage.md)、[独立安装验收](backend-rebuild/new-user-onboarding-results.md) |

正式审批复用 DSH 原生确认；完整正文在侧栏阅读，可切换左右行差异和单页审阅。UI 适配失效时保留或恢复原生可读正文与按钮。修改受管共识不是让用户手填发布引用。

## 最近已经完成的维护工作

Astra 的 [可维护性清单](backend-rebuild/astra-maintainability-review-20261013.md) 是 `ef21875` 附近的历史评审，不是当前未处理清单。原定范围内 M01–M06 均已处理：

| 项目 | 结果与定位 |
| --- | --- |
| M01：原生事实耦合 | `dsh-evidence.js` 将 DSH 事件转换为执行事实，Barrier/结晶核心不直接解析原生事件；保留两者不同的结果口径与来源约束 |
| M02：绑定恢复耦合 | 审批只使用 Controller 的稳定绑定端口；结构化切换回执和旧记录证明留在 Controller，恢复不丢责任、不重复切换 |
| M03：配置指纹 | 明确哪些配置影响结晶适用性；反思模型、评估模型、凭据路由等无关变化不再误使已有结晶失效 |
| M04：journal 版本 | 公共持久化封套与组件领域版本分开；组件负责本领域版本校验，旧记录保留可读与恢复能力 |
| M05：审批/展示适配 | 原生审批、reason 编解码、审核事件与 flush 进入审批 Adapter；UI 的 slot、侧栏及 DOM 进入 UI Adapter；旧文本和详情投影可恢复，适配失败降级，见 [验证报告](backend-rebuild/m05-adapter-validation-20261013.md) |
| M06：内部 agent 生命周期 | 集中角色识别与机械生命周期；保留独立业务策略；修复故障注入复现的 dispose/journal 收尾异常导致关闭等待不结束，见 [验证报告](backend-rebuild/m06-lifecycle-validation-20261014.md) |

M01–M04 的规则与恢复边界详见 [native-usage](backend-rebuild/native-usage.md)。Barrier 原始大规模缺项匹配已完成算法优化；没有用超时或承诺数量上限替代修复。

截至实现基线没有在本次讨论中留下“已确认但决定暂不处理”的具体缺陷清单。这不表示代码无缺陷、支持所有输入或长期可靠性已经证明。发现新的具体问题，应记录复现条件与证据，而不是将下面的边界直接改写成缺陷。

## 当前支持与验证的边界

- 已验证依赖组合是 DSH `0.1.5-rc.2`、Node `24.12.0`、npm `11.6.2`，依赖锁定见 package 文件；未因 DSH 尚未正式发布而维护其特殊分叉。后续版本须做适配核对。
- 完整安装及代码结晶执行验证平台为 macOS；内置执行器使用 Python 与 macOS sandbox-exec。Windows/Linux 没有被宣称同等可用。
- 共识服务使用本地 Squidex/PostgreSQL。无可用容器/Compose 且无已配置共识服务时，安装预检失败，不擅自安装容器环境；卸载默认保留用户数据。
- 原生受管会话包含共识与 Barrier，反思和结晶按配置启用。反思由业务 agent 按需调用；结晶从支持的执行边界自动观察，不依赖业务 agent 主动申请发现。
- 自动结晶当前针对顶层原生工具：参数只有一个 `input` 字段，原始结果为单个 JSON 值。不会自动理解任意 shell 流、通用任务切片或任意外部副作用。
- Barrier 当前只有有限可检查断言与 retain/defer 拆分、pending 继承；不支持任意改写承诺或递归拆分。它不判断是否真正理解源码，不保证完整捕捉所有未声明行为。
- 普通知识库、通用资产仓库、多语言通用执行沙箱、自动最优模型路由、货币成本换算与净收益预测不是已完成能力。它们也未被指定为下一轮任务。
- 不承诺内容或任务普遍正确、任意崩溃窗口 exactly-once、长期稳定率、所有任务都有结晶收益。结晶验证覆盖有限已知边界；反思报告不是正确性认证。

## 验证基线怎么读

M06 完成时的完整后台回归为 **477 passed，0 failed，0 skipped**，记录见其验证报告。这是 2026-10-14 的实现验证基线，不是声称新设备或本轮文档任务重新执行了测试。

已有真实 DSH、原生 Web 审批、真实 Squidex、JSONL 恢复、实际 Python 代码和故障恢复验证。大量机制测试使用本地确定性模型 adapter；历史真实模型实验与之分别记载。不得把它们混称为同一轮“全自主开发”或真实模型质量保证。

清理旧套件后测试集合变化，历史报告中更大的测试数量不能与 477 直接比较并推断回归。`artifacts/`、安装包及 node_modules 不入 Git；可重建的实验材料不要求随设备迁移，缺少旧原始数据时不要声称本机已重新核对。

## 新设备如何开始

1. 读取根目录 `AGENTS.md`、项目方向与本文件，确认本轮用户任务；不必先读全部研究目录。
2. 检查 remote、分支、提交和工作区，区分此后台分支与旧 Crystra/WSR checkout。目录名称和访问权限不决定开发入口；不要覆盖现有修改。
3. 若任务包含新环境搭建或基线复验，核对系统与依赖，再按 README 使用 `npm ci`、`npm test`；安装包检查用 `npm run pack:verify`。不要为一般文档任务拉起服务或调用模型。
4. 需要安装、真实 DSH 或共识验证时再读 first-run/CLI/native-usage，优先用隔离 profile。`npm run qualify:clean-install` 会创建并清理一次性服务，需要对应平台和容器条件。
5. 报告本轮实际确认的状态与环境差异。当前没有已指定的后续功能任务；需要决定方向时参考项目方向中的“未来方向”，提出讨论，不自行转成实施清单。

开发接续不要求迁移原聊天或可重建证据。若另行要求继续旧机器的正式受管任务，才需要单独规划共识数据、DSH 会话、结晶资产及宿主配置迁移；不能把旧文档中的路径、凭据引用或待批准标题直接当成新设备的有效绑定。

## 历史文档与本文件冲突时

- [backend-rebuild/README](backend-rebuild/README.md) 是开发起点与逐次增量，不是当前总览。
- 原始首批共识文件保留“待用户批准”标题和旧机器路径；本会话后来批准并在旧环境发布过，不代表新设备已批准或装载。实际效力要由运行环境的受管机制核验。
- M06 报告结尾的“尚未提交或推送”是报告写成时的状态，后来已提交为 `55339cc` 并推送。
- 较早报告中的异常 payload、重复 callId、匹配性能、反思进程驻留等旧状态，已有后续修复。先查当前使用文档、对应修复和测试，再决定是否仍是问题。

新确认的目标和方案应同步更新方向文档；重要交付进度应更新本文件。历史报告继续保留当时的结论与限制，不能删除过去的失败来制造连续成功的叙述。
