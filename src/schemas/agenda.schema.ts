import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createLembreteSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório').max(120),
  descricao: z.string().max(500).optional(),
  data: z.string().regex(dateRegex, 'Data inválida'),
  horario: z.string().regex(timeRegex, 'Horário inválido'),
});

export const updateLembreteSchema = createLembreteSchema.partial();

export type CreateLembreteInput = z.infer<typeof createLembreteSchema>;
export type UpdateLembreteInput = z.infer<typeof updateLembreteSchema>;
