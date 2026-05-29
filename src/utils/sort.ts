export type SortOrder = 'asc' | 'desc';

export interface ListFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
}

export function parseSortOrder(value?: string): SortOrder {
  return value === 'asc' ? 'asc' : 'desc';
}

export function buildOrderBy<T extends Record<string, unknown>>(
  sortBy: string | undefined,
  sortOrder: SortOrder | undefined,
  allowed: Record<string, T>,
  fallback: T
): T {
  if (sortBy && allowed[sortBy]) {
    return allowed[sortBy];
  }
  return fallback;
}
