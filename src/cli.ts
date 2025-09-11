import type { DomainError, ProcessingConfig, Result } from "./types.ts";
import { Processor } from "./processor.ts";

export class CLI {
  private constructor() {}

  static create(): Result<CLI, DomainError> {
    return { ok: true, data: new CLI() };
  }

  async run(args: string[]): Promise<Result<void, DomainError>> {
    // Parse command line arguments
    const configResult = this.parseArgs(args);
    if (!configResult.ok) return configResult;

    // Create processor
    const processorResult = Processor.create();
    if (!processorResult.ok) return processorResult;

    // Process files
    const result = await processorResult.data.process(configResult.data);
    if (!result.ok) return result;

    // Output result
    console.log(result.data);

    return { ok: true, data: undefined };
  }

  private parseArgs(args: string[]): Result<ProcessingConfig, DomainError> {
    // Simple argument parsing - enhanced in production
    if (args.length < 4) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: args.join(" "),
          expectedFormat: "schema.json input/*.md template.json output.json",
        },
      };
    }

    return {
      ok: true,
      data: {
        schema: {
          path: args[0],
          format: args[0].endsWith(".yaml") ? "yaml" : "json",
        },
        input: { pattern: args[1] },
        template: { path: args[2], format: this.detectFormat(args[2]) },
        output: { path: args[3], format: this.detectFormat(args[3]) },
      },
    };
  }

  private detectFormat(path: string): "json" | "yaml" | "xml" | "custom" {
    if (path.endsWith(".json")) return "json";
    if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
    if (path.endsWith(".xml")) return "xml";
    return "custom";
  }
}
