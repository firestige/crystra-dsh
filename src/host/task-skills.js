import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Ship the method resource with the plugin. Never depend on the host user's skill
// discovery settings or silently substitute an inline prompt if it is missing.
export function grillingSkillInstructions() {
  const source = new URL('../../skills/grilling/SKILL.md', import.meta.url);
  const content = readFileSync(source, 'utf8');
  if (!/^name: grilling$/m.test(content)) throw Error('GRILLING_SKILL_INVALID');
  return `\nApply the following grilling Skill in this requirements turn.\nSkill source: ${fileURLToPath(source)}\n<skill name="grilling">\n${content}\n</skill>\n`;
}
