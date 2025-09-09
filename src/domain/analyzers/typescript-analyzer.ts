/**
 * TypeScript Analyzer - Transforms frontmatter to registry structure
 * Following DDD principles and Totality
 */

import type { DomainError, Result } from "../core/result.ts";
import {
  createDomainError,
  createProcessingStageError,
} from "../core/result.ts";
import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../models/entities.ts";
import type { SchemaAnalyzer } from "../services/interfaces.ts";
import {
  AnalysisContext,
  RegistryCommand,
  RegistryData,
  RegistryVersion,
} from "./value-objects.ts";
import { asObjectRecord } from "../shared/type-guards.ts";
import type { FileSystemRepository } from "../repositories/file-system-repository.ts";
import { ValidToolsConfig } from "../config/valid-tools-config.ts";
import { SchemaRefResolver } from "../config/schema-ref-resolver.ts";
import { VERSION_CONFIG } from "../../config/version.ts";

/**
 * TypeScript Analyzer Aggregate Root
 * Responsible for transforming frontmatter data to match template/schema structure
 * Now uses dependency injection for file system operations
 * Supports recursive $ref resolution as required by requirements.ja.md line 46
 */
export class TypeScriptAnalyzer implements SchemaAnalyzer {
  private validToolsConfig: ValidToolsConfig | null = null;
  private readonly schemaResolver: SchemaRefResolver;

  constructor(
    private readonly fileSystem: FileSystemRepository,
    private readonly defaultVersion: string =
      VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
    private readonly defaultDescription: string =
      "Registry generated from markdown frontmatter",
    private readonly basePath: string = ".",
  ) {
    this.schemaResolver = new SchemaRefResolver(fileSystem, basePath);
  }

  /**
   * Get valid tools configuration using Smart Constructor
   */
  private async getValidToolsConfig(): Promise<ValidToolsConfig> {
    if (this.validToolsConfig !== null) {
      return this.validToolsConfig;
    }

    // Try to load from config file using Smart Constructor
    const configResult = await ValidToolsConfig.create(this.fileSystem);

    if (configResult.ok) {
      this.validToolsConfig = configResult.data;
      return this.validToolsConfig;
    }

    // Fallback to default configuration if loading fails
    this.validToolsConfig = ValidToolsConfig.createDefault();
    return this.validToolsConfig;
  }

  /**
   * Analyze frontmatter and transform to registry structure
   * Supports recursive $ref resolution in schemas
   */
  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>> {
    try {
      // Extract frontmatter data with safe type checking
      const frontMatterJson = frontMatter.getContent().toJSON();

      // Handle case where frontmatter might be empty or a string
      let frontMatterData: Record<string, unknown>;
      if (
        typeof frontMatterJson === "object" && frontMatterJson !== null &&
        !Array.isArray(frontMatterJson)
      ) {
        // TypeScript infers frontMatterJson as object but needs explicit typing
        frontMatterData = frontMatterJson as Record<string, unknown>;
      } else if (typeof frontMatterJson === "string") {
        // Try to parse string as YAML/JSON
        try {
          const parsed = JSON.parse(frontMatterJson);
          if (
            typeof parsed === "object" && parsed !== null &&
            !Array.isArray(parsed)
          ) {
            frontMatterData = parsed;
          } else {
            // If parsed but not an object, return error
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: String(frontMatterJson),
                  expectedFormat: "object",
                },
                `FrontMatter must be an object, got ${typeof parsed}`,
              ),
            };
          }
        } catch {
          // If can't parse, return error
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: String(frontMatterJson),
                expectedFormat: "valid JSON/YAML object",
              },
              `Failed to parse frontmatter content`,
            ),
          };
        }
      } else {
        // Other types are not valid
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(frontMatterJson),
              expectedFormat: "object",
            },
            `FrontMatter must be an object, got ${typeof frontMatterJson}`,
          ),
        };
      }

      // Get document path from frontmatter metadata if available with safe property access
      const documentPath = (typeof frontMatterData._documentPath === "string" &&
        frontMatterData._documentPath) ||
        (typeof frontMatterData._filePath === "string" &&
          frontMatterData._filePath) ||
        (typeof frontMatterData._path === "string" && frontMatterData._path) ||
        "unknown";

      // Create analysis context - get schema data safely
      let schemaData: Record<string, unknown> = {};

      if (typeof schema.getDefinition === "function") {
        const definition = schema.getDefinition();
        // SchemaDefinition has getValue() method, not toJSON()
        if (typeof definition.getValue === "function") {
          const schemaValue = definition.getValue();

          // Resolve $ref references in the schema recursively
          const resolvedSchemaResult = await this.schemaResolver.resolveSchema(
            schemaValue,
          );
          if (!resolvedSchemaResult.ok) {
            return {
              ok: false,
              error: createProcessingStageError(
                "schema $ref resolution",
                resolvedSchemaResult.error,
                `Failed to resolve $ref in schema: ${resolvedSchemaResult.error.message}`,
              ),
            };
          }

          const schemaResult = asObjectRecord(
            resolvedSchemaResult.data,
            "resolved schema definition",
          );
          if (schemaResult.ok) {
            schemaData = schemaResult.data;
          } else {
            // Fallback to empty schema if conversion fails
            schemaData = {};
          }
        } else {
          const definitionResult = asObjectRecord(
            definition,
            "schema definition object",
          );
          if (definitionResult.ok) {
            // Also resolve $ref for this case
            const resolvedResult = await this.schemaResolver.resolveSchema(
              definitionResult.data,
            );
            if (resolvedResult.ok) {
              const finalResult = asObjectRecord(
                resolvedResult.data,
                "resolved schema",
              );
              if (finalResult.ok) {
                schemaData = finalResult.data;
              } else {
                schemaData = definitionResult.data;
              }
            } else {
              schemaData = definitionResult.data;
            }
          }
        }
      } else {
        // Schema might be the raw data itself
        const rawSchemaResult = asObjectRecord(schema, "raw schema");
        if (rawSchemaResult.ok) {
          // Resolve $ref for raw schema
          const resolvedResult = await this.schemaResolver.resolveSchema(
            rawSchemaResult.data,
          );
          if (resolvedResult.ok) {
            const finalResult = asObjectRecord(
              resolvedResult.data,
              "resolved raw schema",
            );
            if (finalResult.ok) {
              schemaData = finalResult.data;
            } else {
              schemaData = rawSchemaResult.data;
            }
          } else {
            schemaData = rawSchemaResult.data;
          }
        }
      }

      const contextResult = AnalysisContext.create(
        documentPath,
        frontMatterData,
        schemaData,
        {}, // Template data would come from template parameter if needed
      );

      if (!contextResult.ok) {
        return {
          ok: false,
          error: createProcessingStageError(
            "analysis context",
            {
              kind: "InvalidResponse",
              service: "analysis",
              response: contextResult.error.message,
            },
            `Analysis context creation failed: ${contextResult.error.message}`,
          ),
        };
      }

      const _context = contextResult.data;

      // Pass through the raw frontmatter data without transformation
      // The template will handle the mapping
      return {
        ok: true,
        data: ExtractedData.create(frontMatterData),
      };
    } catch (error) {
      return {
        ok: false,
        error: createProcessingStageError(
          "TypeScript analysis",
          {
            kind: "InvalidResponse",
            service: "analyzer",
            response: error instanceof Error ? error.message : "Unknown error",
          },
          `TypeScript analysis failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
      };
    }
  }

  /**
   * Transform frontmatter data to registry structure
   * @deprecated This should be handled by a separate registry-specific analyzer
   */
  private async transformToRegistry(
    context: AnalysisContext,
  ): Promise<RegistryData> {
    const frontMatterData = context.getFrontMatterData();
    const documentPath = context.getDocumentPath();

    // Extract or generate version
    const version = this.extractVersion(frontMatterData);

    // Extract or generate description
    const description = this.extractDescription(frontMatterData);

    // Create command from frontmatter and path
    const commands = this.createCommands(documentPath, frontMatterData);

    // Extract available configs from commands (c1 field)
    const availableConfigs: string[] = [];
    for (const command of commands) {
      const c1 = command.toJSON().c1;
      if (c1 && !availableConfigs.includes(c1)) {
        availableConfigs.push(c1);
      }
    }

    // If no configs from commands, try to extract from path
    if (availableConfigs.length === 0) {
      const toolName = await this.extractToolName(documentPath);
      if (toolName) {
        availableConfigs.push(toolName);
      }
    }

    return RegistryData.create(
      version,
      description,
      availableConfigs,
      commands,
    );
  }

  /**
   * Extract or generate version
   */
  private extractVersion(data: Record<string, unknown>): RegistryVersion {
    const versionValue = data.version;
    if (typeof versionValue === "string" && versionValue) {
      const versionResult = RegistryVersion.create(versionValue);
      if (versionResult.ok) {
        return versionResult.data;
      }
    }

    // Use default version if not found or invalid
    return RegistryVersion.createDefault();
  }

  /**
   * Extract description from frontmatter
   */
  private extractDescription(data: Record<string, unknown>): string {
    // Try multiple possible fields for description
    const description = data.description ||
      data.title ||
      data.summary ||
      this.defaultDescription;

    return String(description || this.defaultDescription);
  }

  /**
   * Extract tool name from document path
   */
  private async extractToolName(documentPath: string): Promise<string | null> {
    // Extract from path like "git/merge-cleanup/develop-branches/f_default.md"
    const parts = documentPath.split("/");

    // Find the tool name (usually first directory in path)
    const validToolsConfig = await this.getValidToolsConfig();
    for (const part of parts) {
      const cleaned = part.toLowerCase().replace(/[^a-z]/g, "");
      if (validToolsConfig.isValidTool(cleaned)) {
        return cleaned;
      }
    }

    // Try to extract from filename pattern
    if (documentPath.includes("prompts")) {
      const promptParts = documentPath.split("prompts/")[1]?.split("/") || [];
      if (promptParts.length > 0) {
        const toolCandidate = promptParts[0].toLowerCase();
        if (validToolsConfig.isValidTool(toolCandidate)) {
          return toolCandidate;
        }
      }
    }

    return null;
  }

  /**
   * Create commands from document path and frontmatter
   */
  private createCommands(
    documentPath: string,
    frontMatterData: Record<string, unknown>,
  ): RegistryCommand[] {
    const commands: RegistryCommand[] = [];

    // Extract command fields from frontmatter
    const c1 = String(frontMatterData.c1 || "");
    const c2 = String(frontMatterData.c2 || "");
    const c3 = String(frontMatterData.c3 || "");
    const description = this.extractDescription(frontMatterData);

    // Try to create command from frontmatter data first
    if (c1 && c2 && c3) {
      const commandResult = RegistryCommand.create(c1, c2, c3, description);
      if (commandResult.ok) {
        commands.push(commandResult.data);
        return commands;
      }
    }

    // Fallback: try to create command from path
    const pathCommandResult = RegistryCommand.createFromPath(
      documentPath,
      description,
    );

    if (pathCommandResult.ok) {
      commands.push(pathCommandResult.data);
    } else {
      // Final fallback: create a generic command if path parsing fails
      const parts = documentPath.split("/").filter((p) =>
        p && !p.includes(".")
      );
      if (parts.length >= 3) {
        const fallbackResult = RegistryCommand.create(
          parts[0] || "unknown",
          parts[1] || "unknown",
          parts[2] || "unknown",
          description,
        );
        if (fallbackResult.ok) {
          commands.push(fallbackResult.data);
        }
      }
    }

    return commands;
  }
}

/**
 * Factory function to create TypeScriptAnalyzer
 * @param fileSystem - File system repository for file operations
 * @param defaultVersion - Default version for registry
 * @param defaultDescription - Default description for registry
 * @param basePath - Base path for resolving $ref references (default: ".")
 */
export function createTypeScriptAnalyzer(
  fileSystem: FileSystemRepository,
  defaultVersion?: string,
  defaultDescription?: string,
  basePath?: string,
): TypeScriptAnalyzer {
  return new TypeScriptAnalyzer(
    fileSystem,
    defaultVersion,
    defaultDescription,
    basePath,
  );
}
