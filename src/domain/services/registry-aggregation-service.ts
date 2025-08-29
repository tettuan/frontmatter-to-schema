/**
 * Registry Aggregation Service
 *
 * Domain service responsible for aggregating transformation results into registry structures.
 * Implements the Result Integration Domain (CD5) from domain boundary design.
 *
 * Responsibilities:
 * - Command collection and validation
 * - Registry structure building
 * - Configuration extraction
 * - Registry metadata generation
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { FrontMatter } from "../models/entities.ts";
import type { AnalysisResult } from "../models/entities.ts";

/**
 * Command data structure following Totality principles
 * Flexible interface to support different command data formats
 */
export interface CommandData {
  readonly c1?: string; // Configuration parameter
  // Optional registry-style properties
  readonly version?: string;
  readonly description?: string;
  readonly tools?: {
    readonly availableConfigs: readonly string[];
  };
  // Optional simple-style properties
  readonly name?: string;
}

/**
 * Type guard to validate and normalize CommandData structure
 */
export function isCommandData(obj: unknown): obj is CommandData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const data = obj as Record<string, unknown>;

  // c1 must be string if present
  if (data.c1 !== undefined && typeof data.c1 !== "string") {
    return false;
  }

  // Check for RegistryCommand structure (has version and tools)
  if (data.version !== undefined || data.tools !== undefined) {
    return (
      (data.version === undefined || typeof data.version === "string") &&
      (data.description === undefined ||
        typeof data.description === "string") &&
      (data.tools === undefined || (
        typeof data.tools === "object" &&
        data.tools !== null &&
        Array.isArray((data.tools as Record<string, unknown>).availableConfigs)
      ))
    );
  }

  // Check for SimpleCommand structure (has name)
  if (data.name !== undefined) {
    if (typeof data.name !== "string") return false;
    if (
      data.description !== undefined && typeof data.description !== "string"
    ) return false;
    return true;
  }

  // Check for description-only command
  if (data.description !== undefined) {
    return typeof data.description === "string";
  }

  // At minimum must be an object with valid optional fields
  return true;
}

/**
 * Registry data object interface following Totality principles
 */
export interface RegistryDataObject {
  readonly version: string;
  readonly description: string;
  readonly tools: {
    readonly availableConfigs: readonly string[];
    readonly commands: readonly CommandData[];
  };
}

/**
 * Registry data structure discriminated union
 */
export type RegistryStructure =
  | { kind: "Registry"; version: string; tools: RegistryTools }
  | { kind: "CommandList"; commands: Command[] }
  | { kind: "Generic"; data: unknown[] };

/**
 * Registry tools structure
 */
export interface RegistryTools {
  readonly availableConfigs: string[];
  readonly commands: Command[];
}

/**
 * Command value object
 */
export class Command {
  private constructor(
    private readonly data: CommandData,
    private readonly config?: string,
  ) {}

  static fromFrontMatter(
    frontMatter: FrontMatter,
  ): Result<Command, DomainError> {
    try {
      const rawData = frontMatter.toObject();

      if (!isCommandData(rawData)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: JSON.stringify(rawData),
            expectedFormat:
              "CommandData structure with version, description, and tools",
          }, "FrontMatter must contain valid command data structure"),
        };
      }

      const config = rawData.c1;

      return {
        ok: true,
        data: new Command(rawData, config),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "command creation",
          error: {
            kind: "ParseError",
            input: String(error),
          },
        }, `Failed to create command from frontmatter: ${error}`),
      };
    }
  }

  static fromObject(
    data: unknown,
  ): Result<Command, DomainError> {
    try {
      if (!isCommandData(data)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: JSON.stringify(data),
            expectedFormat:
              "CommandData structure with version, description, and tools",
          }, "Object must contain valid command data structure"),
        };
      }

      const config = data.c1;
      return {
        ok: true,
        data: new Command(data, config),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: JSON.stringify(data),
          expectedFormat: "valid CommandData object",
        }, `Failed to create command from object: ${error}`),
      };
    }
  }

  getData(): CommandData {
    return { ...this.data };
  }

  getConfig(): string | undefined {
    return this.config;
  }

  hasConfig(): boolean {
    return this.config !== undefined;
  }
}

/**
 * Registry data value object
 */
export class RegistryData {
  private constructor(
    private readonly version: string,
    private readonly description: string,
    private readonly tools: RegistryTools,
  ) {}

  static create(
    version: string,
    description: string,
    commands: Command[],
    configs: string[],
  ): Result<RegistryData, DomainError> {
    if (!version.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "version",
        }, "Registry version cannot be empty"),
      };
    }

    if (!description.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "description",
        }, "Registry description cannot be empty"),
      };
    }

    const tools: RegistryTools = {
      availableConfigs: [...configs], // Defensive copy
      commands: [...commands], // Defensive copy
    };

    return {
      ok: true,
      data: new RegistryData(version, description, tools),
    };
  }

  getVersion(): string {
    return this.version;
  }

  getDescription(): string {
    return this.description;
  }

  getTools(): RegistryTools {
    return {
      availableConfigs: [...this.tools.availableConfigs],
      commands: [...this.tools.commands],
    };
  }

  toObject(): RegistryDataObject {
    return {
      version: this.version,
      description: this.description,
      tools: {
        availableConfigs: this.tools.availableConfigs,
        commands: this.tools.commands.map((cmd) => cmd.getData()),
      },
    };
  }
}

/**
 * Registry Aggregation Service
 *
 * Domain service for aggregating transformation results into registry structures.
 * Follows totality principles with explicit error handling and discriminated unions.
 */
export class RegistryAggregationService {
  /**
   * Detect the structure type of data for proper processing
   */
  detectStructureType(data: unknown[]): RegistryStructure {
    if (data.length === 0) {
      return { kind: "Generic", data };
    }

    const firstItem = data[0];
    if (typeof firstItem !== "object" || firstItem === null) {
      return { kind: "Generic", data };
    }

    const firstObject = firstItem as Record<string, unknown>;

    // Check for registry structure
    if ("version" in firstObject && "tools" in firstObject) {
      const tools = firstObject.tools as Record<string, unknown>;
      return {
        kind: "Registry",
        version: String(firstObject.version),
        tools: {
          availableConfigs: Array.isArray(tools.availableConfigs)
            ? tools.availableConfigs.map(String)
            : [],
          commands: Array.isArray(tools.commands)
            ? tools.commands.map((cmd) => {
              const result = Command.fromObject(cmd as Record<string, unknown>);
              return result.ok ? result.data : null;
            }).filter(Boolean) as Command[]
            : [],
        },
      };
    }

    // Check for command list (has c1 field)
    if ("c1" in firstObject) {
      const commands = data
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            const result = Command.fromObject(item as Record<string, unknown>);
            return result.ok ? result.data : null;
          }
          return null;
        })
        .filter(Boolean) as Command[];

      return { kind: "CommandList", commands };
    }

    return { kind: "Generic", data };
  }

  /**
   * Aggregate transformation results into registry data
   */
  aggregateFromResults(
    results: AnalysisResult[],
  ): Result<RegistryData, DomainError> {
    const commands: Command[] = [];
    const configSet = new Set<string>();

    for (const result of results) {
      const document = result.getDocument();
      const frontMatterResult = document.getFrontMatterResult();

      if (!frontMatterResult.ok) {
        // Skip documents without frontmatter rather than failing
        continue;
      }

      const commandResult = Command.fromFrontMatter(frontMatterResult.data);
      if (!commandResult.ok) {
        return commandResult;
      }

      commands.push(commandResult.data);

      if (commandResult.data.hasConfig()) {
        configSet.add(commandResult.data.getConfig()!);
      }
    }

    const configs = Array.from(configSet).sort();

    return RegistryData.create(
      "1.0.0",
      "Command Registry from frontmatter documents",
      commands,
      configs,
    );
  }

  /**
   * Aggregate from mapped data array (for backward compatibility)
   */
  aggregateFromMappedData(
    data: unknown[],
  ): Result<RegistryData, DomainError> {
    const structure = this.detectStructureType(data);

    switch (structure.kind) {
      case "Registry":
        return RegistryData.create(
          structure.version,
          "Existing Registry",
          structure.tools.commands,
          structure.tools.availableConfigs,
        );

      case "CommandList": {
        const configs = structure.commands
          .filter((cmd) => cmd.hasConfig())
          .map((cmd) => cmd.getConfig()!)
          .filter((value, index, array) => array.indexOf(value) === index)
          .sort();

        return RegistryData.create(
          "1.0.0",
          "Command Registry",
          structure.commands,
          configs,
        );
      }

      case "Generic": {
        // Try to convert generic data to commands
        const commands: Command[] = [];
        for (const item of structure.data) {
          if (typeof item === "object" && item !== null) {
            const commandResult = Command.fromObject(item);
            if (commandResult.ok) {
              commands.push(commandResult.data);
            }
          }
        }

        const genericConfigs = commands
          .filter((cmd) => cmd.hasConfig())
          .map((cmd) => cmd.getConfig()!)
          .filter((value, index, array) => array.indexOf(value) === index)
          .sort();

        return RegistryData.create(
          "1.0.0",
          "Generic Data Registry",
          commands,
          genericConfigs,
        );
      }
    }
  }

  /**
   * Extract unique configuration values from commands
   */
  extractConfigurations(commands: Command[]): string[] {
    return commands
      .filter((cmd) => cmd.hasConfig())
      .map((cmd) => cmd.getConfig()!)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort();
  }
}
