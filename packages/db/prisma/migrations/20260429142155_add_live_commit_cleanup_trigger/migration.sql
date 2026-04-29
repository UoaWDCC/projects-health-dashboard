CREATE OR REPLACE FUNCTION trim_live_commits()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM "LiveCommit"
  WHERE id NOT IN (
    SELECT id FROM "LiveCommit"
    ORDER BY "receivedAt" DESC
    LIMIT 10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trim_live_commits_trigger
AFTER INSERT ON "LiveCommit"
FOR EACH ROW EXECUTE FUNCTION trim_live_commits();
