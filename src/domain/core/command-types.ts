/**
 * Command-related Type Definitions
 *
 * Contains all command-related types, interfaces, and value objects
 * following DDD principles and Totality patterns for command handling.
 */

import type { DomainError, Result } from "./result.ts";
import { createDomainError } from "./result.ts";
import { SchemaCommand } from "../models/schema-command.ts";
import { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";

/**
 * Command Options Value Object (eliminates optional properties)
 */
export class CommandOptions {
  private constructor(
    private readonly input: string[],
    private readonly adaptation: string[],
    private readonly inputFile: boolean[],
    private readonly stdin: boolean[],
    private readonly destination: boolean[],
  ) {}

  static create(options: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  }): Result<CommandOptions, DomainError & { message: string }> {
    // Provide safe defaults rather than undefined
    const input = options.input ?? [];
    const adaptation = options.adaptation ?? [];
    const inputFile = options.input_file ?? [];
    const stdin = options.stdin ?? [];
    const destination = options.destination ?? [];

    return {
      ok: true,
      data: new CommandOptions(
        input,
        adaptation,
        inputFile,
        stdin,
        destination,
      ),
    };
  }

  getInput(): string[] {
    return [...this.input];
  }
  getAdaptation(): string[] {
    return [...this.adaptation];
  }
  getInputFile(): boolean[] {
    return [...this.inputFile];
  }
  getStdin(): boolean[] {
    return [...this.stdin];
  }
  getDestination(): boolean[] {
    return [...this.destination];
  }
}

/**
 * Command discriminated union (eliminates optional usage)
 * Now using SchemaCommand internally for schema-driven field extraction
 */
type TotalCommand =
  | {
    kind: "BasicCommand";
    command: SchemaCommand;
    description: string;
  }
  | {
    kind: "DocumentedCommand";
    command: SchemaCommand;
    description: string;
    usage: string;
  }
  | {
    kind: "ConfigurableCommand";
    command: SchemaCommand;
    description: string;
    usage: string;
    options: CommandOptions;
  };

/**
 * Smart constructor for Command
 */
export class ValidatedCommand {
  private constructor(private readonly command: TotalCommand) {}

  static create(
    data: Record<string, unknown>,
    schema?: unknown,
  ): Result<ValidatedCommand, DomainError & { message: string }> {
    // Create SchemaCommand for schema-driven field extraction
    const schemaCommandResult = SchemaCommand.create(data, schema);
    if (!schemaCommandResult.ok) {
      return schemaCommandResult;
    }
    const schemaCommand = schemaCommandResult.data;

    // Extract fields using schema-aware methods
    const description = schemaCommand.getDescription();
    const usage = schemaCommand.getUsage();
    const options = schemaCommand.getOptions();

    // Legacy support: check both schema-aware and direct properties
    const finalDescription = description || (data.description as string);
    const finalUsage = usage || (data.usage as string);
    // Validate description field
    if (!finalDescription?.trim()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput", field: "description" },
          "Command description cannot be empty",
        ),
      };
    }

    // Determine command type based on provided data
    const hasUsage = finalUsage && finalUsage.trim() !== "";
    const hasOptions = options && Object.keys(options).length > 0;

    let command: TotalCommand;
    if (hasUsage && hasOptions) {
      const optionsResult = CommandOptions.create(
        options as {
          input?: string[];
          adaptation?: string[];
          input_file?: boolean[];
          stdin?: boolean[];
          destination?: boolean[];
        },
      );
      if (!optionsResult.ok) {
        return optionsResult;
      }
      command = {
        kind: "ConfigurableCommand",
        command: schemaCommand,
        description: finalDescription.trim(),
        usage: finalUsage!.trim(),
        options: optionsResult.data,
      };
    } else if (hasUsage) {
      command = {
        kind: "DocumentedCommand",
        command: schemaCommand,
        description: finalDescription.trim(),
        usage: finalUsage!.trim(),
      };
    } else {
      command = {
        kind: "BasicCommand",
        command: schemaCommand,
        description: finalDescription.trim(),
      };
    }

    return { ok: true, data: new ValidatedCommand(command) };
  }

  getCommand(): TotalCommand {
    return this.command;
  }

  getSchemaCommand(): SchemaCommand {
    return this.command.command;
  }

  // Legacy getters for backward compatibility
  getC1(): string {
    return this.command.command.getDomain();
  }

  getC2(): string {
    return this.command.command.getAction();
  }

  getC3(): string {
    return this.command.command.getTarget();
  }

  getUsage(): string | null {
    switch (this.command.kind) {
      case "BasicCommand":
        return null;
      case "DocumentedCommand":
      case "ConfigurableCommand":
        return this.command.usage;
    }
  }

  getOptions(): CommandOptions | null {
    switch (this.command.kind) {
      case "BasicCommand":
      case "DocumentedCommand":
        return null;
      case "ConfigurableCommand":
        return this.command.options;
    }
  }
}

/**
 * Legacy interface for backward compatibility
 * Note: These field names are preserved for backward compatibility only.
 * New code should use SchemaCommand for schema-driven field extraction.
 */
export interface LegacyCommand {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string; // c1
  [DEFAULT_COMMAND_FIELDS.ACTION]: string; // c2
  [DEFAULT_COMMAND_FIELDS.TARGET]: string; // c3
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}

/**
 * Backward compatible Command type
 */
export type Command = LegacyCommand;

/**
 * Backward compatibility helper for creating commands
 */
export function createCommand(data: {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string;
  [DEFAULT_COMMAND_FIELDS.ACTION]: string;
  [DEFAULT_COMMAND_FIELDS.TARGET]: string;
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}): LegacyCommand {
  // For backward compatibility, return legacy interface
  return {
    [DEFAULT_COMMAND_FIELDS.DOMAIN]: data[DEFAULT_COMMAND_FIELDS.DOMAIN],
    [DEFAULT_COMMAND_FIELDS.ACTION]: data[DEFAULT_COMMAND_FIELDS.ACTION],
    [DEFAULT_COMMAND_FIELDS.TARGET]: data[DEFAULT_COMMAND_FIELDS.TARGET],
    description: data.description,
    usage: data.usage,
    options: data.options,
  };
}
