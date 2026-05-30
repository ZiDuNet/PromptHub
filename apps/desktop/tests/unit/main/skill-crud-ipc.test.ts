import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const uninstallSkillMdForSkillMock = vi.fn().mockResolvedValue(undefined);
const getSupportedPlatformsMock = vi.fn(() => [{ id: "claude", name: "Claude" }]);
const getManagedContainerPathForSkillMock = vi
  .fn()
  .mockResolvedValue("/prompthub/skills/writer--7dc211f6");
const isManagedRepoPathMock = vi.fn().mockResolvedValue(true);
const deleteManagedVariantContainerMock = vi.fn().mockResolvedValue(undefined);

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    uninstallSkillMdForSkill: uninstallSkillMdForSkillMock,
    getSupportedPlatforms: getSupportedPlatformsMock,
    getManagedContainerPathForSkill: getManagedContainerPathForSkillMock,
    isManagedRepoPath: isManagedRepoPathMock,
    deleteManagedVariantContainer: deleteManagedVariantContainerMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer-repo", () => ({
  isInternalSkillRepoEntry: vi.fn(() => false),
}));

vi.mock("../../../src/main/ipc/skill/shared", () => ({
  ensureLocalRepoPath: vi.fn(),
  readCurrentFilesSnapshot: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/main/services/skill-repo-sync", () => ({
  hasMetadataChanges: vi.fn(() => false),
  syncFrontmatterToRepo: vi.fn().mockResolvedValue(undefined),
}));

type RegisteredHandlers = Record<string, (...args: unknown[]) => unknown>;

function createSkillDbMock() {
  return {
    getById: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockReturnValue(true),
    createVersion: vi.fn(),
  };
}

async function setupSkillCrudIpc() {
  vi.resetModules();
  handleMock.mockReset();
  uninstallSkillMdForSkillMock.mockClear();
  getSupportedPlatformsMock.mockClear();
  getManagedContainerPathForSkillMock.mockClear();
  isManagedRepoPathMock.mockClear();
  deleteManagedVariantContainerMock.mockClear();

  const [{ registerSkillCrudHandlers }, { IPC_CHANNELS }] = await Promise.all([
    import("../../../src/main/ipc/skill/crud-handlers"),
    import("@prompthub/shared/constants/ipc-channels"),
  ]);

  const db = createSkillDbMock();
  registerSkillCrudHandlers({ db } as never);

  const handlers = Object.fromEntries(
    handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as RegisteredHandlers;

  return { db, handlers, IPC_CHANNELS };
}

describe("skill crud IPC", () => {
  beforeEach(() => {
    handleMock.mockReset();
    uninstallSkillMdForSkillMock.mockClear();
    getSupportedPlatformsMock.mockClear();
    getManagedContainerPathForSkillMock.mockClear();
    isManagedRepoPathMock.mockClear();
    deleteManagedVariantContainerMock.mockClear();
  });

  it("deletes PromptHub-managed repo containers when deleting a skill", async () => {
    const { db, handlers, IPC_CHANNELS } = await setupSkillCrudIpc();

    const skill = {
      id: "skill-1",
      name: "writer",
      local_repo_path: "/prompthub/skills/writer--7dc211f6/repo",
    };
    db.getById.mockReturnValue(skill);

    await expect(handlers[IPC_CHANNELS.SKILL_DELETE](null, "skill-1")).resolves.toBe(
      true,
    );

    expect(getManagedContainerPathForSkillMock).toHaveBeenCalledWith(skill);
    expect(isManagedRepoPathMock).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6",
    );
    expect(deleteManagedVariantContainerMock).toHaveBeenCalledWith(skill);
    expect(db.delete).toHaveBeenCalledWith("skill-1");
  });

  it("does not delete external source directories when the resolved path is not managed", async () => {
    const { db, handlers, IPC_CHANNELS } = await setupSkillCrudIpc();

    const skill = {
      id: "skill-2",
      name: "writer",
      local_repo_path: "/Users/demo/external/writer",
    };
    db.getById.mockReturnValue(skill);
    getManagedContainerPathForSkillMock.mockResolvedValueOnce(
      "/Users/demo/external/writer",
    );
    isManagedRepoPathMock.mockResolvedValueOnce(false);

    await expect(handlers[IPC_CHANNELS.SKILL_DELETE](null, "skill-2")).resolves.toBe(
      true,
    );

    expect(isManagedRepoPathMock).toHaveBeenCalledWith(
      "/Users/demo/external/writer",
    );
    expect(deleteManagedVariantContainerMock).not.toHaveBeenCalledWith(skill);
    expect(db.delete).toHaveBeenCalledWith("skill-2");
  });
});
