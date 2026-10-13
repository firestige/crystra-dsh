# 当前机器 Web profile 实际接入结果

2026-10-13。后续已接入 DSH 原生共识审批与免重启的受管版本切换，日常插件包更新为 `~/.dsh/plugins/crystra-backend-20261013-approval-r2/dsh-crystra-0.1.0.tgz`。见 [审批链路验收](consensus-approval-results.md)。以下保留首次实际接入记录。

本轮已实际替换日常 Web profile 的旧 Crystra 套件，并启用 `/Users/firestige/Projects/crystra-backend-rebuild`。没有提交、发布 npm 版本或修改前端。

## 依赖问题与修复

原全局 CLI 是 0.1.5-rc.2，但原依赖清单中 270 个其他 DSH 包为 rc.3，只有 1 个为 rc.2。CLI 的 caret 依赖允许安装时漂移。未安装 Crystra 的对照同样出现 sandbox 初始化失败；这不是 Crystra 专属故障。没有将这一观察夸大为已定位到某一条上游代码。

在 `/Users/firestige/.local/share/dsh/runtimes/0.1.5-rc.2` 建立独立部署清单和锁文件，将 DSH 闭包固定为 rc.2，并使用已经通过验收的 Cordis 4.0.2、loader 1.0.3、include 1.0.7 和 schemastery 3.18.2。最终锁中 231 个 DSH 包均为 rc.2。原全局包完整移动至备份，原 dsh 命令指向此受管运行时；没有关闭 sandbox。

实际 profile 的 `patchReload: live` 还复现了 `hmr.registerConfig is not a function`：自动解析到的 HMR 1.0.19 缺少该接口，而 1.0.17 提供它。将此依赖固定为 1.0.17 后，原 profile 可以原样启动。其余 Cordis 周边没有声称全部回退为某个历史版本。最终依赖锁另外经过临时目录离线重建。

## 安装与启用

插件通过 DSH 自带的 `plugin --profile web add dsh-crystra@file:... --ignore-scripts` 安装，正式包保存在 `~/.dsh/plugins/crystra-backend-20261013/dsh-crystra-0.1.0.tgz`。保留原 bundles 顺序和 live 重载设置，只替换旧 Crystra 依赖。

你批准的 [首批共识正文](initial-project-consensus.md) 已发布并绑定；文件中的“待用户批准”是批准时原文的一部分，保留原文避免改变已审阅内容。批准记录与发布回执见 [production-consensus.json](../../artifacts/backend-rebuild/actual-web-install/20261013-073054/production-consensus.json)。

- ID：`914fc21b-d44d-4ba2-a589-60a0b66243e1`
- 发布版本：`2`
- 发布事件：`33dac192-ab3c-40f6-a483-479743984b75`
- 内容 hash：`ac11ec3afc378a00508d93c07a70658054b6394864e57dd9e664f88c97caaadc`
- 项目 scope：`crystra-backend-rebuild`

独立持久 Squidex/PostgreSQL 已启动，仅绑定 `127.0.0.1:1946`；Compose、受保护的服务环境文件位于 `~/.dsh/crystra/services/`，数据使用持久卷，重启策略为 unless-stopped。它不是验收后删除的临时服务。向现有 credentials 追加管理与只读客户端密钥引用，原 refs、records 保留。密钥不写入本文或项目记录。

业务默认仍为 `deepseek-official/deepseek-flash`，reasoningEffort high。仅 Crystra 独立反思与结晶评估使用用户选择的 `kimi-coding/k3`。并未导入或迁移 Codex OAuth。

## 实际接入后验收

实际 Web profile 临时通过 DSH 原生安装机制装入离线模型提供者，以原生 HTTP 会话接口创建项目会话并执行：先声明可检查承诺，执行失败结果，尝试结束被 NO_GO 拦截，补入正常执行后 GO 闭合；停止并重启 Web 后，在同一会话重复闭环。独立读取持久记录确认两次 NO_GO 与两个已闭合承诺，精确共识引用一致。验收后原生移除临时提供者，恢复业务默认配置，再启动最终服务；最终新建项目会话也自动挂载精确共识。

这轮没有调用 Kimi 或其他付费模型，也没有用真实 Kimi 重新评估反思质量。四项机制的完整离线验证及异常路径仍见 [前轮原生验收](native-installation-results.md)；本轮新增的是用户实际 profile 的启动、绑定、Barrier、恢复、配置保留和 LAN 接入证据。

- [实际 Web 离线结果](../../artifacts/backend-rebuild/actual-web-install/20261013-073054/actual-web-summary.json)
- [独立持久记录及配置核验](../../artifacts/backend-rebuild/actual-web-install/20261013-073054/final-audit.json)
- [局域网认证和 TLS 核验](../../artifacts/backend-rebuild/actual-web-install/20261013-073054/lan-check.json)

原 settings 的四个 namespace 语义一致，原凭据 refs/records 一致；Web cordis.yml、cordis.patch.yml、pnpm-workspace.yaml、Caddyfile 逐字节一致。最终 package.json 与新插件安装后状态一致，不含临时验收插件。localhost 与 LAN 的认证会话接口可用；LAN 使用现有 Caddy 根证书验证，没有关闭 TLS 检查。未认证页面 401，认证后页面 200。

## 使用与运行边界

服务当前在后台运行，沿用 [局域网入口](https://192.168.50.175:8080)，本机端口为 3080。登录仍走 DSH 既有启动入口；不要把含令牌的启动地址分享到文档。既有浏览器登录失效时，从本机受保护的 DSH 启动日志重新获取入口。日志为 `~/.dsh/crystra/web-runtime.log`（0600），PID 记录为 `~/.dsh/crystra/web-runtime.pid`。

在 Web 中选择上述项目目录创建会话即可自动接入，无需实验脚本装配。项目外会话不受本项目 Crystra 管理。当前只配置此项目；反思检查文件和实验、结晶自动发现边界见 [使用说明](native-usage.md)。

当前没有新增 DSH 开机自动启动项（此前也没有）；Caddy 原启动项保留。关闭终端不影响这次后台启动的进程，机器重启后可正常启动：

```sh
dsh --profile web --no-open --port 3080
```

已有实例运行时不要重复启动同端口。Squidex 服务的日常启动使用持久 Compose：

```sh
docker compose --env-file ~/.dsh/crystra/services/service.env -f ~/.dsh/crystra/services/compose.yml up -d
```

不要使用 down -v 删除持久共识数据。不要直接执行无约束的全局 npm 重装，否则 caret 依赖可能再次混装；修复后依赖由上述受管部署目录的 package.json/package-lock.json 管理。

## 备份与回退

备份：`/Users/firestige/.local/state/dsh-repair/20261013-073054`（目录 0700）。`dsh-home/` 保存安装前配置、凭据与 profile 元数据；`global-dsh/` 保存原全局包；`settings-enabled.yaml` 保存已启用新插件且保留原业务模型的配置。

回退应先停止这次 Web PID，确认没有新的用户配置修改后，再移除原全局包位置的**符号链接**并将 `global-dsh/` 移回原位置；恢复需要回退的 settings/credentials 与 profile 元数据，按原生插件管理重建相应依赖。不要盲目覆盖安装后新增的用户配置。仅恢复 package.json 不等于恢复 node_modules。原全局依赖本就已确认不可启动，所以回到旧包不是可用性修复。回退插件不需要删除 Squidex 卷或现有会话记录。
