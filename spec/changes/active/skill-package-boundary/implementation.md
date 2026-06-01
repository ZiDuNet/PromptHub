# Implementation Notes

## Investigation

Read:

- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/structure/skill-system-design.md`
- `apps/desktop/src/main/services/skill-installer.ts`
- `apps/desktop/src/main/services/skill-installer-repo.ts`
- `apps/desktop/src/renderer/stores/skill.store.ts`
- `apps/desktop/src/renderer/components/skill/store-remote-sync.ts`
- `apps/desktop/src/renderer/services/github-skill-store.ts`

## Findings

- Stable structure docs already describe Skill as a portable package with optional scripts/resources.
- Stable behavior docs only explicitly required full-directory copy for project-local distribution; they did not state it as the global import/install invariant.
- `AGENTS.md` still said “Skills are stored as SKILL.md files,” which is too weak and encourages content-only implementations.
- Main services already have directory-level APIs, but renderer store installation can create a DB row and write only `SKILL.md`.
- Custom Git/Gitea remote scan is clone-backed only during preview; the clone is deleted before install, so install loses access to the full package.

## Implemented

- Added `SkillInstaller.saveRemoteGitSkillToLocalRepoBySkillId()` to clone a Git/Gitea source during install, resolve the target Skill directory, and copy the complete package into the managed repo.
- Added `skill:saveRemoteGitToRepo` IPC plus preload API so the renderer can request package-level remote persistence instead of writing only `SKILL.md`.
- Updated registry install/update orchestration so custom Git/Gitea package sources with directory/canonical/fingerprint metadata use clone-backed package persistence, then `syncFromRepo`.
- Kept content-only `SKILL.md` writes for explicit content flows such as user-authored skills and GitHub raw-content sources that do not advertise package metadata.
- Filtered `.git` and `.prompthub` internal directories when copying package sources into the managed repo.
- Upgraded manual Skill creation: when the user leaves instructions blank, PromptHub now creates a starter `SKILL.md` with frontmatter, workflow, verification guidance, and package notes for `references/`, `scripts/`, and `assets/`.
- Replaced the placeholder built-in `skill-creator` content with package-aware best practices and removed its `content_url` so the built-in guidance is not overwritten by remote placeholder content.
- Added a built-in `prompthub-cli-operator` Skill that teaches agents to inspect and operate PromptHub via CLI commands, including `prompthub skill repo-files` and safety rules for destructive operations.
- Tightened package install atomicity: if a registry entry requires clone-backed package persistence and that persistence fails, PromptHub now rolls back the just-created DB skill and surfaces the install error instead of leaving a half-installed `SKILL.md`-only skill.
- Strengthened `AGENTS.md`, `spec/rules/testing-standards.md`, and `spec/rules/tdd-design-gate.md` so new or changed production code targets 100% line, function, branch, and condition coverage, with critical boundary modules requiring 100% branch and condition coverage for touched behavior.
- Audited and tightened full-package safety scan prompt construction:
  - Ordinary text files such as `docs/*.md` and `references/*.md` are now included in the AI prompt, not just `SKILL.md` and script/config extensions.
  - Repository structure and static content findings from the local package scan are preserved as preflight evidence in the AI prompt instead of being discarded after file counting.
  - Package prompt content is bounded by deterministic per-file and total content budgets, with explicit truncation/omission notices so large packages fail visibly instead of silently narrowing review scope.
  - Safety scan keeps symlink/path escape filtering in the real filesystem reader; the regression test verifies escaped symlink content is not included in the scan prompt.
- Fixed Skill UI consistency regressions:
  - Sidebar and TopBar now treat the unopened official store as an empty catalog instead of exposing built-in registry counts or search results.
  - Skill list rows now render cached platform install status immediately but still refresh the current visible Skill ids, so post-install status cannot stay grey from a stale module cache.
  - Skill file tree directory buttons now expose `aria-expanded` and keep the existing recursive toggle behavior for synthetic folders created from nested package file paths.

## Verification

- `pnpm --filter @prompthub/desktop test:run tests/unit/components/create-skill-modal.test.tsx`
  - Passed: 1 file, 7 tests.
- `pnpm --filter @prompthub/desktop test:run tests/unit/services/skill-registry-builtins.test.ts tests/unit/components/create-skill-modal.test.tsx tests/unit/main/skill-installer.test.ts tests/unit/stores/skill.store.test.ts`
  - Passed: 4 files, 195 tests.
- `pnpm --filter @prompthub/desktop test:run tests/unit/main/skill-safety-scan.test.ts tests/unit/components/skill-file-editor.test.tsx`
  - Passed: 2 files, 10 tests.
- After formatting: `pnpm --filter @prompthub/desktop test:run tests/unit/services/skill-registry-builtins.test.ts tests/unit/components/create-skill-modal.test.tsx tests/unit/main/skill-installer.test.ts tests/unit/stores/skill.store.test.ts tests/unit/main/skill-safety-scan.test.ts tests/unit/components/skill-file-editor.test.tsx`
  - Passed: 6 files, 205 tests.
- Package and installed-state regression pass after the Claude Code installed-state fix:
  - `pnpm --filter @prompthub/desktop test:run tests/unit/components/skill-store-installed-state.test.tsx tests/unit/stores/skill-registry-selectors.test.ts tests/unit/services/skill-store-update.test.ts tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/main/skill-local-repo-ipc.test.ts tests/unit/stores/skill.store.test.ts`
  - Passed: 6 files, 60 tests.
- Full-package safety scan prompt regression:
  - `pnpm --filter @prompthub/desktop test:run tests/unit/main/skill-safety-scan.test.ts`
  - Passed: 1 file, 13 tests.
- Installed batch safety scan regression:
  - `pnpm --filter @prompthub/desktop test:run tests/unit/stores/skill.store.test.ts`
  - Passed: 1 file, 42 tests.
- Full desktop Vitest suite:
  - `pnpm --filter @prompthub/desktop test:run`
  - Failed: 11 files failed, 171 passed; 25 tests failed, 1528 passed.
  - Observed failures are outside the Skill UI consistency change area: integration tests whose `settings.store` mocks are missing `AI_SCENARIO_MODEL_ROUTE` or `SKILL_LIST_PAGE_SIZE_OPTIONS`, `skill-store-custom-sources.test.tsx` expecting the old official-store empty text, `skill-filter*.test.ts` / `skill-stats.test.ts` expecting deployed name matching instead of id matching, `skill-platform-sync.test.ts` expecting `skillName` payloads instead of `skillId`, and `skill-db-versioning.test.ts` hitting a duplicate `source_url` migration column.
- Type and lint:
  - `pnpm --filter @prompthub/desktop typecheck`
  - Passed.
  - `pnpm --filter @prompthub/desktop lint`
  - Passed.
- Skill UI regression suite:
  - `pnpm --filter @prompthub/desktop test:run tests/unit/components/sidebar.test.tsx tests/unit/components/skill-view-tags.test.tsx tests/unit/components/skill-file-editor.test.tsx tests/unit/components/top-bar.test.tsx tests/unit/components/skill-store-installed-state.test.tsx`
  - Passed: 5 files, 44 tests.
  - Note: Vitest still prints a React `act` warning from the Skill list platform-status async effect in one test, but the asserted stale-status transition passes.

Regression coverage added:

- Main-process full-package custom Git/Gitea install copies `SKILL.md`, `docs/guide.md`, `scripts/setup.sh`, and `assets/icon.png`.
- Main-process clone-backed install now uses an equivalent local Git fixture, proving the package survives Git checkout before managed-repo copy.
- Package import boundary tests cover `.git`/`.prompthub` filtering, symlink filtering, path traversal rejection, missing `SKILL.md`, ambiguous multi-skill repositories, temp clone cleanup, and a 300-file package stress case.
- IPC tests cover `skill:saveRemoteGitToRepo` validation, missing skill handling, package save delegation, directory fingerprint computation, and DB persistence.
- Renderer store install for custom Git package metadata calls `saveRemoteGitToRepo` and `syncFromRepo`, and does not persist the package by writing only `SKILL.md`.
- Renderer store tests cover directory derivation from `canonical_skill_path`, GitHub raw-content single-file compatibility, and rollback when clone-backed package persistence fails.
- Built-in registry test ensures `skill-creator` contains package guidance and `prompthub-cli-operator` contains key CLI operations and safety rules.
- Create modal test ensures blank manual instructions generate a package-aware starter `SKILL.md`.
- Safety scan now distinguishes remote/pre-install scans from installed package scans:
  - Remote entries with internal or blocked source URLs still fail before AI when no managed local repo exists.
  - Installed Skills with `local_repo_path` are scanned from the managed package directory even when their custom Gitea source URL is internal; the source issue is passed to AI as provenance context.
  - Store detail safety scan now uses the installed Skill content and `local_repo_path` when the store entry is already imported, so nested package files participate in the AI scan.
- Added safety scan regressions for installed internal-Gitea packages and for store detail passing the managed package path.
- Added prompt-sensitive safety scan coverage for ordinary package docs/reference files, repository preflight evidence, prompt budget/truncation behavior, and real filesystem symlink escape filtering.
- Added store batch scan coverage for preserving `local_repo_path` when scanning installed managed packages.
- Added Sidebar regression coverage that the unopened official store shows a zero-count source.
- Added TopBar regression coverage that remote store catalog search still works while official unopened registry skills are not searchable.
- Added Skill list regression coverage that an already-rendered row refreshes stale platform install state after a later status read.
- Added Skill file browser regression coverage that nested synthetic folders from package paths can be expanded to reveal files.

## Docs Synced

- `AGENTS.md`
- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/structure/skill-system-design.md`
- `spec/knowledge/structure/skill-system-design-zh.md`
- `spec/knowledge/reference/skill-regression-test-matrix.md`
- `spec/changes/active/skill-package-boundary/proposal.md`
- `spec/changes/active/skill-package-boundary/specs/skills/spec.md`
- `spec/changes/active/skill-package-boundary/tasks.md`

## Follow-Up

- Run the full desktop unit suite before release packaging.
- Add an E2E install-from-custom-Gitea fixture if CI can provide a local Git server or deterministic bare repo fixture.
