> 2026-09-28 实施更新：时间范围 Evaluation、Delivery 元数据目录、独立 Trace 查询与 localStorage 配置已接入。当前页面与验证边界见 [README](README.md)，跨层决策见 [Analysis 设计修订](../../../../workflow-self-recursive/docs/systems/bi/analysis-data-integration.md)。下文保留设计推演，涉及“尚未接入”的表述是历史状态，不作为当前待办。

# Analysis Contract 组合能力与成本复核报告

日期：2026-09-28。复核 data-design.md 第 4/5/6 节。
规则：chart 各有 TypeScript interface，以 type 联合匹配；业务/查询可复用能力属于
Crystra-ui，DSH 注入宿主访问与生命周期。报告编写时仅更新设计；后续实施状态见 README，服务契约未改变。

核对了本地 Contract schema/validator、Evidence Query 文档、Evaluation 实现与 DSH
allowlist。结论不是线上性能测试，服务部署能力仍需接入时验证；成本数字均为明确假设。
文档下文区分协议可表达、实际记录是否存在、前端读取得起三件事。

## 结论与对前一版的修正

1. 多 series、分组柱、热力图等不要求后端对应图表接口；一次结果可适配多个 chart interface。
2. “Evaluation 没有逐次样本”不等于“所有 Contract 都没有”：Evidence Trace NODE 已提供
   起止时间、model-call 类型、provider/request model 与可选 Token、C57/C30/C06。
   对已读的真实记录可本地统计；不能把它包装成所有真实调用的总体指标。
3. 延时分位数、每日 Token、每日记录调用数属于**条件可组合，规模大时成本高**，不是绝对缺字段。
4. TTFT、缓存 Token、订阅账单/价目/周期、三类介入原因则缺少协议供给或确定口径，不能靠图表
   类型或聚合代码补齐。
5. 当前 compute 不能直接选任意 Delivery 或执行时间范围；不能把子范围扩大成整 Task。
   某些简单样本统计可绕过 compute 的选择限制，复杂正式指标不能默认在前端复制其计算体系。

## 4. 查询层复核

按 chart 定义 interface 后，查询层不需要知道 chart 类型，不需要 columns/binding 解析器。
泛型 resolver 仍用于验证/解码服务响应；业务函数返回具体 LineChartData、HistogramChartData 等。

| 项目 | 当前实现 | 处理归属与必要性 |
| --- | --- | --- |
| 分页、去重、当前资源缓存、刷新取消、迟到结果隔离 | 已有通用资源，暂在 DSH | 迁移到 Crystra-ui support；与 chart 类型无关 |
| TypeResolver | 泛型接口已有；业务服务实现未接 | UI Contract adapter；保留服务身份/语义而非直接返回图表 |
| receipt、Trace summaries、snapshot | 现有资源仅 rows/next，无法完整承载 | 使用泛型响应 metadata 或保留完整强类型结果；不建任意字段配置框架 |
| 异常 | 当前 Error，服务 code 未绑定 | 保留 cursor expired/不兼容等已定义 code，host adapter 转译宿主错误 |
| transport | 注入 read，尚无正式业务绑定 | DSH RPC/地址/鉴权留 host；HTTP 等通用机制不绑定 DSH |
| 多查询缓存与并发预算 | primitive 无跨 key 管理 | UI 通用 cache/resource scope；host 提供生命周期/预算，业务决定依赖 |
| 表达转换 | 通用 projectRows/投影工具已有 | 业务层按图形 interface 转换；查询层不解析 chart 配置 |

Meta 的具体类型应按服务定义，不提前建立任意数据描述协议。Evaluation 单次 compute 保留完整
强类型 response 即可，不能为统一接口伪造分页。Evidence continuation 原样传递并复用固定
查询参数。后端游标已过期时显式刷新，不将新 snapshot 拼到旧数据。

## 5. API 的可组合路径

| 路径 | 可得内容 | 限制 |
| --- | --- | --- |
| 一次 Evaluation compute → metric_results/slices | Token、平均调用延时、记录费用等，含 cohort 维度 | 整个 Task selection；非按日/逐调用/任意 Delivery 结果 |
| 已知 Delivery → traces 全部相关页 → model-call NODE | span 身份、起止时间、provider/request model、可选 tokens 与 canonical model/role/runtime | 记录可能缺测/采样/过期；页面必须限定为源状态允许的已记录数据 |
| facts?kind=DELIVERY_ROOT_BINDING → Delivery/Trace 身份 | 全局分页枚举已接受 root binding | 能列举但不是 workflow/name/执行时间索引；recorded_at 不是开始时间 |
| root 的 C07 → manifests?manifest_digest | workflow id/version 及其他 manifest 元数据 | 每 digest 精确查询；显示名称不保证存在；需 DSH 增加已定义接口透传 |
| tasks → task_id+as_of membership → Delivery | 确切 Task 成员 | 当前 DSH 只透传 list；membership 是接入缺口 |
| facts?event_name=intervention | 已记录介入事件及 C39=USER_REDIRECT | 无三类原因；recorded_at 只支持按接收记录日，而非执行发生日 |
| facts?event_name=usage | C42 kind/C43 unit/C44 source/C45 source_id/C46 value、truth | 不是订阅/价格表；公共 Event source 只给 event_id，不能假设包含精确调用上下文 |

发现入口修正：可以直接分页读取 root-binding Facts，不必先全量遍历所有 Task。但随后按
Workflow/开始时间筛选仍需读取元数据，成本依然随候选 Delivery 数增长。
已有 Task/Delivery 精确范围优先从该范围开始；目录不得静默扫描整个服务。

多查询按稳定身份连接；重复读取以源身份去重；不能从相同名称、相邻时间、同一个 Role
推断精确归属。尤其 usage Fact 到 model-call，公共 Query 0.1 的 EVENT source 是 event_id，
不是 trace_id/span_id；其关系矩阵也没有 usage→call 关系。即使上游 OTLP 内部存在上下文，
也不能认为前端已能通过公共接口拿到。调用费用优先使用 Evaluation 已验证归属的结果。

Evaluation 可一次供多 panel，但一次浏览器 POST 不等于后台低成本：当前实现会解析每个
Delivery 的 Facts/Trace。刷新应按数据查询复用，不能按每张卡/每个图形切换重复 compute。

## 6. 逐项能力与成本

分类：L=供给满足且通常低成本；S=明确范围内可组合、规模敏感；N=当前供给/语义不足。
所有 L/S 都以请求成功、源字段确实存在、读取范围明确为前提。大范围 compute 也可能超预算。

| 目标 | 组合路径 / 必须数据 | 结论 | 建议 |
| --- | --- | --- | --- |
| Token 汇总及 Provider/Model 分组 | compute 的 operational-token-usage slices，provider/model/role/runtime/direction | L | 复用一次结果；保留不同方向的覆盖限制，不将缺失补零 |
| 平均调用耗时 | operational-latency-ms 的 sum_ns/contributing_count | L | 兼容切片可加权，不平均均值；不称 TTFT/Role 执行时长 |
| 已记录可归属费用 | operational-attributable-cost，unit/source/source_id/cohort | L | 不跨不兼容来源相加，不标成完整账单 |
| 已有 12 指标及正式 compare Delta | compute result/left/right/deltas | L/S | 同一请求结果复用；任意大 population 不保证低成本 |
| 调用耗时 P50/P95/P99、直方图 | Trace 内 chat/generate_content 节点的 end-start 样本 | S | 小范围/已加载样本可直接计算；不是从均值/P95 反推，不代表未观测总体 |
| 已记录模型调用数 | model-call NODE 按 trace_id/span_id 去重计数 | S | 能计数；不数所有 NODE，不用 token coverage 代替；不擅称包含所有网络重试的 API 请求总数 |
| 每日记录调用数 / Token | 同上，start_time_unix_nano 与可选 input/output tokens | S | 明确按调用开始日分桶及时区；跨日调用归属是业务显示规则，不声称逐 token 时间 |
| 按 Workflow/version 的上述样本统计 | 已知 Delivery 查询范围 + manifest/root workflow 身份 + call 节点 | S | 单 Delivery 或小集合可组合；不能把整 Task 的 cohort 汇总摊到每个版本 |
| Role invocation 持续时间 | invoke_agent 起止时间，且确有 C30 与产品 Role execution 的语义对应 | S/N | 特定输入满足时可做 invocation 样本统计；C30 可选，协议不保证每个 Role 执行都有此映射，不能由 model-call 时长代替 |
| 精确 Delivery 子集的简单样本统计 | 逐 Delivery Trace → 本地所需统计 | S | 范围精确但扇出；不为求子集提交整个 Task |
| 精确 Delivery 子集的全套 Evaluation 指标/Delta | compute 仅接受 Task ID 集合 | N | 缺选择能力；不能拆/合结果默认保持 eligibility、缺失策略和 Delta 语义 |
| TTFT 的均值/分位数/分布 | 首 token 时刻或直接 TTFT 样本 | N | 已发布 Profile allowlist 未提供；起止时间只代表整个调用 |
| cached/uncached input tokens、缓存命中率 | 缓存数与总输入数或现成比率及合并输入 | N | Profile 仅有 input/output tokens；usage-availability 不是 cache-hit |
| 订阅费、周期、订阅等价估值 | 订阅元数据、有效价格、计费分类/估值输入 | N | Usage kind/source 不等于套餐/价目；缺显式供给，不能前端猜价格 |
| 完整实际按量账单费用 | 完整计费范围与费用值 | N | partial recorded Usage 只能按其原口径展示，不保证全账单 |
| 每日费用（按调用发生日/Provider） | 精确 usage→call 连接 + call 时间 + money | N/S | 当前公共字段缺精确连接；若只看“按记录接收日的某单位/来源 Usage”可有界统计，但不是同一指标 |
| Role×Model 每次执行费用/样本量 | Role execution 身份、精确调用费用归属、执行次数 | N | 当前 call/Delivery-template 汇总不能恢复执行粒度；多模型执行的归属规则也未确定 |
| Role×Model 返工发生率 | execution 级返工结果、model 归属、分子分母 | N | 已有 rework 按 Delivery/template，无 model；finding invocation 字段不等于完整执行总体/模型归属 |
| 已记录 USER_REDIRECT 数 | intervention EVENT_CONTRIBUTION 按事件身份去重 | L/S | 有界结果可计数，按 recorded_at 分桶只称“记录接收日” |
| 计划内裁决/纠偏/主动变更三类原因 | 明确类别字段 | N | C39 当前闭集只有 USER_REDIRECT，不能拆成三类 |
| 每日最长无人工介入运行区间 | 运行/暂停/恢复边界、真实介入时刻及口径 | N | Trace 根时长与记录接收时间不足以重建；不可把相邻记录时间差当自主运行 |
| Delivery 精确检视 + Trace | 已知 Delivery → traces；按需补 manifest | L/S | 只按选择读取；大 Trace 可分页/虚拟化，源状态不由 UI 猜 |
| 全局 Delivery 的 Workflow/name/执行时间筛选与排序 | roots 全枚举 → 逐候选 manifest/Trace | S/N | ID/workflow/time 部分可扫描得出但无对应索引；名称可能本来未提供，不能猜。交互式全局查询不宜全扫 |

每日 Token/调用数的 S 结论不要求把 Evidence 变成指标计算服务：前端只对确切已读的
记录样本做显示统计。如果目标变为全平台、大范围、长期总体，应由服务侧提供合适粒度
的查询或 Evaluation 能力；不把所有 Evaluation 计算复制到浏览器。

## 7. 成本为什么会过高

设 D 为候选 Delivery 数，T_i 为第 i 个 Trace 的 item 数（包含节点和边），L 为页大小。
已知 Delivery 集合的 Trace 请求数约为 `sum(ceil(T_i/L))`；目录发现另加 root/membership
分页，manifest 按不同 digest 增加一次查询。用于统计时还传输了不需要的 tool/agent 节点、
边和字段；当前 Trace API 没有 operation/time/provider 过滤及字段裁剪。

示例（预算模型，非实测）：D=200、每 Trace 400 items、L=200，需要 400 次 Trace 请求，
处理 80,000 items。若还需 root 发现且 200 root 恰好一页，共 401 次；再按需读取 200
份不同 manifest，最多额外 200 次。若平均每 item 1 KB，仅 Trace 约 80 MB，尚不含 JSON
解析、对象内存与排序。复用根 Trace 中已有 workflow 字段可省部分 manifest 请求，不能
机械地要求两条路径都执行。

已核对的边界（不是建议的 UI 阈值）：

- Evidence Query 每页最多 200；snapshot lease 默认 60 秒，可配置 10..300 秒；默认最多
  4 个并发 lease，可配置 1..8。跨大量 Delivery 同时开分页可能耗尽租约或过期重读。
- DSH gateway 默认单响应上限 8 MiB、超时 125 秒；分页绕过不了总传输成本。
- Evaluation 本地默认每侧 500 Delivery、每遍历 20 页、100,000 输入记录、120 秒 deadline；
  Task selection 单侧最多 24。这些是实现/协议限制，不表示该规模必能在时限内成功。

浏览器读取样本后，分组约 O(N)，精确分位数常用排序 O(N log N)。通常首先受网络扇出、
lease 与解析成本限制，而非图形渲染配置；按 chart interface 设计不会消除这些成本。

应采用：小范围明确按需读、重复请求缓存、限制同时开启的遍历、预估剩余工作量、取消
离开范围的请求。自动刷新不得把所有大结果集重新扫一遍。这里不硬定行数阈值，接入后
测量请求数/字节数/首图时间/峰值内存，再按数据源配置预算。

## 8. 建议处理顺序及影响

1. **前端可直接推进**：将 hook/support 移入 UI；按 chart interface 输出 Token、均值、
   已记录费用与已有指标。补 typed response/meta，不引入通用图表配置协议。
2. **低成本宿主接入**：DSH 透传已经定义的 task membership/manifests；共享缓存由 UI
   提供机制，host 管理生命周期。无须因此修改服务 Contract。
3. **条件样本能力**：限定 Delivery 集合上试延时分位数、记录调用数、每日 Token；先复用
   已加载数据，再按预算查询。不能默认执行大范围全遍历。
4. **服务查询效率议题**：跨 Delivery 的有界 model-call 明细/必要字段读取、Delivery
   元数据索引，是成本缺口；与当前缺 TTFT/缓存/计费/介入分类字段分开讨论。可以由服务
   提供合适的明细或聚合结果，但本文不替 owner 选择/修改 Contract。
5. **服务语义议题**：TTFT/缓存、订阅计费、Role execution 关联与介入类别/运行区间，
   先由相应 owner 确认事实与指标语义，再讨论输出形式。不能仅增加 UI interface 就宣称支持。
6. **Evaluation 选择议题**：是否支持 Delivery/执行时间/Workflow 范围及细粒度结果，
   独立于图表样式。当前 Task 选择能力不能无损代替这些范围。

Crystra-ui 的改动是类型、业务投影与可复用查询；DSH 的改动是 host adapters/allowlist；
Evidence/Evaluation 的改动仅列为后续讨论候选，没有本轮修改授权。图形引擎无需重做。

## 9. 证据索引

- [公共 Trace/Fact 与过滤定义](/Users/firestige/Projects/workflow-self-recursive/docs/contracts/evidence-query/evidence-query.md)：§3–§7；Fact Event source 只有 event_id，Trace 有真实起止时间。
- [公共响应 schema](/Users/firestige/Projects/wsr-contracts/evidence-query/schemas/evidence-query-response-0.1.0.schema.json)：node、source、fact、trace_summary。
- [已发布 Profile 校验器](/Users/firestige/Projects/wsr-contracts/observation/tools/validator.cjs)：standard allowlist、C39 枚举与 operation applicability。
- [Task/Manifest 查询](/Users/firestige/Projects/wsr-contracts/evidence-task-query/evidence-task-query-1.0.0.json)：REVIEW_CANDIDATE；LIST_TASKS / TASK_MEMBERSHIP / manifest route。
- [Evaluation 响应与选择](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/api/models.py)、[12 项目录](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/catalog.py)。
- [调用样本规范化](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/normalization/operational.py)：自身也从 Trace 读取时长和 Token。
- [解析成本与限制](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/resolution/service.py)、[执行路径](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/compute.py)。
- [DSH gateway](/Users/firestige/Projects/wsr-dsh/modules/studio/src/host/gateway.js)：allowlist、125 秒和 8 MiB 默认值。
- [v8 分析需求](/Users/firestige/Projects/workflow-self-recursive/tmp/20260907/Crystra-ui-design/pages/analysis-audit.md)：总览指标、每日统计与人工介入要求。

实施跟进（2026-09-28）：查询资源已迁 UI；Task/Evaluation 首批指标和 DSH membership/manifest 白名单已实现。本文成本/供给结论不代表其他能力也已接入；详见 [当前状态](./README.md)。
