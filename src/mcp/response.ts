/**
 * Standardized MCP response builders.
 *
 * Success: { ok: true, details: <data> }
 * Error:   { ok: false, error: <msg>, code?: <code>, retry_after_ms?: <ms> }
 */

export interface SuccessPayload {
  ok: true;
  details: unknown;
}

export interface ErrorPayload {
  ok: false;
  error: string;
  code?: string;
  retry_after_ms?: number;
}

export type ResponsePayload = SuccessPayload | ErrorPayload;

export function ok(data: unknown) {
  const payload: SuccessPayload = { ok: true, details: data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

/**
 * Success response with mixed content (JSON metadata + inline images).
 * Used when returning image data that Claude can visually inspect.
 */
export function okWithImages(
  data: unknown,
  images: { base64: string; mimeType: string }[]
) {
  const payload: SuccessPayload = { ok: true, details: data };
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
      ...images.map((img) => ({
        type: "image" as const,
        data: img.base64,
        mimeType: img.mimeType,
      })),
    ],
  };
}

export function err(msg: string, code?: string, retry_after_ms?: number) {
  const payload: ErrorPayload = {
    ok: false,
    error: msg,
    ...(code ? { code } : {}),
    ...(retry_after_ms ? { retry_after_ms } : {}),
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError: true as const,
  };
}
