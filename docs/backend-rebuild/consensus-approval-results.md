# DSH 原生共识审批链路验收

2026-10-13。补齐原生审批、发布与明确版本切换；没有自建前端、确认弹窗、调度器或 CMS 工作流。

## 已核实的 DSH 能力

0.1.5-rc.2 的 ApprovalService.request 只在 open turn 内工作，记录 approval/asked 与 approval/decided。ask 委派原 answerer，never 拒绝，缺失/异常 answerer 返回 unavailable；allowed-once 是唯一允许结果。signal 取消会撤销等待，迟到结果不成为批准。

DSH api-remotes 原样转发 approval/request；client-ui-approval 在 conversation.composer 中显示原生“允许一次 / 拒绝”，直接展示 request.reason。Crystra 使用这条现成链路，提供精确共识内容及切换范围。展示仍是原生通用文本卡片，没有新增差异编辑器。

## 实现

新增 consensus-approval.js 持久编排有限的审批事务，调用已有 ManagedConsensus 授权/发布/CAS/Pending 逻辑及 Controller.setManifest；新增 status/approve 工具。native 配置只赋予 agent Proposer，宿主审批回调才使用 host:dsh-user Publisher。这是本地 DSH 用户确认身份，不声称区分多用户账号。

项目 binding journal 持有已批准的默认 manifest 和 revision，原 settings 作为初始化种子。当前会话明确切换，其他会话不自动改变；新会话采用默认值，重启从持久记录恢复。未完成责任不被清掉。跨 journal 的切换没有宣称原子性，使用明确阶段与持久操作标记恢复。

通过回归还发现并修复了项目落盘失败后的内存可读边界：只暴露已提交快照，失败后实例拒绝继续服务；不能让新会话获得未落盘的默认版本。

## 证据

- [真实 Web 审批与恢复核验](../../artifacts/backend-rebuild/consensus-approval/native-web.json)：在隔离 home 通过原生插件命令安装，离线模型正常工具调用；实际操作原生批准与拒绝按钮。批准后真实 CMS 发布并激活，拒绝保持原绑定；重启后新会话加载已批准默认值。等待审批时 SIGKILL DSH，恢复同 operationId 为 interrupted，没有发布/切换。
- [原生审批卡片](../../artifacts/backend-rebuild/consensus-approval/native-card.png)、[完成回执](../../artifacts/backend-rebuild/consensus-approval/native-completed.png)。都是合成验收共识，没有修改正式项目共识。
- [真实 CMS 新链路场景](../../artifacts/backend-rebuild/consensus-approval/live-cms.json)：拒绝、批准发布与冷恢复、等待期间候选变化、精确加载/卸载与伪造引用、卸载后撤回与恢复为新草稿。
- [原管理场景回归](../../artifacts/backend-rebuild/consensus-approval/managed-regression.json)：CAS 并发、角色、历史、精确版本、依赖、失联和故障恢复等十二项。旧脚本写死了另一测试项目的容器名，已参数化且仅允许已知验收项目，未停止正式 CMS。
- [实际安装配置核验](../../artifacts/backend-rebuild/consensus-approval/actual-preservation.json)：原模型、UI、LAN 与凭据保留，正式共识引用不变。业务默认 DeepSeek Flash；反思与结晶仍选 Kimi K3。本轮无付费模型验收。

实际包通过 DSH 原生 plugin --profile web add 更新到日常 Web profile，服务已重新启动。使用入口与具体语义见 [native-usage.md](native-usage.md)。

最终后台回归 **355/355**；新增真实 CMS 链路 **5/5**；原管理场景 **12/12**。原生四项能力另读到 22 份持久记录、4 个闭合承诺、完成的独立反思及实际实验、1 个准入结晶族和 1 次代码接管/guard 回退。该轮验收程序最初只接受旧错误文案，已调整为识别同一绑定拒绝语义，并独立重读实际记录通过。

## 当前边界

不是自由文本“批准”识别器；审批以 DSH 卡片为准。审批不证明内容正确。当前仍是单项目根及本地用户，不处理企业多租户和内容防篡改。只读业务请求在共识服务失效时仍失败，不拿历史缓存冒充有效共识。全部卸载使用项目 disabled 配置；本轮 switch 保留至少一条有效共识。无法确定外部发布是否完成且缺少已知响应时，继续保持 Pending，不自动重试写入。

## 审批可读性修正（2026-10-13）

用户指出原验收截图仍要求人审阅原始 JSON。此前的原生链路验收不能代表审批可用性，这是遗漏。现改为由代码从核验过的正文构造审批文字：操作、提议理由、受影响共识的修改前后正文、适用范围和批准/拒绝的影响。不把完整绑定、哈希、事件 ID 和未变化共识堆入审批卡；精确授权绑定继续保留在后台。

新增两项复现回归测试，完整后台 357/357 通过；用离线适配器在隔离 DSH Web 通过同一文字生成函数调用真实原生审批，并实际选择拒绝。该展示验收不重新证明 CMS 发布链路；前轮发布及异常测试仍适用。截图：`../../artifacts/backend-rebuild/consensus-approval/native-readable-card.png`。

已观察到 DSH rc.2 原生 reason 容器折叠换行，长正文仍会成为连续段落。移除原始 JSON 是此次修复范围，不宣称完成长文差异审阅体验。没有新增自定义前端或修改 DSH 原生确认按钮。

## DSH 原生详情与 Markdown 接入（2026-10-13）

经已安装 rc.2 源码核实，`dsh-client-ui-approval` 声明 `conversation.approval.detail`（single/session）插槽，按原生 `callId` 关联；`dsh-client-ui-primitives` 提供 `MarkdownText`。`reason` 自身只是普通文字，并不渲染 Markdown。此次采用 DSH 双端插件的 `./client` 声明，接入原生详情插槽与 Markdown 组件；批准、拒绝、取消、原生 asked/decided 审计均未更换。

后台从核验过的内容生成带 label/text 的分区详情，通过 DSH 自带会话事件与 wire projection 传递，客户端只读，必须匹配当前 pending 的工具名和 callId。详情不由 agent 提供，也不增加远端接口或通信协议。原生完整 reason 继续保留作无详情时的回退。该投影仅持有一个待审批详情，匹配的原生决定会清除；测试验证从原生事件重建。

原生详情插槽为单占位，DSH 原有占用者只展示 shell 参数 command。因此 Crystra 为其他工具保留该回退行为，未将其他工具审批改成共识详情。窄屏下比较列折为单列。为避免原生 reason 与详情重复，仅在本插件详情已挂载的 `[data-approval-scroll]` 容器隐藏第一项纯文字并增大可滚动高度；这是针对 rc.2 DOM 的小型样式适配，未来 DSH 升级需验证。扩展未加载或详情未匹配时，不隐藏原生 reason。

验收：后台完整 361/361；隔离环境真实 DSH 安装、原生详情插槽、Markdown 段落/列表/强调、独立修改前后和适用范围/生效方式分区、滚动及原生拒绝按钮；真实普通命令审批仍显示 command，并可原生拒绝。此次 UI 探针为离线适配器，不修改正式共识、不调用付费模型。CMS 发布与版本切换沿用前轮真实 CMS 异常路径测试，本轮不宣称重新跑过。

截图：`native-detail-markdown.png`、`native-detail-scope.png`、`native-detail-shell-fallback.png` 位于 `artifacts/backend-rebuild/consensus-approval/`。

## 紧凑审批卡与原生侧栏（2026-10-13，替代上节的大卡片布局）

核对已安装 DSH rc.2 的 sidebar-right、sidebar-documentpreview、resources 和 slots 接口及实现：右侧栏提供插件页注册、会话内打开、停靠、浮动、分栏和全屏；文档预览通过 workspaceFiles 读取文件，Markdown 正文使用原生 MarkdownText。未发现可以直接接收两份审批正文的原生差异面板接口。因此复用右侧栏容器、导航与全屏交互，注册共识阅读页，正文复用 MarkdownText；不把 CMS 正文另写为临时工作区文件，不增加传输协议或工作台。

审批卡仅显示操作、共识名称、两行以内的理由、范围及“阅读与对比全文”。原生批准和拒绝按钮保留。阅读页提供修改前、修改后、对比切换；窄面板纵排，全屏宽面板双栏。理由、范围、生效方式及其他属性独立折叠，正文完整渲染。对比当前是完整文档对照，不提供逐字差异高亮或段落自动对齐。两侧篇幅不同会出现留白，不能把这次验证解释为任意长度文档的最佳阅读体验。

展示验收使用 `docs/backend-rebuild/initial-project-consensus.md` 原文（保留历史标题“待用户批准”，不是撤回已批准状态）以及 `test/fixtures/consensus-long-amendment.md` 的 2264 字符完整长修改稿。修改稿在开头、中段及末尾设置可核对段落，仅供隔离展示，不是新需求或待发布共识。离线提供器调用真实 DSH 原生审批服务，数据经真实会话事件和投影到达浏览器；未调用付费模型，未发布正式共识。

实际浏览器验证：紧凑卡与长正文同时可见；536px 内容区纵排，1224px 全屏内容区分为两列各 600px；首批七条正文完整存在；长稿可滚到文末核对段；原生拒绝后旧面板显示审批结束；普通工具审批保留原生理由与命令。最终长文测试页浏览器错误记录为空。此前一次测试提供器重复复用 tool-call id 导致轨迹错误，已改为单次调用后重新安装、重新开页验证；不将其归为产品缺陷。

回归覆盖正文完整性、发布/装卸/撤回/恢复的正文类型、一次切换多份共识不能遗漏第二份、旧审批不能显示下一次正文、普通工具回退、原生投影恢复及匹配决定清理。最终 `npm test` 365/365 通过。多份共识场景新增测试曾明确暴露只显示第一份修改后正文，已修正为按阅读模式保留全部对应正文。

证据：`artifacts/backend-rebuild/consensus-approval/compact-sidebar.png`、`full-consensus-compare.png`、`long-consensus-end.png`、`sidebar-shell-fallback.png`。通过 DSH 原生插件安装更新实际 Web profile，使用独立 archive 路径避免同版本文件缓存；实际客户端图已提供该模块。模型、凭据、UI 配置、插件配置与 LAN Caddy 配置保留，局域网 TLS 与认证 RPC 验证通过。安装与展示验证不等于本轮重新验证了 CMS 所有异常发布场景；那些管理场景的回归结果见前述测试。

## 原生差异展示（2026-10-13，补充上述全文对照）

进一步检查 DSH tool、trajectory 及 Web frontend 的实际实现，找到了宿主导出的 `@deepseek-ai/dsh-client-ui-primitives.DiffBlock`。官方工具编辑结果以 `{path,oldText,newText}` 片段传入，组件提供红色删除、绿色新增、复制及折叠。它本身不计算两份全文的差异；trajectory 内部采用 diff 9.0.0，但仅导出插件 apply/inject，没有可复用的算法接口。因此直接复用宿主 DiffBlock，后台显式依赖相同版本 jsdiff（BSD-3-Clause）生成片段，没有复制 DSH 私有实现或引入新差异引擎。

阅读默认进入“查看变化”，保留修改前、修改后、全文并排对照。比较单元是保留原始字符的中文句界、换行和编号前缀。最初按行会使长段落整体标红/绿；进一步浏览器验收发现编号列表改为章节时，编号和句子绑在一起也会把保留的句子标作删除。新增失败回归后，将编号前缀单独分片；不做语义归一化，不删减原文。每段连续删除/加入归为文本修改，单独加入或删除分别标记。变更部分复用 DiffBlock，未改动上下文可展开；空白上下文不占显示行。

这是文本差异而非语义变更评审。搬移可能显示为删后再加；标点、编号和标题也算文本变化。统计为变化片段数，不是需求条数或修改行数。对达到计算限制的输入，显式标注退回两份完整正文，不伪装为最小差异。旧会话记录没有 diff 字段时明确提示尚未计算，全文查看仍可用。新字段为可选，沿用原有事件与投影，不改变批准内容或授权流程。

再次使用相同两份完整文档验收：首批原文与 2264 字符长修改稿，未用缩短示例替代。最终得到 8 个新增片段、8 个修改片段；没有独立的纯删除片段，修改片段中的旧文仍以红色减号显示。编号改章节保留的共识句子显示为未改动。窄侧栏与原生全屏均无横向溢出；文末新增可滚动到达；全文切换保留首批第七条及长稿文末；拒绝后旧面板失效；最终测试页浏览器错误数为零。UI 验收使用离线提供器触发真实原生审批服务，不发布共识、不调用付费模型。

最终 `npm test` 372/372 通过。新增测试覆盖纯增、纯删、替换、空文档、重复行、末尾换行差异、两份完整文档逐字符重建、列表改章节、旧事件及多共识投影保留。原生组件验收截图：`native-diff-sidebar.png`、`native-diff-middle.png`、`native-diff-end.png`，位于上述 artifacts 目录。

实际 Web profile 通过 DSH 原生安装更新至 approval-r7 路径的归档，版本号不变。配置保留结果与客户端资源验收另见 `diff-actual-preservation.json`、`diff-verification-summary.json`。本轮只验证审批展示及关联管理回归，不重新声称验证了所有真实模型闭环或 CMS 故障场景。


## 2026-10-13：Git 式左右对比（替代此前纵向差异）

采用左旧右新的逐行差异，删除为红色、新增为绿色，行内变化加深高亮，分别保留两版行号。变化区按行配对，缺失侧留空；同一 CSS grid 行保证长文本折行后仍等高，两列共用一个纵向滚动容器。默认进入左右对比，仍可单独阅读修改前或修改后的 Markdown 全文。复用 DSH 原生侧栏与全屏、原生确认交互，不改变批准权限。

差异算法使用既有 diff 依赖；后端将可恢复的对齐行加入原生 session projection。旧事件无对齐行时明确提示改用两版全文，正文和批准内容保持原样。逐行配对不承诺语义段落匹配；列表改章节的重排会按文本差异标记。

验证使用真实首批完整共识与 2264 字符长修改稿，经隔离 DSH 原生审批链显示，未发布合成修改稿、未调用付费模型。55 行左右顶点与高度全部一致，左侧滚动后 scrollTop=720，右侧继续滚动后=1864，文末完整可读；浏览器无错误。拒绝审批后旧面板立即失效。374 项后台回归全部通过，含精确重建两版正文、增删改/空文档/末尾换行、行内差异、投影重放和多共识场景。

已通过 DSH 原生插件安装更新现有 Web profile（approval-r8），验证实际客户端资源、原生项目接入与局域网认证访问；原有模型、凭据、UI 设置及 LAN 配置保持完整。安装包大小见 side-by-side-verification.json。历史 Barrier 记录仅用于安装保持性核对，不作为本次新模型运行结果。

证据：artifacts/backend-rebuild/consensus-approval/side-by-side-diff.png、side-by-side-end.png、side-by-side-verification.json、side-by-side-actual-preservation.json。


## 2026-10-13：分离行级左右对比与单页审阅

按用户反馈移除左右对比中的字词高亮。左右模式仅按行标红/绿，保留旧左新右、独立行号、空白补齐和同步纵向滚动。增加“单页审阅”，在一个连续正文中使用红色删除线、绿色新增下划线；按字符计算变动，保留换行和正文原始文本，不宣称提供 Word 富文本排版或编辑能力。修改前、修改后仍用原生 Markdown 阅读。两种模式仅用于展示，不具有审批权限。

在实际首批完整共识与长修改稿上，经隔离 DSH 原生审批链验证：左右模式 55 行等高对齐且字词 mark 数为 0；单页 DOM 排除新增后精确等于原文、排除删除后精确等于新文，文末可达、无横向溢出、无浏览器错误。拒绝后旧阅读面板失效。377 项回归通过，包含空正文、末尾换行变化、精确重建及原生投影保留审阅数据。合成修改稿未发布，没有付费模型调用。

通过 DSH 原生插件机制更新实际 Web profile（approval-r9）；原有模型、凭据、UI 与 LAN 配置核对保持完整。实际客户端资源包含两种模式，认证 LAN 页面与原生 RPC 正常，未认证访问保持 401。证据：git-lines.png、single-page-review.png、review-modes-verification.json、review-modes-actual-preservation.json。


## 2026-10-13：审阅粒度按句段与词组组织

用户指出全篇字符匹配会为了复用“用”等字符，将标题删除与正文新增混在一起。原实现确有此问题；仅改为单页排版并未解决比较粒度。

本次单页审阅先按换行、句读划分单位，括号内句读不拆分；按共享词组做保持顺序的句段对齐，允许新标题和说明独立插入，再在相近单位内部按词比较。括号内容整体标记，相关度不足时整段替换；超过比较规模上限时回退完整替换。该策略是可解释的文本启发式，不宣称理解语义或还原真实编辑历史。左右行级模式与批准正文未改变。

回归加入用户原例及带 Markdown 标题/新增正文的变体，先复现再修正。379 项测试通过。实际完整首批共识对照长稿的原生 DSH 浏览器验收确认：“（待用户批准）”整体删除、“——阅读对比验收修改稿”整体新增、标题下说明整体新增。DOM 过滤新增/删除分别精确还原两版全文，无浏览器错误，未发布合成稿、未调用模型。

已通过原生插件安装更新现有 Web profile（approval-r10）；模型、凭据、UI 与 LAN 配置保持性和认证访问复验通过。证据：phrase-review.png、phrase-review-verification.json、phrase-review-actual-preservation.json。


## 2026-10-13：完整文档扩测

新增八份完整长文的整段替换、句子增删、移动、改词和混合修改测试，发现并修复规模上限退化、共享词拆碎整段替换、单字词尾/连接词碎片三类问题。详见 consensus-review-scenarios-results.md。388 项回归通过；原生 DSH 八文档显示及实际 Web profile 原生安装验收通过（approval-r11）。
