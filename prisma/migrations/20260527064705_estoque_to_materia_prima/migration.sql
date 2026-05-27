-- DropForeignKey (Estoque -> Produto)
ALTER TABLE "Estoque" DROP CONSTRAINT IF EXISTS "Estoque_produtoId_fkey";

-- DropForeignKey (Despesa -> Produto)
ALTER TABLE "Despesa" DROP CONSTRAINT IF EXISTS "Despesa_produtoId_fkey";

-- Drop old Despesa table (will be recreated)
DROP TABLE IF EXISTS "Despesa";

-- Rename Estoque to MateriaPrima
ALTER TABLE "Estoque" RENAME TO "MateriaPrima";

-- Rename constraint
ALTER TABLE "MateriaPrima" RENAME CONSTRAINT "Estoque_pkey" TO "MateriaPrima_pkey";

-- Drop old produtoId column and unique index
DROP INDEX IF EXISTS "Estoque_produtoId_key";
ALTER TABLE "MateriaPrima" DROP COLUMN "produtoId";

-- Add new columns
ALTER TABLE "MateriaPrima" ADD COLUMN "nome" TEXT NOT NULL DEFAULT 'Sem nome';
ALTER TABLE "MateriaPrima" ADD COLUMN "precoCusto" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Remove default from nome after migration
ALTER TABLE "MateriaPrima" ALTER COLUMN "nome" DROP DEFAULT;

-- Drop relation from Produto
-- (estoque relation removed from Produto model, no column to drop)

-- Recreate Despesa table referencing MateriaPrima
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "materiaPrimaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "MateriaPrima"("id") ON DELETE SET NULL ON UPDATE CASCADE;
