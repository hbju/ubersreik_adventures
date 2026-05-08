import type { ServiceContext } from './serviceContext';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';

/**
 * Converts a Supabase PostgREST error into a typed ServiceResult failure.
 */
export function mapSupabaseError<T>(error: { message: string; code?: string; details?: string }): ServiceResult<T> {
  if (error.code === 'PGRST116') {
    return failure<T>(ErrorCode.NOT_FOUND, error.message, error.details);
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return failure<T>(ErrorCode.UNAUTHORIZED, error.message, error.details);
  }
  return failure<T>(ErrorCode.DATABASE_ERROR, error.message, error.details);
}

function from(ctx: ServiceContext, table: string): any {
  return (ctx.client as any).from(table);
}

/**
 * Fetch a single row by ID from a campaign-scoped table.
 */
export async function getById<T extends Record<string, unknown>>(
  ctx: ServiceContext,
  table: string,
  id: string
): Promise<ServiceResult<T>> {
  const { data, error } = await from(ctx, table)
    .select('*')
    .eq('id', id)
    .eq('campaign_id', ctx.campaignId)
    .single();

  if (error) return mapSupabaseError<T>(error);
  return success(data as T);
}

/**
 * Fetch all rows from a campaign-scoped table.
 */
export async function getAll<T extends Record<string, unknown>>(
  ctx: ServiceContext,
  table: string
): Promise<ServiceResult<T[]>> {
  const { data, error } = await from(ctx, table)
    .select('*')
    .eq('campaign_id', ctx.campaignId);

  if (error) return mapSupabaseError<T[]>(error);
  return success((data ?? []) as T[]);
}

/**
 * Insert a row into a campaign-scoped table. Automatically injects campaign_id.
 */
export async function insert<T extends Record<string, unknown>>(
  ctx: ServiceContext,
  table: string,
  row: Omit<T, 'campaign_id'>
): Promise<ServiceResult<T>> {
  const { data, error } = await from(ctx, table)
    .insert({ ...row, campaign_id: ctx.campaignId } as never)
    .select()
    .single();

  if (error) return mapSupabaseError<T>(error);
  return success(data as T);
}

/**
 * Update a row by ID in a campaign-scoped table.
 */
export async function update<T extends Record<string, unknown>>(
  ctx: ServiceContext,
  table: string,
  id: string,
  fields: Partial<T>
): Promise<ServiceResult<T>> {
  const { data, error } = await from(ctx, table)
    .update(fields as never)
    .eq('id', id)
    .eq('campaign_id', ctx.campaignId)
    .select()
    .single();

  if (error) return mapSupabaseError<T>(error);
  return success(data as T);
}

/**
 * Delete a row by ID from a campaign-scoped table.
 */
export async function remove(
  ctx: ServiceContext,
  table: string,
  id: string
): Promise<ServiceResult<void>> {
  const { error } = await from(ctx, table)
    .delete()
    .eq('id', id)
    .eq('campaign_id', ctx.campaignId);

  if (error) return mapSupabaseError<void>(error);
  return success(undefined as void);
}

/**
 * Build a campaign-scoped query builder for custom queries.
 */
export function campaignQuery(ctx: ServiceContext, table: string) {
  return from(ctx, table).select('*').eq('campaign_id', ctx.campaignId);
}
