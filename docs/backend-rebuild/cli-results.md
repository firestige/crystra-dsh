# 薄 CLI 安装与回退验收

日期：2026-10-13。使用实际 dsh-crystra 打包制品、DSH 0.1.5-rc.2、pnpm 11.23.0 和 OrbStack Docker/Compose；无付费模型调用。

## 结果

- 最终后台回归：404 项通过，0 失败/跳过。
- 隔离 profile：真实安装并初始化 Squidex/PostgreSQL；通过原生 `dsh plugin exec` 调用已安装的 CLI；重复安装；已安装 CLI 自卸载；重装；重复卸载均通过。
- 正常卸载保留两个数据卷，重装后共识草稿的 ID、正文和版本逐项相等。初始化未自动批准或发布共识。
- 无容器接口且无已有共识库：修改 profile 前失败，无安装副作用。
- 在真实初始化完成、配置及凭据写入后注入失败：恢复原配置、凭据、profile 文件和依赖目录状态，删除本次新建容器、网络和卷。
- 独立新 CLI 进程读取持久恢复记录，以及已退出进程安装锁的恢复通过。共享配置被外部修改时保留变更和待恢复记录，不强行覆盖。
- 直接 add 的防御：缺部件提供启动诊断/原生诊断工具；受管任务模型请求前失败。普通项目和内部评估 agent 保持选择边界，相关原生生命周期回归通过。

## 实际 Web profile

已用最终 CLI 更新并重新启动 Web profile。doctor 就绪；原生模型目录及项目会话创建通过；原局域网 HTTPS 页面与原生 RPC 通过。默认 DeepSeek Flash、反思/结晶 Kimi K3、UI、LAN 和原凭据保留。沿用原有共识库，CLI 将其识别为 external，不接管服务。

原 cordis 配置和 LAN Caddyfile 内容未变；原 workspace 配置键保留，新增 34 条有所有权记录的 SDK 兼容约束。profile 可见的 14 个 DSH SDK 包均为 rc.2；全局运行时 231 个 DSH 包仍为 rc.2。

## 实测中修正的安装问题

1. 实际 Squidex API 更新 workflow 后名称为 Unnamed：验收改为核对状态、只读限制和 Owner/Reader 权限，避免把名字当作效力证明。
2. 仅开发环境可解析的凭据 SDK 依赖：补为发布包 runtime 依赖及其必要 peer 闭包，已安装 CLI 可独立解析。
3. 生成凭据引用名不符合 DSH 规则：复用原生 credentialRef/凭据解析器，写入前校验，重复安装通过。
4. pnpm 在消费方解析传递依赖时混入 rc.3：CLI 在 profile 写入受管兼容约束，冲突前置拒绝，回退/卸载跟踪所有权；实际 profile 再次核验一致。
5. 重复安装覆盖配置所有权记录：继承前次 receipt，后续自卸载及重装验收通过。

## 证据与复跑

- [完整回归记录](../../artifacts/backend-rebuild/cli-installation/tests.log)
- [真实安装/卸载/重装](../../artifacts/backend-rebuild/cli-installation/lifecycle.json)
- [真实失败回退](../../artifacts/backend-rebuild/cli-installation/failure-rollback.json)
- [实际 profile 保留核验](../../artifacts/backend-rebuild/cli-installation/actual-preservation.json)
- [doctor](../../artifacts/backend-rebuild/cli-installation/actual-doctor.log)、[LAN](../../artifacts/backend-rebuild/cli-installation/lan-check.json)、[源码哈希](../../artifacts/backend-rebuild/cli-installation/source-hashes.json)
- 可复跑脚本：`scripts/backend/cli-install-acceptance.mjs` 与 `scripts/backend/cli-install-negative-acceptance.mjs`，仅创建隔离 profile；真实容器验收需要已有可用容器接口。脚本结束清理自己的实验资源。

## 明确边界

本轮平台是 macOS；Docker 兼容检测不等于所有容器产品、Windows/Linux 均已验收。结晶执行器仍使用当前 macOS 沙箱，缺失或平台不支持时明确拒绝，不降级绕过。安装/卸载前应退出工作中的 DSH，不承诺多方同时改 profile 依赖时自动合并。持久记录恢复不等于已覆盖任意强杀和硬件故障窗口。

插件提醒使用 DSH 日志、工具和任务错误，未新增 Web 弹窗。尚未发布新的 npm 版本，当前通过本地制品安装；使用入口见 [cli-usage.md](cli-usage.md)。
