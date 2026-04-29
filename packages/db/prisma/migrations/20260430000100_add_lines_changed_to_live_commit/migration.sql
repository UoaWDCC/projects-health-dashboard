-- Add line-change fields for live commit webhook rows.
ALTER TABLE "LiveCommit"
ADD COLUMN "linesAdded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "linesRemoved" INTEGER NOT NULL DEFAULT 0;
