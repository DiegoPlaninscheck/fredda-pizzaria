/*
  Warnings:

  - Added the required column `cliente` to the `vendas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `receitas` ADD COLUMN `estoqueAtual` DECIMAL(10, 3) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `vendas` ADD COLUMN `cliente` VARCHAR(191) NOT NULL,
    ADD COLUMN `dataEntrega` DATETIME(3) NULL,
    ADD COLUMN `entregue` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `formaPagamento` VARCHAR(191) NULL,
    ADD COLUMN `pago` BOOLEAN NOT NULL DEFAULT false;
