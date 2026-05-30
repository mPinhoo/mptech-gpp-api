-- AlterTable
ALTER TABLE "User" ADD COLUMN "documento" TEXT,
ADD COLUMN "dataNascimento" TIMESTAMP(3),
ADD COLUMN "nomeFantasia" TEXT,
ADD COLUMN "usarNomeFantasia" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "genero" TEXT,
ADD COLUMN "nacionalidade" TEXT,
ADD COLUMN "telefone" TEXT;
