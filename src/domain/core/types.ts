// Consolidated domain types for Frontmatter to Schema conversion
// Following Totality principles with discriminated unions and smart constructors

import type { DomainError, Result } from "./result.ts";
import { createDomainError } from "./result.ts";
import { SchemaCommand } from "../models/schema-command.ts";
import { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";

// Command Options Value Object (eliminates optional properties)
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

// Command discriminated union (eliminates optional usage)
// Now using SchemaCommand internally for schema-driven field extraction
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

// Smart constructor for Command
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

// Legacy interface for backward compatibility
// Note: These field names are preserved for backward compatibility only.
// New code should use SchemaCommand for schema-driven field extraction.
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

// Backward compatible Command type
export type Command = LegacyCommand;

export interface Registry {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: Command[];
  };
}

export interface RegistrySchema {
  validate(data: unknown): data is Registry;
  format(registry: Registry): string;
}

// Domain types
export interface PromptFile {
  path: string;
  content: string;
  commandStructure: CommandStructure;
}

// FrontmatterData discriminated union (eliminates optional properties)
type TotalFrontmatterData =
  | { kind: "Empty" }
  | {
    kind: "Minimal";
    title: string;
  }
  | {
    kind: "Standard";
    title: string;
    description: string;
  }
  | {
    kind: "Complete";
    title: string;
    description: string;
    usage: string;
    additionalFields: Record<string, unknown>;
  };

// Smart constructor for FrontmatterData
export class ValidatedFrontmatterData {
  private constructor(private readonly data: TotalFrontmatterData) {}

  static create(rawData: {
    title?: string;
    description?: string;
    usage?: string;
    [key: string]: unknown;
  }): Result<ValidatedFrontmatterData, DomainError & { message: string }> {
    const title = rawData.title?.trim();
    const description = rawData.description?.trim();
    const usage = rawData.usage?.trim();

    // Extract additional fields (excluding known fields)
    const { title: _, description: __, usage: ___, ...additionalFields } =
      rawData;
    const hasAdditionalFields = Object.keys(additionalFields).length > 0;

    let data: TotalFrontmatterData;
    if (!title && !description && !usage && !hasAdditionalFields) {
      data = { kind: "Empty" };
    } else if (title && !description && !usage && !hasAdditionalFields) {
      data = { kind: "Minimal", title };
    } else if (title && description && !usage && !hasAdditionalFields) {
      data = { kind: "Standard", title, description };
    } else if (title && description && usage) {
      data = {
        kind: "Complete",
        title,
        description,
        usage,
        additionalFields: hasAdditionalFields ? additionalFields : {},
      };
    } else {
      // Invalid state - missing required fields for the intended type
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidState",
            expected: "valid frontmatter structure",
            actual: JSON.stringify(rawData),
          },
          "Frontmatter data has invalid structure",
        ),
      };
    }

    return { ok: true, data: new ValidatedFrontmatterData(data) };
  }

  getData(): TotalFrontmatterData {
    return this.data;
  }

  getTitle(): string | null {
    switch (this.data.kind) {
      case "Empty":
        return null;
      case "Minimal":
      case "Standard":
      case "Complete":
        return this.data.title;
    }
  }

  getDescription(): string | null {
    switch (this.data.kind) {
      case "Empty":
      case "Minimal":
        return null;
      case "Standard":
      case "Complete":
        return this.data.description;
    }
  }

  getUsage(): string | null {
    switch (this.data.kind) {
      case "Empty":
      case "Minimal":
      case "Standard":
        return null;
      case "Complete":
        return this.data.usage;
    }
  }

  getAdditionalFields(): Record<string, unknown> {
    switch (this.data.kind) {
      case "Empty":
      case "Minimal":
      case "Standard":
        return {};
      case "Complete":
        return { ...this.data.additionalFields };
    }
  }
}

// Legacy interface for backward compatibility
export interface LegacyFrontmatterData {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}

// Legacy type alias for immediate backward compatibility
export type FrontmatterData = LegacyFrontmatterData;

// CommandStructure Value Object (eliminates optional adaptation)
export class TotalCommandStructure {
  private constructor(
    private readonly schemaCommand: SchemaCommand,
    private readonly input: string,
    private readonly adaptation: string | null,
  ) {}

  static create(
    data: Record<string, unknown>,
    schema?: unknown,
  ): Result<TotalCommandStructure, DomainError & { message: string }> {
    // Create SchemaCommand for schema-driven field extraction
    const schemaCommandResult = SchemaCommand.create(data, schema);
    if (!schemaCommandResult.ok) {
      return schemaCommandResult;
    }
    const schemaCommand = schemaCommandResult.data;

    // Validate input field
    const input = data.input as string;
    if (!input?.trim()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput", field: "input" },
          "CommandStructure input type cannot be empty",
        ),
      };
    }

    // Validate input type against known types
    const validInputTypes = ["-", "nextaction", "code", "claude"];
    if (!validInputTypes.includes(input.trim())) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: input,
            expectedFormat: validInputTypes.join(", "),
          },
          `Invalid input type: ${input}`,
        ),
      };
    }

    const adaptation = (data.adaptation as string)?.trim() || null;

    // Validate adaptation if provided
    if (adaptation !== null) {
      const validAdaptations = [
        "default",
        "strict",
        "registry",
        "claude-code",
        "claude",
      ];
      if (!validAdaptations.includes(adaptation)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: adaptation,
              expectedFormat: validAdaptations.join(", "),
            },
            `Invalid adaptation mode: ${adaptation}`,
          ),
        };
      }
    }

    return {
      ok: true,
      data: new TotalCommandStructure(
        schemaCommand,
        input.trim(),
        adaptation,
      ),
    };
  }

  getC1(): string {
    return this.schemaCommand.getDomain();
  }
  getC2(): string {
    return this.schemaCommand.getAction();
  }
  getC3(): string {
    return this.schemaCommand.getTarget();
  }
  getInput(): string {
    return this.input;
  }
  getAdaptation(): string | null {
    return this.adaptation;
  }

  toString(): string {
    const parts = [
      this.schemaCommand.getDomain(),
      this.schemaCommand.getAction(),
      this.schemaCommand.getTarget(),
    ];
    if (this.input !== "-") {
      parts.push(`-i=${this.input}`);
    }
    if (this.adaptation && this.adaptation !== "default") {
      parts.push(`-a=${this.adaptation}`);
    }
    return parts.join(" ");
  }
}

// Legacy interface for backward compatibility
export interface LegacyCommandStructure {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string; // c1
  [DEFAULT_COMMAND_FIELDS.ACTION]: string; // c2
  [DEFAULT_COMMAND_FIELDS.TARGET]: string; // c3
  input: string;
  adaptation?: string;
}

// Legacy type alias for immediate backward compatibility
export type CommandStructure = LegacyCommandStructure;

// Schema definition interface
export interface LegacySchemaDefinition {
  version?: {
    type: string;
    description: string;
    pattern?: string;
  };
  description?: {
    type: string;
    description: string;
  };
  tools?: {
    type: string;
    description: string;
    properties?: {
      availableConfigs?: {
        type: string;
        description: string;
      };
      commands?: {
        type: string;
        description: string;
      };
    };
  };
  [key: string]: unknown;
}

// Type aliases for backward compatibility
export type RegistryEntry = Command;
export type MappedEntry = Command;

// Analysis context type - discriminated union for different analysis types
export type AnalysisContext =
  | {
    kind: "SchemaAnalysis";
    document: string;
    schema: unknown; // Schema definition from various sources
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "TemplateMapping";
    document: string;
    schema?: unknown; // Optional schema definition from various sources
    template: TemplateDefinition;
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "ValidationOnly";
    document: string;
    schema: {
      validate: (data: unknown) => { ok: boolean; data?: unknown };
      schema: unknown;
    };
    options?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  }
  | {
    kind: "BasicExtraction";
    document: string;
    options?: { includeMetadata?: boolean } & Record<string, unknown>;
    metadata?: Record<string, unknown>;
    sourceFile?: string;
  };

// Template definition type
export interface TemplateDefinition {
  template: string;
  variables?: Record<string, unknown>;
  mappingRules?: Record<string, string>;
  structure?: Record<string, unknown>;
}

// Type guards
export function isSchemaAnalysis(value: unknown): value is { schema: unknown } {
  return value !== null && typeof value === "object" && "schema" in value;
}

export interface AnalysisResultData<T = unknown> {
  has_frontmatter: boolean;
  frontmatter: {
    title?: string;
    description?: string;
    usage?: string;
  };
  template_variables: string[];
  command_structure: CommandStructure;
  detected_options: {
    has_input_file: boolean;
    has_stdin: boolean;
    has_destination: boolean;
    user_variables: string[];
  };
  data?: T;
}

// Analysis Result class - combines data and metadata
export class AnalysisResult<T = unknown> {
  private metadata: Record<string, unknown> = {};

  constructor(
    public readonly sourceFile: unknown,
    public readonly data: T,
  ) {}

  // Alias for backward compatibility
  get extractedData(): T {
    return this.data;
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMetadata(): Record<string, unknown>;
  getMetadata(key: string): unknown;
  getMetadata(key?: string): Record<string, unknown> | unknown {
    if (key === undefined) {
      return { ...this.metadata };
    }
    return this.metadata[key];
  }

  hasMetadata(key: string): boolean {
    return key in this.metadata;
  }
}

// Backward compatibility helpers
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

export function createCommandStructure(data: {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string;
  [DEFAULT_COMMAND_FIELDS.ACTION]: string;
  [DEFAULT_COMMAND_FIELDS.TARGET]: string;
  input: string;
  adaptation?: string;
}): LegacyCommandStructure {
  // For backward compatibility, return legacy interface
  return {
    [DEFAULT_COMMAND_FIELDS.DOMAIN]: data[DEFAULT_COMMAND_FIELDS.DOMAIN],
    [DEFAULT_COMMAND_FIELDS.ACTION]: data[DEFAULT_COMMAND_FIELDS.ACTION],
    [DEFAULT_COMMAND_FIELDS.TARGET]: data[DEFAULT_COMMAND_FIELDS.TARGET],
    input: data.input,
    adaptation: data.adaptation,
  };
}

export function createFrontmatterData(data: {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}): LegacyFrontmatterData {
  // For backward compatibility, return legacy interface
  return data;
}
