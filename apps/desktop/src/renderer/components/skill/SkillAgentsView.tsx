import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BotIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import type {
  AgentScannedSkill,
  Skill,
  SkillInstallMode,
  SkillPlatformScanResult,
} from "@prompthub/shared/types";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import { useSettingsStore } from "../../stores/settings.store";
import { useSkillStore } from "../../stores/skill.store";
import { filterDetectedPlatforms } from "../../services/platform-visibility";
import { normalizeProjectPathForComparison } from "../../services/project-skill-targets";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PlatformIcon } from "../ui/PlatformIcon";
import { useToast } from "../ui/Toast";
import { SkillFullDetailPage } from "./SkillFullDetailPage";
import { SkillLibraryImportModal } from "./SkillLibraryImportModal";
import { buildProjectDetailSkill } from "./project-detail-adapter";
import { sortSkillPlatformsByPreference } from "./use-skill-platform";

const AGENT_SECTION_HEADER_CLASS =
  "h-[152px] border-b border-border app-wallpaper-panel-strong";

function getManagedSkillMatch(
  scannedSkill: AgentScannedSkill,
  librarySkills: Skill[],
): Skill | null {
  const scannedPath = normalizeProjectPathForComparison(scannedSkill.localPath);
  return (
    librarySkills.find((skill) => {
      const repoPath = skill.local_repo_path
        ? normalizeProjectPathForComparison(skill.local_repo_path)
        : "";
      const sourcePath = skill.source_url
        ? normalizeProjectPathForComparison(skill.source_url)
        : "";
      return repoPath === scannedPath || sourcePath === scannedPath;
    }) ??
    librarySkills.find(
      (skill) =>
        Boolean(scannedSkill.directory_fingerprint) &&
        skill.directory_fingerprint === scannedSkill.directory_fingerprint,
    ) ??
    librarySkills.find((skill) => skill.name === scannedSkill.name) ??
    null
  );
}

export function SkillAgentsView() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const skills = useSkillStore((state) => state.skills);
  const searchQuery = useSkillStore((state) => state.searchQuery);
  const selectSkill = useSkillStore((state) => state.selectSkill);
  const setStoreView = useSkillStore((state) => state.setStoreView);
  const loadDeployedStatus = useSkillStore((state) => state.loadDeployedStatus);
  const importScannedSkills = useSkillStore(
    (state) => state.importScannedSkills,
  );
  const skillPlatformOrder =
    useSettingsStore((state) => state.skillPlatformOrder) ?? [];
  const disabledPlatformIds =
    useSettingsStore((state) => state.disabledPlatformIds) ?? [];

  const [platforms, setPlatforms] = useState<SkillPlatform[]>([]);
  const [detectedPlatforms, setDetectedPlatforms] = useState<string[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(
    null,
  );
  const [scanResult, setScanResult] = useState<SkillPlatformScanResult | null>(
    null,
  );
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedSkillPath, setSelectedSkillPath] = useState<string | null>(
    null,
  );
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingJob, setImportingJob] = useState<{
    skillId: string;
    mode: SkillInstallMode;
  } | null>(null);
  const [isImportingLibrarySkills, setIsImportingLibrarySkills] =
    useState(false);
  const [importingAgentSkillPath, setImportingAgentSkillPath] = useState<
    string | null
  >(null);
  const [pendingUninstall, setPendingUninstall] =
    useState<AgentScannedSkill | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const visiblePlatforms = useMemo(
    () =>
      sortSkillPlatformsByPreference(
        filterDetectedPlatforms(
          platforms,
          detectedPlatforms,
          disabledPlatformIds,
        ),
        skillPlatformOrder,
      ),
    [detectedPlatforms, disabledPlatformIds, platforms, skillPlatformOrder],
  );

  const selectedPlatform = useMemo(
    () =>
      visiblePlatforms.find((platform) => platform.id === selectedPlatformId) ??
      null,
    [selectedPlatformId, visiblePlatforms],
  );

  const visibleAgentSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scannedSkills = scanResult?.scannedSkills ?? [];
    if (!query) {
      return scannedSkills;
    }
    return scannedSkills.filter((skill) => {
      const haystack = [
        skill.name,
        skill.description,
        skill.author,
        skill.localPath,
        ...skill.tags,
      ]
        .join("\n")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [scanResult?.scannedSkills, searchQuery]);

  const selectedAgentSkill = useMemo(
    () =>
      (scanResult?.scannedSkills ?? []).find(
        (skill) => skill.localPath === selectedSkillPath,
      ) ?? null,
    [scanResult?.scannedSkills, selectedSkillPath],
  );

  const selectedManagedSkill = useMemo(
    () =>
      selectedAgentSkill
        ? getManagedSkillMatch(selectedAgentSkill, skills)
        : null,
    [selectedAgentSkill, skills],
  );

  const selectedDetailSkill = useMemo(() => {
    if (!selectedAgentSkill || !selectedPlatform) {
      return null;
    }

    return buildProjectDetailSkill({
      scannedSkill: selectedAgentSkill,
      importedSkill: selectedManagedSkill,
      projectName: selectedPlatform.name,
      projectRootPath: scanResult?.skillsDir ?? "",
    });
  }, [
    scanResult?.skillsDir,
    selectedAgentSkill,
    selectedManagedSkill,
    selectedPlatform,
  ]);

  const platformStats = useMemo(() => {
    const scannedSkills = scanResult?.scannedSkills ?? [];
    return scannedSkills.reduce(
      (stats, skill) => {
        stats.total += 1;
        if (skill.installMode === "symlink") {
          stats.symlink += 1;
        } else {
          stats.copy += 1;
        }
        if (getManagedSkillMatch(skill, skills)) {
          stats.managed += 1;
        }
        return stats;
      },
      {
        total: 0,
        managed: 0,
        copy: 0,
        symlink: 0,
      },
    );
  }, [scanResult?.scannedSkills, skills]);

  const loadPlatforms = useCallback(
    async (options?: { toast?: boolean }) => {
      setIsLoadingPlatforms(true);
      try {
        const [supported, detected] = await Promise.all([
          window.api.skill.getSupportedPlatforms(),
          window.api.skill.detectPlatforms(),
        ]);
        setPlatforms(supported);
        setDetectedPlatforms(detected);
        const nextVisiblePlatforms = sortSkillPlatformsByPreference(
          filterDetectedPlatforms(supported, detected, disabledPlatformIds),
          skillPlatformOrder,
        );
        setSelectedPlatformId((current) =>
          current &&
          nextVisiblePlatforms.some((platform) => platform.id === current)
            ? current
            : (nextVisiblePlatforms[0]?.id ?? null),
        );
        if (options?.toast) {
          showToast(
            t("skill.agentsRefreshComplete", {
              count: nextVisiblePlatforms.length,
              defaultValue: `Detected ${nextVisiblePlatforms.length} agents`,
            }),
            "success",
          );
        }
      } catch (error) {
        console.error("Failed to load skill agents:", error);
        showToast(
          t("skill.agentsLoadFailed", "Failed to load agents"),
          "error",
        );
      } finally {
        setIsLoadingPlatforms(false);
      }
    },
    [disabledPlatformIds, showToast, skillPlatformOrder, t],
  );

  const scanSelectedPlatform = useCallback(
    async (options?: { toast?: boolean }) => {
      if (!selectedPlatformId) {
        setScanResult(null);
        return;
      }
      setIsScanning(true);
      try {
        const result =
          await window.api.skill.scanPlatformSkills(selectedPlatformId);
        setScanResult(result);
        setSelectedSkillPath((current) => {
          if (
            current &&
            result.scannedSkills.some((skill) => skill.localPath === current)
          ) {
            return current;
          }
          return null;
        });
        if (options?.toast) {
          showToast(
            t("skill.agentScanComplete", {
              count: result.scannedSkills.length,
              defaultValue: `Scanned ${result.scannedSkills.length} skills`,
            }),
            "success",
          );
        }
      } catch (error) {
        console.error("Failed to scan agent skills:", error);
        setScanResult(null);
        showToast(
          t("skill.agentScanFailed", "Failed to scan agent skills"),
          "error",
        );
      } finally {
        setIsScanning(false);
      }
    },
    [selectedPlatformId, showToast, t],
  );

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  useEffect(() => {
    void scanSelectedPlatform();
  }, [scanSelectedPlatform]);

  const installLibrarySkill = async (skill: Skill, mode: SkillInstallMode) => {
    if (!selectedPlatformId) {
      return;
    }
    setImportingJob({ skillId: skill.id, mode });
    try {
      const skillMdContent = await window.api.skill.export(skill.id, "skillmd");
      if (mode === "symlink") {
        await window.api.skill.installMdSymlink(
          skill.id,
          skillMdContent,
          selectedPlatformId,
        );
      } else {
        await window.api.skill.installMd(
          skill.id,
          skillMdContent,
          selectedPlatformId,
        );
      }
    } finally {
      setImportingJob(null);
    }
  };

  const handleInstallLibrarySkills = async (payload: {
    skillIds: string[];
    importMode: "copy" | "symlink";
  }) => {
    if (!selectedPlatformId) {
      return;
    }
    setIsImportingLibrarySkills(true);
    let installedCount = 0;
    try {
      for (const skillId of payload.skillIds) {
        const skill = skills.find((entry) => entry.id === skillId);
        if (!skill) {
          continue;
        }
        await installLibrarySkill(skill, payload.importMode);
        installedCount += 1;
      }
      await scanSelectedPlatform();
      await loadDeployedStatus();
      showToast(
        t("skill.agentInstallSuccessCount", {
          count: installedCount,
          defaultValue: `Installed ${installedCount} skill(s) to agent`,
        }),
        "success",
      );
      setIsImportModalOpen(false);
    } catch (error) {
      console.error("Failed to install skill to agent:", error);
      showToast(
        t("skill.agentInstallFailed", "Failed to install skill to agent"),
        "error",
      );
    } finally {
      setImportingJob(null);
      setIsImportingLibrarySkills(false);
    }
  };

  const handleImportAgentSkill = async (scannedSkill: AgentScannedSkill) => {
    setImportingAgentSkillPath(scannedSkill.localPath);
    try {
      let repoSkillMd: { content?: string } | null = null;
      if (!scannedSkill.instructions.trim()) {
        try {
          repoSkillMd =
            (await window.api.skill.readLocalFileByPath?.(
              scannedSkill.localPath,
              "SKILL.md",
            )) ?? null;
        } catch {
          repoSkillMd = null;
        }
      }
      const hydratedScannedSkill =
        repoSkillMd?.content && repoSkillMd.content.trim().length > 0
          ? { ...scannedSkill, instructions: repoSkillMd.content }
          : scannedSkill;
      const result = await importScannedSkills(
        [hydratedScannedSkill],
        undefined,
        "copy",
      );
      if (result.importedCount === 0) {
        throw new Error(
          result.failed[0]?.reason ||
            result.skipped[0]?.reason ||
            t("skill.importFailed", "Failed to import skills"),
        );
      }

      await loadDeployedStatus();
      await scanSelectedPlatform();
      showToast(
        t("skill.projectImportSuccess", {
          mode: t("skill.copyMode", "Copy"),
          defaultValue: "Imported to My Skills ({{mode}})",
        }),
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("skill.importFailed", "Failed to import skills"),
        "error",
      );
    } finally {
      setImportingAgentSkillPath(null);
    }
  };

  const handleConfirmUninstall = async () => {
    if (!selectedPlatformId || !pendingUninstall) {
      return;
    }
    setIsUninstalling(true);
    try {
      await window.api.skill.uninstallPlatformSkill(
        selectedPlatformId,
        pendingUninstall.platformSkillPath,
      );
      setPendingUninstall(null);
      if (selectedSkillPath === pendingUninstall.localPath) {
        setSelectedSkillPath(null);
      }
      await scanSelectedPlatform();
      await loadDeployedStatus();
      showToast(
        t("skill.agentUninstallSuccess", "Skill removed from agent"),
        "success",
      );
    } catch (error) {
      console.error("Failed to remove agent skill:", error);
      showToast(
        t("skill.agentUninstallFailed", "Failed to remove skill from agent"),
        "error",
      );
    } finally {
      setIsUninstalling(false);
    }
  };

  const openManagedSkill = () => {
    if (!selectedManagedSkill) {
      return;
    }
    setStoreView("my-skills");
    selectSkill(selectedManagedSkill.id);
  };

  const openManagedSkillFromCard = (managedSkill: Skill) => {
    setStoreView("my-skills");
    selectSkill(managedSkill.id);
  };

  return (
    <>
      {selectedAgentSkill && selectedDetailSkill && selectedPlatform ? (
        <SkillFullDetailPage
          overrideSkill={selectedDetailSkill}
          agentContext={{
            installMode: selectedAgentSkill.installMode,
            isManaged: Boolean(selectedManagedSkill),
            platformId: selectedPlatform.id,
            platformName: selectedPlatform.name,
            sourcePath: selectedAgentSkill.localPath,
          }}
          agentActions={{
            isImporting:
              importingAgentSkillPath === selectedAgentSkill.localPath,
            isUninstalling,
            onImport: selectedManagedSkill
              ? undefined
              : () => handleImportAgentSkill(selectedAgentSkill),
            onOpenFolder: async () => {
              await window.electron?.openPath?.(selectedAgentSkill.localPath);
            },
            onOpenManagedSkill: openManagedSkill,
            onUninstall: () => setPendingUninstall(selectedAgentSkill),
          }}
          onBack={() => setSelectedSkillPath(null)}
        />
      ) : (
        <div className="flex h-full min-h-0 overflow-hidden">
          <div className="flex min-h-0 w-80 shrink-0 flex-col border-r border-border app-wallpaper-panel-strong">
            <div className={`${AGENT_SECTION_HEADER_CLASS} shrink-0`}>
              <div className="flex h-full items-start justify-between gap-4 px-4 py-5">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("nav.agentSkills", "Agent Skills")}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {t(
                      "skill.agentsSidebarHint",
                      "Browse each agent's Skill directory and manage copy or symlink installs.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPlatforms({ toast: true })}
                  disabled={isLoadingPlatforms}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border app-wallpaper-surface text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
                  title={t("common.refresh", "Refresh")}
                >
                  <RefreshCwIcon
                    className={`h-4 w-4 ${isLoadingPlatforms ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {visiblePlatforms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  <BotIcon className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <div className="font-medium text-foreground">
                    {t("skill.noAgents", "No agents detected")}
                  </div>
                </div>
              ) : (
                visiblePlatforms.map((platform) => {
                  const isActive = platform.id === selectedPlatformId;
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => setSelectedPlatformId(platform.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-background/60 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          data-testid="agent-platform-icon-shell"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                        >
                          <PlatformIcon platformId={platform.id} size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {platform.name}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {platform.skillsRelativePath}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col app-wallpaper-panel">
            <div className={`${AGENT_SECTION_HEADER_CLASS} shrink-0`}>
              <div className="flex h-full flex-col gap-4 px-4 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-foreground">
                      {selectedPlatform?.name ??
                        t("nav.agentSkills", "Agent Skills")}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {scanResult?.skillsDir ??
                        t(
                          "skill.agentSkillsDirPending",
                          "Select an agent to scan",
                        )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void scanSelectedPlatform({ toast: true })}
                    disabled={isScanning || !selectedPlatformId}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border app-wallpaper-surface text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
                    title={t("common.refresh", "Refresh")}
                  >
                    <RefreshCwIcon
                      className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 font-medium text-foreground">
                    {t("skill.agentStatsTotal", {
                      count: platformStats.total,
                      defaultValue: `${platformStats.total} skills`,
                    })}
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
                    {t("skill.agentStatsManaged", {
                      count: platformStats.managed,
                      defaultValue: `${platformStats.managed} managed`,
                    })}
                  </span>
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-muted-foreground">
                    {t("skill.agentStatsCopy", {
                      count: platformStats.copy,
                      defaultValue: `${platformStats.copy} copy`,
                    })}
                  </span>
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-muted-foreground">
                    {t("skill.agentStatsSymlink", {
                      count: platformStats.symlink,
                      defaultValue: `${platformStats.symlink} symlink`,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-5 xl:grid-cols-2 2xl:grid-cols-3">
              {isScanning ? (
                <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  {t("skill.scanning", "Scanning...")}
                </div>
              ) : visibleAgentSkills.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  <FolderOpenIcon className="mx-auto mb-3 h-10 w-10 opacity-30" />
                  <div className="font-medium text-foreground">
                    {t("skill.noAgentSkills", "No skills in this agent")}
                  </div>
                </div>
              ) : (
                visibleAgentSkills.map((skill) => {
                  const managedSkill = getManagedSkillMatch(skill, skills);
                  return (
                    <article
                      key={skill.localPath}
                      data-testid="agent-skill-card"
                      className="group rounded-2xl border border-border app-wallpaper-surface transition-colors hover:border-primary/30 hover:bg-accent/30"
                    >
                      <div className="grid min-h-[156px] grid-cols-[minmax(0,1fr)_9.5rem] items-stretch gap-4 px-4 py-4 max-[760px]:grid-cols-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSkillPath(skill.localPath);
                          }}
                          className="min-w-0 self-stretch text-left"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                              {skill.name.trim().charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <div className="truncate text-base font-semibold text-foreground">
                                  {skill.name}
                                </div>
                                {managedSkill ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                                    <CheckCircle2Icon className="h-3 w-3" />
                                    {t("skill.inMySkills", "In My Skills")}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                                {skill.description ||
                                  skill.author ||
                                  skill.localPath}
                              </div>
                              <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                                {skill.localPath}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                  {skill.installMode === "symlink"
                                    ? t("skill.installSymlink", "Symlink")
                                    : t("skill.installCopy", "Copy")}
                                </span>
                                {(skill.tags ?? []).slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>

                        <div
                          data-testid="agent-skill-actions"
                          className="flex w-full shrink-0 items-end justify-end gap-2 self-end justify-self-end max-[760px]:justify-start"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              void window.electron?.openPath?.(skill.localPath)
                            }
                            aria-label={t(
                              "skill.openSkillFolder",
                              "Open Folder",
                            )}
                            title={t("skill.openSkillFolder", "Open Folder")}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <FolderOpenIcon className="h-4 w-4" />
                          </button>
                          {managedSkill ? (
                            <button
                              type="button"
                              onClick={() =>
                                openManagedSkillFromCard(managedSkill)
                              }
                              aria-label={t(
                                "skill.openInMySkills",
                                "Open in My Skills",
                              )}
                              title={t(
                                "skill.openInMySkills",
                                "Open in My Skills",
                              )}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <BookOpenIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleImportAgentSkill(skill)}
                              disabled={
                                importingAgentSkillPath === skill.localPath
                              }
                              aria-label={t(
                                "skill.addToLibrary",
                                "Import to My Skills",
                              )}
                              title={t(
                                "skill.addToLibrary",
                                "Import to My Skills",
                              )}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                            >
                              {importingAgentSkillPath === skill.localPath ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <DownloadIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingUninstall(skill)}
                            aria-label={t(
                              "skill.uninstallFromAgent",
                              "Uninstall from agent",
                            )}
                            title={`${t("skill.uninstallFromAgent", "Uninstall from agent")}: ${skill.name}`}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                disabled={!selectedPlatformId || skills.length === 0}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                <DownloadIcon className="h-4 w-4" />
                {t("skill.installMySkillToAgent", "Install My Skill")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SkillLibraryImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirm={({ skillIds, importMode }) =>
          void handleInstallLibrarySkills({ skillIds, importMode })
        }
        isDeploying={isImportingLibrarySkills || Boolean(importingJob)}
        scannedSkills={scanResult?.scannedSkills ?? []}
        skills={skills}
        fixedTargetDirs={scanResult?.skillsDir ? [scanResult.skillsDir] : []}
        showTargetSettings={false}
        title={t("skill.installMySkillToAgent", "Install My Skill")}
        description={t(
          "skill.installMySkillToAgentHint",
          "Select one or more skills from My Skills and install them into the selected agent's skill folder.",
        )}
        selectHint={t(
          "skill.selectSkillsToAgentHint",
          "Choose one or more skills to install into this agent.",
        )}
        confirmLabel={(count) =>
          t("skill.importSelectedToAgent", {
            count,
            defaultValue: `Install ${count} selected skill(s)`,
          })
        }
      />

      <ConfirmDialog
        isOpen={Boolean(pendingUninstall)}
        onClose={() => setPendingUninstall(null)}
        onConfirm={() => void handleConfirmUninstall()}
        title={t("skill.uninstallFromAgent", "Uninstall from agent")}
        message={t(
          "skill.uninstallFromAgentConfirm",
          "Remove this skill folder from the selected agent? Symlink installs only remove the link.",
        )}
        confirmText={t("common.uninstall", "Uninstall")}
        cancelText={t("common.cancel", "Cancel")}
        variant="destructive"
        isLoading={isUninstalling}
      />
    </>
  );
}
