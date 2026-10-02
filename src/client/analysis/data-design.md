> 2026-09-28 实施更新：时间范围 Evaluation、Delivery 元数据目录、独立 Trace 查询与 localStorage 配置已接入。当前页面与验证边界见 [README](README.md)，跨层决策见 [Analysis 设计修订](../../../../workflow-self-recursive/docs/systems/bi/analysis-data-integration.md)。下文保留设计推演，涉及“尚未接入”的表述是历史状态，不作为当前待办。

# Analysis 数据分层与 Chart envelope 设计候选

日期：2026-09-28。范围：Crystra 前端；以本轮用户明确的三层分工为设计输入。
本文是可审阅方案，不是新增服务 Contract。未修改 Contracts、Observation、Evidence、
Evaluation，也未向 3085 注入样本数据。核对依据是当前本地代码与设计文档，不宣称部署
服务与工作区版本完全一致。

## 1. 已确定的框架

**2026-09-28 用户确认的分包修订：以是否依赖 DSH 专有能力为边界，不以展示、业务、
查询的层次直接划包。此结论替代本设计初版将业务层与查询层整体放入 DSH 的安排。**
Crystra-ui 可以包含领域 hook、查询 support、数据适配与工具，不仅是显示组件。
跨包长期约定见 [Analysis 分包原则](../../../../wsr-ui/docs/analysis-data-boundaries.md)。

| 层 | 输入与输出 | 所属及职责 |
| --- | --- | --- |
| Panel/Chart | 按 type 区分的 ChartData + 展示状态 → 图表/交互事件 | Crystra-ui；绘制、tooltip、布局、图例等局部 UI 状态 |
| 业务层 | 用户范围/观察设置 + 已解析查询结果 → Chart envelope | Crystra-ui Analysis；选择查询、组合多个结果、关联、过滤、聚合、状态协调 |
| 查询层 | 请求参数 + transport + resolver → 缓存的数据及查询状态 | Crystra-ui support/data；请求、反序列化调用、分页、去重、取消、异常 |

调用方向：业务 hook → 查询资源；返回方向：解析结果 → 业务纯 projector → Panel。
查询层不得引用 WidgetData、图表配置或 Analysis 指标名称。Panel 不知道服务 URL、
游标、MetricSlice 或 Evidence 数据结构。业务关联规则进入 Crystra-ui 的 Analysis 业务模块，不进入 Panel/Chart 显示组件。

现有 usePagedQuery 属于查询层；useQueryProjection 只是 memoization 工具，其传入的
业务 projector 属于业务层。避免把这两个 hook 合并成自动解释指标的通用引擎。

TypeResolver 只负责响应验证/解码与页结构适配。Wire 可为 unknown，不通过泛型断言
替代运行时验证。Chart envelope 由业务层创建，不从 TypeResolver 直接返回。

## 2. 按 Chart 类型定义展示接口（2026-09-28 修订）

**用户确认：每种 chart 绑定一个 interface，以 `type` 字面量组成可辨识联合；必选、
可选字段和调用匹配首先由 TypeScript 保证。** 本节替代初版的通用
ChartTable/ChartColumn/ChartBinding 配置方案，不建设类 ECharts 的配置语言或解析器。
前文所称“表格定义”是描述字段需求的方式，不要求所有图表都接收统一表格对象。

继续复用现有绘图引擎，但图形入口不再允许任意 `view` 与任意数据形状交叉配对。
业务层直接生成目标 chart 的数据。可以复用 Point/Series 等小型类型，但每个 chart
有自己的 interface 与唯一 type，不引入基类、运行时注册器或必选字段规则引擎。

以下为三个示例，非完整生产类型清单；后续按现有 View 逐个列明字段：

```ts
interface LineChartData {
  type: 'line';
  unit: string;
  points: readonly { x: number; y: number | null }[];
}
interface MultiLineChartData {
  type: 'multi-line';
  unit: string;
  series: readonly {
    id: string;
    label: string;
    points: readonly { x: number; y: number | null }[];
  }[];
}
interface HistogramChartData {
  type: 'histogram';
  unit: string;
  bins: readonly { from: number; to: number; count: number }[];
}
type ChartData = LineChartData | MultiLineChartData | HistogramChartData;

// Panel 保留完整联合，而非拆成互不关联的 type/data 两个 prop。
function Chart({ data }: { data: ChartData }) {
  switch (data.type) {
    case 'line': return <LineChart data={data} />;
    case 'multi-line': return <MultiLineChart data={data} />;
    case 'histogram': return <HistogramChart data={data} />;
    default: {
      const unreachable: never = data;
      return unreachable;
    }
  }
}

const histogram = {
  type: 'histogram',
  unit: 'ms',
  bins: [{ from: 0, to: 100, count: 12 }],
} satisfies HistogramChartData;
```

`LineChart` 等组件分别接受自己的 interface。使用 `switch` 类型收窄、`never` 穷尽
检查、`satisfies` 约束业务输出；不通过 `as` 断言掩盖不匹配，也不再用 `view: string`
配合一批 optional 字段来运行时判断。示例 x 为有序数值；时间/类别轴的实际字段按
既有 renderer 逐图确认，用元组或联合表达可明确的约束，不扩展为任意轴配置系统。

| Chart 类型 | 对应 interface 的必选数据 | 按需可选内容 |
| --- | --- | --- |
| number | value、unit | 格式化文本 |
| status | 状态和展示文本 | 副标题、图标 |
| range / bar / ring / gauge | 各自独立接口，数值及该图要求的量程 | 目标线、正常区间 |
| columns / bars / pie / donut | 各自独立接口，带稳定 id/label/value 的分类项、unit | 配色 |
| line | points、unit | 明确的显示范围 |
| multi-line | series（id/label/points）、unit | 图例位置 |
| area | 本图实际使用的点或系列、unit | 显示范围 |
| grouped-columns / grouped-bars | 各自独立接口，分类与分组数值、unit | 配色 |
| stack / stacked-columns | 各自独立接口，已可叠加的分类/系列数据、unit | 配色 |
| histogram / frequency-line / frequency-table | 各自独立接口，bins 起点/终点/count | 显示范围 |
| heatmap | x/y 分类身份与数值单元、unit | 色标范围 |
| radar | 维度、系列、值、共同可比量程 | 配色 |
| value-table | 该表格组件的列/行类型 | 展示排序与分页配置 |

上表是逐图核对清单，不表示同一行共用一个含多个 type 的接口。具体必选字段以
最后的 interface 为准。仅 value-table 使用表格组件自己的列/行类型，不把它推广
为所有 chart 的公共 schema。

统计、分组、分箱在业务层完成，chart 不发现重复格子就自行求和。不同 chart 可复用
业务中间结果，但切换图形时通过类型明确的转换函数产生目标数据，不能只改 type。
缺失点使用 null，而不是 0；series/分类使用语义 ID，label 仅展示。

Panel 标题、尺寸、布局与请求状态仍是独立 props；某图必须的量程则放入该图必选
字段，不能藏在一个通用 optional 配置袋中。源指标 LOWER_BOUND 等状态由业务层
提供必要说明，不给每次转换附加来源链或计算历史。

TS 保证编译期结构，不保证外部 JSON、有限数值、身份唯一性、时间顺序或语义粒度。
反序列化/Contract 校验仍在数据入口；业务算法负责必要的数据语义检查。这里只保留
具体边界检查，不为内部 chart 数据再造一个通用校验或配置解释框架。
精确源值在业务层运算后转换成绘图值；导出原始表格与图表，不用绘图舍入值替代源值。

Trace 保留已有 TraceView；不强行纳入统计图的联合。Delivery 目录同样使用自己的模型。

## 3. 业务层组织与 hook 候选

目标在 Crystra-ui 的 Analysis 模块组织 hooks/、model/、projectors/ 与 Contract adapters，
通用查询机制进入 support/data；具体目录复用现有工程约定，暂不创建空实现文件。
Crystra-dsh 的 src/client/analysis 只保留 page 装配、宿主配置与 host adapters。

| 名称（候选） | 职责 |
| --- | --- |
| useAnalysisDataset(scope) | 解析明确的查询范围，取得/共享所需查询资源；暴露源数据及请求状态 |
| useAnalysisPanel(dataset, definition) | 调用纯 projector，组合 panel 所需多源数据与状态；不再独立拉一份相同数据 |
| projectChartData(dataset, definition) | 业务过滤、关联、分组、聚合；输出对应 chart interface |
| Contract adapter（Crystra-ui） | Evidence/Evaluation 响应校验、版本绑定、反序列化、续页适配 |
| Host adapter（Crystra-dsh） | 注入 DSH RPC/鉴权/访问地址配置，管理宿主生命周期 |

它们是分工接口，不强制为每张卡创建 hook。总览和研究报表复用相同的查询资源与
业务投影；chart title/view/size/配色不进入查询 key。

缓存身份至少区分数据源/接口版本、权限范围、服务查询参数及粒度、分页参数、resolver
版本。资源按主机 scope 持有；按固定查询生成一个资源，不在组件 render 时创建。
页结果和父查询共享，不能为了每一张图重复执行 Evaluation。

业务状态按依赖组合：缺失非必需标签不阻塞数值；必需的费用数据错误则相应费用 panel
显示错误，不让整个 dashboard 失败。切换查询范围时不把旧范围的数据标成新范围；同一
范围刷新允许保留旧图并显式显示刷新/失败状态。多个独立 API 没有共同快照时，不宣称
具备原子快照一致性。用发布的身份和结果 receipt 校验可关联性，不按名字/时间相近猜测。

多个 MetricResult 可以按确切 slice 维度组合成宽表；跨来源连接前先声明键与基数。
例如一份 manifest 多个 metric 行采用 many-to-one 元数据连接；不能因重复连接导致
费用翻倍。slice 已经消除的维度不能再通过 join 恢复：整组 Token 总量不能分配给该组
Task 下的每个 Delivery，也不能贴上每份 manifest 的版本当作按版本切片。

## 4. 查询层复核（按 chart interface 规则更新）

详细证据与成本见 [Contract 组合复核报告](./contract-composition-report.md)。
查询层不读取 chart 类型；TypeResolver 解析服务响应，业务层输出具体 chart interface。
实施更新：分页/缓存/去重/取消资源及测试已迁入 Crystra-ui；泛型 metadata、QueryError、
Task/Evaluation Contract adapter 与 DSH transport 已接入。跨查询历史缓存尚未实现。receipt/Trace summaries 留在查询
与业务层，不复制进图表数据。按服务定义泛型类型即可，不建任意字段/图形配置解析框架。

## 5. 当前 API 的组合方式（复核后）

- 一次 Evaluation compute 的 slices 可供多 panel；type 改变只做本地投影。
- 指定 Delivery 的 Trace NODE 已含起止时间及可选 Token，可生成真实记录样本；
  小范围可本地算分位数和按调用开始日分组，不能据此宣称未观测调用的总体结果。
- 全局可用 DELIVERY_ROOT_BINDING Facts 分页发现 Delivery，不必先遍历全部 Task；
  但按 Workflow/开始时间搜索仍可能需逐候选读取 manifest/Trace，缺有界索引。
- Task membership/manifests 已有接口，DSH 尚未透传；属于宿主接入缺口。
- compute 仅接受 Task selection；不能用整 Task 回答其 Delivery 子集或任意时间范围。
- usage EVENT 公共字段不提供精确调用上下文，不能假设可 join 到 call 时间/模型。

映射以 chart interface 为目标：slice_key 对应 series/分类身份，value 对应数值/unit，
state 对应 gap/必要说明；measures/count 或 numerator/denominator 仅在口径允许时参与
业务聚合。无需 chart 接受统一的 dimension/measure 列绑定对象。

## 6. 数据缺口与组合成本（复核后）

| 分类 | 功能 | 判断 |
| --- | --- | --- |
| 供给满足，可复用结果 | Token cohort 汇总、调用平均耗时、记录可归属费用、已有指标/Delta | 一次 compute 支撑多 chart；不改名为 TTFT/Role 执行/完整账单 |
| 条件可组合，规模敏感 | 调用耗时分位数/分布、已记录调用数、每日 Token/调用数、部分 Workflow/version 样本统计 | 逐 Delivery 拉取 Trace；小范围可做，大范围请求与数据量高 |
| 映射有条件 | Role invocation 时长 | invoke_agent 起止时间存在，但必须有真实 C30/产品 Role execution 映射；不能假定普遍成立 |
| 字段/语义不足 | TTFT、缓存 Token/命中率、订阅费用/周期/等价估值、完整按量账单 | 当前协议没有足够输入，不能从其他指标推导 |
| 连接/粒度不足 | 按调用发生日的费用、Role×Model 执行费用/返工率 | 缺精确 usage→call/执行归属或对应粒度；同名、邻近时间不可补关联 |
| 部分可做 | 已记录介入事件数量 | 可统计 USER_REDIRECT；不能还原三类原因或真实自主运行区间 |
| 范围能力不足 | Delivery 子集的完整 Evaluation 结果及正式 Delta | Task compute 不能无损替代；简单样本统计可走 Trace，但不是全套指标替身 |
| 查询成本高 | 全局 Delivery Workflow/执行时间检索、海量跨 Delivery 样本统计 | 枚举与 N 路读取；名称还可能本就未记录，不能强填 |

上一版将“没有 Evaluation 样本接口”泛化成“Contract 无法获取调用样本”的结论已撤回。
详见报告的逐项表、请求量模型与 owner 影响；所有服务变更仅供讨论，本轮不修改 Contract。

## 7. 当前 UI 需要修正的模型位置

1. `analysis-catalog.ts` 静态声明 9 项指标与操作，无法代表真实能力目录。正式可选项由
   业务适配出的能力描述提供；不把全部 fixture 选项宣称已接入。
2. `analysisItemUnit` 硬编码 USD、默认 call grain。单位与分母应来自已绑定语义；
   现有 compatibleChartItem 仅比较单位，无法证明粒度一致。属于业务能力/绑定层修正。
3. 将现有独立的 View + WidgetData 入口收敛为按 chart type 区分的联合，不能任意交叉配对。
   `MatrixData` 单位为整图一个字符串，可以继续约束同图单位；不同币种/不同分母拆图。
   series 当前是 labels/values 且不支持 null，应补齐 gap 表达。这里才是 chart envelope
   的真实展示缺口，不需要服务按图表格式输出。
4. `AnalysisData.overview/queries/matrix` 是同步展示投影入口，不应暗中发异步请求。
   初期可由业务 hook 生成闭包兼容它们，后续收敛成明确的展示数据与能力 props。
5. `DeliverySearchRecord` 强制要求 taskName/workflowName/startedAt，且搜索依赖它们。
   改为可缺省展示字段，日期未知时不偷偷当作 0 或被“正常过滤”，显示不可按该字段筛选。
6. 导出从已解析的源表与图表分别出发；只加载部分记录时明确导出范围，不自动触发全量下载。

## 8. 例子：复用一次结果生成两个图

在明确的 Task 集合范围内 compute 一次，从 operational-token-usage 读取切片：

```text
provider  model  role  runtime  direction  tokens
p1        m1     r1    rt1      input      120
p1        m1     r1    rt1      output      30
p2        m2     r1    rt1      input       80
p2        m2     r1    rt1      output      20
```

业务层生成按 Provider 的表格（本例假设各行单位一致、有效且互不重复）：

```text
provider  input  output
p1        120    30
p2         80    20
```

Panel A：业务层把上述中间结果转换成 GroupedColumnsChartData。
Panel B：业务层复用中间结果，转换成 ValueTableChartData；两者各有独立 type 和 interface。
切换图形或筛掉 p2 只重做本地投影，不重新 compute，也不靠通用 binding 解析器转换。
如果要每日曲线，上述数据缺日期，不能继续变换成每日表格；需要更细粒度供给。
如果要只看其中某个 Delivery，上述 cohort 合计也不能缩小回该 Delivery。

## 9. 后续实施顺序与验收

0. 已完成通用查询资源/hook/测试迁移与 adapter 分离；首批仅明确 Task 范围的三项指标。
1. 按现有 chart 清单逐个确认 interface，组成 type 可辨识联合；保留现有引擎，不实现通用图表 schema/解析器。
2. 在 Crystra-ui 补查询资源 Meta/错误结构和 Contract adapters；在 DSH 补 host adapters，绑定当前可用版本，不造 backend endpoint。
3. 优先验证一次 compute 多 panel 的 Token/调用均值/记录费用路径，明确当前范围和口径。
4. 补目录、精确 Trace 读取；membership/manifests 是 host 接入事项。
5. 按 C 项提交服务能力清单供讨论；无需因为趋势未提供而阻塞已有统计图接入。

验收场景：多 panel 请求去重；切换 view/filter 不查询；切换真正范围会切资源；分页
错误不污染已加载数据；跨页/跨查询不重复计数；旧范围迟到响应不覆盖新范围；缺失
保留 gap；按样本计算 P95/P99而不从 P95推 P99；混合单位拒绝误合并；精确数据导出
不被绘图舍入污染；不足的数据不被自动扩展为整 Task/全部 Delivery。

## 10. 核对依据

所有链接指向本次核对的本地源文件；后续 API 绑定时再次核对版本。

- [v8 分析需求](/Users/firestige/Projects/workflow-self-recursive/tmp/20260907/Crystra-ui-design/pages/analysis-audit.md)：总览及系统读取边界。
- [UI 展示数据类型](/Users/firestige/Projects/wsr-ui/packages/bi/src/domain/widget-families.ts)：WidgetData、MatrixData、familyViews。
- UI `packages/bi/src/domain/analysis-catalog.ts`、`observation-settings.ts`、`delivery-search.ts`、`trace/trace-view.ts`。
- [Evaluation 模型](/Users/firestige/Projects/wsr-evolution/src/crystra_evolution/api/models.py)：EvaluationSelection、ExactValue、MetricSlice、SideResult。
- Evolution `src/crystra_evolution/calculators/operational_{token_usage,latency_ms,attributable_cost,usage_availability}.py`。
- Evolution `src/crystra_evolution/calculators/role_template_{rework_rate,trajectory_partial_cost}.py`、`delivery_cycle_time_ms.py`。
- Contracts `evidence-task-query/evidence-task-query-1.0.0.json`；`observation/schemas/delivery-manifest-0.1.0.schema.json`。
- Evidence `src/crystra_evidence/transport/query.py`；composition `docs/contracts/evidence-query/evidence-query.md`。
- [DSH gateway](/Users/firestige/Projects/wsr-dsh/modules/studio/src/host/gateway.js)、`loopback-integration.js`、`src/client/shared/paged-query.ts`。

旧 Iter5 BI 文档对前端计算的 allowlist 比本轮用户明确的设计更窄。本候选记录新的
前端责任边界，不能将其描述为旧文档已全部支持，也不因此修改服务语义或发布协议。

## 实施状态 — 2026-09-28

以 [README](./README.md) 为当前代码接入清单。泛型迁移、metadata/error、Task/Evaluation
adapter、三项指标 number interface 与宿主 gateway 接入已完成；其余图形、样本统计、
Trace/报表数据与多查询缓存仍按候选设计推进，不能据本文候选接口名宣称已全部实现。
