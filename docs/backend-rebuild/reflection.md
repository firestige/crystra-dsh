# 独立核心代码反思

2026-10-12，DSH 0.1.5-rc.2，开发入口 `dsh-crystra`。

## 定位与边界

反思由宿主选定的高阶模型在独立 DSH 会话中研究核心代码的正确性、鲁棒性和性能，实际读取源码、运行回归或性能实验，给出具体观察、改进建议和待验证问题。报告是建议，不是质量认证。`completed` 仅表示本次会话正常结束并提交了结构化报告，不表示代码正确、全部测试通过或性能达标。

反思没有 `agent/turn-stopping` 监听器，不进入 Barrier 的 GO/NO_GO 计算，不修改承诺、共识或源文件。发现问题后，由原工作 agent 或用户决定后续验证和修改；若后续工作声明承诺，原有 Barrier 再核验这些行为是否执行。没有每步自动反思或新调度器。

## 接入

```js
import * as piAiLifecycle from 'dsh-crystra/pi-ai-lifecycle';
// 当前 DSH + pi-ai Codex 适配需显式挂载，以在 agent 关闭时释放会话连接。
await ctx.plugin(piAiLifecycle);
await ctx.plugin(backend, {
  resolveConsensus,
  reflection: {
    agentOptions: { provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'high' },
    timeoutMs: 300000,
    // 可信宿主决定文件和可执行实验；goal 由工作 agent 提出。
    async requestFor(agent, goal) {
      return {
        root: workspace,
        files: ['src/core.js', 'test/core.test.mjs'],
        goal,
        experiments: [{ id: 'core-regression', command: process.execPath,
          args: ['--test', 'test/core.test.mjs'], timeoutMs: 30000 }],
      };
    },
  },
});
```

启用 `requestFor` 时，原有 `crystraBackend.attach` 同时提供 `crystra_reflect_core({goal})`。也可以单独在 DSH agent 的 setup 中调用 `ctx.crystraReflection.attach(ac, agent, requestFor)`，无需给该 agent 挂 Barrier。setup 使用语句块，不要返回工具 disposer，DSH 会把 setup 返回值理解成提交对象。

宿主也可直接 `await ctx.crystraReflection.run(request, {signal})`。`read(id)` 从持久记录读取结果；重建宿主后无需重新调用模型或重跑实验。读取上次只有 running 的记录会显示 interrupted，不能据此声称自动恢复反思。配置中必须显式提供 provider/model，插件不猜测什么模型足够强。

## 运行记录与范围

- 独立反思会话保留 DSH 原生模型、工具、结束事件；额外域记录保存开始/最终状态、文件 hash、报告和实验收据。
- 源码读取使用开始时捕获的选定文件内容；路径必须实际位于 root 内，单文件最多 256 KiB。模型不获得任意文件读写或继承的通用工具。
- 实验只能从可信宿主给出的命令列表选择，不执行模型拼出的 shell；实际记录命令/参数、原生 callId、退出码、stdout/stderr、耗时和执行前后选定文件 hash。非零退出码是有效观察。进程无法启动或超时与测试失败保留不同信息。
- 报告必须覆盖三个轴；发现项须指向已实际读取的选定文件，实验引用必须对应本次真实收据。空实验引用表示源码推测，不代表实验证明。格式与引用检查不能证明报告的自然语言结论正确，也不能识别所有偷换含义的引用。
- 任一选定文件在实验前后或结束时与开始版本不一致，整体状态 stale；未提交报告为 incomplete；模型/运行异常为 failed；预算耗尽 timed_out；调用方取消 cancelled。超时是独立研究工作的预算，不是 Barrier check 超时。
- 原工作 agent 只接收报告、记录 id、模型/文件版本和实验索引，不接收整段反思会话。完整输出通过宿主 read 获取。

当前实验在指定工作目录运行，宿主提供的命令本身仍是可信代码，不是 OS 沙箱；测试脚本可以有副作用。应在独立工作目录运行会写文件的实验。版本检查只覆盖显式 files，不涵盖全部依赖/环境，也无法发现两次检查之间改动又恢复的情况。当前由模型选择已有实验并提出新增验证建议，尚未提供模型自动编写和执行任意新实验的能力。策略、prompt、模型和实验集可以随实践调整。

## 验证结果

`node --test test/backend/reflection.test.mjs`：9 项通过，真实 DSH loop + 固定离线 LLM adapter，真实 Node 子进程。覆盖失败回归的记录、虚构实验引用、代码变化、没有报告、研究超时、文件范围、测量数据记录、独立 worker 请求链、调用取消；完成记录在新 host 中读取且不重复模型/测试。

全仓 `npm test`：337/337，通过。日志：`artifacts/backend-rebuild/reflection-focused-tests.log`、`reflection-full-tests.log`。没有调用真实模型，不能把此结果解释为高阶模型质量、漏判率或自主实验设计能力已经验证。

本地实际运行 `node scripts/backend/reflection-benchmark.mjs`：固定 20 项动作，历史噪声 100/1000/10000，10 次预热，每档 7 组、每组 30 次核验。本次每次核验中位数约 0.082/0.201/1.767 ms。原始数据在 `artifacts/backend-rebuild/reflection-benchmark.json`。这只是当前实现的单机历史长度测量，未比较候选优化，也不是性能 SLA。

## 真实模型验证

已准备 `scripts/backend/reflection-live.mjs`，选择本地已安装目录中的 `openai-codex / gpt-6-astra`，复用 DSH 已有 OAuth 凭据服务。计划传入四个文件：

1. `src/backend/barrier.js`
2. `src/backend/value.js`
3. `test/backend/barrier.test.mjs`
4. `scripts/backend/reflection-benchmark.mjs`

用户明确授权后已执行：模型实际读取四个文件、运行两项实验并完成三轴报告；实验收据和代码版本已独立核对，新 host 可恢复完全相同的结果。模型独立指出的重叠承诺匹配问题另有本地复现。两次报告格式错误经反馈修复；首次真实模型脚本完成后仍驻留；后续已定位 pi-ai 缓存连接/定时器，并通过会话级生命周期适配修复，真实模型再次运行自然退出。详见 [真实运行结果与边界](reflection-live-result.md)。凭据未进入模型 prompt 或报告。

定向修复、追加测试和仍未修复的重复 callId 关联缺陷，见 [反思后续验证](reflection-follow-up.md)。上述 337 项为首次增量时的历史计数。
