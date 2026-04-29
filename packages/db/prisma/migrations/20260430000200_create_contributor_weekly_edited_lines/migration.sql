CREATE TABLE "ContributorWeeklyEditedLines" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorWeeklyEditedLines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributorWeeklyEditedLines_username_repoId_weekStart_key"
    ON "ContributorWeeklyEditedLines"("username", "repoId", "weekStart");

CREATE INDEX "ContributorWeeklyEditedLines_repoId_weekStart_idx"
    ON "ContributorWeeklyEditedLines"("repoId", "weekStart");

CREATE INDEX "ContributorWeeklyEditedLines_weekStart_idx"
    ON "ContributorWeeklyEditedLines"("weekStart");

ALTER TABLE "ContributorWeeklyEditedLines"
    ADD CONSTRAINT "ContributorWeeklyEditedLines_repoId_fkey"
    FOREIGN KEY ("repoId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
