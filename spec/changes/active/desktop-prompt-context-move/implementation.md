# Implementation

## Shipped

- 为 Prompt 右键菜单新增“移动到...”入口。
- 将“移动到...”实现为右键菜单右侧二级子菜单，固定高度并支持滚动。
- 子菜单展示文件夹自身 icon，并保留层级缩进信息。
- 子菜单增加 hover 容错窗口与桥接热区，避免鼠标从左侧菜单移向右侧子菜单时断触消失。
- 支持将 Prompt 移出当前文件夹。
- 为 `MainContent` 新增 issue #140 集成测试，并为 Vitest 补充 `@tanstack/react-virtual` stub alias。
- 调整 Gallery 视图虚拟滚动区域的上下留白，恢复与其他视图一致的呼吸感。

## Verification

- `pnpm vitest --run tests/integration/components/main-content-context-move.integration.test.tsx`
- `pnpm vitest --run tests/unit/components/context-menu.test.tsx tests/unit/components/prompt-gallery-view.test.tsx tests/integration/components/main-content-context-move.integration.test.tsx`
- `pnpm lint`

## Synced Docs

- 无。当前为局部交互增强，暂不需要回写稳定域文档。

## Follow-ups

- 若后续需要批量与单条操作统一，可把当前文件夹弹层提取为共享组件，供右键菜单和表格批量移动共用。
