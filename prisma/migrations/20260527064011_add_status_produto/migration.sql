-- CreateEnum
CREATE TYPE "StatusProduto" AS ENUM ('ATIVO', 'INATIVO', 'FORA_DE_CICLO');

-- AlterTable: add status column with default
ALTER TABLE "Produto" ADD COLUMN "status" "StatusProduto" NOT NULL DEFAULT 'ATIVO';

-- Migrate data: ativo=false → INATIVO
UPDATE "Produto" SET "status" = 'INATIVO' WHERE "ativo" = false;

-- Drop old column
ALTER TABLE "Produto" DROP COLUMN "ativo";
