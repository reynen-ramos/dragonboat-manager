import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repo } from '../repo';
import { newId } from '@/utils/ids';
import type { EntityMapper } from './mapping';

/**
 * The generic Repo<T> over one Postgres table.
 *
 * Reads are fetch-all-then-filter-in-memory only at the page layer — here a
 * `filter` becomes a real WHERE clause, and every row is scoped to the active
 * club. Ids are generated client-side (as the mock does), so create and
 * restore share one identity story across adapters.
 */

/** Every supabase-js response carries `error`; a throw is what the app expects. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export function makeSupabaseRepo<T extends { id: string }>(
  client: SupabaseClient,
  clubId: () => Promise<string>,
  mapper: EntityMapper<T>,
  options: {
    /**
     * Reads go here instead of the table — how members are read through the
     * privacy-filtering `member_directory` view while writes (staff-only by
     * policy anyway) still hit the table.
     */
    readFrom?: string;
  } = {},
): Repo<T> {
  const from = () => client.from(mapper.table);
  const readFrom = () => client.from(options.readFrom ?? mapper.table);

  const where = (filter?: Partial<T>): Record<string, unknown> => {
    const match: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(filter ?? {})) {
      // Undefined filter values mean "any", exactly as the mock's matcher.
      if (value !== undefined) match[mapper.column(field)] = value;
    }
    return match;
  };

  return {
    async list(filter) {
      const cid = await clubId();
      const rows = unwrap(
        await readFrom().select('*').eq('club_id', cid).match(where(filter)).order('created_at'),
      );
      return (rows as Record<string, unknown>[]).map((row) => mapper.fromRow(row));
    },

    async get(id) {
      const cid = await clubId();
      const row = unwrap(
        await readFrom().select('*').eq('club_id', cid).eq('id', id).maybeSingle(),
      );
      return row ? mapper.fromRow(row as Record<string, unknown>) : undefined;
    },

    async create(input) {
      return (await this.createMany([input]))[0];
    },

    async createMany(inputs) {
      if (inputs.length === 0) return [];
      const cid = await clubId();
      const rows = inputs.map((input) => mapper.toRow({ ...input, id: newId() } as T, cid));
      const created = unwrap(await from().insert(rows).select());
      return (created as Record<string, unknown>[]).map((row) => mapper.fromRow(row));
    },

    async update(id, patch) {
      const cid = await clubId();
      const row = unwrap(
        await from()
          .update(mapper.toPatch(patch as Record<string, unknown>))
          .eq('club_id', cid)
          .eq('id', id)
          .select()
          .maybeSingle(),
      );
      if (!row) throw new Error(`No ${mapper.table} with id ${id}`);
      return mapper.fromRow(row as Record<string, unknown>);
    },

    async remove(id) {
      const cid = await clubId();
      unwrap(await from().delete().eq('club_id', cid).eq('id', id));
    },

    async removeMany(ids) {
      if (ids.length === 0) return;
      const cid = await clubId();
      unwrap(await from().delete().eq('club_id', cid).in('id', ids));
    },

    async bulkUpdate(patches) {
      if (patches.length === 0) return [];
      const cid = await clubId();
      // Read-merge-upsert: a documented, benign race at club concurrency.
      // The two paths where partial application would corrupt state
      // (replaceForCrew, applyChanges) go through transactional RPCs instead.
      const current = unwrap(
        await from().select('*').eq('club_id', cid).in('id', patches.map((p) => p.id)),
      ) as Record<string, unknown>[];
      const byId = new Map(current.map((row) => [row.id as string, row]));
      const merged = patches
        .filter((p) => byId.has(p.id))
        .map((p) => ({ ...byId.get(p.id)!, ...mapper.toPatch(p.patch as Record<string, unknown>) }));
      const rows = unwrap(await from().upsert(merged).select());
      return (rows as Record<string, unknown>[]).map((row) => mapper.fromRow(row));
    },

    async restoreMany(rowsToRestore) {
      if (rowsToRestore.length === 0) return;
      const cid = await clubId();
      unwrap(
        await from().upsert(
          rowsToRestore.map((row) => mapper.toRow(row, cid)),
          // Identity is per club: ids only collide within one.
          { onConflict: 'club_id,id', ignoreDuplicates: true },
        ),
      );
    },
  };
}
