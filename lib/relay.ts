/**
 * Relays a call to an x402 endpoint somewhere else.
 *
 * The router is a router here, not a gate. It forwards the request, and with it any
 * signed payment the caller attached; it hands back whatever the endpoint said, 402
 * included, with the payment headers intact. The payment is addressed to the
 * endpoint's own payTo, the endpoint verifies and settles it, and the router never
 * holds, checks or touches the money.
 */

/** x402 headers, v2 names first and v1 as fallback, for either direction. */
export const PAYMENT_REQUIRED_HEADER = "payment-required";
export const PAYMENT_SIGNATURE_HEADERS = ["payment-signature", "x-payment"] as const;
export const PAYMENT_RESPONSE_HEADERS = ["payment-response", "x-payment-response"] as const;

export type Relayed = {
  status: number;
  /** Parsed JSON body, or the raw text when it was not JSON. */
  body: unknown;
  /** Base64 PAYMENT-REQUIRED header, present on a 402. */
  paymentRequired: string | null;
  /** Base64 settlement header, present after a paid call. */
  paymentResponse: string | null;
};

export async function relay(
  endpoint: string,
  input: Record<string, unknown>,
  payment?: string,
  timeoutSeconds = 25,
): Promise<Relayed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (payment) {
    // Both names, so a v1 endpoint and a v2 endpoint read the same receipt.
    for (const name of PAYMENT_SIGNATURE_HEADERS) headers[name] = payment;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (error) {
    throw new Error(
      `Endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON; passed through as text.
  }

  const first = (names: readonly string[]) =>
    names.map((n) => response.headers.get(n)).find((v) => v) ?? null;

  return {
    status: response.status,
    body,
    paymentRequired: response.headers.get(PAYMENT_REQUIRED_HEADER),
    paymentResponse: first(PAYMENT_RESPONSE_HEADERS),
  };
}

export function decodeBase64Json<T = unknown>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}
