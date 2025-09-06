/**
 * Template File Loader Infrastructure Adapter
 *
 * Following Ports and Adapters pattern - infrastructure layer implementation
 * Implements ITemplateRepository for file system operations
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { ERROR_KINDS } from "../../domain/constants/index.ts";
import type {
  ITemplateRepository,
  TemplatePath,
} from "../../domain/repositories/template-repository.ts";
import { Template, TemplateId } from "../../domain/models/entities.ts";
import { TemplateFormat } from "../../domain/models/value-objects.ts";

/**
 * Template File Loader - Infrastructure Implementation
 */
export class TemplateFileLoader implements ITemplateRepository {
  private constructor(
    private readonly baseDirectory: string,
    private readonly fileSystem: FileSystemAdapter,
  ) {}

  /**
   * Smart Constructor following Totality principle
   */
  static create(
    baseDirectory: string,
    fileSystem?: FileSystemAdapter,
  ): Result<TemplateFileLoader, DomainError & { message: string }> {
    if (typeof baseDirectory !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof baseDirectory,
          expectedFormat: "string",
        }, "Base directory must be a string"),
      };
    }

    if (baseDirectory.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "base_directory",
        }, "Base directory cannot be empty"),
      };
    }

    const fs = fileSystem || new DenoFileSystemAdapter();

    return {
      ok: true,
      data: new TemplateFileLoader(baseDirectory, fs),
    };
  }

  /**
   * Load template from file system
   */
  async load(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const fullPath = this.resolveTemplatePath(path);

      // Check if file exists first
      const existsResult = await this.exists(path);
      if (!existsResult.ok) {
        return existsResult as Result<
          Template,
          DomainError & { message: string }
        >;
      }

      if (!existsResult.data) {
        return {
          ok: false,
          error: createDomainError({
            kind: ERROR_KINDS.FILE_NOT_FOUND,
            path: fullPath,
          }, `Template file not found: ${fullPath}`),
        };
      }

      // Read template file content
      const contentResult = await this.fileSystem.readTextFile(fullPath);
      if (!contentResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: ERROR_KINDS.READ_ERROR,
            path: fullPath,
            details: contentResult.error.message,
          }, `Failed to read template file: ${fullPath}`),
        };
      }

      // Parse template content
      let templateData: unknown;
      try {
        templateData = JSON.parse(contentResult.data);
      } catch (error) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: contentResult.data,
            details: String(error),
          }, `Invalid JSON in template file: ${fullPath}`),
        };
      }

      // Create template format
      const formatResult = TemplateFormat.create(
        "json",
        JSON.stringify(templateData),
      );
      if (!formatResult.ok) {
        return formatResult as Result<
          Template,
          DomainError & { message: string }
        >;
      }

      // Create template ID
      const templateIdResult = TemplateId.create(path.toString());
      if (!templateIdResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            templateIdResult.error,
            "Failed to create template ID",
          ),
        };
      }

      // Create template entity with empty mapping rules (file templates don't need mapping rules)
      const templateResult = Template.create(
        templateIdResult.data,
        formatResult.data,
        [],
      );

      if (!templateResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotConfigured",
            component: "Template",
          }, `Template creation failed: ${templateResult.error.message}`),
        };
      }

      return {
        ok: true,
        data: templateResult.data,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.toString(),
          details: String(error),
        }, `Template loading failed: ${error}`),
      };
    }
  }

  /**
   * Check if template file exists
   */
  async exists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>> {
    try {
      const fullPath = this.resolveTemplatePath(path);
      const exists = await this.fileSystem.exists(fullPath);
      return { ok: true, data: exists };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.toString(),
          details: String(error),
        }, `Failed to check template existence: ${error}`),
      };
    }
  }

  /**
   * Get base directory for resolving paths
   */
  getBaseDirectory(): Result<string, DomainError & { message: string }> {
    return { ok: true, data: this.baseDirectory };
  }

  /**
   * Private helper: Resolve template path relative to base directory
   */
  private resolveTemplatePath(path: TemplatePath): string {
    const relativePath = path.getPath();

    // If already absolute path, return as-is
    if (relativePath.startsWith("/")) {
      return relativePath;
    }

    // Join with base directory
    return `${this.baseDirectory}/${relativePath}`;
  }
}

/**
 * File System Adapter Interface
 */
interface FileSystemAdapter {
  readTextFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>>;
  exists(path: string): Promise<boolean>;
}

/**
 * Deno File System Adapter Implementation
 */
class DenoFileSystemAdapter implements FileSystemAdapter {
  async readTextFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path,
          details: String(error),
        }, `Failed to read file: ${path}`),
      };
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Type guards
 */
export function isTemplateFileLoader(
  value: unknown,
): value is TemplateFileLoader {
  return value instanceof TemplateFileLoader;
}
