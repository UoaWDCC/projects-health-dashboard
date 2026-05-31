CREATE OR REPLACE FUNCTION trim_live_commits()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM "LiveCommit"
  WHERE id NOT IN (
    SELECT id FROM "LiveCommit"
    ORDER BY "committedAt" DESC
    LIMIT 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
