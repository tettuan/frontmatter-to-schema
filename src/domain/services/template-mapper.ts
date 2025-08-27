import type { Result } from "../core/result.ts";
import {
  type ExtractedData,
  MappedData,
  type Template,
  type Schema,
} from "../models/entities.ts";
import type { FrontMatterContent } from "../models/value-objects.ts";
import type { ProcessingError } from "../shared/types.ts";
import type { DomainError } from "../core/result.ts";
import { StrictStructureMatcher } from "../models/StrictStructureMatcher.ts";
import type { TypeScriptAnalysisOrchestrator } from "../core/typescript-processing-orchestrator.ts";

export class TemplateMapper {
  constructor(
    private readonly orchestrator?: TypeScriptAnalysisOrchestrator,
  ) {}

  /**
   * Legacy method for backward compatibility - single-stage processing
   */
  map(
    data: ExtractedData,
    template: Template,
    schema?: unknown,
  ): Result<MappedData, ProcessingError & { message: string }> {
    const format = template.getFormat();
    // For now, assume template format contains JSON definition in template field
    const templateDefinition = format.getTemplate();

    // Extract data from ExtractedData
    const dataObject = data.getData();

    // Parse template definition based on format type
    let templateStructure: unknown;

    // For handlebars format, skip JSON parsing and handle directly
    if (format.getFormat() === "handlebars") {
      return this.mapWithHandlebars(dataObject, templateDefinition);
    }

    // For other formats, parse as JSON to get structure for validation
    try {
      templateStructure = JSON.parse(templateDefinition);
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "MappingFailed",
          document: "template",
          reason: `Invalid template definition JSON: ${error}`,
          message: `Invalid template definition JSON: ${error}`,
        } as ProcessingError & { message: string },
      };
    }

    // Perform strict structure validation if schema is provided
    if (schema) {
      const alignmentResult = StrictStructureMatcher
        .validateStructuralAlignment(
          dataObject,
          schema,
          templateStructure,
        );

      if (!alignmentResult.ok) {
        return {
          ok: false,
          error: {
            kind: "MappingFailed",
            document: "template",
            reason: `Structure mismatch: ${alignmentResult.error.message}`,
            message: `Structure mismatch: ${alignmentResult.error.message}`,
          } as ProcessingError & { message: string },
        };
      }
    }

    switch (format.getFormat()) {
      case "json":
        return this.mapToJsonStrict(dataObject, templateStructure);
      case "yaml":
        return this.mapToYamlStrict(dataObject, templateStructure);
      case "handlebars":
        return this.mapWithHandlebars(dataObject, templateDefinition);
      case "custom":
        return this.mapWithCustomStrict(dataObject, templateStructure);
      default:
        return {
          ok: false,
          error: {
            kind: "MappingFailed",
            document: "template",
            reason: `Unsupported template format: ${format.getFormat()}`,
            message: `Unsupported template format: ${format.getFormat()}`,
          } as ProcessingError & { message: string },
        };
    }
  }

  private mapToJsonStrict(
    data: unknown,
    templateStructure: unknown,
  ): Result<MappedData, ProcessingError & { message: string }> {
    try {
      // Apply strict template mapping - only exact structure matches
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: {
            kind: "MappingFailed",
            document: "template",
            reason: "Data structure does not match template exactly",
            message: "Data structure does not match template exactly",
          } as ProcessingError & { message: string },
        };
      }

      // Create MappedData from the result
      const mappedData = MappedData.create(result as Record<string, unknown>);
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "MappingFailed",
          document: "template",
          reason: `Failed to map to JSON: ${error}`,
          message: `Failed to map to JSON: ${error}`,
        } as ProcessingError & { message: string },
      };
    }
  }

  private mapToYamlStrict(
    data: unknown,
    templateStructure: unknown,
  ): Result<MappedData, ProcessingError & { message: string }> {
    try {
      // Apply strict template mapping then create MappedData
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: {
            kind: "MappingFailed",
            document: "template",
            reason: "Data structure does not match template exactly",
            message: "Data structure does not match template exactly",
          } as ProcessingError & { message: string },
        };
      }

      // Create MappedData from the result
      const mappedData = MappedData.create(result as Record<string, unknown>);
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "MappingFailed",
          document: "template",
          reason: `Failed to map to YAML: ${error}`,
          message: `Failed to map to YAML: ${error}`,
        } as ProcessingError & { message: string },
      };
    }
  }

  private mapWithHandlebars(
    _data: unknown,
    _templateDefinition: string,
  ): Result<MappedData, ProcessingError & { message: string }> {
    // This would use a Handlebars library in production
    return {
      ok: false,
      error: {
        kind: "MappingFailed",
        document: "template",
        reason: "Handlebars support not yet implemented",
        message: "Handlebars support not yet implemented",
      } as ProcessingError & { message: string },
    };
  }

  private mapWithCustomStrict(
    data: unknown,
    templateStructure: unknown,
  ): Result<MappedData, ProcessingError & { message: string }> {
    try {
      // Apply strict template mapping for custom format
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: {
            kind: "MappingFailed",
            document: "template",
            reason: "Data structure does not match template exactly",
            message: "Data structure does not match template exactly",
          } as ProcessingError & { message: string },
        };
      }

      // Create MappedData from the result
      const mappedData = MappedData.create(result as Record<string, unknown>);
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "MappingFailed",
          document: "template",
          reason: `Failed to map with custom template: ${error}`,
          message: `Failed to map with custom template: ${error}`,
        } as ProcessingError & { message: string },
      };
    }
  }

  private applyDataToTemplateStrict(
    data: unknown,
    template: unknown,
    rootData?: unknown,
  ): unknown {
    // Use rootData for placeholder resolution, fallback to data for backward compatibility
    const contextData = rootData !== undefined ? rootData : data;

    // Handle null and undefined template values
    if (template === null || template === undefined) {
      return template; // Return the template value itself, not the data
    }

    if (typeof template === "string") {
      // Check if it's a placeholder
      if (template.startsWith("{{") && template.endsWith("}}")) {
        const path = template.slice(2, -2).trim();
        const value = this.getValueByPathStrict(contextData, path);
        // Return undefined if path doesn't exist (no fallbacks)
        return value;
      }
      return template;
    }

    if (Array.isArray(template)) {
      if (!Array.isArray(data)) {
        // Structure mismatch - template expects array but data is not array
        return undefined;
      }

      // For arrays, both must have the same length for strict matching
      if (template.length !== data.length) {
        return undefined;
      }

      const result = [];
      for (let i = 0; i < template.length; i++) {
        const mappedItem = this.applyDataToTemplateStrict(
          data[i],
          template[i],
          contextData,
        );
        if (mappedItem === undefined && template[i] !== undefined) {
          return undefined;
        }
        result.push(mappedItem);
      }
      return result;
    }

    if (typeof template === "object") {
      if (
        data === null ||
        data === undefined ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        // Structure mismatch - template expects object but data is not object
        return undefined;
      }

      const result: Record<string, unknown> = {};
      const dataObj = data as Record<string, unknown>;

      // Process all template keys
      for (const [key, templateValue] of Object.entries(template)) {
        // For static values (non-placeholders), we don't need the key in data
        const mappedValue = this.applyDataToTemplateStrict(
          dataObj[key], // This might be undefined for static values
          templateValue,
          contextData,
        );
        if (mappedValue === undefined && templateValue !== undefined) {
          return undefined;
        }
        result[key] = mappedValue;
      }

      return result;
    }

    return template;
  }

  private getValueByPathStrict(data: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        // Handle array access by numeric index
        const index = parseInt(part, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      } else if (typeof current === "object") {
        const currentObj = current as Record<string, unknown>;
        // Strict path resolution - must exist in object
        if (!(part in currentObj)) {
          return undefined;
        }
        current = currentObj[part];
      } else {
        // Path traversal failed - current is not an object or array
        return undefined;
      }
    }

    return current;
  }

  private convertToYaml(data: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${indentStr}null`;
    }

    if (typeof data === "string") {
      // Quote if contains special characters
      if (data.includes(":") || data.includes("#") || data.includes('"')) {
        return `${indentStr}"${data.replace(/"/g, '\\"')}"`;
      }
      return `${indentStr}${data}`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `${indentStr}${data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `${indentStr}[]`;
      }
      return data
        .map((item) => {
          const itemStr = this.convertToYaml(item, indent + 1);
          return `${indentStr}- ${itemStr.trim()}`;
        })
        .join("\n");
    }

    if (typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) {
        return `${indentStr}{}`;
      }
      return entries
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${indentStr}${key}:\n${
              this.convertToYaml(value, indent + 1)
            }`;
          }
          const valueStr = this.convertToYaml(value, 0);
          return `${indentStr}${key}: ${valueStr.trim()}`;
        })
        .join("\n");
    }

    return `${indentStr}${String(data)}`;
  }

  /**
   * New 2-stage processing method following domain boundary architecture
   * This replaces the single-stage processing with proper orchestration
   */
  async mapWithOrchestrator(
    frontMatter: FrontMatterContent,
    schema: Schema,
    template: Template,
  ): Promise<Result<MappedData, DomainError & { message: string }>> {
    if (!this.orchestrator) {
      return {
        ok: false,
        error: {
          kind: "ReadError",
          path: "orchestrator",
          details: "TypeScriptAnalysisOrchestrator not configured",
          message: "TypeScriptAnalysisOrchestrator not configured",
        } as DomainError & { message: string },
      };
    }

    try {
      // Stage 1: Extract information from frontmatter + schema
      const extractionResult = await this.orchestrator.extractInformation(
        frontMatter,
        schema,
      );
      if (!extractionResult.ok) {
        return {
          ok: false,
          error: {
            kind: "ExtractionStrategyFailed",
            strategy: "information_extraction",
            input: frontMatter,
            message: `Stage 1 failed: ${extractionResult.error.message}`,
          } as DomainError & { message: string },
        };
      }

      // Stage 2: Map extracted info to template
      const mappingResult = await this.orchestrator.mapToTemplate(
        extractionResult.data,
        schema,
        template,
      );
      if (!mappingResult.ok) {
        return {
          ok: false,
          error: {
            kind: "TemplateMappingFailed",
            template: template,
            source: frontMatter,
            message: `Stage 2 failed: ${mappingResult.error.message}`,
          } as DomainError & { message: string },
        };
      }

      // Convert StructuredData to MappedData
      const structuredData = mappingResult.data;
      try {
        // Parse the structured content to create mapped data
        const parsedContent = JSON.parse(structuredData.getContent());
        const mappedData = MappedData.create(parsedContent);
        return { ok: true, data: mappedData };
      } catch (_parseError) {
        // If JSON parsing fails, treat as raw content
        const mappedData = MappedData.create({ content: structuredData.getContent() });
        return { ok: true, data: mappedData };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "TemplateMappingFailed",
          template: template,
          source: frontMatter,
          message: `Orchestrator processing failed: ${error}`,
        } as DomainError & { message: string },
      };
    }
  }
}
