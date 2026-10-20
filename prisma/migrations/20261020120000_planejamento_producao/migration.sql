-- CreateTable
CREATE TABLE `planos_producao` (
    `id` VARCHAR(191) NOT NULL,
    `semana` DATE NOT NULL,
    `modeloAtivo` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `planos_producao_semana_key`(`semana`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plano_producao_itens` (
    `id` VARCHAR(191) NOT NULL,
    `previsao` DECIMAL(10, 2) NULL,
    `limiteInferior` DECIMAL(10, 2) NULL,
    `limiteSuperior` DECIMAL(10, 2) NULL,
    `metodo` VARCHAR(191) NULL,
    `estoqueInicial` DECIMAL(10, 3) NOT NULL,
    `sugerido` DECIMAL(10, 3) NOT NULL,
    `planejado` DECIMAL(10, 3) NOT NULL,
    `planoId` VARCHAR(191) NOT NULL,
    `receitaId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `plano_producao_itens_planoId_receitaId_key`(`planoId`, `receitaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `planos_producao` ADD CONSTRAINT `planos_producao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plano_producao_itens` ADD CONSTRAINT `plano_producao_itens_planoId_fkey` FOREIGN KEY (`planoId`) REFERENCES `planos_producao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plano_producao_itens` ADD CONSTRAINT `plano_producao_itens_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

