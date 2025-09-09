/**
 * Command Value Object
 *
 * Smart Constructor pattern following Totality principle.
 * Ensures only valid Command instances can be created.
 */

import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type { CommandCreationData, CommandOptions } from "./command-options.ts";

/**
 * Command class using Smart Constructor pattern (Totality principle)
 * Replaces interface with class to ensure only valid instances can be created
 */
export class Command {
  private constructor(
    private readonly c1: string,
    private readonly c2: string,
    private readonly c3: string,
    private readonly description: string,
    private readonly usage: string,
    private readonly options: CommandOptions,
    private readonly title?: string,
  ) {}

  /**
   * Smart constructor following totality principle
   * Ensures only valid Command instances can be created
   */
  static create(
    data: CommandCreationData,
  ): Result<Command, DomainError & { message: string }> {
    // Validate required C3L fields
    if (typeof data.c1 !== "string" || !data.c1.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c1),
            expectedFormat: "non-empty string",
          },
          "Command c1 (domain/category) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.c2 !== "string" || !data.c2.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c2),
            expectedFormat: "non-empty string",
          },
          "Command c2 (action/directive) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.c3 !== "string" || !data.c3.trim()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(data.c3),
            expectedFormat: "non-empty string",
          },
          "Command c3 (target/layer) is required and must be a non-empty string",
        ),
      };
    }

    if (typeof data.description !== "string" || !data.description.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.description),
          expectedFormat: "non-empty string",
        }, "Command description is required and must be a non-empty string"),
      };
    }

    if (typeof data.usage !== "string" || !data.usage.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.usage),
          expectedFormat: "non-empty string",
        }, "Command usage is required and must be a non-empty string"),
      };
    }

    // Parse options into discriminated union
    const optionsResult = Command.parseOptions(data.options);
    if (!optionsResult.ok) {
      return optionsResult;
    }

    // Validate optional title if present
    if (
      data.title !== undefined &&
      (typeof data.title !== "string" || !data.title.trim())
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(data.title),
          expectedFormat: "non-empty string or undefined",
        }, "Command title must be a non-empty string if provided"),
      };
    }

    return {
      ok: true,
      data: new Command(
        data.c1.trim(),
        data.c2.trim(),
        data.c3.trim(),
        data.description.trim(),
        data.usage.trim(),
        optionsResult.data,
        data.title?.trim(),
      ),
    };
  }

  /**
   * Parse options object into discriminated union
   */
  private static parseOptions(
    options: Record<string, unknown>,
  ): Result<CommandOptions, DomainError & { message: string }> {
    const hasFile = Array.isArray(options.file);
    const hasStdin = Array.isArray(options.stdin);
    const hasDestination = Array.isArray(options.destination);
    const hasInput = Array.isArray(options.input);
    const hasAdaptation = Array.isArray(options.adaptation);

    // Determine the appropriate discriminated union case
    if (
      !hasFile && !hasStdin && !hasDestination && !hasInput && !hasAdaptation
    ) {
      return {
        ok: true,
        data: {
          kind: "basic",
          hasFile: false,
          hasStdin: false,
          hasDestination: false,
        },
      };
    }

    if (hasFile && !hasStdin && !hasDestination) {
      return {
        ok: true,
        data: {
          kind: "file-only",
          hasFile: true,
          file: options.file as boolean[],
          hasStdin: false,
          hasDestination: false,
        },
      };
    }

    if (!hasFile && hasStdin && !hasDestination) {
      return {
        ok: true,
        data: {
          kind: "stdin-only",
          hasStdin: true,
          stdin: options.stdin as boolean[],
          hasFile: false,
          hasDestination: false,
        },
      };
    }

    if (!hasFile && !hasStdin && hasDestination) {
      return {
        ok: true,
        data: {
          kind: "destination-only",
          hasDestination: true,
          destination: options.destination as boolean[],
          hasFile: false,
          hasStdin: false,
        },
      };
    }

    // Default to full options for complex cases
    return {
      ok: true,
      data: {
        kind: "full",
        input: hasInput ? options.input as string[] : undefined,
        adaptation: hasAdaptation ? options.adaptation as string[] : undefined,
        file: hasFile ? options.file as boolean[] : undefined,
        stdin: hasStdin ? options.stdin as boolean[] : undefined,
        destination: hasDestination
          ? options.destination as boolean[]
          : undefined,
      },
    };
  }

  // Getters following encapsulation principles
  getC1(): string {
    return this.c1;
  }

  getC2(): string {
    return this.c2;
  }

  getC3(): string {
    return this.c3;
  }

  getDescription(): string {
    return this.description;
  }

  getUsage(): string {
    return this.usage;
  }

  getOptions(): CommandOptions {
    return this.options;
  }

  getTitle(): string | undefined {
    return this.title;
  }

  /**
   * Convert to legacy interface format for backwards compatibility
   * @deprecated Use the new Command class methods instead
   */
  toLegacyInterface(): {
    c1: string;
    c2: string;
    c3: string;
    title?: string;
    description: string;
    usage: string;
    options: {
      input?: string[];
      adaptation?: string[];
      file?: boolean[];
      stdin?: boolean[];
      destination?: boolean[];
    };
  } {
    const legacyOptions: {
      input?: string[];
      adaptation?: string[];
      file?: boolean[];
      stdin?: boolean[];
      destination?: boolean[];
    } = {};

    switch (this.options.kind) {
      case "basic":
        // No options
        break;
      case "file-only":
        legacyOptions.file = this.options.file;
        break;
      case "stdin-only":
        legacyOptions.stdin = this.options.stdin;
        break;
      case "destination-only":
        legacyOptions.destination = this.options.destination;
        break;
      case "full":
        if (this.options.input) legacyOptions.input = this.options.input;
        if (this.options.adaptation) {
          legacyOptions.adaptation = this.options.adaptation;
        }
        if (this.options.file) legacyOptions.file = this.options.file;
        if (this.options.stdin) legacyOptions.stdin = this.options.stdin;
        if (this.options.destination) {
          legacyOptions.destination = this.options.destination;
        }
        break;
    }

    return {
      c1: this.c1,
      c2: this.c2,
      c3: this.c3,
      title: this.title,
      description: this.description,
      usage: this.usage,
      options: legacyOptions,
    };
  }
}
