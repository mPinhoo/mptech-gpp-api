import { z } from 'zod';

export const dashboardPeriodSchema = z.object({
  dataDe: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial inválida')
    .optional(),
  dataAte: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final inválida')
    .optional(),
});

export type DashboardPeriodQuery = z.infer<typeof dashboardPeriodSchema>;
