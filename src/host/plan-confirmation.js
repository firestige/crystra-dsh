const cell = value => String(value ?? '未配置')
  .replace(/&/g,'&amp;').replace(/[<>|`*_\\]/g, c => `&#${c.charCodeAt(0)};`)
  .replace(/[\r\n]+/g,' ');

/** Presentation only: the original exact binding document remains approval authority. */
export function roleBindingsTable(proposed, current) {
  const bindings = proposed?.bindings ?? current?.bindings;
  if (!bindings || !Object.keys(bindings).length) return 'Role 绑定尚不可用';
  return ['| role | provider | model-id |','| --- | --- | --- |',
    ...Object.entries(bindings).map(([role,binding]) =>
      `| ${cell(role)} | ${cell(binding.agentProvider?.identity)} | ${cell(binding.model?.model)} |`)
  ].join('\n');
}
