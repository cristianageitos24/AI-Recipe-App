/** Shared result shape for soft-delete / restore server actions (cookbooks + recipes). */
export type TrashActionReason =
  | "forbidden"
  | "not_found"
  | "not_restorable"
  | "already_trashed"
  | "already_active";

export type TrashActionResult =
  | { ok: true; state: "trashed" | "restored"; folderId?: string; recipeId?: string }
  | { ok: false; reason: TrashActionReason };
