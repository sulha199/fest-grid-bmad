# BMad Method - Cline Rules

## 1. Directory Structure Awareness
- **`_bmad/`**: Core BMad directory containing agents, workflows, tasks, and system configurations. Read definitions from here when invoked.
- **`_bmad-output/`**: The strictly designated location for all generated planning, architecture, epics, stories, and sprint artifacts.
- **`_bmad-output/project-context.md`**: Global project rules (tech stack, conventions). MUST read, check, and adhere to this file whenever generating code, technical documents, or performing updates.
- **`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`**: Active Product Requirement Document (PRD). MUST read, check, and adhere to this file whenever modifying, updating, or implementing application code.

## 2. Handling `bmad-*` Skill Commands
When the user enters a `bmad-*` command (e.g., `bmad-agent-architect`, `bmad-architecture`, `bmad-prd`, `bmad-help`):
1. **Locate the Definition**: Look inside `_bmad/` for the matching agent prompt or workflow template.
2. **Adopt the Persona**: Act as the designated agent role (e.g., Architect, Product Manager, Lead Dev) and follow its tone and constraints.
3. **Execute Step-by-Step**: Follow the exact workflow sequence outlined in the corresponding `_bmad/` markdown or YAML file.

## 3. Execution Guardrails
- **Planning Isolation**: Do NOT modify main application source code during planning phases (`bmad-prd`, `bmad-architecture`, `bmad-create-epics-and-stories`). Output must go to `_bmad-output/`.
- **Sprint & Story Tracking**: During implementation (`bmad-dev-story`), only update story files and `_bmad-output/implementation-artifacts/sprint-status.yaml` as directed by the workflow.
- **Mandatory References**: For any updates, code edits, or implementation tasks, the active agent/skill MUST explicitly read and reference:
  1. `_bmad-output/project-context.md` (for tech stack, conventions, and design tokens)
  2. `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (for features, constraints, and business logic)
- **Fresh Chat Reminder**: If you notice the chat history contains remnants of a previous, unrelated workflow, remind the user to open a fresh chat for better LLM context hygiene.
