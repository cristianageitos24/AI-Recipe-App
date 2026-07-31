-- Meal calendar and grocery features are Pro-only.
-- App actions enforce this too; these policies prevent direct Data API bypasses.

DROP POLICY IF EXISTS "Users manage own meal_dates" ON public.meal_dates;
CREATE POLICY "Pro users manage own meal_dates"
  ON public.meal_dates
  FOR ALL
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  )
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  );

DROP POLICY IF EXISTS "Users manage meal_date_recipes of own meal_dates"
  ON public.meal_date_recipes;
CREATE POLICY "Pro users manage own meal_date_recipes"
  ON public.meal_date_recipes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_dates m
      WHERE m.id = meal_date_id
        AND m.user_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meal_dates m
      WHERE m.id = meal_date_id
        AND m.user_id = (auth.jwt() ->> 'sub')
    )
  );

DROP POLICY IF EXISTS "Users manage own grocery_items" ON public.grocery_items;
CREATE POLICY "Pro users manage own grocery_items"
  ON public.grocery_items
  FOR ALL
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  )
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  );

DROP POLICY IF EXISTS "Users manage own grocery_trips" ON public.grocery_trips;
CREATE POLICY "Pro users manage own grocery_trips"
  ON public.grocery_trips
  FOR ALL
  TO authenticated
  USING (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  )
  WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (auth.jwt() ->> 'sub')
        AND (
          p.plan_tier = 'pro'
          OR p.stripe_subscription_status IN ('active', 'trialing')
        )
    )
  );
