import { z } from 'zod';

// ── Cursor Pagination (default for public APIs) ──

export interface CursorPaginationParams {
  cursor?: string;
  take?: number;
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasNext: boolean;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(20),
});

export function buildCursorQuery(params: CursorPaginationParams) {
  const take = params.take || 20;

  return {
    take: take + 1,
    ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
  };
}

export function buildCursorResult<T extends { id: string }>(
  items: T[],
  take: number = 20,
): CursorPaginatedResult<T> {
  const hasNext = items.length > take;
  const data = hasNext ? items.slice(0, take) : items;
  const nextCursor = hasNext ? data[data.length - 1]?.id || null : null;

  return {
    data,
    meta: { nextCursor, hasNext },
  };
}

// ── Offset Pagination (admin/backoffice) ──

export interface OffsetPaginationParams {
  page?: number;
  limit?: number;
}

export interface OffsetPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OffsetPaginatedResult<T> {
  data: T[];
  meta: OffsetPaginationMeta;
}

export const offsetPaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export function buildOffsetQuery(params: OffsetPaginationParams) {
  const page = params.page || 1;
  const limit = params.limit || 20;

  return {
    take: limit,
    skip: (page - 1) * limit,
  };
}

export function buildOffsetResult<T>(
  items: T[],
  total: number,
  params: OffsetPaginationParams,
): OffsetPaginatedResult<T> {
  const page = params.page || 1;
  const limit = params.limit || 20;

  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
