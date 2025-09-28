import { ProcessingError } from "../../domain/shared/types/errors.ts";

export interface CLIResponse {
  ok: boolean;
  data?: unknown;
  error?: ProcessingError;
}

export class CLI {
  private constructor() {}

  static create(): { ok: boolean; data?: CLI; error?: ProcessingError } {
    return { ok: true, data: new CLI() };
  }

  run(args: string[]): CLIResponse {
    // TODO: Implement CLI command processing
    return {
      ok: false,
      error: new ProcessingError("CLI not yet implemented", "NOT_IMPLEMENTED", {
        args,
      }),
    };
  }
}
