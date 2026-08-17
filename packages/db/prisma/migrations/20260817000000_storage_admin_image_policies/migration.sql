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

-- Guarded so environments without Supabase's auth/storage objects skip this cleanly: Prisma's
-- shadow database, and the worker's integration-test container. Note the guard checks for
-- auth.uid() itself, not the auth schema — apps/worker/src/test-config/integration.global-setup.ts
-- scaffolds `auth` and `auth.users` to exercise the on_auth_user_created trigger, so the schema
-- exists there while auth.uid() does not. Guard on the object you actually depend on.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN

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

-- Same reasoning: guard on storage.objects and on is_admin() (created above, and skipped in the
-- same environments), since the policies below reference both.
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
