/**
 * Command Processing Context Service
 *
 * Application service that manages context for command processing.
 * Uses Smart Constructor pattern following Totality principle.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { Schema, Template } from "../../domain/models/entities.ts";
import type { ProcessingMode } from "../../domain/command/index.ts";

/**
 * Command processing context using Smart Constructor pattern
 * Replaces interface with class to ensure only valid contexts can be created
 */
export class CommandProcessingContext {
  private constructor(
    private readonly commandSchema: Schema,
    private readonly commandTemplate: Template,
    private readonly mode: ProcessingMode,
  ) {}

  /**
   * Smart constructor for strict processing mode
   */
  static createStrict(
    commandSchema: Schema,
    commandTemplate: Template,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    const mode: ProcessingMode = { kind: "strict", validation: "fail-fast" };
    return {
      ok: true,
      data: new CommandProcessingContext(commandSchema, commandTemplate, mode),
    };
  }

  /**
   * Smart constructor for lenient processing mode
   */
  static createLenient(
    commandSchema: Schema,
    commandTemplate: Template,
    maxErrors: number = 10,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    if (maxErrors < 1) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxErrors,
          min: 1,
        }, "Maximum errors must be at least 1"),
      };
    }

    const mode: ProcessingMode = {
      kind: "lenient",
      validation: "continue-on-error",
      maxErrors,
    };
    return {
      ok: true,
      data: new CommandProcessingContext(commandSchema, commandTemplate, mode),
    };
  }

  /**
   * Create context from legacy boolean flag (backwards compatibility)
   * @deprecated Use createStrict() or createLenient() instead
   */
  static fromStrictMode(
    commandSchema: Schema,
    commandTemplate: Template,
    strictMode: boolean = false,
  ): Result<CommandProcessingContext, DomainError & { message: string }> {
    return strictMode
      ? CommandProcessingContext.createStrict(commandSchema, commandTemplate)
      : CommandProcessingContext.createLenient(commandSchema, commandTemplate);
  }

  getCommandSchema(): Schema {
    return this.commandSchema;
  }

  getCommandTemplate(): Template {
    return this.commandTemplate;
  }

  getMode(): ProcessingMode {
    return this.mode;
  }

  isStrict(): boolean {
    return this.mode.kind === "strict";
  }

  isLenient(): boolean {
    return this.mode.kind === "lenient";
  }

  getMaxErrors(): number | undefined {
    return this.mode.kind === "lenient" ? this.mode.maxErrors : undefined;
  }
}
