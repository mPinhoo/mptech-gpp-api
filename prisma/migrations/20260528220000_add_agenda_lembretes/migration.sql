-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'AGENDA_LEMBRETE';

-- CreateTable
CREATE TABLE "Lembrete" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataReferencia" TEXT NOT NULL,
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lembrete_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Notificacao" ADD COLUMN "lembreteId" TEXT;

-- CreateIndex
CREATE INDEX "Lembrete_userId_dataReferencia_idx" ON "Lembrete"("userId", "dataReferencia");

-- CreateIndex
CREATE INDEX "Lembrete_notificado_agendadoPara_idx" ON "Lembrete"("notificado", "agendadoPara");

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_lembreteId_fkey" FOREIGN KEY ("lembreteId") REFERENCES "Lembrete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
