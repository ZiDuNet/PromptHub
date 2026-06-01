import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BotIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  RefreshCwIcon,
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
import { Modal } from "../ui/Modal";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { PlatformIcon } from "../ui/PlatformIcon";
import { useToast } from "../ui/Toast";
import { SkillFullDetailPage } from "./SkillFullDetailPage";
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
  const [pendingUninstall, setPendingUninstall] =
    useState<AgentScannedSkill | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const visiblePlatforms = useMemo(
    () =>
      sortSkillPlatformsByPreference(
        filterDetectedPlatforms(platforms, detectedPlatforms, disabledPlatformIds),
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
      ) ??
      null,
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
  }, [scanResult?.skillsDir, selectedAgentSkill, selectedManagedSkill, selectedPlatform]);

  const loadPlatforms = useCallback(async () => {
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
          : nextVisiblePlatforms[0]?.id ?? null,
      );
    } catch (error) {
      console.error("Failed to load skill agents:", error);
      showToast(t("skill.agentsLoadFailed", "Failed to load agents"), "error");
    } finally {
      setIsLoadingPlatforms(false);
    }
  }, [disabledPlatformIds, showToast, skillPlatformOrder, t]);

  const scanSelectedPlatform = useCallback(async () => {
    if (!selectedPlatformId) {
      setScanResult(null);
      return;
    }
    setIsScanning(true);
    try {
      const result = await window.api.skill.scanPlatformSkills(selectedPlatformId);
      setScanResult(result);
      setSelectedSkillPath((current) => {
        if (current && result.scannedSkills.some((skill) => skill.localPath === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      console.error("Failed to scan agent skills:", error);
      setScanResult(null);
      showToast(t("skill.agentScanFailed", "Failed to scan agent skills"), "error");
    } finally {
      setIsScanning(false);
    }
  }, [selectedPlatformId, showToast, t]);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  useEffect(() => {
    void scanSelectedPlatform();
  }, [scanSelectedPlatform]);

  const handleInstallLibrarySkill = async (
    skill: Skill,
    mode: SkillInstallMode,
  ) => {
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
        await window.api.skill.installMd(skill.id, skillMdContent, selectedPlatformId);
      }
      await scanSelectedPlatform();
      await loadDeployedStatus();
      showToast(
        t("skill.agentInstallSuccess", "Skill installed to agent"),
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
            isUninstalling,
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
                      "Browse each agent's real skill folder and manage copy or symlink installs.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPlatforms()}
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
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isActive
                          ? "border-primary/40 bg-primary/5"
                          : "border-border app-wallpaper-surface hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/70 ring-1 ring-border">
                          <PlatformIcon platformId={platform.id} size={28} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {platform.name}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
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
                      {selectedPlatform?.name ?? t("nav.agentSkills", "Agent Skills")}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {scanResult?.skillsDir ??
                        t("skill.agentSkillsDirPending", "Select an agent to scan")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void scanSelectedPlatform()}
                    disabled={isScanning || !selectedPlatformId}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border app-wallpaper-surface text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
                    title={t("common.refresh", "Refresh")}
                  >
                    <RefreshCwIcon
                      className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
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
                    <button
                      key={skill.localPath}
                      type="button"
                      onClick={() => {
                        setSelectedSkillPath(skill.localPath);
                      }}
                      className="rounded-2xl border border-border app-wallpaper-surface px-4 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {skill.name}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {skill.description || skill.localPath}
                          </div>
                        </div>
                        {managedSkill ? (
                          <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {skill.installMode === "symlink"
                            ? t("skill.installSymlink", "Symlink")
                            : t("skill.installCopy", "Copy")}
                        </span>
                        {managedSkill ? (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                            {t("skill.inMySkills", "In My Skills")}
                          </span>
                        ) : null}
                      </div>
                    </button>
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

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={t("skill.installMySkillToAgent", "Install My Skill")}
        size="xl"
      >
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border app-wallpaper-surface px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">
                  {skill.name}
                </div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {skill.description}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={importingJob?.skillId === skill.id}
                  onClick={() => void handleInstallLibrarySkill(skill, "copy")}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
                >
                  {importingJob?.skillId === skill.id &&
                  importingJob.mode === "copy" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t("skill.installCopy", "Copy")}
                </button>
                <button
                  type="button"
                  disabled={importingJob?.skillId === skill.id}
                  onClick={() => void handleInstallLibrarySkill(skill, "symlink")}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {importingJob?.skillId === skill.id &&
                  importingJob.mode === "symlink" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t("skill.installSymlink", "Symlink")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

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
