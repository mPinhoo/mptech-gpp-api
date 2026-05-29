import prisma from './prisma.js';

export const CLIENT_NAME_SIMILARITY_THRESHOLD = 0.25;

export async function findClienteIdsBySimilarName(
  userId: string,
  name: string
): Promise<string[]> {
  const term = name.trim();
  if (!term) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Cliente"
    WHERE "userId" = ${userId}
      AND similarity(lower(nome), lower(${term})) >= ${CLIENT_NAME_SIMILARITY_THRESHOLD}
    ORDER BY similarity(lower(nome), lower(${term})) DESC
  `;

  return rows.map((row) => row.id);
}
