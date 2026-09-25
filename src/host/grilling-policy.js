export function validateGrillingBatch(questions) {
  if (!Array.isArray(questions) || questions.length !== 1)
    throw Error('GRILLING_ONE_QUESTION: 每次只问一个问题，先检索资料，再选择一个必要决策；不要提交批量问题。');
}

export function validateGrillingQuestion({ question, choices }) {
  if (typeof question !== 'string' || !question.trim() ||
      !Array.isArray(choices) || choices.length < 2 || choices.length > 3 ||
      choices.some(c => typeof c !== 'string' || !c.trim()) ||
      new Set(choices.map(c => c.trim())).size !== choices.length ||
      choices.filter(c => /(?:（建议）|\(Recommended\)|\(建议\))\s*$/i.test(c)).length !== 1 ||
      !/(?:（建议）|\(Recommended\)|\(建议\))\s*$/i.test(choices[0]))
    throw Error('GRILLING_OPTIONS: 提供 2–3 个不同选项，第一项以“（建议）”结尾且只能有一个建议项；不要问开放问题。');
}
