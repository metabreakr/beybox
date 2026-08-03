/*
# Create profiles table

1. New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users on delete cascade)
  - `email` (text, not null — copied from auth.users at signup)
  - `display_name` (text, not null — the name shown beside the email
    on the account screen and the admin users table)
  - `role` (text, not null, default 'user' — 'user' or 'superadmin')
  - `plan` (text, not null, default 'free' — 'free' or 'pro')
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `profiles`.
- Each authenticated user can read and update only their own profile row.
- INSERT is handled server-side via the trigger function below,
  not by the frontend, so no INSERT policy is exposed.
- A trigger creates a profile row automatically when a new auth.user
  is created, pulling the display_name from the sign-up metadata.

3. Important Notes
- display_name is stored in raw_user_meta_data at sign-up time and
  copied into the profiles table by the handle_new_user trigger.
- The admin users table (future) reads profiles across all users;
  that will require a separate superadmin-scoped policy added later.
  For now, only self-access is allowed.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to create a profile row when a new auth user signs up.
-- display_name is read from raw_user_meta_data, which is where
-- supabase.auth.signUp stores the options.data passed from the frontend.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger: fires after a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
