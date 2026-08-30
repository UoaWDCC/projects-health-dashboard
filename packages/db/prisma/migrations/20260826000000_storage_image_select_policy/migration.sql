-- Completes 20260817000000_storage_admin_image_policies, which added INSERT and UPDATE policies
-- on storage.objects but no SELECT policy, so every upload still failed with
-- "new row violates row-level security policy".
--
-- The Storage API's upload query is:
--   INSERT INTO storage.objects (...) VALUES (...)
--   ON CONFLICT (name, bucket_id) DO UPDATE SET ... RETURNING *
--
-- Under RLS, RETURNING requires the returned row to satisfy SELECT policies, and
-- ON CONFLICT DO UPDATE additionally requires SELECT to read the conflicting row. With no
-- SELECT policy, a bare INSERT passes on the INSERT policy alone but this query never can --
-- neither the first upload to a fresh path nor a replacement.
--
-- Verified against Postgres 16 with this schema reproduced: with the SELECT policy, an admin
-- upload succeeds and a non-admin write is denied, a non-admin sees zero rows, and a write to
-- any other bucket is denied. `authenticated` needs no grant on the public schema for this --
-- is_admin() is reached through the policy expression, not by a direct call from the session.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
  ) AND EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN

    DROP POLICY IF EXISTS "Admins can read entity images" ON storage.objects;

    CREATE POLICY "Admins can read entity images"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id IN ('project-images', 'person-images')
        AND public.is_admin()
      );

  END IF;
END
$$;
