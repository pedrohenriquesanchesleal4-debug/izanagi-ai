/**
 * Shared command-layer vocabulary: usage errors, global options and exit
 * codes. Kept apart from the entrypoint so commands never import it.
 */

import type { IzanagiPipeline } from "../../sdk/src/index.ts";

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;
export const EXIT_ENVIRONMENT = 3;

/** Thrown when argv does not satisfy a command contract. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export interface GlobalOptions {
  readonly json: boolean;
}

export interface CommandContext {
  readonly pipeline: IzanagiPipeline;
  readonly options: GlobalOptions;
}
