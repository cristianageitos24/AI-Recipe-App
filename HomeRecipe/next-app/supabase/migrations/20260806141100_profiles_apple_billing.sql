-- Dual billing: Apple IAP (RevenueCat) alongside Stripe for shared Pro gate
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_source TEXT
    CHECK (billing_source IS NULL OR billing_source = ANY (ARRAY['stripe'::text, 'apple'::text])),
  ADD COLUMN IF NOT EXISTS apple_entitlement_active BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.plan_tier IS
  'App entitlement: free | pro (shared Pro gate synced from Stripe OR Apple/RevenueCat webhooks)';
COMMENT ON COLUMN public.profiles.billing_source IS
  'Which store currently owns active Pro: stripe | apple | null when free';
COMMENT ON COLUMN public.profiles.apple_entitlement_active IS
  'True while RevenueCat reports HomeRecipe Pro entitlement active for this Clerk user id';
