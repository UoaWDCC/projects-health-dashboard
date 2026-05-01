DROP TABLE IF EXISTS "ContributorWeeklyEditedLines";

ALTER TABLE "LiveCommit"
DROP COLUMN IF EXISTS "linesAdded",
DROP COLUMN IF EXISTS "linesRemoved";