/**
 * Valid Tools Configuration - Smart Constructor pattern for tool validation
 * Following DDD and Totality principles
 */

import type { Result } from "../core/result.ts";
import type { FileSystemRepository } from "../repositories/file-system-repository.ts";

/**
 * Configuration error types using discriminated union for Totality
 */
export type ConfigError =
  | { kind: "FileNotFound"; path: string; message: string }
  | {
    kind: "InvalidFormat";
    input: string;
    expectedFormat: string;
    message: string;
  }
  | { kind: "EmptyInput"; field?: string; message: string }
  | { kind: "ParseError"; input: string; details?: string; message: string };

/**
 * Helper functions to create ConfigError instances without type assertions
 */
const createFileNotFoundError = (path: string): ConfigError => ({
  kind: "FileNotFound",
  path,
  message: `Configuration file not found: ${path}`,
});

const createInvalidFormatError = (
  input: string,
  expectedFormat: string,
  customMessage?: string,
): ConfigError => ({
  kind: "InvalidFormat",
  input,
  expectedFormat,
  message: customMessage ||
    `Invalid format: expected ${expectedFormat}, got "${input}"`,
});

const createEmptyInputError = (
  field?: string,
  customMessage?: string,
): ConfigError => ({
  kind: "EmptyInput",
  field,
  message: customMessage ||
    `Input cannot be empty${field ? ` (field: ${field})` : ""}`,
});

const createParseError = (
  input: string,
  details?: string,
  customMessage?: string,
): ConfigError => ({
  kind: "ParseError",
  input,
  details,
  message: customMessage ||
    `Failed to parse "${input}"${details ? `: ${details}` : ""}`,
});

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
        error: createFileNotFoundError(configPath),
      };
    }

    try {
      const config = JSON.parse(result.data);

      if (!config || typeof config !== "object") {
        return {
          ok: false,
          error: createInvalidFormatError(
            result.data.substring(0, 100),
            "JSON object",
            "Configuration must be a valid JSON object",
          ),
        };
      }

      const validTools = config.validTools;

      if (!Array.isArray(validTools)) {
        return {
          ok: false,
          error: createInvalidFormatError(
            String(validTools),
            "array of strings",
            "validTools must be an array",
          ),
        };
      }

      if (validTools.length === 0) {
        return {
          ok: false,
          error: createEmptyInputError(
            "validTools",
            "validTools array cannot be empty",
          ),
        };
      }

      // Validate all tools are strings
      for (const tool of validTools) {
        if (typeof tool !== "string" || tool.trim().length === 0) {
          return {
            ok: false,
            error: createInvalidFormatError(
              String(tool),
              "non-empty string",
              `Invalid tool name: ${String(tool)}`,
            ),
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
        error: createParseError(
          result.data.substring(0, 100),
          error instanceof Error ? error.message : String(error),
          "Failed to parse configuration JSON",
        ),
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
