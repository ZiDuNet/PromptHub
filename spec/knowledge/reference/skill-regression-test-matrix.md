# Skill Regression Test Matrix

This matrix turns escaped user-reported skill bugs into required regression tests. It is a test-design contract, not a bug-fix plan.

For defect classification, start with `spec/knowledge/reference/skill-defect-taxonomy.md`. This matrix is the concrete regression layer after the bug has been typed.

## TDD Failure Pattern

The escaped bugs share these testing gaps:

- Tests asserted mocked API calls but not durable post-conditions.
- Tests covered `SKILL.md`-only fixtures but not full repo directory preservation.
- Tests covered install paths but not delete/uninstall cleanup paths.
- Tests validated detail views without checking that list, detail, project, and platform status use the same source of truth.
- Tests covered GitHub happy paths more than custom Git/Gitea paths.
- Tests did not include recursive file-browser behavior.

## Required Regression Matrix

| ID     | Escaped Bug                                                                                             | Missed Invariant                                                                                                      | Lowest Effective Test Layer                            | Required Test Item                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SR-001 | Claude Code store install does not show imported                                                        | Store cards must derive installed state from stable source identity, not only name or current detail state            | Component + store unit, backed by DB/source-id fixture | Install a Claude Code store skill, reload store entries, assert card badge/button shows imported and no duplicate import action appears                    |
| SR-002 | Custom Gitea store import keeps only `SKILL.md` and loses directories                                   | Custom Git/Gitea imports must preserve full repo directory content except explicit ignore rules                       | Main-process service unit + E2E smoke                  | Fixture repo contains `SKILL.md`, nested docs, scripts, assets; after import, managed repo contains all files and directory fingerprint reflects full tree |
| SR-003 | Deleting a skill does not remove platform symlink                                                       | Delete/uninstall must clean platform copy/symlink plus activation metadata                                            | Main-process service unit + integration                | Install by symlink, delete skill, assert platform symlink path removed, activation record cleared, status no longer installed                              |
| SR-004 | Custom Gitea skill safety scan blocked with `SAFETY_SCAN_BLOCKED_SOURCE`                                | Safety scan source policy must allow managed custom-store repos while still blocking unsafe external/internal sources | Main-process service unit                              | Custom Gitea managed repo with `localRepoPath` scans using repo files; internal URL remains blocked; report stores source metadata                         |
| SR-005 | Project skill distribution can install but cannot uninstall                                             | Project distribution is a bidirectional lifecycle, not install-only                                                   | Component integration + service unit                   | Distribute to project by copy and symlink; uninstall from same project; assert files/symlink and project status are removed                                |
| SR-006 | Official store tab shows 54 but header/card list shows 0                                                | Store tab count, header count, empty state, and cards must use the same filtered data source                          | Component unit                                         | Seed 54 official entries; assert side tab count, header count, and rendered cards agree; if official store is closed, tab count must also be 0 or hidden   |
| SR-007 | Installed skill detail shows installed but list card remains gray/uninstalled                           | List and detail installed status must share one selector/source of truth                                              | Store selector unit + component unit                   | Mark skill installed, render list and detail, assert both show installed state; update install status and assert both surfaces update                      |
| SR-008 | File browser cannot expand nested folders                                                               | Skill repo file browser must recursively load child directories                                                       | Component unit + IPC/service unit                      | Fixture tree includes nested folder; click folder, assert child files appear and read/list APIs receive normalized relative paths                          |
| SR-009 | Project tab does not show skills installed into project by symlink                                      | Project scan must include symlinked and copied project skills                                                         | Main-process scan unit + component integration         | Project deploy target contains symlinked skill and copied skill; scan returns both with mode/source metadata; project tab renders both                     |
| SR-010 | Missing agent-centric entry for all skills and project skills cannot tag/uninstall by copy/symlink mode | Agent/project skill inventory must expose copy/symlink mode, tag management, and uninstall actions                    | Requirement-level design + component integration + E2E | Given an agent/platform, list all copied and symlinked skills; tag each; uninstall each; assert status and tags update without affecting unrelated agents  |

## Required Fixtures

Every future skill install/distribution regression suite should include:

- `full-repo-skill`: `SKILL.md`, `README.md`, `docs/guide.md`, `scripts/setup.sh`, `assets/icon.png`
- `nested-file-skill`: at least two folder levels below the skill root
- `custom-gitea-source`: non-GitHub Git URL plus branch/directory metadata
- `same-name-variant`: two skills with same `name` but different `source_id`
- `copy-and-symlink-project`: one copied project skill and one symlinked project skill

## Package Boundary Test Rule

For any path named import, install, sync, export, distribute, or deploy, the test fixture must be a Skill directory, not a bare `SKILL.md` file. A single-file Skill fixture is allowed only when the test explicitly verifies the single-file compatibility case, and the expected result must still be a directory containing `SKILL.md`.

The minimum file-inventory assertion for package fidelity is:

```text
SKILL.md
docs/guide.md
scripts/setup.sh
assets/icon.png
```

The test must compare relative paths in the managed repo after the operation. Asserting `writeLocalFile("SKILL.md")` or `saveToRepo` was called is not sufficient.

## Coverage and Harness Rule

Skill package-boundary changes require 100% line, function, branch, and condition coverage for new or changed production code. The harness must include:

- black-box filesystem assertions against the managed repo inventory
- white-box branch coverage for GitHub raw-content vs custom Git/Gitea clone-backed paths
- IPC validation for malformed inputs and missing skills
- failure/rollback coverage for clone, copy, sync, and persistence errors
- adversarial path coverage for `../`, absolute paths, hidden internal directories, symlinks, and missing `SKILL.md`
- stress coverage for large package inventories

If a legacy file cannot reach 100% overall in one change, the active change must list the unrelated uncovered branches and still prove every new/changed branch and condition.

## Test Acceptance Rules

A test item from this matrix is not complete until it asserts the user-visible post-condition:

- persisted DB row or status field when persistence is involved
- actual managed repo files when import/copy/symlink is involved
- platform filesystem state when platform install/uninstall is involved
- rendered list/detail/project/store state when UI status is involved
- no stale status after reload or rescan when derived state is involved

Mock call counts alone do not satisfy this matrix.
