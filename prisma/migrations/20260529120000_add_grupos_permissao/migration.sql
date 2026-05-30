-- CreateTable
CREATE TABLE "GrupoPermissao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoPermissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissaoMenu" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "leitura" BOOLEAN NOT NULL DEFAULT false,
    "criar" BOOLEAN NOT NULL DEFAULT false,
    "editar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissaoMenu_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "grupoPermissaoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GrupoPermissao_nome_key" ON "GrupoPermissao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "PermissaoMenu_grupoId_menu_key" ON "PermissaoMenu"("grupoId", "menu");

-- CreateIndex
CREATE INDEX "User_grupoPermissaoId_idx" ON "User"("grupoPermissaoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_grupoPermissaoId_fkey" FOREIGN KEY ("grupoPermissaoId") REFERENCES "GrupoPermissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissaoMenu" ADD CONSTRAINT "PermissaoMenu_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoPermissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
