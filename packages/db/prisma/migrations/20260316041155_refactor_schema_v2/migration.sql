/*
  Warnings:

  - The values [ROLLUP] on the enum `SyncJobType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `messageDisplay` on the `CommitFact` table. All the data in the column will be lost.
  - You are about to drop the column `guildId` on the `DiscordChannel` table. All the data in the column will be lost.
  - You are about to drop the column `sampleRepoId` on the `UnmatchedIdentity` table. All the data in the column will be lost.
  - You are about to drop the column `concerns` on the `WeeklySummary` table. All the data in the column will be lost.
  - You are about to drop the column `lowContributorMemberIds` on the `WeeklySummary` table. All the data in the column will be lost.
  - You are about to drop the column `mvpProjectMemberId` on the `WeeklySummary` table. All the data in the column will be lost.
  - You are about to drop the column `sentimentText` on the `WeeklySummary` table. All the data in the column will be lost.
  - You are about to drop the `Repository` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WeeklyRollup` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[personId,provider]` on the table `PersonIdentity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `notableChanges` to the `GlobalWeeklySummary` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SyncJobType_new" AS ENUM ('GITHUB', 'DISCORD', 'LLM');
ALTER TABLE "SyncJob" ALTER COLUMN "type" TYPE "SyncJobType_new" USING ("type"::text::"SyncJobType_new");
ALTER TYPE "SyncJobType" RENAME TO "SyncJobType_old";
ALTER TYPE "SyncJobType_new" RENAME TO "SyncJobType";
DROP TYPE "SyncJobType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "CommitFact" DROP CONSTRAINT "CommitFact_repoId_fkey";

-- DropForeignKey
ALTER TABLE "PRFact" DROP CONSTRAINT "PRFact_repoId_fkey";

-- DropForeignKey
ALTER TABLE "Repository" DROP CONSTRAINT "Repository_projectId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyRollup" DROP CONSTRAINT "WeeklyRollup_projectId_fkey";

-- DropIndex
DROP INDEX "CommitFact_committedAt_idx";

-- AlterTable
ALTER TABLE "CommitFact" DROP COLUMN "messageDisplay";

-- AlterTable
ALTER TABLE "DiscordChannel" DROP COLUMN "guildId";

-- AlterTable
ALTER TABLE "GlobalWeeklySummary" ADD COLUMN     "flaggedAvg4wProjects" JSONB,
ADD COLUMN     "flaggedWeekProjects" JSONB,
ADD COLUMN     "llmInputHash" TEXT,
ADD COLUMN     "notableChanges" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SyncJob" ADD COLUMN     "itemsProcessed" INTEGER;

-- AlterTable
ALTER TABLE "UnmatchedIdentity" DROP COLUMN "sampleRepoId",
ADD COLUMN     "sampleRepoName" TEXT;

-- AlterTable
ALTER TABLE "WeeklySummary" DROP COLUMN "concerns",
DROP COLUMN "lowContributorMemberIds",
DROP COLUMN "mvpProjectMemberId",
DROP COLUMN "sentimentText",
ADD COLUMN     "sentimentParagraph" TEXT,
ADD COLUMN     "sentimentScore" DOUBLE PRECISION;

-- DropTable
DROP TABLE "Repository";

-- DropTable
DROP TABLE "WeeklyRollup";

-- CreateTable
CREATE TABLE "GitHubRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,

    CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStats" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "prsMerged" INTEGER NOT NULL DEFAULT 0,
    "discordMessages" INTEGER NOT NULL DEFAULT 0,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "commitsAvg4w" DOUBLE PRECISION,
    "prsMergedAvg4w" DOUBLE PRECISION,
    "discordMessagesAvg4w" DOUBLE PRECISION,
    "linesAddedAvg4w" DOUBLE PRECISION,
    "linesRemovedAvg4w" DOUBLE PRECISION,
    "commitsCumulative" INTEGER,
    "prsMergedCumulative" INTEGER,
    "discordMessagesCumulative" INTEGER,
    "linesAddedCumulative" INTEGER,
    "linesRemovedCumulative" INTEGER,
    "healthScore" DOUBLE PRECISION,
    "velocityScore" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "mvpMemberId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "algorithmVersion" TEXT,

    CONSTRAINT "WeeklyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveCommit" (
    "id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "shortSha" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "projectId" TEXT,
    "branch" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "commitUrl" TEXT,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveCommit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubRepository_owner_name_key" ON "GitHubRepository"("owner", "name");

-- CreateIndex
CREATE INDEX "WeeklyStats_weekStart_idx" ON "WeeklyStats"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyStats_projectId_weekStart_key" ON "WeeklyStats"("projectId", "weekStart");

-- CreateIndex
CREATE INDEX "LiveCommit_receivedAt_idx" ON "LiveCommit"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveCommit_repoOwner_repoName_sha_key" ON "LiveCommit"("repoOwner", "repoName", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "PersonIdentity_personId_provider_key" ON "PersonIdentity"("personId", "provider");

-- AddForeignKey
ALTER TABLE "GitHubRepository" ADD CONSTRAINT "GitHubRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitFact" ADD CONSTRAINT "CommitFact_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRFact" ADD CONSTRAINT "PRFact_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStats" ADD CONSTRAINT "WeeklyStats_mvpMemberId_fkey" FOREIGN KEY ("mvpMemberId") REFERENCES "ProjectMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStats" ADD CONSTRAINT "WeeklyStats_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
