# Implementation

## Shipped

- Added `spec/knowledge/reference/skill-regression-test-matrix.md`.
- Added `spec/knowledge/reference/skill-defect-taxonomy.md` to classify escaped Skill bugs by defect type before choosing concrete tests.
- Mapped the ten user-reported skill bugs to missed invariants, lowest effective test layers, and required regression test items.
- Updated `spec/rules/testing-standards.md` with Skill-specific TDD gates:
  - matrix lookup before skill bugfixes;
  - observable post-condition assertions instead of mock-only success;
  - required fixtures for custom Git/Gitea, symlink/copy installs, same-name variants, and nested file browsing.
- Updated `spec/workflow/04-verification/README.md` so Skill-risk changes must cite matrix coverage.
- Updated `spec/rules/README.md` to point to the matrix.
- Audited the ten escaped Skill bug reports against current implementation and regression tests.
- Fixed the remaining release-blocking Skill verification failures:
  - deployed status filters and stats now accept both current skill IDs and legacy/name-keyed deployed sets;
  - custom store empty-state regression test now exercises a custom source instead of the unopened official store;
  - batch platform sync tests now assert the current `skillId` contract used to disambiguate same-name variants;
  - SkillDB versioning test now uses the current schema without re-applying obsolete column migrations;
  - Agent Skills i18n keys were added for Japanese, French, German, and Spanish.

## Verification

- Reviewed representative existing skill tests:
  - `apps/desktop/tests/unit/main/skill-installer-remote.test.ts`
  - `apps/desktop/tests/unit/main/skill-installer-platform.test.ts`
  - `apps/desktop/tests/unit/main/skill-installer-repo.test.ts`
  - `apps/desktop/tests/unit/main/skill-safety-scan.test.ts`
  - `apps/desktop/tests/unit/services/skill-platform-sync.test.ts`
  - `apps/desktop/tests/unit/components/skill-projects-view.test.tsx`
  - `apps/desktop/tests/unit/components/skill-store-custom-sources.test.tsx`
  - `apps/desktop/tests/e2e/local-store-source.spec.ts`
- Ran documentation sanity checks with `rg` and `git diff --check`.
- No product tests were run because this change defines constraints and test items only.
- Re-ran the escaped Skill bug target suite:
  - `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-store-installed-state.test.tsx tests/unit/main/skill-installer-remote-git-package.test.ts tests/unit/main/skill-safety-scan.test.ts tests/unit/components/skill-file-editor.test.tsx tests/unit/components/skill-detail-project-distribution.test.tsx tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-agents-view.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/top-bar.test.tsx tests/unit/stores/skill-registry-selectors.test.ts`
  - Result: 10 files passed, 92 tests passed.
- Re-ran the full desktop unit suite after fixing blockers:
  - `pnpm --filter @prompthub/desktop test -- --run`
  - Result: 186 files passed, 1587 tests passed.
- Ran code quality gates:
  - `pnpm --filter @prompthub/desktop lint`
  - `pnpm --filter @prompthub/desktop typecheck`
  - Result: both passed.

## Synced Docs

- `spec/knowledge/reference/skill-regression-test-matrix.md`
- `spec/rules/testing-standards.md`
- `spec/workflow/04-verification/README.md`
- `spec/rules/README.md`

## Follow-ups

- Keep the matrix as a required lookup before future Skill bug fixes and feature changes.
