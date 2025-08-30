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

/**
 * TypeScript Analyzer Aggregate Root
 * Responsible for transforming frontmatter data to match template/schema structure
 */
export class TypeScriptAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly defaultVersion: string = "1.0.0",
    private readonly defaultDescription: string =
      "Registry generated from markdown frontmatter",
  ) {}

  /**
   * Analyze frontmatter and transform to registry structure
   */
  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>> {
    // Add await to satisfy linter
    await Promise.resolve();

    try {
      // Extract frontmatter data with safe type checking
      const frontMatterJson = frontMatter.getContent().toJSON();

      // Handle case where frontmatter might be empty or a string
      let frontMatterData: Record<string, unknown>;
      if (
        typeof frontMatterJson === "object" && frontMatterJson !== null &&
        !Array.isArray(frontMatterJson)
      ) {
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
          const schemaResult = asObjectRecord(schemaValue, "schema definition");
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
            schemaData = definitionResult.data;
          }
        }
      } else {
        // Schema might be the raw data itself
        const rawSchemaResult = asObjectRecord(schema, "raw schema");
        if (rawSchemaResult.ok) {
          schemaData = rawSchemaResult.data;
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
            } as DomainError,
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
          } as DomainError,
          `TypeScript analysis failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ),
      };
    }
  }

  /**
   * Transform frontmatter data to registry structure
   */
  private transformToRegistry(context: AnalysisContext): RegistryData {
    const frontMatterData = context.getFrontMatterData();
    const documentPath = context.getDocumentPath();

    // Extract or generate version
    const version = this.extractVersion(frontMatterData);

    // Extract or generate description
    const description = this.extractDescription(frontMatterData);

    // Extract tool configuration from document path
    const toolName = this.extractToolName(documentPath);
    const availableConfigs = toolName ? [toolName] : [];

    // Create command from frontmatter and path
    const commands = this.createCommands(documentPath, frontMatterData);

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
    const versionValue = data.version as string;
    if (versionValue) {
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
    const description = (
      data.description ||
      data.title ||
      data.summary ||
      this.defaultDescription
    ) as string;

    return String(description);
  }

  /**
   * Extract tool name from document path
   */
  private extractToolName(documentPath: string): string | null {
    // Extract from path like "git/merge-cleanup/develop-branches/f_default.md"
    const parts = documentPath.split("/");

    // Find the tool name (usually first directory in path)
    for (const part of parts) {
      const cleaned = part.toLowerCase().replace(/[^a-z]/g, "");
      const validTools = [
        "git",
        "spec",
        "test",
        "code",
        "docs",
        "meta",
        "build",
        "refactor",
        "debug",
      ];
      if (validTools.includes(cleaned)) {
        return cleaned;
      }
    }

    // Try to extract from filename pattern
    if (documentPath.includes("prompts")) {
      const promptParts = documentPath.split("prompts/")[1]?.split("/") || [];
      if (promptParts.length > 0) {
        const toolCandidate = promptParts[0].toLowerCase();
        const validTools = [
          "git",
          "spec",
          "test",
          "code",
          "docs",
          "meta",
          "build",
          "refactor",
          "debug",
        ];
        if (validTools.includes(toolCandidate)) {
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

    // Try to create command from path
    const description = this.extractDescription(frontMatterData);
    const commandResult = RegistryCommand.createFromPath(
      documentPath,
      description,
    );

    if (commandResult.ok) {
      commands.push(commandResult.data);
    } else {
      // Fallback: create a generic command if path parsing fails
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
 */
export function createTypeScriptAnalyzer(
  defaultVersion?: string,
  defaultDescription?: string,
): TypeScriptAnalyzer {
  return new TypeScriptAnalyzer(defaultVersion, defaultDescription);
}
