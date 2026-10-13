# Crystra 薄 CLI

CLI 只协调原生插件安装、共识服务准备及失败回退；agent、模型、工具执行和会话仍归 DSH。当前开发包提供 `crystra` bin，无需新增常驻服务或调度器。

新用户无需仓库，安装制品后按 [首次安装与启用](first-run.md) 使用 DSH 原生项目确认和首份共识审批。`doctor` 区分 installationReady 与配置阶段；离线不核验持久共识效力或模型路由，在线使用 `crystra_installation_status`。

## 当前机器

Web profile 已安装此 CLI，可直接使用：

```sh
dsh plugin --profile web exec crystra doctor
dsh plugin --profile web exec crystra recover
dsh plugin --profile web exec crystra uninstall
```

卸载默认保留共识数据。当前机器沿用原有共识库，CLI 不接管或停止它，也不移除原模型、UI、LAN 配置和凭据。

首次从当前开发仓库安装：

```sh
node /Users/firestige/Projects/crystra-backend-rebuild/src/backend/install/cli.js install --profile web
```

从打包制品启动 CLI，也可以使用 npm 的原生可执行入口：

```sh
npm exec --package /absolute/path/dsh-crystra-0.1.0.tgz -- crystra install --profile web
```

以上是本地制品用法，未发布新的 npm 版本。`--package` 可指定交给 DSH 的插件制品；省略时将当前 CLI 所在包打成新的持久 tarball，再调用原生 add，避免开发目录引用与同版本缓存混淆。`--home` 可选，默认沿用 DSH_HOME。已有工作中的 DSH 应先退出，安装完成后重新启动，避免原生热加载在部件尚未就绪时接入任务。

## 命令及职责

| 命令 | 行为 |
| --- | --- |
| install | 检查 DSH/pnpm；连接已配置的 localhost 共识库，或探测已有容器接口后部署受管 Squidex/PostgreSQL；原生 add、schema/workflow/只读客户端初始化、凭据与配置局部写入 |
| uninstall | 原生 remove；停止 CLI 自有服务；只删除仍与安装记录相同的自有配置/凭据；保留数据卷以及用户后续修改 |
| recover | 从持久记录恢复未完成安装，或继续未完成卸载；仍有外部配置冲突时明确保留记录和配置 |
| doctor | 报告安装/共识库/Python及当前沙箱的就绪状态，未就绪时退出码 2；不运行付费模型，不进行安装 |

没有容器环境且未配置已有共识库时，在修改 profile 前失败，不自动安装 Docker 或其他容器软件。探测使用 Docker/Podman 兼容接口与 Compose 能力；本轮实测是已有 OrbStack 的 Docker 接口，不据此宣称所有容器产品均已验收。

Python 和当前 macOS 沙箱仅在启用结晶执行器时检查。CLI 不安装 Python，也不在不支持的平台关闭沙箱。共识、Barrier、反思的安装不因此强制要求 Python。Windows/Linux 的完整安装及结晶执行器适配尚未验收。

初始化只准备共识库结构和权限，不创建或发布示例共识、不自动批准正文、不选择业务模型。项目根、scope、精确共识引用和反思/结晶模型仍通过 DSH 原生配置与审批确定。

## 直接 plugin add

仍支持 DSH 原生 add。包本身没有会偷偷部署容器的 npm 生命周期脚本；因此 add 成功仅代表插件安装完成。

- 未配置时保持 disabled，并输出明确的启动警告和 `crystra doctor/install` 补齐指引。
- 原生工具 `crystra_installation_status` 可读取就绪情况、缺失部件及操作指引，不暴露密钥。
- 已启用项目在模型请求前核对共识服务及启用的结晶执行部件；缺失时明确失败，不伪装成已受管。其他项目与内部评估 agent 保持原选择边界。
- 即使只做了原生 add，也可通过 `dsh plugin --profile web exec crystra install` 补齐初始化。

提醒使用 DSH 日志、诊断工具及任务错误，不声称新增了 Web 弹窗或工作台。

## 回退与数据边界

安装记录、配置快照和依赖目录快照保存在 `$DSH_HOME/crystra/installer/<profile>`，使用私有目录/文件权限；文件原子写入复用 DSH 的 atomic-write，凭据格式和引用名复用 DSH 的校验器。安装与卸载调用继续复用 DSH/pnpm。

当前适配目标为 DSH 0.1.5-rc.2。CLI 在 profile 的 pnpm workspace 写入配套 SDK 版本约束，防止传递依赖混入 rc.3；不会覆盖已有的冲突约束，而是在安装前拒绝并提示。新增约束记为本次自有配置，卸载时只移除仍与记录一致的条目，保留用户原有 workspace 设置。这是当前版本的兼容策略，后续支持新版 DSH 时需同步更新并验收。

失败时只清理本次新建的容器、网络、卷和 CMS app；已有卷与服务不被当作新资源删除。配置和依赖目录恢复到操作前快照。发现共享配置被外部修改时，不覆盖它，保留待恢复记录。正常卸载采取逐键保留，不覆盖整份旧 settings。

已验证新的 CLI 进程可读取持久回退记录，并处理已退出进程留下的安装锁。没有证明任意强杀时刻/任意硬件故障都自动恢复；也没有承诺运行中的 profile 被多方同时改包时可自动合并。保留这些边界，不把安装锁解释为 DSH 全局写锁。
