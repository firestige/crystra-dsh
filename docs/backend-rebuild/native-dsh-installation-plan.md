> 2026-10-13：本文保留初始调查。原生配置与自动接入现已实现；准确配置及验收边界见 [native-usage.md](native-usage.md) 和 [native-installation-results.md](native-installation-results.md)。下文“待实现”及初始状态不代表当前实现。

# 现有 DSH 的原生插件接入方案

2026-10-13。当前先完成调查及安装路径验证；没有修改用户 ~/.dsh，没有启动模型、迁移会话或启动 Squidex。暂以本机现有 web profile 为部署目标，用户的日常入口尚待确认；如使用桌面版，不能套用 CLI 的 desktop profile（该名称由 Electron 保留）。

## 已核实的本机状态

| 项目 | 当前读取结果 |
| --- | --- |
| DSH CLI | /Users/firestige/.nvm/versions/node/v24.12.0/bin/dsh，版本 0.1.5-rc.2 |
| 插件管理 | dsh plugin --profile NAME 将参数交给 profile 内的 pnpm，随后按包的 dsh.bundle 声明自动维护 bundles 列表 |
| 原生用户配置 | ~/.dsh/settings.yaml；settings 服务支持 namespace schema、默认值/组合层/用户层、版本冲突、更新通知和 secret 字段脱敏 |
| 原生插件配置 | ~/.dsh/profiles/web/cordis.patch.yml；bundle → profile patch → home patch → 命令行 patch 的层次组合 |
| 现有 web profile | 已包含 dsh-crystra，但依赖指向旧 GitHub release crystra-dsh-v0.1.0-rc.2，不是当前 worktree 的新后台包 |
| 旧包效果 | 旧 cordis.patch.yml 禁用 ui-workspace；新后台包只有插入 Crystra，不禁用 DSH UI |
| 现有用户 patch | web-runtime 有局域网 trustedHosts 配置，必须保留；一条 row 的 config 为整体替换，不是深合并 |
| 模型配置 | 当前默认 DeepSeek；另有 Kimi/自定义路由。应保留业务模型选择，反思/结晶评估独立配置 |
| 本机默认凭据文档 | 仅检查键名，没有输出密钥；未发现 llm-pi-ai/openai-codex 登录记录，不能宣称默认 DSH 已拥有实验所用 OAuth |

当前 profile 配置存在，不代表已确认用户此刻运行的进程就是此 profile。读取进程列表被本机权限拒绝，没有据此猜测运行状态。

## 原生安装路径：已实际验证

在独立临时 DSH_HOME 中，先 npm pack 当前 worktree，再实际执行：

```sh
dsh plugin --profile crystra-install-check add /absolute/path/dsh-crystra-0.1.0.tgz --ignore-scripts
dsh --profile crystra-install-check --dump-config
```

原生命令成功安装包并自动加入 dsh.profile.bundles；配置树出现 `{ id: crystra, name: dsh-crystra }`。首次 offline 安装因本地 pnpm store 缺少依赖 tarball 失败，允许下载 registry 依赖后成功，未手改 profile manifest 来伪装安装成功。

证据：[原生命令结果](../../artifacts/backend-rebuild/native-plugin-install/result.json)、[安装日志](../../artifacts/backend-rebuild/native-plugin-install/install-online.log)、[profile 清单](../../artifacts/backend-rebuild/native-plugin-install/profile-package.json)、[组合配置](../../artifacts/backend-rebuild/native-plugin-install/composed.yml)。

这里验证的是安装、登记和配置组合，不是新包已经完成日常 agent 接入。当前默认插件在没有 resolveConsensus/consensus 配置时会拒绝启动，且仍依赖宿主 attach；不能现在直接替换生产 profile 后宣称可用。

## 接入结构

继续交付一个 dsh-crystra 包。包的原生入口承担安装后启动适配，核心机制保持现有分层：

- DSH 负责依赖安装、bundle 装载、agent/model/tool/session、用户配置及凭据。
- Crystra 增加产品内配置适配：将可序列化参数转换为当前 resolver、token 回调、requestFor、context 等可信宿主接口。
- Crystra 增加生命周期适配：根据配置为 DSH 创建或恢复的业务 agent 自动 attach，原生关闭事件负责资源释放。
- Squidex/PostgreSQL 作为独立持久本地服务，使用普通部署配置启动；不随每次 DSH 会话创建实验实例，不清空数据。

不提供另一套 DSH 启动器，不要求用户编写 ctx.plugin/agents.create 脚本，不接管 DSH 调度，不开发工作台。

## 必须补齐的产品接入层

### 配置及原生设置入口

注册 crystra settings namespace 及 schema，让 DSH 自带 Plugins 设置页面/API 和 settings.yaml 管理参数。profile patch 只决定加载/禁用及启动基线，业务可变参数在 settings 中。先保留单机单工作项目的简单形态，再按实际使用扩展。

下面仅为待实现的目标配置形态，不是当前包可直接读取的配置：

```yaml
crystra:
  enabled: true
  projects:
    - root: /absolute/path/to/project
      consensus:
        scope: project
        references: [] # 由受信任的共识导入/发布操作填入精确引用
      reflection:
        enabled: true
        provider: openai-codex
        model: gpt-6-astra
        files: [src/core.js, test/core.test.mjs]
        experiments: [] # 明确的可执行检查定义，不由任意聊天文本拼 shell
      crystallization:
        enabled: true
        provider: openai-codex
        model: gpt-6-astra
        python: /usr/bin/python3
```

CMS 的 localhost 地址、app/schema、凭据引用和评估预算也作为 schema 参数；实际字段在接入实现时定稿。缺少共识/模型配置时，安装后显示未配置状态并保持未启用，而不是让整个 DSH 无配置启动失败。用户选择启用某项目后，缺失/无效绑定必须明确拒绝，不能静默降成未受管执行。

设置变更可以通知新会话；正在运行和恢复中的承诺继续使用持久绑定，不能因 settings 热加载而静默换版、丢责任。先将需要重建服务的变更明确标记为下次启动生效，不追求所有配置热切换。

### 自动接入 agent

DSH 现有 agent/created 通知在注册后同步调用 listener，但不等待 listener 返回的 Promise。接入必须在同步 listener 中安装工具/提示/钩子，异步装载通过现有 attachment.ready 在 prompt/工具/Barrier 前等待；不能只写 async listener 并假定 DSH 已等待初始化。需要原生 CLI 回归证明首个请求就受到管理。

范围按可信工作目录及配置选择；明确排除 Crystra 反思、结晶评估的内部 agent，避免递归管理。启动时已存在的适用 agent 及恢复 agent 要各 attach 一次；卸载/退出释放钩子和 journal。工作目录取 DSH 会话/宿主事实，agent 不能通过工具参数自己选择授权主体。

### 身份、凭据与共识首次装载

沿用 DSH credentials 的引用/record 服务。插件在宿主内解析 CMS 凭据并提供当前 token 回调；若使用 Squidex client credentials，由本地适配获取/更新 token。模型 OAuth 仍由 DSH Models/authorization 管理，不复制 Codex 凭据或建立新登录存储。

使用原生设置/受信任操作导入或发布共识，生成完整 reference（身份、发布版本、事件、actor、hash）。不能把 references: [] 当启用后的有效配置，也不让 agent 自报 Publisher 身份。受管授权/发布需要明确的人类主体入口；现有 API 能力已验证，但日常可信操作入口要在本接入层补齐，不能要求用户调用实验脚本。

当前 ~/.dsh 的已检查凭据中没有 Codex OAuth；若仍使用 Codex 评估，应在同一个正式 DSH_HOME 通过 DSH 登录，并按 provider 的原生配置声明所需模型。模型目录补充沿用 DSH 配置，不改 provider 核心。

### 反思与结晶的常规使用配置

反思从项目配置读取核心文件与检查命令，业务 agent 调用现有 crystra_reflect_core 即可；不要求用户提供 requestFor JS 函数。结晶使用已有自动观察及 Python 执行器，context 从可信项目/共识/执行配置生成，不要求用户提供 context 回调。

当前结晶自动入口仅覆盖符合 {input: JSON值} 且完整 JSON 输出的顶层 native 工具；不宣传安装后能优化所有 shell、编辑器或自然语言任务。先选择一个符合边界的普通业务工具验证即可，不新增通用工作流引擎。资产目录与状态目录使用 DSH_HOME 下专属目录，跨重启稳定，退出不清理持久资产。

## 正式安装使用步骤（接入层完成后）

1. 备份 web profile 的 package.json、pnpm-lock.yaml、cordis.patch.yml，以及 settings.yaml；记录旧包的精确依赖 URL。凭据不进入报告。
2. 通过 DSH 原生命令替换现有旧包：`dsh plugin --profile web add /absolute/path/to/new/dsh-crystra-0.1.0.tgz`。初次本地试用不需要发布 npm，也不使用 link 到可变 worktree。后续每次交付重新打包、记录 hash。
3. `dsh --profile web --dump-config` 检查新后台 bundle、DSH 自带 UI、原有 web-runtime 网络设置；不把 dump 成功当成服务启动成功。
4. 按已固定版本部署持久 Squidex/数据库，完成 app/schema/权限和首份共识。通过 DSH 原生设置完成 Crystra 配置；在 DSH Models 中选择/登录评估 provider。
5. 从项目目录用原来命令 `dsh web` 启动。新建普通会话，使用原来工具，观察共识注入、声明/NO_GO/修复闭合；按需调用独立反思，重复结构化业务工具触发结晶。
6. 正常关闭/重启 DSH，恢复该会话，确认承诺、共识绑定、评估记录、已准入代码保持。默认 UI 不被替换。

回退同样通过 dsh plugin 安装原精确 tarball，再恢复原 profile/settings 配置；先停受管工作，保留新持久数据。只禁用 Crystra 不等于已完成责任，应明确说明该项目暂未受管。无需重新安装 DSH 或删除整个 ~/.dsh。

## 下一增量的验收标准

在独立 DSH_HOME 中，完全通过 dsh plugin、原生 profile/patch/settings 和 dsh web/headless 入口验收，不由脚本调用 ctx.plugin/agents.create 来代替正式启动：

- 无配置安装可启动 DSH，Crystra 明确未启用；配置后普通新建/恢复会话自动接入，首请求即生效。
- CMS 不可用、凭据缺失、共识过期/撤销等场景不能伪装受管成功；未选中的会话继续正常工作。
- 反思/结晶内部 agent 不递归管理；正常关闭无资源驻留。
- 四项能力及关键负例经正式入口可用，重启复原绑定；持久 CMS/资产不被初始化清理。
- 安装后不覆盖原模型选择、其他插件、UI 和局域网设置；卸载/回退通过 DSH 原生命令完成。

这是产品接入验收，不再扩展核心机制。安装/配置适配完成前，不向用户提供貌似一键可用的半成品步骤。
