# Skills Delta Spec: Package Boundary

## ADDED Requirements

### REQ-SKILL-PKG-001: Skill Package Definition

PromptHub MUST model a Skill as a directory-level package. `SKILL.md` is the required entrypoint inside that package, not the package itself.

#### Scenario: Single-file skill remains a package

Given a Skill has no supporting files
When PromptHub creates or imports it
Then the managed representation is still `<skill-root>/SKILL.md`
And all APIs must treat `<skill-root>` as the Skill identity and file boundary.

### REQ-SKILL-PKG-002: Import Preserves Full Directory

Any operation named import, install from store, install from Git/Gitea, install from local directory, sync from source, export, distribute, or deploy MUST preserve the full Skill directory tree except for explicit ignored entries such as `.git` and `.prompthub`.

#### Scenario: Custom Gitea skill with resources

Given a custom Gitea source contains:

- `SKILL.md`
- `scripts/setup.sh`
- `docs/guide.md`
- `assets/icon.png`

When the user installs that Skill from the store
Then the managed local repo contains those files with the same relative paths
And the directory fingerprint is computed from the full file inventory
And safety scan and file browser operate on the managed directory, not only `SKILL.md`.

### REQ-SKILL-PKG-003: Content-only Write Is Not Import

Content-only APIs that write a `SKILL.md` string MAY be used for new UI-authored Skills or editing the existing `SKILL.md` entrypoint. They MUST NOT be used as the final persistence path for any source that has, or may have, a package directory.

#### Scenario: Store entry has a remote package source

Given a registry entry carries `source_url`, branch/directory metadata, canonical path, or a directory fingerprint
When the user installs it
Then PromptHub must resolve and persist the source package directory
And a fallback to writing only `SKILL.md` must be treated as incomplete unless the source is explicitly single-file.

## MODIFIED Requirements

### Existing Skill File Contract

The existing `SKILL.md` contract is narrowed to mean entrypoint file contract. It must not be read as the full Skill persistence contract.

## Test Requirements

- Regression tests must use a full-repo fixture with nested files.
- Main-process package persistence tests must assert filesystem post-conditions by comparing relative file inventories.
- Renderer store orchestration tests must prove package-capable registry entries use the package import API and do not finish by writing only `SKILL.md`.
- For custom Git/Gitea sources, tests must cover non-GitHub clone-backed sources, not only GitHub raw file APIs.
- Safety scan and file browser tests must verify downstream consumers read the managed repository path and nested package files.
