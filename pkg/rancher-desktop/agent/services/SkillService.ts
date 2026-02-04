import { EnabledSkillRecord, getPersistenceService } from './PersistenceService';
import { catalog } from '../skills/catalog';

import fs from 'fs';
import path from 'path';

import paths from '@pkg/utils/paths';

export interface SkillCatalogEntry {
  id: string;
  name: string;
  publisher: string;
  icon?: string;
  shortDescription: string;
  tags: string[];
  rating: number;
  activeInstalls: number;
  version: string;
  lastUpdated: string;
  metaSource?: 'builtin' | 'userData' | 'remote';
  metaPath?: string;
  metaUrl?: string;
}

export interface SkillMeta {
  id: string;
  title: string;
  description: string;
  how_to_run: string;
  tags?: string[];
  entrypoint?: string;
  [key: string]: unknown;
}

export class SkillService {
  private initialized = false;

  private getPackagedResourcesRoot(): string | null {
    // electron-builder copies the repo's `resources/` directory into
    // `<process.resourcesPath>/resources/` (Option A).
    // In development, `process.cwd()` is typically the app root where a `resources/` folder exists.
    const candidates = [
      path.join(process.resourcesPath || '', 'resources'),
      path.join(process.cwd(), 'resources'),
    ].filter(Boolean);

    for (const c of candidates) {
      try {
        if (c && fs.existsSync(c)) {
          return c;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const persistence = getPersistenceService();
    await persistence.initialize();

    this.initialized = true;
  }

  async listCatalog(): Promise<SkillCatalogEntry[]> {
    await this.initialize();

    const raw = catalog.skills;

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw as SkillCatalogEntry[];
  }

  async getCatalogEntryById(id: string): Promise<SkillCatalogEntry | null> {
    const catalog = await this.listCatalog();
    return catalog.find(s => s.id === id) ?? null;
  }

  async getSkillMetaById(id: string): Promise<SkillMeta | null> {
    await this.initialize();

    const entry = await this.getCatalogEntryById(id);

    // Prefer installed meta.json from the runtime userData directory.
    // This is the authoritative source once a skill is installed.
    try {
      const installedMetaPath = path.join(paths.appHome, 'skills', 'installed', id, 'meta.json');
      if (fs.existsSync(installedMetaPath)) {
        const raw = fs.readFileSync(installedMetaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as SkillMeta;
        }
      }
    } catch {
      // ignore and fall back
    }

    // If the catalog indicates this is a baked-in skill, load meta.json from packaged resources.
    if (entry?.metaSource === 'builtin' && entry.metaPath) {
      const root = this.getPackagedResourcesRoot();
      if (root) {
        try {
          const p = path.join(root, entry.metaPath);
          if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              return parsed as SkillMeta;
            }
          }
        } catch {
          // ignore and fall through
        }
      }
    }

    if (entry?.metaUrl) {
      try {
        return await this.fetchMeta(entry.metaUrl);
      } catch {
        // Ignore and fall back below.
      }
    }

    return null;
  }

  async fetchMeta(metaUrl: string): Promise<SkillMeta> {
    const resp = await fetch(metaUrl);

    if (!resp.ok) {
      throw new Error(`Failed to fetch skill meta: ${ resp.status }`);
    }

    const data = await resp.json();

    if (!data || typeof data !== 'object') {
      throw new Error('Skill meta response is not an object');
    }

    return data as SkillMeta;
  }

  async enableSkill(meta: SkillMeta): Promise<void> {
    await this.initialize();

    const catalogEntry = await this.getCatalogEntryById(meta.id);

    const persistence = getPersistenceService();

    await persistence.enableSkill({
      id:          meta.id,
      title:       meta.title,
      description: meta.description,
      how_to_run:  meta.how_to_run,
      meta:        {
        ...meta,
        metaSource: catalogEntry?.metaSource,
        metaPath:   catalogEntry?.metaPath,
      },
    });
  }

  async disableSkill(id: string): Promise<void> {
    await this.initialize();

    const persistence = getPersistenceService();

    await persistence.disableSkill(id);
  }

  async isSkillEnabled(id: string): Promise<boolean> {
    await this.initialize();

    const persistence = getPersistenceService();

    return await persistence.isSkillEnabled(id);
  }

  async isSkillInstalled(id: string): Promise<boolean> {
    // Check if skill exists in userData directory
    const userPath = path.join(paths.appHome, 'skills', 'installed', id, 'meta.json');
    if (fs.existsSync(userPath)) {
      return true;
    }

    // Check if skill exists in packaged resources (builtin)
    const entry = await this.getCatalogEntryById(id);
    if (entry?.metaSource === 'builtin' && entry.metaPath) {
      const root = this.getPackagedResourcesRoot();
      if (root) {
        const builtinPath = path.join(root, entry.metaPath);
        if (fs.existsSync(builtinPath)) {
          return true;
        }
      }
    }

    return false;
  }

  async installSkill(id: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    const entry = await this.getCatalogEntryById(id);
    if (!entry) {
      return { success: false, error: `Skill not found in catalog: ${id}` };
    }

    // For builtin skills, they're already installed
    if (entry.metaSource === 'builtin') {
      return { success: true };
    }

    // For remote skills, we would download and install
    // For now, just return success if the skill exists in catalog
    // TODO: Implement actual download/install for remote skills
    return { success: true };
  }

  async listEnabledSkills(): Promise<EnabledSkillRecord[]> {
    await this.initialize();

    const persistence = getPersistenceService();

    return await persistence.listEnabledSkills();
  }
}

let instance: SkillService | null = null;

export function getSkillService(): SkillService {
  if (!instance) {
    instance = new SkillService();
  }

  return instance;
}
