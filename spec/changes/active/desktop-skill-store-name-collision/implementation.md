# Implementation

## Status

实现进行中，核心身份模型、数据库约束、商店去重、安装态判定已落地并通过当前定向验证。长期目录结构与平台激活模型已定稿为“统一 variant 容器 + 平台按逻辑名单激活”，当前部分平台唯一目录实现视为过渡方案，后续会继续收敛。

## Findings Captured Before Implementation

- 当前远端列表会在加载阶段对同名 skill 直接折叠，问题发生在 source 进入 UI 之前。
- 当前安装态判断存在 name-based fallback，会把“另一个来源的同名 skill”错误地标成已安装。
- 当前数据库 `skills` 表对 `LOWER(name)` 存在唯一索引，因此即使 UI 不折叠，也无法并行安装同名实例。
- 在实际启动迁移中，`drop_skill_name_unique_v2` 还暴露出一个底层适配问题：`node-sqlite3-wasm` 的 `prepare()` statement 必须手动 `finalize()`，而现有 `@prompthub/db` 适配层没有对单次查询/执行自动释放，导致前序 migration statement 把后续 `DROP INDEX idx_skills_name_lower` 锁住，报 `SQLite3Error: database table is locked`。

## Implementation Notes

- 已在 `packages/db/src/adapter.ts` 为单次执行场景新增 `db.run(sql, ...params)`、`db.get(sql, ...params)`、`db.all(sql, ...params)`，统一使用底层 `prepare()` 后在 `finally` 中自动 `finalize()`。
- 已把 `packages/db/src/init.ts` 中迁移流程的大部分单次 statement 调用改为新的 adapter helpers，避免 migration transaction 内遗留未释放的 statement 锁。
- 已新增回归测试 `apps/desktop/tests/unit/main/database-migration-locks.test.ts`，覆盖：
  - adapter helper 会自动释放单次 statement
  - legacy `idx_skills_name_lower` 在迁移期间可被成功删除，且不会再触发 table lock
- 已完成商店/库内实例级 identity 切换：
  - `RegistrySkill` / `Skill` 新增并持久化 `source_id`
  - `source_id` 成为同名实例并存的主判定键
  - `SkillStore` / `SkillStoreDetail` / `TopBar` / store update path 不再按 `slug/name` 判安装或选中
- 已把 PromptHub managed repo 路径从按 `skill.name` 切换为实例唯一目录保存，避免同名 skill 覆盖本地仓库目录。
- 已把平台安装/卸载/安装状态从按 `skill.name` 切换为按 `skill.id` 调度，并补上基础兼容层。
- 当前代码中一度引入“平台唯一目录名”以避免同名覆盖，但经过结构评审后，已将长期方向收敛为：
  - 进入 My Skills 的所有 skill 都进入统一 variant 容器
  - `copy / symlink` 只决定容器内 `repo/` 的 materialization 方式
  - 外部平台保持按逻辑 skill 名单激活，而不是长期依赖唯一平台目录并存
  - 老目录继续兼容，不做一次性强制迁移
- 已将上述长期方向同步到当前 change 的 `proposal.md` / `design.md` / `specs/desktop/spec.md`，作为后续代码继续收敛的约束。
- 已修复 `SkillStore` 中 custom source 列表区被隐藏的 UI bug：此前 header 会显示数量，但 `showCatalog` 为 `false` 导致实际卡片列表不渲染。
- 已补充并通过当前回归测试：
  - `apps/desktop/tests/unit/stores/skill.store.test.ts`
  - `apps/desktop/tests/unit/components/skill-store-remote.test.tsx`
  - `apps/desktop/tests/unit/main/skill-installer-platform.test.ts`

## Expected Verification

- `main/dev` 两个 branch 下同名 skill 应在商店中同时可见。
- 安装 `main` 后，`dev` 条目仍应可安装，并显示为另一变体而非已安装。
- 两个同名实例安装后，本地库与详情页都能区分来源。
- 仅当 source identity 与内容都一致时，系统才允许折叠或强提示重复。

## Verified So Far

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer-platform.test.ts tests/unit/stores/skill.store.test.ts tests/unit/components/skill-store-remote.test.tsx`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop typecheck`

以上验证均已通过。
