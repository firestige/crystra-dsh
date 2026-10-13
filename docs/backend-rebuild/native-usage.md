# 原生 DSH 安装与使用

2026-10-13。适用已验证的 DSH 0.1.5-rc.2 / Node 24.12.0。工作台不在本次范围。

## 安装

新用户优先按随包交付的 [首次安装与启用](first-run.md) 操作：安装包初始化服务后，在 DSH 中请求 `crystra_initialize_project`，通过原生确认进入空引用初始化阶段，再提交和批准首份共识。无需用户手填下面的发布引用。下列配置主要用于已有正式绑定的集成说明。

推荐使用 [薄 CLI](cli-usage.md) 完成原生插件安装、部件检查、共识库初始化及失败回退。下面保留直接 `plugin add` 的方式；它只安装插件，不部署服务，缺部件会收到诊断与补齐指引。

在工作目录打包，然后使用 DSH 自带插件管理入口。升级旧套件时必须显式写包名，避免 pnpm 在识别 tarball 前解析旧套件依赖：

```sh
npm pack --ignore-scripts
# 将下面路径替换为刚生成的包的绝对路径。
dsh plugin --profile web add dsh-crystra@file:/absolute/path/dsh-crystra-0.1.0.tgz --ignore-scripts
```

安装器自动维护 profile dependencies 和 bundles。新包的 patch 只插入 Crystra，不禁用或替换 DSH UI。不修改默认业务模型、provider 登录或局域网 trustedHosts。修改前备份 profile 的 package.json、pnpm-lock.yaml 和 cordis.patch.yml。不要把本文配置整体覆盖到现有文件。

未配置时 Crystra 默认 disabled，普通 DSH agent 继续工作。安装不等于启用。安装后的首次启用和参数修改需要重启 DSH；设置发生变化时原绑定保持不变，状态标记 restartRequired，防止热更新改变已有责任。

## 配置

在现有 `$DSH_HOME/settings.yaml` 新增 `crystra` namespace，也可使用 DSH 原生 settings API/Plugins 设置入口。保留其他 namespace。当前支持一个项目根目录及其子目录；不同根目录需要独立 DSH 配置。

```yaml
crystra:
  enabled: true
  project:
    root: /absolute/path/to/project
    scope: project:P
    references:
      - id: CONTENT_ID
        published_version: 3
        publication_event_id: PUBLICATION_EVENT_ID
        actor: PUBLISHER_ACTOR
        data_hash: EXACT_64_CHARACTER_SHA256
  squidex:
    baseUrl: http://127.0.0.1:1946
    app: YOUR_APP
    schema: agreements
    managementClientId: YOUR_APP:management
    managementSecretRef: CRYSTRA_SQUIDEX_MANAGEMENT_SECRET
    consumerClientId: YOUR_APP:consumer
    consumerSecretRef: CRYSTRA_SQUIDEX_CONSUMER_SECRET
    timeoutMs: 10000
  reflection:
    enabled: false
  crystallization:
    enabled: false
```

引用来自受管发布操作返回的 `reference`，不能用当前草稿版本、猜测事件号或只填文档 ID。Squidex/PostgreSQL 是独立持久服务，须先完成既有共识 schema/workflow 的初始化与发布。薄 CLI 可初始化受管服务与 schema/workflow/凭据；原生插件不会创建示例共识或替用户批准内容。

密钥通过 DSH credentials 服务解析。在既有 `.credentials.yaml` 的 `refs` 下追加上述两个键，保持原来的 refs、records 和 version；文件权限为 0600。也可以由进程启动环境提供这些键。不要放入项目文档、聊天、agent 提示或 settings.yaml。插件按标准 client_credentials 获取访问令牌，并在到期前续取；认证失败不会缓存。管理客户端和 Reader 消费客户端分开，agent 的宿主身份固定为 Proposer，发布仍须独立的宿主授权。

兼容已有短期令牌配置：`managementTokenRef` / `consumerTokenRef`。这两项指向访问令牌而非 client secret，需要调用方更新过期令牌；同一角色同时提供时 TokenRef 优先。日常运行优先用上面的 ClientId/SecretRef。

### 独立反思

```yaml
  reflection:
    enabled: true
    provider: YOUR_EXISTING_EXPERT_PROVIDER
    model: YOUR_EXISTING_EXPERT_MODEL
    timeoutMs: 300000
    files: [src/core.js, test/core.test.mjs]
    experiments:
      - id: core-regression
        command: /absolute/path/to/node
        args: [--test, test/core.test.mjs]
        timeoutMs: 30000
```

适用业务 agent 自动获得 `crystra_reflect_core`。它独立创建评估 agent，检查选定核心代码的正确性、鲁棒性和性能，执行预先定义的实际检查，保存报告和执行记录。它不产生 Barrier 决策，也不替代验收标准。provider/model 必须是此 DSH 已配置的路由；插件不导入 Codex App/CLI 的 OAuth。

### 结晶

```yaml
  crystallization:
    enabled: true
    provider: YOUR_EXISTING_EXPERT_PROVIDER
    model: YOUR_EXISTING_EXPERT_MODEL
    timeoutMs: 300000
    python: /absolute/path/to/python3
    executionTimeoutMs: 2000
```

当前适配器支持 macOS 的 Python 代码能力，资产放在 `$DSH_HOME/crystra/code/<project-namespace>`，不需要用户手写执行器函数。自动观察有明确边界：顶层原生 tool 的参数必须是唯一 `input` 字段，结果为单个 JSON 值；普通任意 shell 命令不自动推断为这种边界。发现重复后评估 agent 可以接受、拒绝或推迟。候选先绑定代码 hash、对拍独立历史执行，随后才接管适用调用；guard 不匹配或执行异常回退原工具。结晶内部 agent 不受业务 Barrier 挂载。

## 在 DSH 中审批、发布与切换共识

在启用项目的会话里，直接要求 agent 更新共识即可，例如：“把这条约定整理成共识修改，提交给我批准后启用。”agent 负责读取基线、编辑草稿和提交 Ready；随后调用 `crystra_consensus_approve`。DSH 使用现有审批卡片展示当前共识、候选全文及切换范围，你选择“允许一次”或“拒绝”。聊天中的普通“批准”文本不替代这张卡片的决定。

- `crystra_consensus_status`：读取项目当前绑定和 revision、当前会话绑定和 revision、未完成责任；给出 id 时读取候选的正文、quoted base 与宿主计算的 dataHash；给出 operationId 时读取操作回执。
- `crystra_consensus_command`：agent 的 Proposer 操作，包括创建/编辑草稿、提交 Ready、退回草稿。每次新操作用新 UUID operationId，修改基于精确 quoted base；CAS 失败后不能自动覆盖别人更新。
- `crystra_consensus_approve`：请求 DSH 确认。publish 提供 id/base/dataHash/activate；switch 提供完整且非空的精确 references；withdraw 提供 id/base；restore 提供新 id 和精确历史 from。共同提供 operationId、reason、expectedRevision。agent 不能通过填 actor 或 grantId 获得发布权限。

publish 的 activate=true 在已确认发布后更新本会话和项目默认绑定；同 ID 替换原引用，新 ID 追加。activate=false 只发布。switch 可选择已经发布的具体版本，并通过完整引用清单加载或卸载个别共识；不可清空全部引用。选择历史版本仍要核对当下效力和依赖。restore 只创建新草稿，不隐式重新发布或启用。

切换要求当前会话没有 active 或 pending 承诺，应先把已有步骤实际完成并闭合，再提交切换申请。其他已有会话保持原绑定，不被全局悄悄改写；要切换这些会话，需要各自明确请求。新建会话采用已批准的项目默认绑定。不得直接撤回当前项目/当前会话正在使用的共识；先用批准的 switch 卸载它，再撤回。其他仍绑定已撤回版本的会话将失败，而不是偷偷改用新版。

审批绑定候选版本、内容 hash、操作意图、会话和项目 revision；等待过程中候选或基线变化，旧批准不能发布。请求有效期十分钟；取消、拒绝、无 answerer、never 策略均不发布。等待批准时崩溃，恢复为 interrupted；不能沿用不存在的批准。拒绝后的原操作不会再次询问；新的请求需要用户新的指示。

CMS 成功响应后的历史投影可能稍晚出现，插件有界核对已有回执，不重发发布。仍不确定则保留 Pending，复用原 operationId 恢复；不凭“内容看起来一样”推断成功。发布已确认但激活写入失败时，保留独立阶段和持久切换标记；恢复时不重复发布。存储失败后该实例拒绝继续使用未落盘状态。

项目默认绑定保存在 DSH 持久会话日志中，与会话绑定历史和审批回执一起审计。settings.yaml 的 references 是初始化种子，不需要每次批准后手改或重启。手改种子与已有记录不一致会失败，不能用来绕过受管切换。反思与结晶的内部 agent 不获发布者权限；项目绑定变化也使结晶上下文变化，避免沿用旧上下文的候选。

## 自动接入与失败行为

- 创建或从原生 Web API 恢复的项目内 agent 自动接入；首次业务模型请求前加载精确共识和既有责任。
- 项目外 agent 以及反思/结晶评估 agent 不挂业务 Barrier。
- 跳过承诺的动作或验收条件不满足：NO_GO；补入正常执行后可 GO 闭合。
- 共识引用错误、凭据缺失、CMS 不可用：在业务模型请求前失败，不静默采用缓存共识。
- 恢复已有会话时改变共识绑定：拒绝隐式变化。配置变化不会自动抹掉原责任。
- enabled 配置无效：明确报错并阻止接入。无法识别项目根时，保守阻止该实例的业务请求；修复设置后重启。

## 当前机器的部署状态

2026-10-13 已修复日常 dsh 命令的 rc.2/rc.3 混装及 HMR 接口漂移，并通过原生插件安装命令替换 Web profile 旧套件。已启用 crystra-backend-rebuild 项目及用户批准的首批精确共识引用。业务默认保留 DeepSeek Flash，反思与结晶评估选择现有 Kimi K3。实际部署、验收、持久服务和回退说明见 [actual-web-installation-results.md](actual-web-installation-results.md)。
