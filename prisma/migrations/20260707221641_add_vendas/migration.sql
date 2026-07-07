-- CreateTable
CREATE TABLE `vendas` (
    `id` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `precoUnitario` DECIMAL(10, 2) NOT NULL,
    `valorTotal` DECIMAL(10, 2) NOT NULL,
    `dataVenda` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receitaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
