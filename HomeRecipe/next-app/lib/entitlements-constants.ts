/** Client-safe freemium constants (no server imports). */
export const FREE_EXTRACTION_LIMIT = 3;
export const FREE_RECIPE_TTL_DAYS = 30;
export const FREE_RESTORE_GRACE_DAYS = 7;

export type PlanLimitReason =
  | "catalog"
  | "nutrition"
  | "extractions"
  | "expiry"
  | "planning";
