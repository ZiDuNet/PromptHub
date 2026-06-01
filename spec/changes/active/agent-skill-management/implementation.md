# Implementation Notes

## Status

Implemented.

## Shipped

- Added an Agent Skills first-level skill navigation entry next to Project Skills.
- Added `SkillAgentsView`, reusing the project skill management layout pattern:
  - agent/platform list
  - scanned agent skill list
  - shared `SkillFullDetailPage` detail view opened only after the user clicks a scanned Skill
  - existing Skill preview/source/files tabs for the selected Agent-local Skill
- Agent scan refresh now keeps the browser in list mode instead of auto-opening the first scanned Skill.
- Agent/platform rows now use shared platform icon assets instead of letter placeholders.
- Agent/platform list panes now use constrained internal scrolling so long Agent lists remain reachable.
- Agent refresh buttons now animate the refresh icon while loading/scanning.
- Agent-specific detail sidebar content was split into `AgentSkillPreviewSidebar` so the shared detail page remains under the 2,000-line file limit.
- Chinese locale terminology now uses `Skill` across zh/zh-TW UI strings instead of translating the product term as `技能`.
- Added Agent Skills i18n keys for English, Simplified Chinese, and Traditional Chinese.
- Added missing Project Skill deployment sidebar i18n keys across English, Simplified Chinese, Traditional Chinese, Japanese, French, German, and Spanish so detail panes no longer fall back to raw English labels.
- Added a Simplified Chinese Project Skill preview sidebar regression test that renders the real panel labels and asserts the previous English fallback strings are absent.
- Tightened visible Chinese fallback strings in renderer Skill surfaces so missing locale keys do not reintroduce `技能` in end-user UI.
- Removed the Agent Skills inner search box. The Agent browser now reads the shared Skill search query from the top bar, so there is one search entry point and filtered results update in the Agent Skill grid.
- Suppressed the top-bar result count in Agent Skill view because Agent scan results live in the Agent browser state, not the global library result set. This prevents false `No results` labels while the Agent list is correctly filtered.
- Added missing Agent Skill navigation/search and common action labels (`open`, `uninstall`) to every desktop locale so Chinese Agent detail buttons no longer fall back to `Open` / `Uninstall`.
- Added platform scan and arbitrary platform-skill uninstall IPC:
  - `skill:scanPlatformSkills`
  - `skill:uninstallPlatformSkill`
- Added shared `AgentScannedSkill` and `SkillPlatformScanResult` types.
- Platform scans now return the real agent skill folder path, install mode (`copy` or `symlink`), and full scanned skill metadata.
- Agent skill uninstall removes only the selected folder/symlink inside the selected platform skills directory and rejects paths outside that directory.
- From Agent Skills, users can:
  - browse copy and symlink installs
  - see whether a scanned skill is already in My Skills
  - open the matching My Skills detail
  - open the local folder
  - uninstall an agent-local skill
  - install a My Skills entry into the selected agent via copy or symlink

## Verification

- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-agents-view.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/main/skill-platform-ipc.test.ts tests/unit/main/skill-installer.test.ts`
  - 4 files passed
  - 176 tests passed
- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-agents-view.test.tsx tests/unit/components/sidebar.test.tsx`
  - 2 files passed
  - 22 tests passed
- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-agents-view.test.tsx`
  - 1 file passed
  - 6 tests passed
- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-agents-view.test.tsx tests/unit/services/skill-locale-regression.test.ts tests/unit/components/project-skill-preview-sidebar-i18n.test.tsx`
  - 3 files passed
  - 14 tests passed
  - Existing React `act(...)` warnings still appear in the Agent detail test path, but all assertions pass.
- Passed: `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/top-bar-agent-search.test.tsx tests/unit/components/skill-agents-view.test.tsx tests/unit/services/skill-locale-regression.test.ts`
  - 3 files passed
  - 14 tests passed
  - Existing React `act(...)` warnings still appear in the Agent detail test path, but all assertions pass.
- Passed: JSON parse validation for `en.json`, `zh.json`, and `zh-TW.json`.
- Passed: JSON parse validation for all desktop locales (`en`, `zh`, `zh-TW`, `ja`, `fr`, `de`, `es`).
- Passed: locale key scan for the Project Skill deployment keys across all desktop locales.
- Passed: `pnpm --filter @prompthub/desktop typecheck`
- Passed: `pnpm --filter @prompthub/desktop lint`
- Latest typecheck attempt after the Agent search/i18n follow-up failed in pre-existing AI settings work outside this change path:
  - `src/renderer/components/settings/AISettingsPrototype.tsx(795,9)` passes `testingDefault` to a prop type that does not define it.
  - `src/renderer/components/settings/AISettingsPrototype.tsx(823,9)` has duplicate JSX attributes.
- Latest lint attempt passed: `pnpm --filter @prompthub/desktop lint`.
- Verified touched component file sizes: `SkillFullDetailPage.tsx` 1975 lines, `SkillAgentsView.tsx` 554 lines, `AgentSkillPreviewSidebar.tsx` 71 lines, `TopBar.tsx` 1034 lines.
- Full unit suite attempted again with `pnpm --filter @prompthub/desktop test:unit`.
  - Result: failed with 14 failures outside the Agent Skills change path.
  - Failing areas observed: create-skill modal timeout, project distribution/detail timeouts, skill i18n smoke timeout, custom store empty state assertion, skill filter/stats deployed counts, platform sync expectation fields, and one skill DB versioning migration test.
  - The new Agent Skills tests passed during the full run.
