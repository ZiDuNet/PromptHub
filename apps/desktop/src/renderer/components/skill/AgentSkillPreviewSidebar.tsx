import { FolderOpenIcon } from "lucide-react";
import type { TFunction } from "i18next";
import { PlatformIcon } from "../ui/PlatformIcon";

interface AgentSkillPreviewSidebarProps {
  installMode: "copy" | "symlink";
  isManaged?: boolean;
  onOpenFolder?: () => void | Promise<void>;
  platformId: string;
  platformName: string;
  sourcePath: string;
  t: TFunction;
}

export function AgentSkillPreviewSidebar({
  installMode,
  isManaged = false,
  onOpenFolder,
  platformId,
  platformName,
  sourcePath,
  t,
}: AgentSkillPreviewSidebarProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {t("skill.agentSource", "Agent Source")}
        </h3>
        <div className="app-wallpaper-panel rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/70 ring-1 ring-border">
              <PlatformIcon platformId={platformId} size={24} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {platformName}
              </div>
              <div className="text-xs text-muted-foreground">
                {installMode === "symlink"
                  ? t("skill.symlink", "Symlink")
                  : t("skill.copyMode", "Copy")}
              </div>
            </div>
          </div>
          {isManaged ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {t("skill.inMySkills", "In My Skills")}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onOpenFolder?.()}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-accent/60 px-4 py-4 text-left transition-colors hover:bg-accent"
            title={sourcePath}
          >
            <FolderOpenIcon className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {t("skill.openLocalSource", "Open Local Skill Folder")}
              </div>
              <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                {sourcePath}
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
