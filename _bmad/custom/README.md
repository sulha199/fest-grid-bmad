# BMad Customizations

This directory contains customizations for BMad workflows and agents.

## Important Note: `bmad-create-story` Fork

The `bmad-create-story` skill has been deliberately forked to enforce structural and architectural compliance according to `story-content-structure.md` and `story-split-gate.md`.

Because there is no sanctioned override path for core template and step files, the following files have been modified directly in the installed skill directories (`.cline/skills/bmad-create-story/`, `.claude/skills/bmad-create-story/`, and `.agents/skills/bmad-create-story/`):
- `SKILL.md` (Added Step 3.5 for Story Split Gate Validation)
- `template.md` (Restructured to the canonical 15-section shape)
- `checklist.md` (Rewritten to enforce structural/gate compliance)

### Upgrade Warning

**A future `bmad upgrade` or `bmad update` will overwrite these files.** 

When that happens, the structural compliance checks and template shape will be lost. To restore them after an update, you will need to recover `SKILL.md`, `template.md`, and `checklist.md` from version control (Git history) and re-copy them to the respective `.cline/`, `.claude/`, and `.agents/` directories.

The persistent facts added to `_bmad/custom/bmad-create-story.toml` are safe and will survive updates by design.