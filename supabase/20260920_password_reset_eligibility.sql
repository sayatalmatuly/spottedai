-- Run this migration in the Supabase SQL Editor before enabling password reset.
-- It only exposes a yes/no result to the server-side service_role client.
CREATE OR REPLACE FUNCTION public.can_request_password_reset(requested_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS users
    INNER JOIN public.profiles AS profiles ON profiles.id = users.id
    WHERE lower(users.email) = lower(trim(requested_email))
      AND users.email_confirmed_at IS NOT NULL
      -- Existing projects may store this as either an enum or text.
      AND profiles.status::text = 'APPROVED'
  );
$$;

REVOKE ALL ON FUNCTION public.can_request_password_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_request_password_reset(text) TO service_role;

-- Make the new RPC function available to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
