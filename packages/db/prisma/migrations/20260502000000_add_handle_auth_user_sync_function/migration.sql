CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public."Profile" (
    "id",
    "email",
    "displayName",
    "isActive",
    "lastSignInAt",
    "createdAt"
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    true,
    NEW.last_sign_in_at,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    "email" = EXCLUDED."email",
    "displayName" = EXCLUDED."displayName",
    "lastSignInAt" = EXCLUDED."lastSignInAt",
    "isActive" = EXCLUDED."isActive";

  RETURN NEW;
END;
$$;
