# 后台插件清理与清洁安装验收

2026-10-12，分支 `codex/backend-rebuild`。本轮从全新环境完整执行，没有续用上一轮消费者或续验 CMS 阶段。

## 清理结果

默认 `dsh-crystra` 直接导出 `src/backend/index.js`。移除旧执行器、Studio/UI、初始化模块、evidence/evolution 配套服务、旧 providers、local file 组件输入，以及对应的测试、构建、资格认证和发布脚本。删除旧 client 和 backend 子路径导出，无兼容 shim。bundle 配置只加载后台插件，不再禁用/替换 DSH 自带 UI。

保留共识、Barrier、反思、结晶及 DSH 适配的实现、全部新后台回归、故障注入夹具和研究记录。历史实验产物不参与安装。工作树依赖已删除重装，锁文件重建；依赖闭包不含 crystra-execution、crystra-ui-core、Codex/Copilot CLI、LangGraph 或 better-sqlite3。核对清单见 `artifacts/backend-rebuild/removed-legacy-paths.json`。

## 验收结果

- 全部后台回归：318/318，无失败、取消或跳过；原套件测试随旧实现删除，不再运行。
- 已安装包的四项能力：114/114，无跳过，通过默认入口及安装包内实现执行。
- 全新 Squidex/PostgreSQL：12/12，无跳过。
- 默认入口、移除旧导出和打包边界回归：2/2（包含在318项中），先验证旧布局失败，再验证新布局通过。
- 独立数据库的两个容器、网络和两个卷已删除，未操作其它服务。

四项能力覆盖：

| 能力 | 本轮验收覆盖 |
| --- | --- |
| 共识 | 精确发布引用、草稿隔离、授权/撤销、CAS冲突、装载/卸载、撤回/恢复、SIGKILL边界、发布响应丢失、CMS停机、DSH完整进程重启、不同scope并发 |
| Barrier | 原生执行依据、调用身份与版本、未兑现承诺拒绝闭合、合法修订与责任保留、错误/无效结果及重启恢复 |
| 反思 | 独立DSH agent、真实源代码读取和实验、正确性/鲁棒性/性能报告、取消、超时/协议异常、传输清理与进程退出 |
| 结晶 | 自动发现和提议、agent选择接受/暂缓/拒绝、对拍准入、实际生成Python文件执行、hash绑定、失败回退、修复重验、恢复重启 |

## 包体

| 项目 | 清理前 | 清理后 |
| --- | ---: | ---: |
| npm压缩包 | 311,882,453 B（311.9 MB） | 35,160 B（35.2 KB） |
| 解包内容 | 760,091,414 B | 116,789 B（116.8 KB） |
| 文件条目 | 13,100 | 20 |
| bundled dependencies | 旧执行器/UI及传递依赖 | 无 |

压缩包减少约 99.9887%。35 KB是发布包本体，不含registry下载依赖；本轮安装的后台包、显式DSH测试宿主及其全部依赖合计约110 MiB。运行时依赖4项，开发/验收宿主依赖10项。

归档SHA-256：`e49ecee5cddd71a65770f73189e1cf085ed1919747c0bb59f1f71210d7b763b9`。

## 隔离与证据边界

`npm run qualify:clean-install` 每次新建消费者、空HOME/XDG/TMPDIR/npm cache及空npm配置；从本轮tarball安装。消费者显式安装DSH rc.2测试宿主组件并设置本次受支持版本的overrides，不能把Crystra的overrides误认为会自动传给消费者。不复制旧配置、旧JSONL、结晶资产、模型凭证或数据库卷。

消费测试只能读取安装目录和本轮临时任务目录，并实际核验读取开发仓库被拒绝。原生文件锁和子进程被显式允许，因此这是依赖隔离检查，不是恶意代码安全隔离证明。Python执行器继续使用自身macOS沙箱。复制的测试只调整产品导入指向和独立Docker实例名，不放松断言。

本轮使用确定性DSH adapter和localhost模型协议夹具，执行真实DSH loop、工具、JSONL及Python代码；没有调用真实高阶模型。此前真实模型质量实验是独立证据。本结论适用于当前macOS、Node24.12/npm11.6.2、DSH0.1.5-rc.2及固定Squidex镜像；不代表其它平台/版本或长期可靠性已验收。CI配置已更新，但没有声称远端CI已运行。

消费目录：`/private/tmp/crystra-clean-DyB9oi/consumer`。结果、归档、锁文件、逐阶段日志及CMS明细见 `artifacts/backend-rebuild/backend-only-clean-install/`；`result.json` 为最终机器可读状态。旧混合包安装证据仍单独保留在 `artifacts/backend-rebuild/clean-install/`，不能混作本轮结果。
