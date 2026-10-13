# 独立安装包：首次初始化到受管任务验收

2026-10-13。候选包 dsh-crystra@0.1.0，未发布；压缩包 74,040 字节，展开 224,162 字节。[制品与哈希](../../artifacts/backend-rebuild/new-user-onboarding/manifest.json)。逐文件核对包内 backend、README、package.json 和首次使用指南与本次源码相同。

## 用户入口

[首次安装与启用指南](first-run.md) 随包交付。取得独立 tgz 后，使用 npm exec 启动 install；之后使用 DSH 原生会话中的 crystra_initialize_project 和原生共识审批，不手填发布引用。已有正式项目不能被初始化工具覆盖。安装、项目初始化和共识批准是三个不同阶段。

## 实现

- 项目初始化工具只接受目录与 scope，经 DSH 原生 approval 允许一次后，以 settings revision CAS 更新项目字段；保留模型、UI、网络和宿主凭据。随后重启 DSH。
- 显式 initializing 配置允许空初始化种子；受管 Controller 在绑定前拒绝声明和业务核验，不把空引用当作有效共识。初始化阶段不触发要求业务步骤闭合的结束循环。
- 复用既有草稿、Ready、用户审批、宿主发布和版本绑定链路。首份批准的精确引用来自实际 CMS 发布回执，存入原生持久日志。审批完成可结束初始化对话，下一受管任务依然必须声明和实际执行。
- 在线诊断区分 disabled / initializing / managed / invalid，区分 attached 与 managed 会话，实际核验绑定效力并解析已启用模型路由；不输出认证错误细节或密钥。离线 doctor 单独显示 installationReady、配置阶段、DSH 兼容版本，并明确持久绑定/路由需要在线核验。
- 安装前实际比较 DSH 版本。pnpm/Corepack 首次下载使用有界 120 秒等待，避免把冷启动下载误判为不可用。

## 独立验收

只在构建阶段从仓库生成 tgz。运行阶段工作目录、HOME、DSH_HOME、npm 缓存与 XDG 目录全新；只用独立包和已安装 DSH/容器程序。没有导入仓库模块、测试 fixture 或发布辅助函数，没有预置共识引用，没有继承模型登录。使用仓库之外单独制作并通过原生插件管理安装的离线模型适配器，仅输出确定性模型消息；真实 DSH 工具、CMS、审批、持久化、Barrier 和 CLI 执行，不替换其实现。通过浏览器点击原生审批按钮。

| 场景 | 实际观察 |
| --- | --- |
| 独立 npm exec 安装 | 原生插件安装和真实 Squidex/PostgreSQL 初始化成功；无项目发布引用 |
| 项目初始化 | 原生审批显示目录和范围，确认后保存空引用种子并要求重启 |
| 首份共识拒绝 | 实际创建、提交 Ready；原生侧栏显示全文；拒绝后没有发布或激活 |
| 审批期间强制退出 | SIGKILL 后同一会话恢复成功；相同 operationId 返回 interrupted，没有隐式新批准 |
| 新指示重新批准 | 使用新的 operationId，实际发布并绑定；项目 revision 为 1，批准/拒绝/中断各一项 |
| 首个新受管会话 | 首次模型请求即带正式共识；配置文件仍为空种子，证明没有手填引用 |
| 失败与补跑 | 先声明 result-equals；真实工具写出 exitCode=1 的失败记录；尝试结束收到一次 NO_GO；补跑写出 exitCode=0 后 GO 闭合，无 pending |
| 在线诊断 | state=managed、consensus=effective、ready=true，并列出实际受管会话 |
| 安装中途故障与清理失败 | 在另一空白 HOME，于真实容器启动后从外部命令边界注入故障；留下持久恢复记录；新 npm exec 进程 recover 恢复原 profile 并清理自有容器/网络/卷 |
| 正常卸载 | 已安装 CLI 自卸载；模型/UI 设置、用户初始化项目、会话日志和任务文件内容保留；两个共识卷保留；独立包重复卸载成功 |

原生项目/共识审批拒绝、取消、配置并发变化，以及不支持模型路由的诊断另有针对性回归。最终完整后台回归 415 项通过，0 失败/跳过。没有调用付费模型，不据此重新宣称强模型自主规划质量。

## 实际子进程补验

同一制品另起一套全新 HOME/缓存，再次通过原生项目确认和首份共识批准，运行真正的 Node 子进程。独立测试工具只封装 child_process 执行和 JSON 结果，不替换 Barrier 或持久化；退出码来自真实进程：首次抛出 ERR_ASSERTION，返回 1；补跑实际断言通过，返回 0，标准输出为 Actual subprocess assertion passed。Barrier 留下一次 NO_GO，最终 GO 闭合。这个环境再次完成正常卸载，真实程序、退出码/输出文件和会话历史保留。

[补验记录](../../artifacts/backend-rebuild/new-user-onboarding/real-node-process/flow-results.json)、[实际程序](../../artifacts/backend-rebuild/new-user-onboarding/real-node-process/first-check.mjs)、[失败输出](../../artifacts/backend-rebuild/new-user-onboarding/real-node-process/failed-check.json)、[成功输出](../../artifacts/backend-rebuild/new-user-onboarding/real-node-process/passed-check.json)。补验没有重复拒绝/中断场景，这两项由上面的主链路单独覆盖。模型输出仍为离线适配器，安装包 hash 保持不变。

## 冷启动实验发现并修复

首轮强制退出暴露了旧展示代码写入未知必需事件 crystra/consensus-approval-detail，导致 DSH query 拒绝恢复。DSH 明确不提供持久日志的运行时事件登记；当前 append API 也不提供 ignorable 参数。修复为从原生 approval/asked.reason 重建展示，保留可读正文和差异计算；正文续行编码保证正文中的“适用范围：”等文字不能被错拆成元信息。新包重新在空白环境走完审批、强制退出、同一会话恢复，日志只包含 DSH 已知事件。没有修改 DSH 核心或绕过日志校验。

早期包已经写出的未知必需事件日志没有自动改写；升级已有早期环境前需要检查并另行安排受控迁移。本轮没有修改日常 Web profile。该早期失败实验保留为失败证据，最终通过结果来自修复后重新建立的空白环境。

## 证据

- [流程与精确发布引用](../../artifacts/backend-rebuild/new-user-onboarding/flow-results.json)
- [独立故障恢复](../../artifacts/backend-rebuild/new-user-onboarding/recovery-results.json)
- [卸载与保留验证](../../artifacts/backend-rebuild/new-user-onboarding/uninstall-results.json)
- [完整测试](../../artifacts/backend-rebuild/new-user-onboarding/tests.log)
- [原生审批截图](../../artifacts/backend-rebuild/new-user-onboarding/native-approval.png)
- [受管任务 NO_GO 动作线](../../artifacts/backend-rebuild/new-user-onboarding/managed-task.png)

外部验收驱动作为证据保存在 artifacts 中，不是安装依赖，也不进入发布包。验收结束后，先证明正常卸载保留数据，再清理明确可丢弃的合成测试卷；没有清理日常服务。

## 边界

干净环境是隔离 HOME、缓存和 DSH 配置，机器已有 DSH 与可用容器程序，未声称验证了全新操作系统。完整实测为 macOS/OrbStack；结晶仍需已有 Python 和当前 macOS 沙箱。反思与结晶在新用户流程中默认关闭，本轮重点验证首份共识和首个受管任务，不重做付费模型能力评测。跨平台执行器及旧日志迁移均不属于本轮通过范围。
