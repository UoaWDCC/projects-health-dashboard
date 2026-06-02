-- AlterTable
ALTER TABLE "DiscordChannel" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "GitHubRepository" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
