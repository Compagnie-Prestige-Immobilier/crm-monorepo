import { z } from 'zod';

const MAX_CURSOR_MICROS = 8.64e18;

const microsSchema = z.number().int().min(0).max(MAX_CURSOR_MICROS);

export const isValidCursorMicros = (t: unknown): t is number => microsSchema.safeParse(t).success;
