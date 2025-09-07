/**
 * Valid Tools Configuration - Smart Constructor pattern for tool validation
 * Following DDD and Totality principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { FileSystemRepository } from "../repositories/file-system-repository.ts";

/**
 * Configuration error types for Totality
 */
export type ConfigError = DomainError & {
  kind: "FileNotFound" | "InvalidFormat" | "EmptyInput" | "ParseError";
};

/**
 * Valid Tools Configuration Value Object
 * Uses Smart Constructor pattern to ensure valid state
 */
export class ValidToolsConfig {
  private constructor(private readonly tools: readonly string[]) {}

  /**
   * Smart Constructor - Create configuration from file system
   */
  static async create(
    fileSystem: FileSystemRepository,
    configPath = "src/config/valid-tools.json",
  ): Promise<Result<ValidToolsConfig, ConfigError>> {
    const result = await fileSystem.readFile(configPath);

    if (!result.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "FileNotFound" as const,
          path: configPath,
        }, `Configuration file not found: ${configPath}`) as ConfigError,
      };
    }

    try {
      const config = JSON.parse(result.data);

      if (!config || typeof config !== "object") {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat" as const,
            input: result.data.substring(0, 100),
            expectedFormat: "JSON object",
          }, "Configuration must be a valid JSON object") as ConfigError,
        };
      }

      const validTools = config.validTools;

      if (!Array.isArray(validTools)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat" as const,
            input: String(validTools),
            expectedFormat: "array of strings",
          }, "validTools must be an array") as ConfigError,
        };
      }

      if (validTools.length === 0) {
        return {
          ok: false,
          error: createDomainError({
            kind: "EmptyInput" as const,
            field: "validTools",
          }, "validTools array cannot be empty") as ConfigError,
        };
      }

      // Validate all tools are strings
      for (const tool of validTools) {
        if (typeof tool !== "string" || tool.trim().length === 0) {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat" as const,
              input: String(tool),
              expectedFormat: "non-empty string",
            }, `Invalid tool name: ${String(tool)}`) as ConfigError,
          };
        }
      }

      return {
        ok: true,
        data: new ValidToolsConfig(validTools.map((tool) => tool.trim())),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError" as const,
          input: result.data.substring(0, 100),
          details: error instanceof Error ? error.message : String(error),
        }, "Failed to parse configuration JSON") as ConfigError,
      };
    }
  }

  /**
   * Create with default tools (fallback)
   */
  static createDefault(): ValidToolsConfig {
    return new ValidToolsConfig([
      "git",
      "spec",
      "test",
      "code",
      "docs",
      "meta",
      "debug",
      "config",
      "setup",
      "build",
      "refactor",
    ]);
  }

  /**
   * Get immutable list of tools
   */
  getTools(): readonly string[] {
    return this.tools;
  }

  /**
   * Check if tool is valid
   */
  isValidTool(tool: string): boolean {
    const cleaned = tool.toLowerCase().replace(/[^a-z]/g, "");
    return this.tools.includes(cleaned);
  }

  /**
   * Get tool count
   */
  getCount(): number {
    return this.tools.length;
  }
}
