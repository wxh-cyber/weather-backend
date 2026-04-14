CREATE TABLE `RefreshToken` (
  `tokenId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `userId` VARCHAR(191) NOT NULL,

  INDEX `RefreshToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
  PRIMARY KEY (`tokenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `City` (
  `cityId` VARCHAR(191) NOT NULL,
  `cityName` VARCHAR(191) NOT NULL,
  `cityCode` VARCHAR(191) NULL,
  `province` VARCHAR(191) NOT NULL DEFAULT '',
  `country` VARCHAR(191) NOT NULL DEFAULT '中国',
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `City_cityName_key`(`cityName`),
  UNIQUE INDEX `City_cityCode_key`(`cityCode`),
  PRIMARY KEY (`cityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserCity` (
  `userCityId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `cityId` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserCity_userId_cityId_key`(`userId`, `cityId`),
  INDEX `UserCity_userId_isDefault_idx`(`userId`, `isDefault`),
  PRIMARY KEY (`userCityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WeatherSnapshot` (
  `snapshotId` VARCHAR(191) NOT NULL,
  `cityId` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `weatherText` VARCHAR(191) NOT NULL,
  `temperature` VARCHAR(191) NOT NULL,
  `currentJson` JSON NOT NULL,
  `hourlyJson` JSON NOT NULL,
  `dailyJson` JSON NOT NULL,
  `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WeatherSnapshot_cityId_source_key`(`cityId`, `source`),
  PRIMARY KEY (`snapshotId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RefreshToken`
  ADD CONSTRAINT `RefreshToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`userId`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserCity`
  ADD CONSTRAINT `UserCity_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`userId`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserCity`
  ADD CONSTRAINT `UserCity_cityId_fkey`
  FOREIGN KEY (`cityId`) REFERENCES `City`(`cityId`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WeatherSnapshot`
  ADD CONSTRAINT `WeatherSnapshot_cityId_fkey`
  FOREIGN KEY (`cityId`) REFERENCES `City`(`cityId`)
  ON DELETE CASCADE ON UPDATE CASCADE;
