import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillAgentsView } from "../../../src/renderer/components/skill/SkillAgentsView";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { installWindowMocks } from "../../helpers/window";

const showToastMock = vi.fn();
const translate = (
  _key: string,
  fallback?: string | Record<string, unknown>,
  options?: Record<string, unknown>,
) => {
  if (typeof fallback === "string") {
    return fallback;
  }
  if (
    typeof fallback === "object" &&
    fallback &&
    "defaultValue" in fallback
  ) {
    return String(fallback.defaultValue);
  }
  if (options && "defaultValue" in options) {
    return String(options.defaultValue);
  }
  return _key;
};

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: translate,
      i18n: { language: "en" },
    }),
  };
});

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock("../../../src/renderer/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    children,
    title,
  }: {
    isOpen: boolean;
    children: ReactNode;
    title?: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock("../../../src/renderer/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={onConfirm}>
        confirm-uninstall
      </button>
    ) : null,
}));

vi.mock("../../../src/renderer/components/skill/SkillFileEditor", () => ({
  SkillFileEditor: ({ localPath }: { localPath?: string }) => (
    <div>file-editor:{localPath}</div>
  ),
}));

const claudePlatform = {
  id: "claude",
  name: "Claude Code",
  icon: "Sparkles",
  rootDir: {
    darwin: "~/.claude",
    win32: "%USERPROFILE%\\.claude",
    linux: "~/.claude",
  },
  skillsRelativePath: "skills",
};

function scanResult() {
  return {
    platform: claudePlatform,
    skillsDir: "/agents/claude/skills",
    scannedSkills: [
      {
        name: "copy-skill",
        description: "Copied skill",
        author: "PromptHub",
        tags: ["copy"],
        instructions: "# Copy Skill",
        filePath: "/agents/claude/skills/copy-skill/SKILL.md",
        localPath: "/agents/claude/skills/copy-skill",
        platformSkillPath: "/agents/claude/skills/copy-skill",
        platforms: ["Claude Code"],
        installMode: "copy" as const,
      },
      {
        name: "linked-skill",
        description: "Linked skill",
        author: "PromptHub",
        tags: ["symlink"],
        instructions: "# Linked Skill",
        directory_fingerprint: "fingerprint-linked",
        filePath: "/agents/claude/skills/linked-skill/SKILL.md",
        localPath: "/agents/claude/skills/linked-skill",
        platformSkillPath: "/agents/claude/skills/linked-skill",
        platforms: ["Claude Code"],
        installMode: "symlink" as const,
      },
    ],
  };
}

describe("SkillAgentsView", () => {
  beforeEach(() => {
    showToastMock.mockReset();
    installWindowMocks({
      api: {
        skill: {
          getSupportedPlatforms: vi.fn().mockResolvedValue([claudePlatform]),
          detectPlatforms: vi.fn().mockResolvedValue(["claude"]),
          scanPlatformSkills: vi.fn().mockResolvedValue(scanResult()),
          uninstallPlatformSkill: vi.fn().mockResolvedValue(undefined),
          export: vi.fn().mockResolvedValue("# Library Skill"),
          readLocalFileByPath: vi.fn().mockResolvedValue({ content: "# Copy Skill" }),
          installMd: vi.fn().mockResolvedValue(undefined),
          installMdSymlink: vi.fn().mockResolvedValue({
            requestedMode: "symlink",
            effectiveMode: "symlink",
          }),
        },
      },
      electron: {
        openPath: vi.fn(),
      },
    });

    useSettingsStore.setState({
      skillInstallMethod: "symlink",
      skillPlatformOrder: ["claude"],
      disabledPlatformIds: [],
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);

    useSkillStore.setState({
      skills: [
        {
          id: "library-linked",
          name: "linked-skill",
          description: "Managed linked skill",
          instructions: "# Linked Skill",
          content: "# Linked Skill",
          protocol_type: "skill",
          author: "PromptHub",
          directory_fingerprint: "fingerprint-linked",
          local_repo_path: "/library/linked-skill",
          tags: ["library"],
          is_favorite: false,
          created_at: 1,
          updated_at: 1,
        },
      ],
      selectedSkillId: null,
      searchQuery: "",
      storeView: "agents",
      selectSkill: vi.fn((id: string | null) => {
        useSkillStore.setState({ selectedSkillId: id } as never);
      }),
      setStoreView: vi.fn((view: string) => {
        useSkillStore.setState({ storeView: view as never });
      }),
      loadDeployedStatus: vi.fn().mockResolvedValue(undefined),
    } as Partial<ReturnType<typeof useSkillStore.getState>>);
  });

  it("renders the agent skill browser without opening a persistent detail pane", async () => {
    render(<SkillAgentsView />);

    expect((await screen.findAllByText("Claude Code")).length).toBeGreaterThan(0);
    expect(await screen.findByAltText("claude icon")).toBeInTheDocument();
    expect((await screen.findAllByText("copy-skill")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("linked-skill").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Copy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Symlink").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In My Skills").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /Uninstall/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("# Copy Skill")).not.toBeInTheDocument();
  });

  it("filters agent skills with the global skill search query instead of a second local search box", async () => {
    useSkillStore.setState({
      searchQuery: "linked",
    } as Partial<ReturnType<typeof useSkillStore.getState>>);

    render(<SkillAgentsView />);

    expect(await screen.findByText("linked-skill")).toBeInTheDocument();
    expect(screen.queryByText("copy-skill")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search")).not.toBeInTheDocument();
  });

  it("opens a full-width detail view after clicking an agent skill", async () => {
    render(<SkillAgentsView />);

    fireEvent.click((await screen.findAllByText("copy-skill"))[0]);

    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Uninstall/i })).toBeInTheDocument();
    expect(screen.getByText("Copied skill")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));

    expect(
      screen.queryByRole("button", { name: /Uninstall/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("copy-skill").length).toBeGreaterThan(0);
  });

  it("uninstalls the selected agent skill by platform skill path and refreshes the scan", async () => {
    const { api } = installWindowMocks({
      api: {
        skill: {
          getSupportedPlatforms: vi.fn().mockResolvedValue([claudePlatform]),
          detectPlatforms: vi.fn().mockResolvedValue(["claude"]),
          scanPlatformSkills: vi.fn().mockResolvedValue(scanResult()),
          uninstallPlatformSkill: vi.fn().mockResolvedValue(undefined),
          readLocalFileByPath: vi.fn().mockResolvedValue({ content: "# Copy Skill" }),
        },
      },
    });

    render(<SkillAgentsView />);

    fireEvent.click((await screen.findAllByText("copy-skill"))[0]);
    fireEvent.click(screen.getByRole("button", { name: /Uninstall/i }));
    fireEvent.click(screen.getByText("confirm-uninstall"));

    await waitFor(() => {
      expect(api.skill.uninstallPlatformSkill).toHaveBeenCalledWith(
        "claude",
        "/agents/claude/skills/copy-skill",
      );
    });
    expect(api.skill.scanPlatformSkills).toHaveBeenCalledTimes(2);
  });

  it("installs a My Skills entry into the selected agent through the symlink API", async () => {
    const { api } = installWindowMocks({
      api: {
        skill: {
          getSupportedPlatforms: vi.fn().mockResolvedValue([claudePlatform]),
          detectPlatforms: vi.fn().mockResolvedValue(["claude"]),
          scanPlatformSkills: vi.fn().mockResolvedValue(scanResult()),
          export: vi.fn().mockResolvedValue("# Linked Skill"),
          readLocalFileByPath: vi.fn().mockResolvedValue({ content: "# Linked Skill" }),
          installMdSymlink: vi.fn().mockResolvedValue({
            requestedMode: "symlink",
            effectiveMode: "symlink",
          }),
          installMd: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    render(<SkillAgentsView />);

    fireEvent.click(await screen.findByRole("button", { name: /Install My Skill/i }));
    const dialog = screen.getByRole("dialog", { name: /Install My Skill/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /Symlink/i }));

    await waitFor(() => {
      expect(api.skill.export).toHaveBeenCalledWith("library-linked", "skillmd");
      expect(api.skill.installMdSymlink).toHaveBeenCalledWith(
        "library-linked",
        "# Linked Skill",
        "claude",
      );
    });
  });

  it("opens the managed library skill from an agent-scanned skill", async () => {
    render(<SkillAgentsView />);

    fireEvent.click(await screen.findByText("linked-skill"));
    fireEvent.click(screen.getByRole("button", { name: /Open in My Skills/i }));

    expect(useSkillStore.getState().storeView).toBe("my-skills");
    expect(useSkillStore.getState().selectedSkillId).toBe("library-linked");
  });
});
