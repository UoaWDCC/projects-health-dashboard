-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EXEC', 'MEMBER');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('GITHUB', 'DISCORD');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('GITHUB', 'DISCORD', 'ROLLUP', 'LLM');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonIdentity" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,

    CONSTRAINT "PersonIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedIdentity" (
    "id" TEXT NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "sampleRepoId" TEXT,

    CONSTRAINT "UnmatchedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordChannel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DiscordChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordWeeklyAggregate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueAuthors" INTEGER NOT NULL DEFAULT 0,
    "unmappedMessageCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordWeeklyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordIdentityWeeklyCount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "authorIdentityId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordIdentityWeeklyCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitFact" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "authorIdentityId" TEXT,
    "message" TEXT NOT NULL,
    "messageDisplay" TEXT,
    "branch" TEXT,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PRFact" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "authorIdentityId" TEXT,
    "mergedByIdentityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "labels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PRFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyRollup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "prsMerged" INTEGER NOT NULL DEFAULT 0,
    "discordMessages" INTEGER NOT NULL DEFAULT 0,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "commitsCumulative" INTEGER NOT NULL DEFAULT 0,
    "prsMergedCumulative" INTEGER NOT NULL DEFAULT 0,
    "discordMessagesCumulative" INTEGER NOT NULL DEFAULT 0,
    "linesAddedCumulative" INTEGER NOT NULL DEFAULT 0,
    "linesRemovedCumulative" INTEGER NOT NULL DEFAULT 0,
    "commitsAvg4w" DOUBLE PRECISION,
    "prsMergedAvg4w" DOUBLE PRECISION,
    "discordMessagesAvg4w" DOUBLE PRECISION,
    "linesAddedAvg4w" DOUBLE PRECISION,
    "linesRemovedAvg4w" DOUBLE PRECISION,
    "healthScore" DOUBLE PRECISION,
    "velocityScore" DOUBLE PRECISION,
    "sentimentScore" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "algorithmVersion" TEXT,

    CONSTRAINT "WeeklyRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberWeeklyContribution" (
    "id" TEXT NOT NULL,
    "projectMemberId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "commits" INTEGER NOT NULL DEFAULT 0,
    "prsMerged" INTEGER NOT NULL DEFAULT 0,
    "discordMessages" INTEGER NOT NULL DEFAULT 0,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MemberWeeklyContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "summaryText" TEXT NOT NULL,
    "sentimentText" TEXT,
    "concerns" JSONB NOT NULL DEFAULT '[]',
    "mvpProjectMemberId" TEXT,
    "lowContributorMemberIds" JSONB NOT NULL DEFAULT '[]',
    "llmModel" TEXT,
    "llmPromptVersion" TEXT,
    "llmInputHash" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalWeeklySummary" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "summaryText" TEXT NOT NULL,
    "llmModel" TEXT,
    "llmPromptVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalWeeklySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "projectId" TEXT,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PersonIdentity_provider_externalId_key" ON "PersonIdentity"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedIdentity_provider_externalId_key" ON "UnmatchedIdentity"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_owner_name_key" ON "Repository"("owner", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordChannel_externalId_key" ON "DiscordChannel"("externalId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_personId_key" ON "ProjectMember"("projectId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Config_scope_key_key" ON "Config"("scope", "key");

-- CreateIndex
CREATE INDEX "DiscordWeeklyAggregate_weekStart_idx" ON "DiscordWeeklyAggregate"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordWeeklyAggregate_projectId_weekStart_key" ON "DiscordWeeklyAggregate"("projectId", "weekStart");

-- CreateIndex
CREATE INDEX "DiscordIdentityWeeklyCount_authorIdentityId_weekStart_idx" ON "DiscordIdentityWeeklyCount"("authorIdentityId", "weekStart");

-- CreateIndex
CREATE INDEX "DiscordIdentityWeeklyCount_weekStart_idx" ON "DiscordIdentityWeeklyCount"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordIdentityWeeklyCount_projectId_weekStart_authorIdenti_key" ON "DiscordIdentityWeeklyCount"("projectId", "weekStart", "authorIdentityId");

-- CreateIndex
CREATE INDEX "CommitFact_repoId_committedAt_idx" ON "CommitFact"("repoId", "committedAt");

-- CreateIndex
CREATE INDEX "CommitFact_committedAt_idx" ON "CommitFact"("committedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommitFact_repoId_sha_key" ON "CommitFact"("repoId", "sha");

-- CreateIndex
CREATE INDEX "PRFact_repoId_mergedAt_idx" ON "PRFact"("repoId", "mergedAt");

-- CreateIndex
CREATE INDEX "PRFact_repoId_createdAt_idx" ON "PRFact"("repoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PRFact_repoId_number_key" ON "PRFact"("repoId", "number");

-- CreateIndex
CREATE INDEX "WeeklyRollup_weekStart_idx" ON "WeeklyRollup"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyRollup_projectId_weekStart_key" ON "WeeklyRollup"("projectId", "weekStart");

-- CreateIndex
CREATE INDEX "MemberWeeklyContribution_personId_weekStart_idx" ON "MemberWeeklyContribution"("personId", "weekStart");

-- CreateIndex
CREATE INDEX "MemberWeeklyContribution_weekStart_idx" ON "MemberWeeklyContribution"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "MemberWeeklyContribution_projectMemberId_weekStart_key" ON "MemberWeeklyContribution"("projectMemberId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySummary_projectId_weekStart_key" ON "WeeklySummary"("projectId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalWeeklySummary_weekStart_key" ON "GlobalWeeklySummary"("weekStart");

-- CreateIndex
CREATE INDEX "SyncJob_projectId_type_status_idx" ON "SyncJob"("projectId", "type", "status");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonIdentity" ADD CONSTRAINT "PersonIdentity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordChannel" ADD CONSTRAINT "DiscordChannel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Config" ADD CONSTRAINT "Config_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordWeeklyAggregate" ADD CONSTRAINT "DiscordWeeklyAggregate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordIdentityWeeklyCount" ADD CONSTRAINT "DiscordIdentityWeeklyCount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordIdentityWeeklyCount" ADD CONSTRAINT "DiscordIdentityWeeklyCount_authorIdentityId_fkey" FOREIGN KEY ("authorIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitFact" ADD CONSTRAINT "CommitFact_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitFact" ADD CONSTRAINT "CommitFact_authorIdentityId_fkey" FOREIGN KEY ("authorIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRFact" ADD CONSTRAINT "PRFact_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRFact" ADD CONSTRAINT "PRFact_authorIdentityId_fkey" FOREIGN KEY ("authorIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PRFact" ADD CONSTRAINT "PRFact_mergedByIdentityId_fkey" FOREIGN KEY ("mergedByIdentityId") REFERENCES "PersonIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRollup" ADD CONSTRAINT "WeeklyRollup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberWeeklyContribution" ADD CONSTRAINT "MemberWeeklyContribution_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "ProjectMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberWeeklyContribution" ADD CONSTRAINT "MemberWeeklyContribution_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySummary" ADD CONSTRAINT "WeeklySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
