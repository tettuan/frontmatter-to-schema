/**
 * Configuration File Service
 *
 * Handles raw configuration file I/O operations and JSON processing
 * Part of the Infrastructure Layer - File System operations
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { ConfigPath } from "../../domain/models/value-objects.ts";

/**
 * Raw configuration data structure
 */
export interface RawConfigurationData {
  documentsPath?: string;
  documents_path?: string;
  schemaPath?: string;
  schema_path?: string;
  templatePath?: string;
  template_path?: string;
  outputPath?: string;
  output_path?: string;
  parallel?: boolean;
  continueOnError?: boolean;
  continue_on_error?: boolean;
  quiet?: boolean;
  [key: string]: unknown;
}

/**
 * Service for configuration file I/O operations
 * Encapsulates file system access and JSON parsing
 */
export class ConfigurationFileService {
  /**
   * Type guard for Record<string, unknown>
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  /**
   * Load and parse configuration file from filesystem
   */
  async loadConfigurationFile(
    path: ConfigPath,
  ): Promise<Result<RawConfigurationData, DomainError & { message: string }>> {
    try {
      const configPath = path.getValue();
      const content = await this.readFile(configPath);
      if (!content.ok) {
        return content;
      }

      const parseResult = this.parseJsonContent(content.data, configPath);
      if (!parseResult.ok) {
        return parseResult;
      }

      return { ok: true, data: parseResult.data };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to load configuration: ${path.getValue()}`),
      };
    }
  }

  /**
   * Save configuration data to file
   */
  async saveConfigurationFile(
    path: ConfigPath,
    data: RawConfigurationData,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const configPath = path.getValue();
      const content = JSON.stringify(data, null, 2);

      await Deno.writeTextFile(configPath, content);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to save configuration: ${path.getValue()}`),
      };
    }
  }

  /**
   * Read text content from file
   */
  private async readFile(
    filePath: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(filePath);
      return { ok: true, data: content };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: filePath,
          }, `Configuration file not found: ${filePath}`),
        };
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: filePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to read file: ${filePath}`),
      };
    }
  }

  /**
   * Parse JSON content with error handling
   */
  private parseJsonContent(
    content: string,
    filePath: string,
  ): Result<RawConfigurationData, DomainError & { message: string }> {
    try {
      const parsed = JSON.parse(content);

      if (!this.isRecord(parsed)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: "parsed JSON",
            expectedFormat: "object",
          }, `Configuration must be a JSON object: ${filePath}`),
        };
      }

      return { ok: true, data: parsed as RawConfigurationData };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: content.substring(0, 100),
          details: error instanceof Error ? error.message : "Invalid JSON",
        }, `Failed to parse JSON configuration: ${filePath}`),
      };
    }
  }
}
