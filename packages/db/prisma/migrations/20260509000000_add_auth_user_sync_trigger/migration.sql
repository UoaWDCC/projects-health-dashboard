-- Fires handle_auth_user_sync() on every auth.users insert/update so that
-- Google OAuth logins (and any future provider) automatically upsert a Profile row.
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();
