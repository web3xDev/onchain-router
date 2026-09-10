/**
 * A tool that cannot give a verdict says so, and the call is free.
 *
 * This is the incentive the router offers an agent: you pay for an answer, not for
 * an attempt. A raw data API charges for an empty result set. Here an empty result is
 * not a result, and the payment that was signed for it is never settled.
 *
 * Both transports already refuse to settle when a handler fails: HTTP on any status
 * of 400 or above, MCP on `isError`. Throwing this turns "I do not know" into that
 * path deliberately, and distinguishes it from a real failure so the caller can tell
 * "there is nothing to say" from "something broke".
 */
export class NoAnswer extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "NoAnswer";
  }
}

export function isNoAnswer(error: unknown): error is NoAnswer {
  return error instanceof NoAnswer || (error instanceof Error && error.name === "NoAnswer");
}
