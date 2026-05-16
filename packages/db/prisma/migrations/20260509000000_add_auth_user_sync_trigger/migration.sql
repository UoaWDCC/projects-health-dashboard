-- Fires handle_auth_user_sync() on every auth.users insert/update so that
-- Google OAuth logins (and any future provider) automatically upsert a Profile row.
-- Guarded by an auth schema check so Prisma's shadow DB (plain Postgres, no auth schema) can apply this cleanly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();
  END IF;
END
$$;
