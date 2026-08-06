/**
 * Editable profile facts live in Supabase `profiles`.
 * Web writes Supabase (+ best-effort Clerk name); RevenueCat sync is mobile-only.
 */

/** Normalize optional phone for storage (empty → null). */
export function normalizePhoneInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Normalize display name (empty → null). */
export function normalizeDisplayNameInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

/**
 * Accept empty or YYYY-MM-DD. Rejects clearly invalid / future dates.
 */
export function normalizeBirthdayInput(raw: string): {
  value: string | null;
  error: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { value: null, error: "Use birthday format YYYY-MM-DD" };
  }

  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { value: null, error: "Enter a valid birthday" };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) {
    return { value: null, error: "Birthday cannot be in the future" };
  }

  return { value: trimmed, error: null };
}

export function lightPhoneLooksOk(phone: string | null): boolean {
  if (!phone) return true;
  // Allow digits, spaces, +, -, (), common formatting; require some digits.
  if (!/^[+\d\s().-]{7,20}$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function birthdayFromDb(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    // Postgres date may arrive as YYYY-MM-DD or ISO timestamp.
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value.trim() || null;
  }
  return null;
}
