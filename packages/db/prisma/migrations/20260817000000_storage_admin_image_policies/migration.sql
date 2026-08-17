-- Allow admins to upload project/person images to Supabase Storage.
--
-- Files in Storage are rows in storage.objects, which has RLS enabled by default. The buckets are
-- created with `public: true` (scripts/setup-storage.ts), but that only governs READS — writes are
-- still denied unless a policy permits them. With no write policy, every upload failed with
-- "new row violates row-level security policy".
--
-- Admin status lives in public."UserRole", not in a JWT claim, so the policy has to read that table.
-- The `authenticated` role has no grants on the public schema (only service_role does, see
-- 20260510031636_grant_service_role_public_schema), so the lookup goes through a SECURITY DEFINER
-- function instead of granting `authenticated` direct SELECT on "UserRole" — that would expose every
-- user's roles through PostgREST.

-- Guarded so Prisma's shadow database (plain Postgres, no auth/storage schemas) can apply this cleanly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN

    -- Runs as the function owner, so it can read "UserRole" without that table being readable by
    -- `authenticated`. Callers can only ask about themselves — auth.uid() is not a parameter.
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER SET search_path = public
    AS $fn$
      SELECT EXISTS (
        SELECT 1
        FROM public."UserRole"
        WHERE "userId" = auth.uid()::text
          AND role = 'ADMIN'::public."Role"
      );
    $fn$;

    REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN

    DROP POLICY IF EXISTS "Admins can upload entity images" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can replace entity images" ON storage.objects;

    CREATE POLICY "Admins can upload entity images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id IN ('project-images', 'person-images')
        AND public.is_admin()
      );

    -- uploadImage() passes { upsert: true } with a fixed path of "<entityId>/image"
    -- (apps/web/src/lib/storage.ts), so replacing an image UPDATEs the existing row rather than
    -- inserting a new one. Without this second policy the first upload succeeds and every
    -- replacement fails with the same RLS error.
    CREATE POLICY "Admins can replace entity images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id IN ('project-images', 'person-images')
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id IN ('project-images', 'person-images')
        AND public.is_admin()
      );

  END IF;
END
$$;
