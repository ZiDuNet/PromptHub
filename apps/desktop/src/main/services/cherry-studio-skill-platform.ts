import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import DatabaseAdapter from "../database/sqlite";
import { parseSkillMd } from "./skill-validator";
import { isInternalSkillRepoEntry } from "./skill-installer-repo";
import {
  getPlatformRootDir,
  getPlatformSkillsDir,
  resolvePlatformPath,
} from "./skill-installer-utils";

interface CherryStudioSkillRow {
  id: string;
  folder_name: string;
}

interface CherryStudioAgentWorkspaceRow {
  accessible_paths: string;
}

export interface CherryStudioPlatformOptions {
  overrides?: Record<string, string>;
}

const CHERRY_STUDIO_PLATFORM_ID = "cherry-studio";
const CHERRY_STUDIO_DB_FILE = "cherrystudio.sqlite";
const CHERRY_STUDIO_SOURCE = "local";
const MAX_FOLDER_NAME_LENGTH = 80;

export function isCherryStudioPlatform(platformId: string): boolean {
  return platformId === CHERRY_STUDIO_PLATFORM_ID;
}

function getCherryStudioDbPath(
  platform: SkillPlatform,
  options?: CherryStudioPlatformOptions,
): string {
  return path.join(getCherryStudioRootDir(platform, options), CHERRY_STUDIO_DB_FILE);
}

function getCherryStudioRootDir(
  platform: SkillPlatform,
  options?: CherryStudioPlatformOptions,
): string {
  const overridePath = options?.overrides?.[platform.id];
  if (overridePath?.trim()) {
    return resolvePlatformPath(overridePath.trim());
  }
  return getPlatformRootDir(platform);
}

function getCherryStudioSkillsDir(
  platform: SkillPlatform,
  options?: CherryStudioPlatformOptions,
): string {
  const overridePath = options?.overrides?.[platform.id];
  if (!overridePath?.trim()) {
    return getPlatformSkillsDir(platform);
  }

  return path.join(
    resolvePlatformPath(overridePath.trim()),
    ...platform.skillsRelativePath.split(/[\\/]+/).filter(Boolean),
  );
}

function sanitizeCherryStudioFolderName(folderName: string): string {
  const sanitized = folderName
    .replace(/[/\\]/g, "_")
    .replace(/\0/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.slice(0, MAX_FOLDER_NAME_LENGTH);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copySkillRepoToCherryStudio(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    filter: async (_src, dest) => {
      const relativePath = path.relative(targetDir, dest);
      return !relativePath || !isInternalSkillRepoEntry(relativePath);
    },
  });
}

async function readSkillMd(sourceDir: string): Promise<string> {
  const skillMdPath = path.join(sourceDir, "SKILL.md");
  return fs.readFile(skillMdPath, "utf-8");
}

function parseJsonStringArray(rawValue: string | null | undefined): string[] {
  if (!rawValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

async function openCherryStudioDb(
  platform: SkillPlatform,
  options?: CherryStudioPlatformOptions,
): Promise<DatabaseAdapter.Database | null> {
  const dbPath = getCherryStudioDbPath(platform, options);
  if (!(await pathExists(dbPath))) {
    return null;
  }

  const db = new DatabaseAdapter(dbPath);
  const table = db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_global_skill'",
  );
  if (!table) {
    db.close();
    throw new Error("Cherry Studio database is missing agent_global_skill table");
  }
  return db;
}

async function requireCherryStudioDb(
  platform: SkillPlatform,
  options?: CherryStudioPlatformOptions,
): Promise<DatabaseAdapter.Database> {
  const db = await openCherryStudioDb(platform, options);
  if (!db) {
    throw new Error(
      `Cherry Studio database not found: ${getCherryStudioDbPath(platform, options)}`,
    );
  }
  return db;
}

function getExistingSkillRow(
  db: DatabaseAdapter.Database,
  folderName: string,
): CherryStudioSkillRow | undefined {
  return db.get(
    "SELECT id, folder_name FROM agent_global_skill WHERE folder_name = ? LIMIT 1",
    folderName,
  ) as CherryStudioSkillRow | undefined;
}

function upsertCherryStudioSkillRow(
  db: DatabaseAdapter.Database,
  skillName: string,
  folderName: string,
  skillMdContent: string,
): void {
  const parsed = parseSkillMd(skillMdContent);
  const metadata = parsed?.frontmatter;
  const now = Date.now();
  const existing = getExistingSkillRow(db, folderName);
  const contentHash = crypto
    .createHash("sha256")
    .update(skillMdContent)
    .digest("hex");
  const name = metadata?.name?.trim() || skillName;
  const description = metadata?.description?.trim() || null;
  const author = metadata?.author?.trim() || null;
  const tags = JSON.stringify(metadata?.tags ?? []);

  if (existing) {
    db.run(
      `UPDATE agent_global_skill
       SET name = ?, description = ?, author = ?, tags = ?, content_hash = ?, updated_at = ?
       WHERE id = ?`,
      name,
      description,
      author,
      tags,
      contentHash,
      now,
      existing.id,
    );
    return;
  }

  db.run(
    `INSERT INTO agent_global_skill
     (id, name, description, folder_name, source, source_url, namespace, author, tags, content_hash, is_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 0, ?, ?)`,
    crypto.randomUUID(),
    name,
    description,
    folderName,
    CHERRY_STUDIO_SOURCE,
    author,
    tags,
    contentHash,
    now,
    now,
  );
}

export async function installCherryStudioSkill(
  platform: SkillPlatform,
  skillName: string,
  sourceDir: string,
  options?: CherryStudioPlatformOptions,
): Promise<void> {
  const folderName = sanitizeCherryStudioFolderName(skillName);
  const skillsDir = getCherryStudioSkillsDir(platform, options);
  const targetDir = path.join(skillsDir, folderName);
  const skillMdContent = await readSkillMd(sourceDir);
  const db = await requireCherryStudioDb(platform, options);

  try {
    await fs.mkdir(skillsDir, { recursive: true });
    await copySkillRepoToCherryStudio(sourceDir, targetDir);
    upsertCherryStudioSkillRow(db, skillName, folderName, skillMdContent);
  } catch (error) {
    await fs.rm(targetDir, { recursive: true, force: true });
    throw error;
  } finally {
    db.close();
  }
}

export async function uninstallCherryStudioSkill(
  platform: SkillPlatform,
  skillName: string,
  options?: CherryStudioPlatformOptions,
): Promise<void> {
  const folderName = sanitizeCherryStudioFolderName(skillName);
  const skillsDir = getCherryStudioSkillsDir(platform, options);
  const targetDir = path.join(skillsDir, folderName);
  const db = await openCherryStudioDb(platform, options);

  if (!db) {
    await fs.rm(targetDir, { recursive: true, force: true });
    return;
  }

  try {
    const existing = getExistingSkillRow(db, folderName);
    if (existing) {
      await removeEnabledAgentSymlinks(db, existing.id, folderName);
      db.run("DELETE FROM agent_skill WHERE skill_id = ?", existing.id);
      db.run("DELETE FROM agent_global_skill WHERE id = ?", existing.id);
    }
    await fs.rm(targetDir, { recursive: true, force: true });
  } finally {
    db.close();
  }
}

export async function getCherryStudioSkillStatus(
  platform: SkillPlatform,
  skillName: string,
  options?: CherryStudioPlatformOptions,
): Promise<boolean> {
  const folderName = sanitizeCherryStudioFolderName(skillName);
  const skillMdPath = path.join(
    getCherryStudioSkillsDir(platform, options),
    folderName,
    "SKILL.md",
  );
  if (!(await pathExists(skillMdPath))) {
    return false;
  }

  const db = await openCherryStudioDb(platform, options);
  if (!db) {
    return false;
  }

  try {
    return Boolean(getExistingSkillRow(db, folderName));
  } finally {
    db.close();
  }
}

async function removeEnabledAgentSymlinks(
  db: DatabaseAdapter.Database,
  skillId: string,
  folderName: string,
): Promise<void> {
  const rows = db.all(
    `SELECT agent.accessible_paths
     FROM agent_skill
     JOIN agent ON agent.id = agent_skill.agent_id
     WHERE agent_skill.skill_id = ? AND agent_skill.is_enabled = 1`,
    skillId,
  ) as CherryStudioAgentWorkspaceRow[];

  for (const row of rows) {
    const workspace = parseJsonStringArray(row.accessible_paths)[0];
    if (!workspace) {
      continue;
    }

    const linkPath = path.join(workspace, ".claude", "skills", folderName);
    try {
      const stat = await fs.lstat(linkPath);
      if (stat.isSymbolicLink()) {
        await fs.unlink(linkPath);
      }
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
}
