-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "isDesigner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeveloper" BOOLEAN NOT NULL DEFAULT false;
