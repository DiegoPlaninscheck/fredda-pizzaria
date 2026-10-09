-- AlterTable
ALTER TABLE `movimentacoes_estoque` ADD COLUMN `ordemId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `receitas` ADD COLUMN `precoVenda` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `vendas` ADD COLUMN `pedidoId` INTEGER NULL;

-- CreateTable
CREATE TABLE `clientes` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NOT NULL,
    `endereco` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clientes_telefone_key`(`telefone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDENTE', 'CONFIRMADO', 'ENTREGUE', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `canal` ENUM('WHATSAPP', 'MANUAL') NOT NULL DEFAULT 'WHATSAPP',
    `tipoEntrega` ENUM('RETIRADA', 'ENTREGA') NOT NULL,
    `enderecoEntrega` TEXT NULL,
    `formaPagamento` VARCHAR(191) NULL,
    `dataEntregaDesejada` DATETIME(3) NULL,
    `observacoes` TEXT NULL,
    `valorTotal` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `clienteId` VARCHAR(191) NOT NULL,
    `conversaId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido_itens` (
    `id` VARCHAR(191) NOT NULL,
    `quantidade` DECIMAL(10, 3) NOT NULL,
    `precoUnitario` DECIMAL(10, 2) NOT NULL,
    `pedidoId` INTEGER NOT NULL,
    `receitaId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversas` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('BOT', 'HUMANO', 'ENCERRADA') NOT NULL DEFAULT 'BOT',
    `historico` JSON NOT NULL,
    `ultimaMensagemEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clienteId` VARCHAR(191) NOT NULL,

    INDEX `conversas_clienteId_ultimaMensagemEm_idx`(`clienteId`, `ultimaMensagemEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `waMessageId` VARCHAR(191) NULL,
    `direcao` ENUM('ENTRADA', 'SAIDA') NOT NULL,
    `texto` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `conversaId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `mensagens_whatsapp_waMessageId_key`(`waMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_ordemId_fkey` FOREIGN KEY (`ordemId`) REFERENCES `ordens_producao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_conversaId_fkey` FOREIGN KEY (`conversaId`) REFERENCES `conversas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_itens` ADD CONSTRAINT `pedido_itens_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_itens` ADD CONSTRAINT `pedido_itens_receitaId_fkey` FOREIGN KEY (`receitaId`) REFERENCES `receitas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_whatsapp` ADD CONSTRAINT `mensagens_whatsapp_conversaId_fkey` FOREIGN KEY (`conversaId`) REFERENCES `conversas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

