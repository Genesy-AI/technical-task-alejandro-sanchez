-- AlterTable
ALTER TABLE "lead" ADD COLUMN "phoneCountryCode" TEXT;
ALTER TABLE "lead" ADD COLUMN "phoneEnrichedAt" DATETIME;
ALTER TABLE "lead" ADD COLUMN "phoneEnrichmentStatus" TEXT;
ALTER TABLE "lead" ADD COLUMN "phoneProvider" TEXT;
