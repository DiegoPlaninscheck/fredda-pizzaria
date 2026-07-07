-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'OPERADOR') NOT NULL DEFAULT 'OPERADOR',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fornecedores` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fornecedores_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorias` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categorias_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `insumos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `unidade` ENUM('KG', 'GRAMA', 'LITRO', 'ML', 'UNIDADE', 'PACOTE', 'SACO', 'CAIXA') NOT NULL,
    `estoqueAtual` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `estoqueMinimo` DECIMAL(10, 3) NOT NULL DEFAULT 0,
    `precoUnitario` DECIMAL(10, 2) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `categoriaId` VARCHAR(191) NOT NULL,
    `fornecedorId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentacoes_estoque` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA') NOT NULL,
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `lote` VARCHAR(191) NULL,
    `dataVencimento` DATETIME(3) NULL,
    `precoUnitario` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `insumoId` VARCHAR(191) NOT NULL,
    `fornecedorId` VARCHAR(191) NULL,
    `usuarioId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receitas` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `rendimento` DECIMAL(10, 3) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receita_insumos` (
    `id` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `receitaId` VARCHAR(191) NOT NULL,
    `insumoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `receita_insumos_receitaId_insumoId_key`(`receitaId`, `insumoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordens_producao` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PLANEJADA', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'PLANEJADA',
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `dataPrevista` DATETIME(3) NULL,
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `receitaId` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `etapas_fermentacao` (
    `id` VARCHAR(191) NOT NULL,
    `nome` ENUM('MISTURA', 'DESCANSO_INICIAL', 'FERMENTACAO_LONGA', 'MODELAGEM', 'CONGELAMENTO') NOT NULL,
    `ordem` INTEGER NOT NULL,
    `status` ENUM('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA') NOT NULL DEFAULT 'PENDENTE',
    `duracaoMinutos` INTEGER NOT NULL,
    `minutosDecorridos` INTEGER NOT NULL DEFAULT 0,
    `iniciadaEm` DATETIME(3) NULL,
    `concluidaEm` DATETIME(3) NULL,
    `ordemId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registros_condicoes` (
    `id` VARCHAR(191) NOT NULL,
    `temperatura` DECIMAL(5, 2) NULL,
    `umidade` DECIMAL(5, 2) NULL,
    `observacoes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `etapaId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `insumos` ADD CONSTRAINT `insumos_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `insumos` ADD CONSTRAINT `insumos_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_insumoId_fkey` FOREIGN KEY (`insumoId`) REFERENCES `insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `fornecedores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receita_insumos` ADD CONSTRAINT `receita_insumos_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receita_insumos` ADD CONSTRAINT `receita_insumos_insumoId_fkey` FOREIGN KEY (`insumoId`) REFERENCES `insumos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_producao` ADD CONSTRAINT `ordens_producao_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordens_producao` ADD CONSTRAINT `ordens_producao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `etapas_fermentacao` ADD CONSTRAINT `etapas_fermentacao_ordemId_fkey` FOREIGN KEY (`ordemId`) REFERENCES `ordens_producao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_condicoes` ADD CONSTRAINT `registros_condicoes_etapaId_fkey` FOREIGN KEY (`etapaId`) REFERENCES `etapas_fermentacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
