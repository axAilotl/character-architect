import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { UserPreset, CreatePresetRequest, UpdatePresetRequest } from '../types/index.js';
import { DEFAULT_PRESETS } from '@card-architect/defaults';

export class PresetRepository {
  constructor(private db: Database.Database) {}

  /**
   * Initialize built-in presets if they don't exist
   */
  initializeBuiltInPresets(): void {
    const builtInPresets: Omit<UserPreset, 'id' | 'createdAt' | 'updatedAt'>[] = DEFAULT_PRESETS;

    const now = new Date().toISOString();

    for (const preset of builtInPresets) {
      // Check if preset with this name already exists
      const existing = this.db
        .prepare('SELECT id FROM llm_presets WHERE name = ? AND is_built_in = 1')
        .get(preset.name);

      if (!existing) {
        const id = randomUUID();
        this.db
          .prepare(
            `INSERT INTO llm_presets (id, name, description, instruction, category, is_built_in, is_hidden, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            preset.name,
            preset.description || null,
            preset.instruction,
            preset.category || null,
            preset.isBuiltIn ? 1 : 0,
            preset.isHidden ? 1 : 0,
            now,
            now
          );
      }
    }
  }

  /**
   * Get all presets (built-in + user-defined)
   */
  getAll(): UserPreset[] {
    const rows = this.db
      .prepare('SELECT * FROM llm_presets ORDER BY is_built_in DESC, category, name')
      .all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      instruction: row.instruction,
      category: row.category,
      isBuiltIn: row.is_built_in === 1,
      isHidden: row.is_hidden === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get visible presets only (excludes hidden)
   */
  getVisible(): UserPreset[] {
    const rows = this.db
      .prepare('SELECT * FROM llm_presets WHERE is_hidden = 0 ORDER BY is_built_in DESC, category, name')
      .all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      instruction: row.instruction,
      category: row.category,
      isBuiltIn: row.is_built_in === 1,
      isHidden: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get preset by ID
   */
  getById(id: string): UserPreset | null {
    const row = this.db.prepare('SELECT * FROM llm_presets WHERE id = ?').get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instruction: row.instruction,
      category: row.category,
      isBuiltIn: row.is_built_in === 1,
      isHidden: row.is_hidden === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Toggle hidden state for a preset
   */
  toggleHidden(id: string): UserPreset | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const newHidden = existing.isHidden ? 0 : 1;
    const now = new Date().toISOString();

    this.db.prepare('UPDATE llm_presets SET is_hidden = ?, updated_at = ? WHERE id = ?').run(newHidden, now, id);

    return this.getById(id);
  }

  /**
   * Copy a preset (including built-in) as a new user preset
   */
  copy(id: string, newName?: string): UserPreset | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const newId = randomUUID();
    const name = newName || `${existing.name} (Copy)`;

    this.db
      .prepare(
        `INSERT INTO llm_presets (id, name, description, instruction, category, is_built_in, is_hidden, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
      )
      .run(
        newId,
        name,
        existing.description,
        existing.instruction,
        existing.category,
        now,
        now
      );

    return this.getById(newId);
  }

  /**
   * Create new user preset
   */
  create(data: CreatePresetRequest): UserPreset {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO llm_presets (id, name, description, instruction, category, is_built_in, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        data.name,
        data.description || null,
        data.instruction,
        data.category || null,
        now,
        now
      );

    return this.getById(id)!;
  }

  /**
   * Update user preset (cannot update built-in presets)
   */
  update(data: UpdatePresetRequest): UserPreset | null {
    const existing = this.getById(data.id);
    if (!existing) return null;
    if (existing.isBuiltIn) {
      throw new Error('Cannot modify built-in presets');
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }
    if (data.instruction !== undefined) {
      updates.push('instruction = ?');
      values.push(data.instruction);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      values.push(data.category || null);
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(data.id);

    this.db.prepare(`UPDATE llm_presets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.getById(data.id);
  }

  /**
   * Delete user preset (cannot delete built-in presets)
   */
  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;
    if (existing.isBuiltIn) {
      throw new Error('Cannot delete built-in presets');
    }

    const result = this.db.prepare('DELETE FROM llm_presets WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
