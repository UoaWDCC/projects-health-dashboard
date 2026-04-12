/*
  Warnings:

  - The primary key for the `CommitFact` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Config` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DiscordChannel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DiscordIdentityWeeklyCount` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DiscordWeeklyAggregate` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `GitHubRepository` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `GlobalWeeklySummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `LiveCommit` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MemberWeeklyContribution` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PRFact` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Person` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PersonIdentity` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Project` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ProjectMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SyncJob` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `UnmatchedIdentity` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `UserRole` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `WeeklyStats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `WeeklySummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `CommitFact` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Config` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `DiscordChannel` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `DiscordIdentityWeeklyCount` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `DiscordWeeklyAggregate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `GitHubRepository` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `GlobalWeeklySummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `LiveCommit` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `MemberWeeklyContribution` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `PRFact` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Person` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `PersonIdentity` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ProjectMember` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `SyncJob` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `UnmatchedIdentity` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `UserRole` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `WeeklyStats` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `WeeklySummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "CommitFact" DROP CONSTRAINT "CommitFact_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "CommitFact_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Config" DROP CONSTRAINT "Config_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Config_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DiscordChannel" DROP CONSTRAINT "DiscordChannel_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "DiscordChannel_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DiscordIdentityWeeklyCount" DROP CONSTRAINT "DiscordIdentityWeeklyCount_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "DiscordIdentityWeeklyCount_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DiscordWeeklyAggregate" DROP CONSTRAINT "DiscordWeeklyAggregate_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "DiscordWeeklyAggregate_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "GitHubRepository" DROP CONSTRAINT "GitHubRepository_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "GlobalWeeklySummary" DROP CONSTRAINT "GlobalWeeklySummary_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "GlobalWeeklySummary_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "LiveCommit" DROP CONSTRAINT "LiveCommit_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "LiveCommit_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MemberWeeklyContribution" DROP CONSTRAINT "MemberWeeklyContribution_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "MemberWeeklyContribution_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PRFact" DROP CONSTRAINT "PRFact_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "PRFact_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Person" DROP CONSTRAINT "Person_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Person_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PersonIdentity" DROP CONSTRAINT "PersonIdentity_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "PersonIdentity_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Project" DROP CONSTRAINT "Project_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SyncJob" DROP CONSTRAINT "SyncJob_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "UnmatchedIdentity" DROP CONSTRAINT "UnmatchedIdentity_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "UnmatchedIdentity_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "WeeklyStats" DROP CONSTRAINT "WeeklyStats_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "WeeklyStats_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "WeeklySummary" DROP CONSTRAINT "WeeklySummary_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "WeeklySummary_pkey" PRIMARY KEY ("id");
