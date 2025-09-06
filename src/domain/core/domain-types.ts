/**
 * Domain-specific Type Definitions
 *
 * Contains all core domain types, value objects, and business logic types
 * following DDD principles and Totality patterns.
 */

import type { DomainError, Result } from "./result.ts";
import { createDomainError } from "./result.ts";
import { SchemaCommand } from "../models/schema-command.ts";
import { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";
import type { Command } from "./command-types.ts";

/**
 * Registry and Schema interfaces
 */
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

/**
 * Domain entity interfaces
 */
export interface PromptFile {
  path: string;
  content: string;
  commandStructure: CommandStructure;
}

/**
 * FrontmatterData discriminated union (eliminates optional properties)
 */
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

/**
 * Smart constructor for FrontmatterData
 */
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

/**
 * CommandStructure Value Object (eliminates optional adaptation)
 */
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
    const inputValue = data.input as string;
    if (!inputValue?.trim()) {
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
    if (!validInputTypes.includes(inputValue.trim())) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: inputValue,
            expectedFormat: validInputTypes.join(", "),
          },
          `Invalid input type: ${inputValue}`,
        ),
      };
    }

    const adaptationValue = (data.adaptation as string)?.trim() || null;

    // Validate adaptation if provided
    if (adaptationValue !== null) {
      const validAdaptations = [
        "default",
        "strict",
        "registry",
        "claude-code",
        "claude",
      ];
      if (!validAdaptations.includes(adaptationValue)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: adaptationValue,
              expectedFormat: validAdaptations.join(", "),
            },
            `Invalid adaptation mode: ${adaptationValue}`,
          ),
        };
      }
    }

    return {
      ok: true,
      data: new TotalCommandStructure(
        schemaCommand,
        inputValue.trim(),
        adaptationValue,
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

/**
 * Legacy interfaces for backward compatibility
 */
export interface LegacyFrontmatterData {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}

export interface LegacyCommandStructure {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: string; // c1
  [DEFAULT_COMMAND_FIELDS.ACTION]: string; // c2
  [DEFAULT_COMMAND_FIELDS.TARGET]: string; // c3
  input: string;
  adaptation?: string;
}

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

/**
 * Backward compatible type aliases
 */
export type FrontmatterData = LegacyFrontmatterData;
export type CommandStructure = LegacyCommandStructure;

/**
 * Type aliases for backward compatibility - defined after the command types are loaded
 * These will be properly typed when imported through the main types.ts module
 */

/**
 * Backward compatibility helpers
 */
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
