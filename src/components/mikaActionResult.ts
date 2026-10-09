import type { ActionError } from "astro:actions";
import type { MikaApiResult } from "@bnomei/emdash-mika/types";

/** Unwrap both Action layers without losing Astro validation fields or commerce errors. */
export function mikaActionResult<T>(
  result:
    | {
        data?: MikaApiResult<T>;
        error?: ActionError;
      }
    | undefined,
): { data?: T; error?: ActionError | { code: string; message: string } } | undefined {
  if (!result) return undefined;
  if (result.error) return { error: result.error };
  if (result.data?.ok === false) return { error: result.data.error };
  return result.data?.ok ? { data: result.data.data } : {};
}
