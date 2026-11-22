-- UK is not an assigned ISO 3166-1 alpha-2 code. The United Kingdom is GB.
UPDATE "Lead" SET "countryCode" = 'GB' WHERE "countryCode" = 'UK';
