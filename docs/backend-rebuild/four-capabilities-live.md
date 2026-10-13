# 四项后台能力：真实模型 DSH 完整闭环

2026-10-12。结果：**通过**。本轮验收运行约403.4秒。

## 实际调用链

当前Codex会话启动实验脚本 → Cordis装配真实DSH服务 → DSH原生agent/loop/tools/session → `dsh-llm-pi-ai` provider → 已授权OAuth连接的Codex订阅模型。

业务worker和原始计算边界使用 `gpt-6.1-sol`（low）；独立反思和结晶评估使用 `gpt-6-astra`（high）。没有注册LlmAdapter夹具，也没有直接调用模型API来替代DSH。原始计算边界本身另建DSH agent调用真实模型，因此Python接管减少的是这个边界的模型调用；外层worker仍使用模型。共7个真实模型会话，原生事件中保留provider/model和usage。

产品由默认 `dsh-crystra` 入口加载。完整实验脚本为 `scripts/backend/four-capabilities-live.mjs`，可用 `--plan` 查看范围而不读取凭据、不启动服务或模型。凭据路径需通过环境显式提供，凭据不进入提示或报告。

## 观察结果

| 能力 | 真实DSH观察 |
| --- | --- |
| 共识 | 全新Squidex/PostgreSQL中经受管操作发布，共识按精确publication reference绑定；14条原生system/message含共识标记。没有让worker获得CMS写凭据。 |
| Barrier | sol先声明执行测试，按负例要求提前结束；原生seq 20出现插件发出的NO_GO，worker随后实际运行测试。最后7个承诺全部GO闭合，active为空，pending为空。 |
| 反思 | worker主动调用可用的crystra_reflect_core工具（本阶段任务明确要求反思）；独立astra读取4个指定文件，实际执行回归和性能测量并提交三轴报告。回归23/23通过，两个实验exitCode均为0。 |
| 结晶 | 普通业务工具调用产生独立原始观察后自动启动astra；模型读取历史原生依据、生成Python源文件、注册并提议准确reference；两次候选均各完成2个对拍后准入。 |

业务路径如下，五批结果都与仅用于验收的已知结果一致：

| 批次 | 输入values | 实际执行路径 | sum |
| --- | --- | --- | ---: |
| 1 | `[3, 1, 3]` | original-live-model | 7 |
| 2 | `[0, -2, 0, 8]` | original-live-model | 6 |
| 3 | `[5, -1, 5, 0]` | crystallized-python | 9 |
| 4 | `[10, 10, -4]` | original-live-model | 16 |
| 5 | `[1, 7, 1]` | crystallized-python | 9 |

第4批前，实验修改了已经准入的执行文件。hash绑定识别出变化，回退真实模型，自动重新探索/注册/对拍后再准入。第5批前正常dispose并重新装配DSH host，从同一JSONL恢复worker和结晶状态，已闭合承诺保持一致，Python重新接管。原生calls/results的sourceEventSeqs和callId关联均已复核；两次快速执行均有持久route和Python执行收据。

## 发现与边界

首轮在外部模型请求前失败：DSH provider的内置目录没有gpt-6.1-sol。使用DSH公开models配置显式声明sol/astra后重跑成功，未修改DSH、pi-ai或Crystra生产核心代码。配置中的contextWindow/maxTokens是本轮保守的本地预算，不是声称模型官方上限。失败证据保留在相邻run-1791815751793。

反思报告含7项条目，其中5项没有实验复现依据：稀疏数组的值域、split后保留动作的别名、非法原生事件形状/序号、整体资源边界、匹配图构建的规模成本。它们保留为源代码推测/后续实验建议，不能当作本轮确认的5个产品缺陷，也没有擅自扩成修复需求。

提前结束与文件修改均为刻意注入的负例，不能表述为模型自发幻觉。重复任务和反思目标由实验提供；结晶的发现、候选构建与准入由机制/模型推进，并非宿主预填Python实现。预知结果用于校验模型实际输出，没有给模型答案或据此替换输出。此轮证明这组有明确边界的任务可以经真实DSH模型链触发四项能力；不代表任意任务自动规划、任意代码正确性、长期可靠性或净成本收益已经证明。

本轮重启是同一进程中重建DSH host/原生agent并恢复持久状态，不能记为真实OS进程SIGKILL测试；完整DSH进程故障恢复已有上一轮独立安装验收证据。本轮正常host重建复验通过。共识本轮覆盖受管发布与装载，未重复全部管理故障矩阵，也未测试worker自行发起共识修改。

新Squidex实例的两个容器、网络和数据卷已清除。实验期间没有修改生产核心实现或外部项目，也没有写入共享DSH会话数据。

## 可复核文件

本目录包含 `result.json`（逐阶段结果）、`audit.json`（独立事件关联复核）、`reflection.json`（反思全文及实验收据）、`before-fault.json`/`after-fault.json`（结晶状态）、`worker-state.json`（7项闭合承诺）、`dsh/`（原生会话JSONL）、`code/`（模型生成的源代码和实际执行收据）、`publication.json`（精确共识引用）及CMS启动/清理日志。

使用量按原生assistant/message逐事件去重汇总，见audit.json。它是单次验收的使用记录，不是价格核算或收益基准测试。

本轮证据目录：`artifacts/backend-rebuild/four-capabilities-live/run-1791815846921/`。
