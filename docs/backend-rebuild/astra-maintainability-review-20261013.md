# Crystra 后台可维护性检查（Astra，2026-10-13）

## 结论

当前实现已经具备可用的组件边界，足以继续单机/localhost MVP：Barrier 不调用模型，反思不参与 GO/NO_GO，结晶有独立准入与回退策略，安装事务不进入业务执行链。但“拆成多个文件”尚未完全转化为不同演进速度：DSH 原生事实格式、Controller 的恢复内部结构、公共 journal 的领域版本假设、整份配置的结晶 hash，以及审批展示文字协议仍造成可定位的联动。

本次列出 **6 项设计债：5 项 P2、1 项 P3**。没有据此认定新的已复现业务正确性缺陷，也没有 P0/P1 阻断结论。优先级表示维护价值：P2 建议在相应组件下一次功能扩展前处理；P3 可随日常维护顺手处理。所有建议均为最小边界调整，不要求拆仓库、引入事件总线或重写架构。

## 范围、身份与方法

- 仓库：`/Users/firestige/Projects/crystra-backend-rebuild`，分支 `codex/backend-rebuild`。
- HEAD：`ef2187555e195311f1cad3a1767ac58a8c8a6602`。
- 评审的是当前工作树，包含未提交的 `src/backend/barrier.js` 性能修复（35 行增加、7 行删除），不是仅评审 HEAD。
- 检查开始及验证结束时，已有未跟踪文件：`docs/backend-rebuild/astra-stress-20261013.md`、`docs/backend-rebuild/matching-performance-fix-results.md`、`test/backend/barrier-matching-performance.test.mjs`、`test/backend/matching-performance-worker.mjs`。旧压力报告没有被当作本次结论。
- 当前 `barrier.js` SHA-256：`cd99d52b8de86b3cc53540f05dfd4aaecccdb1094895fde19e505acc5613a35e`；性能测试：`a4914c4e7502e94335b489f11dd763adcddb1b63c75d19cdc2f26118f5bb9690`。
- 实读 `src/backend/` 的组件、原生接入、安装、审批显示代码以及相关 `test/backend/`，对照后台使用/结晶文档。适用用户提供的 AGENTS 约束；仓库及其祖先路径未发现额外 AGENTS.md。没有适用于这次只读代码审查的必需实施技能；未启动实现/TDD 或文档共创流程。
- 未修改产品代码、测试或配置，未提交/推送/发布，未操作日常 DSH、容器、真实凭据或付费模型。仅新增本报告；测试使用临时目录和本地模型桩。
- 方法采用《架构整洁之道》的依赖方向与变化隔离，以及《重构》的封装、重复代码、发散式变化、散弹式修改等诊断视角。坏味道是定位维护成本的提示，不自动等于缺陷。术语只概述，不编页码。

一手参考：[Robert C. Martin 对 Clean Architecture 的说明](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)强调边界内侧不应依赖外侧格式与框架细节；[Martin Fowler 的 Refactoring 书籍页](https://martinfowler.com/books/refactoring.html)说明以保持可观察行为的小步调整改善结构；[作者的 Extract Function 目录](https://refactoring.com/catalog/extractFunction.html)提供本文局部提炼建议的对应方法。本文问题判断来自代码，不来自这些来源对本项目的评价。

## 实际组件关系与独立演进判断

```text
DSH settings / agents / tools / sessions / approval
    └─ native-plugin + native-config → index（组合与生命周期）
         ├─ Controller → Barrier + loadConsensus
         │     ├─ journal 端口 → dsh-journal → DSH persistence
         │     └─ evidence 端口 → 当前仍传入原始 DSH events
         ├─ ManagedConsensus → client 端口 → SquidexClient → Squidex/PG
         ├─ ConsensusApproval → ManagedConsensus + Controller + 展示函数
         ├─ reflection → DSH 子 agent + 文件快照/实验 + journal
         └─ crystallization-dsh → Crystallization
                ├─ evaluate 端口 → crystallization-agent → DSH 子 agent
                └─ resolve 端口 → code-capabilities → Python bridge
install manager → operations → DSH CLI / 本地服务与配置
approval projection/client → DSH 审批与原生侧栏（无发布权限）
```

| 变化情景 | 实际修改面及需要验证的面 | 判断 |
|---|---|---|
| 只优化责任匹配算法 | `barrier.js` 和 Barrier 算法/压力测试；Controller/反思/结晶无须跟改 | 边界健康。本轮未提交优化就是实际例子 |
| 增加一种承诺断言 | `barrier.js` 校验/匹配，`index.js:30-39` 工具指引，相应 Barrier/DSH 工具测试 | 合理的领域+入口同步；不是只改一个纯函数即可完成 |
| 改 CMS HTTP 或历史事件查询 | 首先 `squidex-client.js`；若改变 ContentData/状态语义，还影响 `managed-consensus`、`consensus`、审批与安装初始化 | HTTP 已隔离，CMS 内容/状态契约仍有意贯穿共识子系统 |
| 改反思模型、实验或报告 | `reflection.js`、原生配置与反思测试；当前还改变结晶 family 身份 | 语义独立，配置隔离不充分，见 M-03 |
| 改结晶 guard/shadow/fallback | `crystallization.js` 与该组件测试；Python 执行环境变化由 `code-capabilities`/bridge/诊断承担 | 算法与执行环境已有端口；原生证据仍渗入核心，见 M-01 |
| 改责任历史/会话恢复结构 | `Controller`、审批恢复逻辑、组合入口与跨组件恢复测试 | 需要同步理解另一组件内部，见 M-02 |
| 独立升级某组件持久化格式 | 该组件 + 公共 `dsh-journal` 及其他 journal 使用方回归 | 当前共同锁定领域 `schemaVersion=1`，见 M-04 |
| 改审批措辞或语言 | display、projection、client 及旧事件重放测试 | 展示文字兼任协议，见 M-05 |
| 改安装/卸载恢复 | `install/manager`、`operations`、安装测试；正常无需改 Barrier/反思算法 | 边界健康，但压缩代码使事务顺序审阅困难 |

生命周期是**统一插件启停、组件配置可选**，不是四个完全独立的可热替换插件。`native-config.js:41-53` 分别启用反思/结晶，`index.js:49-77` 创建各自服务；`native-plugin.js:29-36` 对所有配置变更统一要求重启，`index.js:198-209` 按固定顺序关闭服务。原生模式的受管会话固定包含共识+Barrier；反思核心 API 可独立调用，测试已经验证无需附着 Barrier。这个 MVP 取舍本身不是问题，也不应以缺少热插拔判定不可维护。

## 按维护影响排序的问题清单

### M-01 · P2 · DSH 原生证据格式进入两个策略核心，宿主升级会形成跨组件修改

**位置/符号：** `barrier.js:62-94` `evaluateCommitment`、`:51-59` `resultValue`；`crystallization.js:128-140` `originalOutput`；`crystallization-dsh.js:25-29,37-61`；`index.js:119-124` evidence 端口。

**证据：** Controller 接收 evidence 端口，但入口直接传 `snapshotEvents()`。Barrier 内部解析 `tool/call`、`tool/result`、`sourceEventSeqs`、`message.source.callId`、`tool-result` block 和渲染文本；结晶核心再次理解同一组 DSH 字段，自动适配器还进行一次筛选。没有 import DSH 并不等于与 DSH 数据格式解耦。

**变化牵连：** DSH 若调整结果 envelope、参数编码或关联字段，即使责任匹配/结晶准入规则不变，也须改上述三个模块，并同步 `barrier-native-results`、`barrier-event-shape-regression`、`barrier-call-identity`、`crystallization`、`crystallization-dsh` 测试。领域测试目前也承担宿主格式夹具的维护。

**原则/坏味道：** 依赖规则、适配格式隔离；同一外部格式变化造成散弹式修改。

**最小建议：** 在 DSH 适配侧提炼有契约测试的“可信执行事实提取器”，输出原始序号/身份、参数、结果及明确的不可用原因；Barrier 保留匹配和不复用责任，结晶保留更严格的准入。不要把两者对结果的不同要求统一成一个过度宽松解析器：Barrier 可组合文本块，结晶当前要求唯一 JSON 文本，必须保留这一区别。

**确认程度/例外：** 代码已确认的设计债；本次未发现由此产生的新错误。保留原生证据引用是必要的，问题是格式知识重复进入策略层，不是不能依赖真实 DSH 事实。

### M-02 · P2 · 共识审批依赖 Controller 内部历史结构与人工拼接恢复标记

**位置/符号：** `consensus-approval.js:19` `#boundary`、`:36-43`、`:86-95` `switching` 恢复；`controller.js:20,27-36` 状态与 `setManifest`；`index.js:114-117,178-180`。

**证据：** 审批直接读取 `active`、`pending.length`、`manifestRevision`、`bindingHistory`；恢复时要求 revision 恰好 `+1`，并在历史中寻找 `reason === "approval:<operationId>: <reason>"`。这不只是调用“变更绑定”，而是把 Controller 记录事务的内部结构复制进另一个组件。`setManifest` 本身也检查 active/pending，审批端再检查以避免在不允许时打扰用户。

**变化牵连：** 将 pending 从数组改成其他责任表示、压缩 bindingHistory、修改 revision 规则或给 reason 加展示格式，都需同步审批恢复；否则现有持久化记录的判定需要重新论证。`consensus-approval.test.mjs:26,33` 的恢复场景证明这条跨组件协议确实被执行，而非猜测。

**原则/坏味道：** 封装内部记录、信息隐藏；Feature Envy（对外部内部结构的依恋）与散弹式修改。

**最小建议：** Controller 暴露稳定的绑定状态摘要/可切换检查，并接受结构化 `operationId` 生成或查询绑定收据；审批恢复使用收据，不扫描历史 reason。保留审批前预检和提交时再次检查，不能为减少重复而去掉竞态保护。

**确认程度/例外：** 设计债，现有冷恢复测试通过。共识切换必须尊重未结清责任是正确且必要的领域依赖；建议只收窄接口，不把两项能力强行完全分离。

### M-03 · P2 · 原生结晶身份绑定整份配置，反思演进会无关地触发重新积累与准入

**位置/符号：** `native-config.js:52` `context` 中 `configuration:digest(config)`；`crystallization.js:64-67` `family`；`native-plugin.js:29-36`；`install/components.js:8-14` 与 `native-plugin.js:22-25`。

**证据：** family key 由 scope、boundary、context 整体 hash 生成，而 context 含整个 Crystra Config，包括反思 provider/model/files/experiments 和 CMS 凭据引用名称等。局部内存桩验证：仅将反思 model 从 A 改 B，项目与共识引用完全不变，结晶 context hash 仍不同。

**变化牵连：** 单独调试反思模型/实验需要原生重启；重启后既有结晶 family 不再命中，需要新 observations 和准入。它是保守失效而非错误复用，但使反思的高频试验拖动结晶的稳定资产。此外，启用结晶后的 Python/沙箱检查汇总为全局 `components.ready`，可使受管 prompt 不能开始；这是当前整套就绪策略，不是独立故障隔离。

**原则/坏味道：** 单一变化原因、配置关注点分离；无关数据组成同一变化单元。

**最小建议：** 明确列出影响能力复用的共识、执行环境、能力契约配置，构造专用适用性版本；反思配置继续属于反思。未知依赖仍应保守失效，不建议盲目删掉所有配置 hash。对可选能力不可用时“整套停止还是单项不可用”作显式策略选择并测试，不悄悄降级。

**确认程度/例外：** hash 牵连已无副作用验证；后续重新积累是 `family` 选择逻辑的直接结果，未在真实模型运行中测成本。统一重启已在使用文档声明，本次不把重启本身列为缺陷。

### M-04 · P2 · 公共 journal 同时约束存储 envelope 和每个组件的领域 schema 版本

**位置/符号：** `dsh-journal.js:18-20,28-33` `openJournal`；`controller.js:15,20`；`managed-consensus.js:16-17`；`consensus-approval.js:12`；`crystallization.js:19-22`；`reflection.js:43,108-111`。

**证据：** 所有组件已有独立 journal identity，这是健康边界。但公共 adapter 写入时硬性要求 `state.schemaVersion === 1`，同时 envelope 自己也写 `schemaVersion:1`。因此，单一反思/结晶组件想升级自身记录为 v2，即使自行提供了领域迁移，公共适配器也拒绝写入。内存 persistence 桩已确认 v2 append 报 `Invalid journal state identity`。

**变化牵连：** 某组件增加真正需要迁移的状态布局，必须同时修改公共 journal 验证规则，回归 Controller、共识、审批、反思、结晶的读写。若为规避限制而把领域 v2 仍标为 1，版本信息就失去清晰语义。

**原则/坏味道：** 存储细节与领域状态分开演进；共享组件承担不同变化原因。

**最小建议：** 公共 journal 仅管理 envelope 版本、身份、持久化顺序；状态版本由各组件的 `open`/恢复迁移负责，或注入组件校验器。保留严格拒绝未知 envelope 和错误身份。只需一次接口调整，不需要通用迁移框架。

**确认程度/例外：** 已验证的演进限制；当前 v1 数据均可正常使用。统一版本不是当前恢复失败证据，也不建议为了改名立即迁移现有日志。

### M-05 · P2 · 审批展示文字承担可重放协议，文案/UI 演进需要保持历史解析兼容

**位置/符号：** `consensus-approval.js:47-49`；`index.js:96-100`；`consensus-approval-display.js:33-44` `withDiffs`/`presentationFromApprovalReason`；`consensus-approval-projection.js:12`；`consensus-approval-client.js:7` 宿主 DOM 选择器。

**证据：** 审批构造结构化 presentation，但入口从 request 中取出后丢弃，只将原生 request 交给 DSH；projection 从 `approval/asked.reason` 反解析展示结构。解析依赖中文 `请确认：`、双换行和全角冒号，diff 依赖 `修改前/修改后` 标签。客户端还用特定宿主 DOM 顺序隐藏重复原文。

**变化牵连：** 翻译标题、调整 section 标签/排版，需同时考虑 display 编码、projection 解码、client 展示和旧审批事件重放。只调整新文案会影响历史显示的兼容性判断。宿主审批卡 DOM 变动还需检查 CSS 适配，但不会改变批准权限。

**原则/坏味道：** UI 与用例边界、封装记录；展示字符串兼任协议的 Primitive Obsession。

**最小建议：** 若现有 DSH 支持合法、可持久化且可忽略的展示 metadata，优先传结构化版本化 DTO；不为此重新引入宿主不支持的必需事件。若 rc.2 暂无合适通道，则把当前编码/解码明确为带版本兼容策略的 codec，集中标签，保留历史样本测试；文案在协议之外变化。

**确认程度/例外：** 当前文字往返及多行内容测试通过，没有声称丢字或错批。原生审批 UI 是必要宿主交互，不属于本轮不建设的工作台/JSONIR 前端。保留原生事件而不加入未知必需事件有明确合理性；债务是兼容策略需要显式化。

### M-06 · P3 · 反思与结晶评估重复实现原生 agent 生命周期，内部角色识别分散

**位置/符号：** `reflection.js:18-24,41-54,82-97,112`；`crystallization-agent.js:9-22,38-49`；内部 session 前缀识别见 `native-config.js:18`、`native-plugin.js:15`、`project-initialization.js:13`、`crystallization-dsh.js:9`。

**证据：** 两个评估服务都实现 live Set、closed 标记、cancel/abort、定时器、followup、idle 等待、flush、turn/end 结果解释和 dispose。清理结构已经不同：结晶 evaluator 对 dispose 使用内层 finally 保证 settle，反思把 dispose 放在后续 journal/settle 之前。此处仅说明两个实现已会独立漂移；本次未模拟 dispose 抛错，也不把潜在等待问题列为已复现缺陷。

**变化牵连：** DSH 的取消/结束语义或资源释放要求变化时，要同步检查两个 runner；增加/重命名内部 agent 类型还要更新四处前缀判断。容易遗漏的部分恰好涉及持久化和插件退出，而非两种评估的业务判断。

**原则/坏味道：** Duplicated Code、散弹式修改。不同评估策略不是重复，只有机械生命周期属于共同变化原因。

**最小建议：** 先集中内部角色判断；待下次生命周期修正时，提炼一个小的原生 agent 运行/清理 helper，保留各自工具、报告、超时结果和证据策略。不要合并反思与结晶的业务服务，不建立新调度器。

**确认程度/例外：** 重复与修改面已确认；异常清理影响是待验证风险。DSH 仍拥有 agent 执行与调度，这个边界保持正确。

## 健康边界与不列为问题的事项

- `Controller` 通过 journal/resolve/evidence 端口运行，Barrier 为确定性算法；反思没有进入责任判定，反思报告无权释放责任。
- `Crystallization` 的 evaluate/resolve/context/original 端口可用替身单独验证；代码 hash、guard、shadow、fallback 不是依靠模型口头承诺。
- 共识管理对已发出的不确定写入保留 pending，审批与会话切换有持久化恢复路径。本次相关测试通过；不把这些必要状态分支误称为“过度复杂”。
- `index.js` 作为组合根有多个 import 是正常的；但其中代理工具/提示拼装可以在未来变动时局部提炼，不能仅按文件长度判错。
- 本轮 Barrier 优化把相同 predicate 的 candidate rows 共享，仍在 assignment 时附回独立 actionId；责任不复用、等价匹配分配与分割可行性有针对性回归。没有依据要求回滚该优化。
- 安装 manager 的事务与 operations 副作用适配可注入测试。`install/manager.js:29-32`、`operations.js:41-59` 以及 `ConsensusApproval.#request` 多个语句压在长行中，确实提高阶段顺序审阅成本；建议下次编辑时格式化并按阶段命名提炼，暂不另列架构问题。
- 所有组件都使用普通 JSON、字符串和小对象适合当前规模；没有因未使用类或类型系统直接提出改造。
- 未要求多租户、远端服务、通用消息总线、微服务或独立仓库。PostgreSQL 通过 Squidex 服务使用，后台业务未直接依赖 SQL。

## 本次验证与边界

实际执行两组现有定向测试，共 **78 项通过、0 失败、0 跳过**：

```sh
node --test test/backend/barrier-matching-performance.test.mjs test/backend/native-config.test.mjs test/backend/consensus-approval.test.mjs test/backend/journal.test.mjs
# 36 passed
node --test test/backend/reflection.test.mjs test/backend/crystallization.test.mjs test/backend/native-lifecycle.test.mjs test/backend/consensus-approval-detail.test.mjs
# 42 passed
```

另使用内存桩直接验证 M-03 的配置 hash 牵连和 M-04 的 v2 state 拒收，无产品文件改动。测试覆盖当前行为与部分恢复路径，不证明所有生产异常不存在。未运行真实 Squidex、安装卸载、容器或远端模型；没有扩大到完整正确性/安全审计。

建议先做 M-01/M-02 的边界封装，再在第一次需要新状态版本或频繁模型调参前处理 M-04/M-03；M-05 随审批 UI/宿主适配演进处理；M-06 随生命周期维护处理。保留现有行为与恢复测试作为验收依据。本次只交付评审清单，不实施重构。
