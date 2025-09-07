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
import { DEFAULT_COMMAND_FIELDS } from "../constants/command-fields.ts";
import { ResultHandlerService } from "./result-handler-service.ts";

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

  // domain field must be string if present
  const domainField = DEFAULT_COMMAND_FIELDS.DOMAIN;
  if (
    data[domainField] !== undefined && typeof data[domainField] !== "string"
  ) {
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
        return ResultHandlerService.createError(
          createDomainError({
            kind: "InvalidFormat",
            input: JSON.stringify(rawData),
            expectedFormat:
              "CommandData structure with version, description, and tools",
          }, "FrontMatter must contain valid command data structure"),
          {
            operation: "fromFrontMatter",
            component: "Command",
          },
        );
      }

      const config = rawData[DEFAULT_COMMAND_FIELDS.DOMAIN];
      return { ok: true, data: new Command(rawData, config) };
    } catch (error) {
      return ResultHandlerService.createError(
        createDomainError({
          kind: "ProcessingStageError",
          stage: "command creation",
          error: {
            kind: "ParseError",
            input: String(error),
          },
        }, `Failed to create command from frontmatter: ${error}`),
        {
          operation: "fromFrontMatter",
          component: "Command",
        },
      );
    }
  }

  static fromObject(
    data: unknown,
  ): Result<Command, DomainError> {
    try {
      if (!isCommandData(data)) {
        return ResultHandlerService.createError(
          createDomainError({
            kind: "InvalidFormat",
            input: JSON.stringify(data),
            expectedFormat:
              "CommandData structure with version, description, and tools",
          }, "Object must contain valid command data structure"),
          {
            operation: "fromObject",
            component: "Command",
          },
        );
      }

      const config = data[DEFAULT_COMMAND_FIELDS.DOMAIN];
      return { ok: true, data: new Command(data, config) };
    } catch (error) {
      return ResultHandlerService.createError(
        createDomainError({
          kind: "InvalidFormat",
          input: JSON.stringify(data),
          expectedFormat: "valid CommandData object",
        }, `Failed to create command from object: ${error}`),
        {
          operation: "fromObject",
          component: "Command",
        },
      );
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
      return ResultHandlerService.createError(
        createDomainError({
          kind: "EmptyInput",
          field: "version",
        }, "Registry version cannot be empty"),
        {
          operation: "create",
          component: "RegistryData",
        },
      );
    }

    if (!description.trim()) {
      return ResultHandlerService.createError(
        createDomainError({
          kind: "EmptyInput",
          field: "description",
        }, "Registry description cannot be empty"),
        {
          operation: "create",
          component: "RegistryData",
        },
      );
    }

    const tools: RegistryTools = {
      availableConfigs: [...configs], // Defensive copy
      commands: [...commands], // Defensive copy
    };

    return { ok: true, data: new RegistryData(version, description, tools) };
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
        commands: this.tools.commands.map((cmd) => {
          const data = cmd.getData();
          // If the data has a nested "data" property, unwrap it
          if (
            typeof data === "object" && data !== null && "data" in data &&
            Object.keys(data).length === 1
          ) {
            return (data as { data: CommandData }).data;
          }
          return data;
        }),
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

    // Unwrap Result objects and data wrappers if present
    const unwrappedData = data.map((item) => {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        // Check if it's a Result wrapper
        if ("ok" in obj && "data" in obj && obj.ok === true) {
          return obj.data;
        }
        // Check if it's a simple data wrapper (from MappedData)
        if ("data" in obj && Object.keys(obj).length === 1) {
          const innerData = obj.data;
          // Make sure the inner data is the actual command data
          if (typeof innerData === "object" && innerData !== null) {
            const inner = innerData as Record<string, unknown>;
            if (
              DEFAULT_COMMAND_FIELDS.DOMAIN in inner ||
              DEFAULT_COMMAND_FIELDS.ACTION in inner ||
              DEFAULT_COMMAND_FIELDS.TARGET in inner ||
              "description" in inner
            ) {
              return innerData;
            }
          }
        }
      }
      return item;
    });

    const firstItem = unwrappedData[0];
    if (typeof firstItem !== "object" || firstItem === null) {
      return { kind: "Generic", data: unwrappedData };
    }

    const firstObject = firstItem as Record<string, unknown>;

    // Check for registry structure(s) - merge multiple if present
    if ("version" in firstObject && "tools" in firstObject) {
      // Collect all registry structures
      const registries = unwrappedData.filter((item) => {
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          return "version" in obj && "tools" in obj;
        }
        return false;
      });

      // Merge all registries
      const mergedCommands: Command[] = [];
      const mergedConfigs = new Set<string>();
      let latestVersion = "1.0.0";

      for (const registry of registries) {
        const reg = registry as Record<string, unknown>;
        latestVersion = String(reg.version);

        const tools = reg.tools as Record<string, unknown>;

        // Merge availableConfigs
        if (Array.isArray(tools.availableConfigs)) {
          tools.availableConfigs.forEach((config) => {
            mergedConfigs.add(String(config));
          });
        }

        // Merge commands
        if (Array.isArray(tools.commands)) {
          const commands = this.extractSuccesses(
            tools.commands.map((cmd) =>
              Command.fromObject(cmd as Record<string, unknown>)
            ),
          );
          mergedCommands.push(...commands);
        }
      }

      return {
        kind: "Registry",
        version: latestVersion,
        tools: {
          availableConfigs: Array.from(mergedConfigs).sort(),
          commands: mergedCommands,
        },
      };
    }

    // Check for command list (has command fields or looks like a command)
    if (
      DEFAULT_COMMAND_FIELDS.DOMAIN in firstObject ||
      DEFAULT_COMMAND_FIELDS.ACTION in firstObject ||
      DEFAULT_COMMAND_FIELDS.TARGET in firstObject ||
      ("description" in firstObject &&
        ("title" in firstObject || "usage" in firstObject))
    ) {
      const commands = this.extractSuccesses(
        unwrappedData
          .filter((item) => typeof item === "object" && item !== null)
          .map((item) => Command.fromObject(item as Record<string, unknown>)),
      );

      return { kind: "CommandList", commands };
    }

    // Check if items have description field (basic command structure)
    if ("description" in firstObject) {
      const commands = this.extractSuccesses(
        unwrappedData
          .filter((item) => typeof item === "object" && item !== null)
          .map((item) => Command.fromObject(item as Record<string, unknown>)),
      );

      if (commands.length > 0) {
        return { kind: "CommandList", commands };
      }
    }

    return { kind: "Generic", data: unwrappedData };
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
      if (
        ResultHandlerService.isError(commandResult, {
          operation: "aggregateFromResults",
          component: "RegistryAggregationService",
        })
      ) {
        return commandResult;
      }

      commands.push(commandResult.data);

      // Extract domain value for availableConfigs
      const commandData = commandResult.data.getData();
      if (commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]) {
        configSet.add(String(commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]));
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
          "Registry generated from markdown frontmatter",
          structure.tools.commands,
          structure.tools.availableConfigs,
        );

      case "CommandList": {
        const configSet = new Set<string>();
        for (const cmd of structure.commands) {
          const commandData = cmd.getData();
          // Extract domain value for availableConfigs
          if (commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]) {
            configSet.add(String(commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]));
          }
        }
        const configs = Array.from(configSet).sort();

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
        const configSet = new Set<string>();

        for (const item of structure.data) {
          // Unwrap Result object if present
          let actualItem = item;
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            if ("ok" in obj && "data" in obj && obj.ok === true) {
              actualItem = obj.data;
            }
          }

          if (typeof actualItem === "object" && actualItem !== null) {
            const actualItemObj = actualItem as Record<string, unknown>;

            // For registry mode, the data is already the command data (domain, action, target, etc)
            // Check if this is already command data
            if (
              actualItemObj[DEFAULT_COMMAND_FIELDS.DOMAIN] ||
              actualItemObj[DEFAULT_COMMAND_FIELDS.ACTION] ||
              actualItemObj[DEFAULT_COMMAND_FIELDS.TARGET]
            ) {
              // This is already command data from registry mode
              const commandResult = Command.fromObject(actualItemObj);
              ResultHandlerService.onSuccess(
                commandResult,
                (command) => {
                  commands.push(command);
                  // Extract domain value for availableConfigs
                  if (actualItemObj[DEFAULT_COMMAND_FIELDS.DOMAIN]) {
                    configSet.add(
                      String(actualItemObj[DEFAULT_COMMAND_FIELDS.DOMAIN]),
                    );
                  }
                },
                {
                  operation: "aggregateFromMappedData - registry mode",
                  component: "RegistryAggregationService",
                },
              );
            } else {
              // Handle template-mapped structure extraction
              const extractedData = this
                .extractCommandDataFromTemplateStructure(
                  actualItemObj,
                );
              if (extractedData) {
                const commandResult = Command.fromObject(extractedData);
                ResultHandlerService.onSuccess(
                  commandResult,
                  (command) => {
                    commands.push(command);
                    // Extract domain value for availableConfigs
                    if (extractedData[DEFAULT_COMMAND_FIELDS.DOMAIN]) {
                      configSet.add(
                        String(extractedData[DEFAULT_COMMAND_FIELDS.DOMAIN]),
                      );
                    }
                  },
                  {
                    operation: "aggregateFromMappedData - template mode",
                    component: "RegistryAggregationService",
                  },
                );
              } else {
                // Fallback to direct object conversion
                const commandResult = Command.fromObject(actualItemObj);
                ResultHandlerService.onSuccess(
                  commandResult,
                  (command) => {
                    commands.push(command);
                    const commandData = command.getData();
                    // Extract domain value for availableConfigs
                    if (commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]) {
                      configSet.add(
                        String(commandData[DEFAULT_COMMAND_FIELDS.DOMAIN]),
                      );
                    }
                  },
                  {
                    operation: "aggregateFromMappedData - fallback",
                    component: "RegistryAggregationService",
                  },
                );
              }
            }
          }
        }

        const genericConfigs = Array.from(configSet).sort();

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

  /**
   * Helper to safely extract successes from aggregateResults
   */
  private extractSuccesses<T, E extends DomainError>(
    results: Result<T, E>[],
  ): T[] {
    const aggregateResult = ResultHandlerService.aggregateResults(results);
    return aggregateResult.ok ? aggregateResult.data.successes : [];
  }

  /**
   * Extract command data from template-mapped structure
   * Handles structures like: { "tools": { "commands[]": { c1, c2, c3, description, ... } } }
   */
  private extractCommandDataFromTemplateStructure(
    item: Record<string, unknown>,
  ): Record<string, unknown> | null {
    // Check if this looks like a template-mapped structure
    if (item.tools && typeof item.tools === "object" && item.tools !== null) {
      const tools = item.tools as Record<string, unknown>;

      // Look for commands[] key (template mapping artifact)
      if (
        tools["commands[]"] && typeof tools["commands[]"] === "object" &&
        tools["commands[]"] !== null
      ) {
        return tools["commands[]"] as Record<string, unknown>;
      }

      // Look for commands array
      if (
        tools.commands && Array.isArray(tools.commands) &&
        tools.commands.length > 0
      ) {
        const firstCommand = tools.commands[0];
        if (typeof firstCommand === "object" && firstCommand !== null) {
          return firstCommand as Record<string, unknown>;
        }
      }
    }

    // Check if the item itself has command-like structure (domain, action, target, etc)
    if (
      typeof item === "object" && item !== null &&
      (item[DEFAULT_COMMAND_FIELDS.DOMAIN] ||
        item[DEFAULT_COMMAND_FIELDS.ACTION] ||
        item[DEFAULT_COMMAND_FIELDS.TARGET] ||
        item.description)
    ) {
      return item;
    }

    return null;
  }
}
