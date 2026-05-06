/**
 * Soft-delete retention window. Must stay aligned with `purge_trashed_rows` in
 * supabase/migrations/039_trash_purge_cron.sql (`interval '7 days'`).
 */
export const TRASH_RETENTION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * MS_PER_DAY;

/** Earliest `deleted_at` still eligible for listing (not yet purged). Use with `.gte("deleted_at", cutoff)`. */
export function trashListCutoffIso(): string {
  return new Date(Date.now() - TRASH_RETENTION_MS).toISOString();
}

/** Unix ms when the row will be hard-deleted if still trashed. */
export function permanentDeletionTimestamp(deletedAt: string | Date): number {
  const t =
    typeof deletedAt === "string" ? Date.parse(deletedAt) : deletedAt.getTime();
  return t + TRASH_RETENTION_MS;
}

/**
 * Human-readable time until permanent deletion from `deleted_at`.
 * Clamps at zero (purge may run slightly before/after client clock).
 */
export function formatTimeRemainingUntilDeletion(
  deletedAt: string | Date,
  nowMs: number = Date.now()
): string {
  const end = permanentDeletionTimestamp(deletedAt);
  const ms = Math.max(0, end - nowMs);
  if (ms < 60_000) return "Less than a minute";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.floor(ms / 86_400_000);
  return days === 1 ? "1 day" : `${days} days`;
}
