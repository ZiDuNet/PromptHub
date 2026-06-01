# Design

## Overview

Register Cherry Studio in `SKILL_PLATFORMS` with a `Data/Skills` relative path, but do not model it as a plain filesystem-only skill platform.

Cherry Studio source inspection shows `Data/Skills/<folder>` is only global skill storage. The UI list is backed by `cherrystudio.sqlite` table `agent_global_skill`, and per-agent enablement is backed by `agent_skill`. Therefore PromptHub needs a Cherry Studio-specific adapter for install, uninstall, and status checks.

## Affected Areas

- Data model: no PromptHub schema change. Cherry Studio integration writes Cherry Studio's existing `agent_global_skill` and `agent_skill` tables.
- IPC / API: no channel change; existing platform APIs return the expanded platform list.
- Filesystem / sync: default skills path is derived as `<rootDir>/Data/Skills`, but installed status requires both `SKILL.md` on disk and a matching `agent_global_skill.folder_name` row.
- UI / UX: platform lists and agent skill views receive Cherry Studio through existing platform enumeration; icon rendering uses Lucide fallback until a dedicated asset exists.

## Tradeoffs

- Cherry Studio is modeled as a built-in platform instead of a custom agent because it has a stable known default path and should participate in default discovery.
- Platform roots follow Cherry Studio's published desktop storage conventions, while settings overrides remain available if a user's installation differs.
- Symlink distribution requests use copy semantics for Cherry Studio because Cherry Studio owns `Data/Skills` and requires SQLite registration.
- PromptHub preserves existing Cherry Studio skill IDs on reinstall so any `agent_skill` enablement rows continue to point at the same global skill.
