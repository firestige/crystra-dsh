# 原生安装与自动接入验收

2026-10-13。实现于 `codex/backend-rebuild`，未提交或发布。

## 结果与证据

实际入口是 DSH 自带 `plugin add`、headless 和 Web 命令。Web 会话通过登录 URL 交换浏览器 cookie，再调用原生 `session/create`、`session/prompt`；验收程序不调用 agents.create/attach 装配业务 agent。模型使用原生安装的离线测试 provider，CMS 使用独立的真实 Squidex/PostgreSQL，Python 候选执行经过真实代码桥和 sandbox-exec。

最后一轮原生证据目录：[native-runtime/1791825987361](../../artifacts/backend-rebuild/native-runtime/1791825987361/)。

| 场景 | 观察 |
| --- | --- |
| 原生安装与未配置启动 | 自动登记 bundle，disabled 时普通会话正常结束 |
| 项目外 agent | 正常运行，不挂业务承诺工具与共识 |
| 首次请求 | 已含精确共识、当前责任及承诺工具 |
| 承诺未兑现 | 提前结束产生 NO_GO，实际执行后 GO 闭合 |
| Web 重启恢复 | 通过原生 prompt 恢复既有状态并完成第二轮工作 |
| 恢复时隐式改变绑定 | 原生持久 turn/end 明确记录 error：Restored consensus binding cannot change implicitly；零模型请求 |
| 本地 CMS 认证 | TokenRef 与 ClientId/SecretRef 两种原生配置均完成实际共识读取 |
| 独立反思 | 使用独立模型路由，读取文件、实际执行 regression，保存 completed 报告；未挂业务 Barrier |
| 自动结晶 | 实际重复工具执行触发独立评估、Python 注册、两份历史对拍并准入；一次原生调用被接管 |
| 不适用结晶输入 | x=-1 实际回到原工具；适用 x=3 没有执行原工具 |
| 缺凭据、CMS 断连、错误引用、配置不完整 | 全部失败且模型请求数为零 |
| 配置保留 | 现有 settings 与 Web patch 的副本逐字节不变，bundles 顺序、patchReload 保留，原生组合仍含 ui-workspace 和原 LAN trust |

上述观察由独立原生持久日志读取复核，不以“退出码为 0”单独判定四项能力成功：[日志核验](../../artifacts/backend-rebuild/native-runtime/1791825987361/record-audit.json)、[Web 恢复结果](../../artifacts/backend-rebuild/native-runtime/1791825987361/web-summary.json)、[配置保留结果](../../artifacts/backend-rebuild/native-runtime/1791825987361/preservation.json)。共读取 20 份记录，4 份已闭合承诺状态，1 个准入结晶族和 1 次接管。

## 本轮发现并修复

1. 原生创建通知早于 settings 就绪时，临时阻拦未解除。先复现，修复为首次设置初始化时清理临时 guard，再按已解析配置同步挂载；disabled 时解除临时 guard。
2. 宿主和安装插件解析不同的 persistence 包副本，instanceof 无法识别真正的日志缺失。先由原生启动复现，再补回归；改用公开错误类型和精确 sessionId 核对，只为确实缺失的对应日志创建，不吞存储故障或错误 session。
3. credentials resolve 返回空时触发未注入属性的二次访问，错误信息变成 Cordis 报错。保留原生 get 通道，不因空结果切换访问方式，明确报告宿主凭据缺失。
4. Squidex 客户端凭据接入包含到期前续取、并发请求合并和失败后重试，不要求手动续填短期令牌。

## 与 Crystra 无关但影响当前安装的两项摩擦

- 当前全局 DSH CLI 标称 rc.2，但 dsh-sandbox-local 实为 rc.3。不安装 Crystra 的原生对照也启动失败。本轮使用独立安装、依赖一致的 rc.2 完成验收；没有关闭沙箱、修改全局 DSH 或现有配置。
- 从旧 Web profile 升级时，只给 tarball 路径会使 pnpm 先解析旧远端套件并因历史 dsh-brand 依赖失败。显式 `dsh-crystra@file:/absolute/package.tgz` 可通过原生插件安装机制替换旧依赖；配置副本已验证。

## 边界

完整后台回归 335/335；安装后的代码另通过 126/126 后台检查（含本轮新增配置/生命周期/认证用例）及 12/12 真实 Squidex 场景，清洁安装通过；验收容器及卷已清理。原生安装包约 38 KB（压缩，依赖独立安装）。这轮验证的是原生接入机制，没有重新测量真实高阶模型质量或长期可靠性。

以上是隔离验收当时的边界。随后已修复日常 DSH 依赖、替换实际 Web profile 旧插件并发布用户批准的真实共识，新增实际安装验证见 [actual-web-installation-results.md](actual-web-installation-results.md)。使用方式见 [native-usage.md](native-usage.md)。
