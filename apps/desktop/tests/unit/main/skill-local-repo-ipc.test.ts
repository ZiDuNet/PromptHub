import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const saveRemoteGitSkillToLocalRepoBySkillIdMock = vi
  .fn()
  .mockResolvedValue("/managed/writer/repo");
const computeRepoDirectoryFingerprintMock = vi
  .fn()
  .mockResolvedValue("fingerprint-after-copy");

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    saveRemoteGitSkillToLocalRepoBySkillId:
      saveRemoteGitSkillToLocalRepoBySkillIdMock,
    listLocalRepoFilesByPath: vi.fn().mockResolvedValue([]),
    readLocalRepoFileByPath: vi.fn().mockResolvedValue(null),
    readLocalRepoFilesByPath: vi.fn().mockResolvedValue([]),
    isManagedRepoPath: vi.fn().mockResolvedValue(true),
    getPreferredLocalRepoPathForSkill: vi.fn(
      (skill: { id: string }) => `/managed/${skill.id}/repo`,
    ),
  },
}));

vi.mock("../../../src/main/services/skill-repo-sync", () => ({
  buildSkillSyncUpdateFromRepo: vi.fn(),
  computeRepoDirectoryFingerprint: computeRepoDirectoryFingerprintMock,
}));

vi.mock("../../../src/main/ipc/skill/shared", () => ({
  ensureLocalRepoPath: vi.fn().mockResolvedValue("/managed/writer/repo"),
  readCurrentFilesSnapshot: vi.fn().mockResolvedValue([]),
}));

type RegisteredHandlers = Record<
  string,
  (...args: unknown[]) => Promise<unknown>
>;

function createSkillDbMock() {
  return {
    getById: vi.fn(),
    update: vi.fn(),
    createVersion: vi.fn(),
  };
}

async function setupSkillLocalRepoIpc() {
  vi.resetModules();
  handleMock.mockReset();
  saveRemoteGitSkillToLocalRepoBySkillIdMock.mockClear();
  computeRepoDirectoryFingerprintMock.mockClear();

  const [{ registerSkillLocalRepoHandlers }, { IPC_CHANNELS }] =
    await Promise.all([
      import("../../../src/main/ipc/skill/local-repo-handlers"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

  const db = createSkillDbMock();
  registerSkillLocalRepoHandlers({ db } as never);

  const handlers = Object.fromEntries(
    handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as RegisteredHandlers;

  return { db, handlers, IPC_CHANNELS };
}

describe("skill local repo IPC", () => {
  beforeEach(() => {
    handleMock.mockReset();
    saveRemoteGitSkillToLocalRepoBySkillIdMock.mockClear();
    computeRepoDirectoryFingerprintMock.mockClear();
  });

  it("saves a remote Git package to the managed repo and persists the fingerprint", async () => {
    const { db, handlers, IPC_CHANNELS } = await setupSkillLocalRepoIpc();
    const skill = {
      id: "skill-writer",
      name: "writer",
      source_url: "https://gitea.example.com/team/skills",
      source_directory: "skills/writer",
    };
    db.getById.mockReturnValue(skill);

    await expect(
      handlers[IPC_CHANNELS.SKILL_SAVE_REMOTE_GIT_TO_REPO](
        null,
        "skill-writer",
        {
          repoUrl: "https://gitea.example.com/team/skills",
          branch: "main",
          directory: "skills/writer",
        },
      ),
    ).resolves.toBe("/managed/writer/repo");

    expect(saveRemoteGitSkillToLocalRepoBySkillIdMock).toHaveBeenCalledWith(
      skill,
      {
        repoUrl: "https://gitea.example.com/team/skills",
        branch: "main",
        directory: "skills/writer",
      },
    );
    expect(computeRepoDirectoryFingerprintMock).toHaveBeenCalledWith(
      "/managed/writer/repo",
    );
    expect(db.update).toHaveBeenCalledWith("skill-writer", {
      local_repo_path: "/managed/writer/repo",
      directory_fingerprint: "fingerprint-after-copy",
    });
  });

  it.each([
    {
      name: "empty skill id",
      skillId: "",
      options: { repoUrl: "https://gitea.example.com/team/skills" },
      expectedError: /requires a non-empty skillId/,
    },
    {
      name: "missing repo URL",
      skillId: "skill-writer",
      options: {},
      expectedError: /requires a non-empty repoUrl/,
    },
    {
      name: "blank repo URL",
      skillId: "skill-writer",
      options: { repoUrl: " " },
      expectedError: /requires a non-empty repoUrl/,
    },
  ])("rejects invalid saveRemoteGitToRepo input: $name", async (input) => {
    const { handlers, IPC_CHANNELS } = await setupSkillLocalRepoIpc();

    await expect(
      handlers[IPC_CHANNELS.SKILL_SAVE_REMOTE_GIT_TO_REPO](
        null,
        input.skillId,
        input.options,
      ),
    ).rejects.toThrow(input.expectedError);

    expect(saveRemoteGitSkillToLocalRepoBySkillIdMock).not.toHaveBeenCalled();
  });

  it("rejects saveRemoteGitToRepo when the skill does not exist", async () => {
    const { db, handlers, IPC_CHANNELS } = await setupSkillLocalRepoIpc();
    db.getById.mockReturnValue(null);

    await expect(
      handlers[IPC_CHANNELS.SKILL_SAVE_REMOTE_GIT_TO_REPO](null, "missing", {
        repoUrl: "https://gitea.example.com/team/skills",
      }),
    ).rejects.toThrow(/Skill not found: missing/);

    expect(saveRemoteGitSkillToLocalRepoBySkillIdMock).not.toHaveBeenCalled();
  });
});
