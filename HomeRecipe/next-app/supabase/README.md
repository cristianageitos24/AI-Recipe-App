# Supabase setup

1. In Supabase Dashboard: **SQL Editor** → New query.
2. Paste and run the contents of `migrations/001_initial_schema.sql`.
3. This creates: `profiles`, `recipes`, `user_recipes`, `folders`, `folder_recipes`, `favorites`, `meal_dates`, `meal_date_recipes`, RLS policies, and a trigger to create a profile on signup.
