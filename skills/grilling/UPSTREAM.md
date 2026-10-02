# Grilling method provenance

The frontmatter and method paragraphs in `SKILL.md` are copied verbatim from the
user's existing `/Users/firestige/.agents/skills/grilling/SKILL.md`, inspected on
2026-09-22. The `Crystra Task integration` section records the user's single-question,
2–3-option, marked-recommendation and local/online research requirements.

This package snapshot makes the Skill available in installed Crystra profiles
without depending on a particular developer home directory or provider discovery.
`src/host/task-skills.js` explicitly loads its complete text for requirements turns.
Update this resource rather than duplicating the method in JavaScript prompts.
Workflow-specific grilling Skills retain their own Action and artifact boundaries.
