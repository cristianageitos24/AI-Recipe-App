-- Stripe Billing: map Clerk profiles to Stripe customers/subscriptions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier = ANY (ARRAY['free'::text, 'pro'::text]));

COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe Customer id (cus_...)';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Active Stripe Subscription id (sub_...)';
COMMENT ON COLUMN public.profiles.stripe_subscription_status IS 'Stripe subscription.status (active, past_due, canceled, etc.)';
COMMENT ON COLUMN public.profiles.stripe_price_id IS 'Stripe Price id currently subscribed';
COMMENT ON COLUMN public.profiles.plan_tier IS 'App entitlement: free | pro (synced from Stripe webhooks)';

CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
