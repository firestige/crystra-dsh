# 新用户：从安装到首个受管任务

当前已适配 DSH 0.1.5-rc.2。先按 DSH 自己的安装说明准备 DSH Web、Node、pnpm 和业务模型。当前完整验证平台是 macOS；结晶执行器需要可执行的 Python 和 macOS 沙箱。已有容器接口须支持 Compose。Crystra 不自动安装容器软件。

## 1. 安装独立制品

取得提供方交付的 `dsh-crystra-VERSION.tgz`，无需克隆仓库或安装开发依赖。退出工作中的 DSH 后执行：

```sh
npm exec --package /absolute/path/dsh-crystra-VERSION.tgz -- crystra install --profile web
```

会检查兼容版本与环境，复用 DSH 安装插件，初始化本地 Squidex/PostgreSQL、权限及宿主凭据。不自动创建、批准或发布共识。没有容器环境且没有已配置共识库时在修改前失败。已有模型、UI、LAN 配置保留。

```sh
dsh plugin --profile web exec crystra doctor
dsh --profile web
```

`installationReady` 表示安装部件；`project` 表示配置阶段。离线 doctor 不声称已核验持久共识效力和模型路由，请在 DSH 会话请求调用 `crystra_installation_status`。

## 2. 初始化项目

在 DSH 的普通会话中明确告诉 agent：

> 初始化 Crystra 项目，目录为 /absolute/path/to/project，适用范围 project:my-project。先请求我确认，不要发布共识。

agent 调用 `crystra_initialize_project`，DSH 原生审批展示项目目录和适用范围。允许一次后，宿主通过 DSH settings 的 revision CAS 只写入项目初始化配置。拒绝、取消或配置在等待期间变化均不启用。不会更改模型或凭据。已有项目不能被该工具覆盖。

按返回提示退出并重启 DSH。在该目录新建会话。此时为“初始化中”，尚非受管任务。

## 3. 首份共识审批

提供自己的真实约定文档，要求 agent 整理并提交首份共识：

> 根据我提供的约定整理首份项目共识，提交给我审批。批准后发布并启用。批准前不要开展业务实现。

agent 使用现有受管草稿工具提交 Ready，再请求 `crystra_consensus_approve`。阅读 DSH 原生审批卡和侧栏完整正文。只有“允许一次”才发布并绑定；拒绝后不发布。版本、事件、发布者和内容 hash 由宿主从真实发布回执生成，无需用户手填。

首份批准后，本会话和后续新会话使用正式共识，不需要再次重启。初始化种子保持不变，批准后的绑定保存在 DSH 持久日志中，不能手改种子冒充批准。其他已有初始化会话不会被隐式切换；请新建受管任务会话。

等待审批时退出 DSH，不算批准；恢复旧操作会返回 interrupted，后续新批准须有用户新的明确指示。

## 4. 检查与首个任务

让 agent 调用 `crystra_installation_status`：项目应为 managed、共识为 effective、ready 为 true。原生诊断会实际解析启用的模型路由，不执行付费推理。离线 doctor 的配置种子可能仍显示 initializing，以在线持久绑定核验结果为准。

开始一个有明确可核验动作的任务。agent 先声明承诺，再执行工具；缺少实际执行或断言不满足时 Barrier 返回 NO_GO，补入实际执行后可闭合。共识和 Barrier 自动挂载，用户不手动维护状态机。

反思和结晶默认关闭。在 DSH 原生 Plugins/settings 的 crystra 配置中启用：反思选择已有 provider/model、核心文件及实际检查命令；结晶选择已有 provider/model 与 Python 绝对路径。修改后重启 DSH，再用原生诊断检查路由和执行环境。反思由业务 agent 调用独立工具，结晶观察支持的重复工具边界；不承诺任意任务都能自动结晶。

## 5. 故障与卸载

安装失败自动回退；报告仍有未完成操作时：

```sh
npm exec --package /absolute/path/dsh-crystra-VERSION.tgz -- crystra recover --profile web
```

保留原始安装包，可在插件入口缺失时恢复。共享配置有外部修改时保留变更并明确报告，不盲目覆盖。

退出 DSH 后卸载：

```sh
dsh plugin --profile web exec crystra uninstall
```

默认保留共识数据卷、DSH 会话日志、结晶资产和安装记录/制品缓存；只移除仍与所有权记录一致的自有配置并停止 CLI 自有服务。用户后续修改与外部共识服务保留。当前没有一键删除全部历史数据命令。

重新安装使用原始制品，会复用持久共识库。手动删除过配置时，不把已有正式共识自动绑定给新项目，仍需通过受管审批选择版本。
