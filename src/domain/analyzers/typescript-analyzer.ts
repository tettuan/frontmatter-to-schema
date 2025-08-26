/**
 * TypeScript Analyzer - Transforms frontmatter to registry structure
 * Following DDD principles and Totality
 */

import type { Result } from "../shared/types.ts";
import { createError, type ProcessingError } from "../shared/types.ts";
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

/**
 * TypeScript Analyzer Aggregate Root
 * Responsible for transforming frontmatter data to match template/schema structure
 */
export class TypeScriptAnalyzer implements SchemaAnalyzer {
  constructor(
    private readonly defaultVersion: string = "1.0.0",
    private readonly defaultDescription: string = "Registry generated from markdown frontmatter",
  ) {}

  /**
   * Analyze frontmatter and transform to registry structure
   */
  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    try {
      // Extract frontmatter data
      const frontMatterData = frontMatter.getContent().toJSON() as Record<
        string,
        unknown
      >;

      // Get document path from frontmatter metadata if available
      // The document path should be passed somehow - check various possible sources
      const documentPath = (frontMatterData._documentPath as string) || 
                          (frontMatterData._filePath as string) || 
                          (frontMatterData._path as string) ||
                          "unknown";

      // Create analysis context
      // Get schema data - it might be the raw schema object or have a getDefinition method
      let schemaData: Record<string, unknown> = {};
      if (typeof schema.getDefinition === 'function') {
        const definition = schema.getDefinition();
        schemaData = typeof definition.toJSON === 'function' 
          ? definition.toJSON() as Record<string, unknown>
          : definition as Record<string, unknown>;
      } else {
        // Schema might be the raw data itself
        schemaData = schema as unknown as Record<string, unknown>;
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
          error: createError({
            kind: "AnalysisFailed",
            document: documentPath,
            reason: contextResult.error.message,
          }, `Analysis context creation failed: ${contextResult.error.message}`),
        };
      }

      const context = contextResult.data;

      // Transform frontmatter to registry structure
      const registryData = this.transformToRegistry(context);

      // Return as ExtractedData
      return {
        ok: true,
        data: ExtractedData.create(registryData.toJSON()),
      };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "unknown",
          reason: error instanceof Error ? error.message : "Unknown error",
        }, `TypeScript analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`),
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
      const validTools = ["git", "spec", "test", "code", "docs", "meta", "build", "refactor", "debug"];
      if (validTools.includes(cleaned)) {
        return cleaned;
      }
    }

    // Try to extract from filename pattern
    if (documentPath.includes("prompts")) {
      const promptParts = documentPath.split("prompts/")[1]?.split("/") || [];
      if (promptParts.length > 0) {
        const toolCandidate = promptParts[0].toLowerCase();
        const validTools = ["git", "spec", "test", "code", "docs", "meta", "build", "refactor", "debug"];
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
      const parts = documentPath.split("/").filter(p => p && !p.includes("."));
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