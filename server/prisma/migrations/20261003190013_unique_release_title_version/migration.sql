/*
  Warnings:

  - A unique constraint covering the columns `[title,version]` on the table `releases` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "releases_title_version_key" ON "releases"("title", "version");
