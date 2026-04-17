-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "laneLength" INTEGER NOT NULL,
    "laneCount" INTEGER NOT NULL,
    "laneBeginners" INTEGER,
    "laneMedium" INTEGER,
    "laneAdvanced" INTEGER,
    "depth" TEXT,
    "waterTemp" INTEGER,
    "freeSwimHours" TEXT,
    "price" INTEGER,
    "bookingMethod" TEXT,
    "kickboard" BOOLEAN NOT NULL DEFAULT false,
    "buoy" BOOLEAN NOT NULL DEFAULT false,
    "paddle" BOOLEAN NOT NULL DEFAULT false,
    "fins" BOOLEAN NOT NULL DEFAULT false,
    "locker" TEXT,
    "shower" BOOLEAN NOT NULL DEFAULT true,
    "parking" BOOLEAN NOT NULL DEFAULT false,
    "lastVerified" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "visitedAt" DATETIME,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InfoUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfoUpdate_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Review_poolId_idx" ON "Review"("poolId");

-- CreateIndex
CREATE INDEX "InfoUpdate_poolId_idx" ON "InfoUpdate"("poolId");
