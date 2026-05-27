# Implementation

## Implemented

- 新增 `apps/web/src/services/auth-captcha.ts`，使用 `svg-captcha` 签发内存型一次性图形验证码 challenge，支持过期清理、大小写无关校验与错误分类。
- 在 `apps/web/src/routes/auth.ts` 增加 `GET /api/auth/captcha`，并要求 `/api/auth/login` 与 `/api/auth/register` 必须提交 `captchaId` 和 `captchaAnswer`；同时把答案约束调整为字母数字格式。
- 更新 `apps/web/src/client/api/auth.ts` 与 `apps/web/src/client/contexts/AuthContext.tsx`，让前端拉取 `imageData` 并提交验证码字段。
- 更新 `apps/web/src/client/pages/Login.tsx` 与 `apps/web/src/client/pages/Setup.tsx`，将原文本 challenge 改为 `<img>` 图形验证码，保留刷新与失败后自动换题行为。
- 更新 `apps/web/src/client/index.css` 与 7 个 locale 文件，使图形验证码样式、alt 文案与交互提示完整对齐。
- 更新测试辅助 `apps/web/src/test-helpers/auth-captcha.ts`，通过动态导入 `getCaptchaAnswerForTesting(...)` 获取答案，避免 `vi.resetModules()` 后读取旧 challenge。
- 补齐 `apps/web/src/routes/import-export.test.ts` 的导出 payload 类型字段，消除与 `images` / `videos` 字段不一致导致的 `typecheck` 误报。
- 修复 `docker compose up -d --build` 下的 Web 启动失败：`apps/web/vite.server.config.ts` 现在将 `svg-captcha` 视为 SSR external dependency，避免 Vite 将其打进 server bundle 后破坏 `../fonts/Comismsh.ttf` 的相对路径读取。
- 更新 `apps/web/src/build.test.ts`，把 `svg-captcha` 纳入 SSR external regression guard，防止后续再次被打包进 server bundle。

## Verification

- `pnpm --filter @prompthub/web exec vitest run src/client/pages/Login.test.tsx src/client/pages/Setup.test.tsx src/client/api/auth.test.ts src/client/contexts/AuthContext.test.tsx src/routes/auth.test.ts`
  - 结果：通过（38/38）
- `pnpm lint:web`
  - 结果：通过
- `pnpm --filter @prompthub/web typecheck`
  - 结果：通过
- `pnpm --filter @prompthub/web exec vitest run src/routes/auth.test.ts`
  - 结果：通过（16/16）
- `pnpm --filter @prompthub/web exec vitest run src/build.test.ts`
  - 结果：通过（1/1）
- `pnpm --filter @prompthub/web build`
  - 结果：通过
- `pnpm --filter @prompthub/web lint`
  - 结果：通过

## Notes

- 额外执行了 `pnpm --filter @prompthub/web exec vitest run src/routes/import-export.test.ts` 以抽查受当前脏工作树影响的其它 Web 路由测试。
- 该测试当前失败，表现为 `GET /api/export` 返回 `400`、import summary 中 `settingsUpdated` 为 `false`、invalid import 返回 `400` 而非 `422`。
- 这些失败点位于现有的 import/export 与 sync 契约改动范围内，不是本次验证码链路新增逻辑引入的回归；本次变更未修改 `apps/web/src/routes/import-export.ts` 的运行时行为。
