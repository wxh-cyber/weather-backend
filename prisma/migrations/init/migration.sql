CREATE TABLE `User` (
  `userId` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `nickname` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NOT NULL DEFAULT '',
  `qq` VARCHAR(191) NOT NULL DEFAULT '',
  `wechat` VARCHAR(191) NOT NULL DEFAULT '',
  `avatarUrl` VARCHAR(191) NOT NULL DEFAULT '',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LoginRecord` (
  `recordId` VARCHAR(191) NOT NULL,
  `account` VARCHAR(191) NOT NULL,
  `loginTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `loginAddress` VARCHAR(191) NOT NULL,
  `loginDevice` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,

  INDEX `LoginRecord_userId_loginTime_idx`(`userId`, `loginTime` DESC),
  PRIMARY KEY (`recordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LoginRecord`
  ADD CONSTRAINT `LoginRecord_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`userId`)
  ON DELETE CASCADE ON UPDATE CASCADE;
