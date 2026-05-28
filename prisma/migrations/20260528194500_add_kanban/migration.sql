-- CreateTable
CREATE TABLE "KanbanColuna" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanColuna_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "kanbanColunaId" TEXT;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_kanbanColunaId_fkey" FOREIGN KEY ("kanbanColunaId") REFERENCES "KanbanColuna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
