-- CreateTable
CREATE TABLE `ordem_receitas` (
    `id` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `ordemId` VARCHAR(191) NOT NULL,
    `receitaId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ordem_receitas_ordemId_receitaId_key`(`ordemId`, `receitaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: copia o vinculo receita/quantidade de cada ordem existente para a nova tabela de juncao
INSERT INTO `ordem_receitas` (`id`, `quantidade`, `ordemId`, `receitaId`)
SELECT
    CONCAT('legacy_', `id`) AS `id`,
    `quantidade`,
    `id` AS `ordemId`,
    `receitaId`
FROM `ordens_producao`;

-- DropForeignKey
ALTER TABLE `ordens_producao` DROP FOREIGN KEY `ordens_producao_receitaId_fkey`;

-- AlterTable
ALTER TABLE `ordens_producao` DROP COLUMN `receitaId`,
    DROP COLUMN `quantidade`;

-- AddForeignKey
ALTER TABLE `ordem_receitas` ADD CONSTRAINT `ordem_receitas_ordemId_fkey` FOREIGN KEY (`ordemId`) REFERENCES `ordens_producao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordem_receitas` ADD CONSTRAINT `ordem_receitas_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
