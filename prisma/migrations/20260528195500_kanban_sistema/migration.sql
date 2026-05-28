-- AlterTable
ALTER TABLE "KanbanColuna" ADD COLUMN "sistema" BOOLEAN NOT NULL DEFAULT false;

-- Seed: criar colunas fixas do sistema
INSERT INTO "KanbanColuna" ("id", "nome", "ordem", "sistema", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Aguardando Produção', 0, true, NOW(), NOW()),
  (gen_random_uuid(), 'Em Produção', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'Finalizado', 2, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
