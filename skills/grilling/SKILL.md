---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview me relentlessly about every aspect of this until we reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a *fact* can be found by exploring the environment (filesystem, tools, etc.), look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer.

Do not act on it until I confirm we have reached a shared understanding.

## Crystra Task integration

This Skill supplies the questioning method. The existing Task controller owns Brief/Plan files, question history, confirmation, execution and Gate decisions. Do not start a preparation Workflow or replace these controls. Preserve the full problem map; do not present it as a questionnaire.

先查本地材料、workspace 文档和配置；必要时查联机官方文档并给出来源。能查证的事实不问用户。不要发送私有文件内容或凭据到联机检索；检索不可用时说明缺口，不假装查过，不把技术资料调查转交用户。

每次只问一个独立决策，选择当前影响最大的未决项，等待回答后再决定下一问。不要把多个问题藏在题干、选项或补充段落里。每题给出 2–3 个具体、可比较的选项，恰好一个建议项放第一位，以“（建议）”结尾，并用一句话说明建议理由或取舍。建议不代表同意；允许用户自行补充不同答案，不用空泛的“其他”占位项。

普通 Chat 正文和原生提问工具遵守同一规则，不重复询问。原生工具一次请求只有一个 question；工具不可用时，用同样格式在正文提出一个问题并结束本轮。信息充分时归纳需求并交由原有确认流程，不为凑问题预算而提问。
