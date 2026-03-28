#!/usr/bin/env bash
# Require explicit confirmation before running migrations against the production database.
# Prod migrations use `prisma migrate deploy`, which only applies pending migration files
# and never resets or creates new ones — but the database being targeted is still production,
# so accidental runs should be prevented at the script level.
#
# Long-term: move prod migrations to a CI/CD pipeline (e.g. GitHub Actions with manual
# approval) so they cannot be triggered from a developer machine at all.
read -p "You are about to migrate PROD. Type 'yes' to continue: " confirm
if [ "$confirm" = "yes" ]; then
  dotenv -e .env -- pnpm --filter @repo/db db:deploy
else
  echo "Aborted."
  exit 1
fi
