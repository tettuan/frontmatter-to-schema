import type { Result } from "../core/result.ts";
import {
  type ExtractedData,
  MappedData,
  type Schema as _Schema,
  type Template,
} from "../models/entities.ts";
import type { FrontMatterContent as _FrontMatterContent } from "../models/value-objects.ts";
import type { DomainError } from "../core/result.ts";
import { StrictStructureMatcher } from "../models/strict-structure-matcher.ts";
import type { SchemaValidationMode } from "./interfaces.ts";
import { TemplateReference } from "../models/template-reference.ts";
import type { ITemplateRepository } from "../repositories/template-repository.ts";
import { TemplatePath } from "../repositories/template-repository.ts";

// Smart Constructor for DomainError with message
function createTemplateMappingError(
  template: unknown,
  source: unknown,
  message: string,
): DomainError & { message: string } {
  return {
    kind: "TemplateMappingFailed",
    template,
    source,
    message,
  };
}

// Type guard for Record<string, unknown>
function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Smart Constructor for validated template structure
class ValidatedTemplateStructure {
  private constructor(readonly structure: Record<string, unknown>) {}

  static create(
    jsonString: string,
  ): Result<ValidatedTemplateStructure, DomainError & { message: string }> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!isRecordObject(parsed)) {
        return {
          ok: false,
          error: createTemplateMappingError(
            jsonString,
            parsed,
            "Template definition must be a JSON object",
          ),
        };
      }
      return {
        ok: true,
        data: new ValidatedTemplateStructure(parsed),
      };
    } catch (error) {
      return {
        ok: false,
        error: createTemplateMappingError(
          jsonString,
          null,
          `Invalid template definition JSON: ${error}`,
        ),
      };
    }
  }

  getStructure(): Record<string, unknown> {
    return this.structure;
  }
}

// Smart Constructor for validated mapping result
class ValidatedMappingResult {
  private constructor(readonly result: Record<string, unknown>) {}

  static create(
    value: unknown,
  ): Result<ValidatedMappingResult, DomainError & { message: string }> {
    if (!isRecordObject(value)) {
      return {
        ok: false,
        error: createTemplateMappingError(
          value,
          value,
          "Mapping result must be a valid object",
        ),
      };
    }
    return {
      ok: true,
      data: new ValidatedMappingResult(value),
    };
  }

  getResult(): Record<string, unknown> {
    return this.result;
  }
}

export class TemplateMapper {
  constructor(
    private readonly templateRepository?: ITemplateRepository,
  ) {}

  /**
   * Legacy method for backward compatibility - single-stage processing
   */
  map(
    data: ExtractedData,
    template: Template,
    schemaMode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    const format = template.getFormat();
    const templateDefinition = format.getTemplate();
    const dataObject = data.getData();

    // For handlebars format, skip JSON parsing and handle directly
    if (format.getFormat() === "handlebars") {
      return this.mapWithHandlebars(dataObject, templateDefinition);
    }

    // Parse and validate template definition
    const templateStructureResult = ValidatedTemplateStructure.create(
      templateDefinition,
    );
    if (!templateStructureResult.ok) {
      return templateStructureResult;
    }

    const templateStructure = templateStructureResult.data.getStructure();

    // Perform strict structure validation using discriminated union
    switch (schemaMode.kind) {
      case "WithSchema": {
        const alignmentResult = StrictStructureMatcher
          .validateStructuralAlignment(
            dataObject,
            schemaMode.schema,
            templateStructure,
          );

        if (!alignmentResult.ok) {
          return {
            ok: false,
            error: createTemplateMappingError(
              template,
              data.getData(),
              `Structure mismatch: ${alignmentResult.error.message}`,
            ),
          };
        }
        break;
      }
      case "NoSchema": {
        // No schema validation required
        break;
      }
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = schemaMode;
        throw new Error(`Unhandled schema mode: ${String(_exhaustiveCheck)}`);
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
          error: createTemplateMappingError(
            template,
            data.getData(),
            `Unsupported template format: ${format.getFormat()}`,
          ),
        };
    }
  }

  private mapToJsonStrict(
    data: unknown,
    templateStructure: Record<string, unknown>,
  ): Result<MappedData, DomainError & { message: string }> {
    try {
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: createTemplateMappingError(
            templateStructure,
            data,
            "Data structure does not match template exactly",
          ),
        };
      }

      const validatedResult = ValidatedMappingResult.create(result);
      if (!validatedResult.ok) {
        return validatedResult;
      }

      const mappedData = MappedData.create(validatedResult.data.getResult());
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: createTemplateMappingError(
          templateStructure,
          data,
          `Failed to map to JSON: ${error}`,
        ),
      };
    }
  }

  private mapToYamlStrict(
    data: unknown,
    templateStructure: Record<string, unknown>,
  ): Result<MappedData, DomainError & { message: string }> {
    try {
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: createTemplateMappingError(
            templateStructure,
            data,
            "Data structure does not match template exactly",
          ),
        };
      }

      const validatedResult = ValidatedMappingResult.create(result);
      if (!validatedResult.ok) {
        return validatedResult;
      }

      const mappedData = MappedData.create(validatedResult.data.getResult());
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: createTemplateMappingError(
          templateStructure,
          data,
          `Failed to map to YAML: ${error}`,
        ),
      };
    }
  }

  private mapWithHandlebars(
    _data: unknown,
    _templateDefinition: string,
  ): Result<MappedData, DomainError & { message: string }> {
    return {
      ok: false,
      error: createTemplateMappingError(
        _templateDefinition,
        _data,
        "Handlebars support not yet implemented",
      ),
    };
  }

  private mapWithCustomStrict(
    data: unknown,
    templateStructure: Record<string, unknown>,
  ): Result<MappedData, DomainError & { message: string }> {
    try {
      const result = this.applyDataToTemplateStrict(data, templateStructure);
      if (result === undefined) {
        return {
          ok: false,
          error: createTemplateMappingError(
            templateStructure,
            data,
            "Data structure does not match template exactly",
          ),
        };
      }

      const validatedResult = ValidatedMappingResult.create(result);
      if (!validatedResult.ok) {
        return validatedResult;
      }

      const mappedData = MappedData.create(validatedResult.data.getResult());
      return { ok: true, data: mappedData };
    } catch (error) {
      return {
        ok: false,
        error: createTemplateMappingError(
          templateStructure,
          data,
          `Failed to map with custom template: ${error}`,
        ),
      };
    }
  }

  /**
   * Apply data to template using Totality principle - returns Result<T,E>
   * This is the preferred method following DDD patterns
   */
  private applyDataToTemplate(
    data: unknown,
    template: unknown,
    rootData?: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    try {
      const result = this.applyDataToTemplateStrict(data, template, rootData);
      if (result === undefined) {
        return {
          ok: false,
          error: createTemplateMappingError(
            template,
            data,
            "Template structure does not match data structure",
          ),
        };
      }
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createTemplateMappingError(
          template,
          data,
          `Template processing failed: ${error}`,
        ),
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
      // Use TemplateReference to parse and handle different template types
      const refResult = TemplateReference.create(template);
      if (!refResult.ok) {
        // If template reference parsing fails, treat as literal
        return template;
      }

      const templateRef = refResult.data;

      // Handle different template reference types
      switch (templateRef.getType().kind) {
        case "placeholder": {
          const pathResult = templateRef.getPath();
          if (!pathResult.ok) {
            return undefined;
          }
          const value = this.getValueByPathStrict(contextData, pathResult.data);
          return value;
        }
        case "file_reference": {
          const pathResult = templateRef.getPath();
          if (!pathResult.ok) {
            return undefined;
          }

          // Load referenced template file if repository is available
          if (this.templateRepository) {
            const templatePathResult = TemplatePath.create(pathResult.data);
            if (templatePathResult.ok) {
              // Note: This is a sync method but template loading is async
              // In a real implementation, this would need to be restructured
              // For now, return placeholder indicating async processing needed
              return { __async_template_loading__: pathResult.data };
            }
          }

          // Fallback: return the path itself as placeholder
          return pathResult.data;
        }
        case "array_item": {
          const pathResult = templateRef.getPath();
          if (!pathResult.ok) {
            return undefined;
          }

          // Array item templates should be applied when processing array data
          if (Array.isArray(data)) {
            const result = [];
            for (const item of data) {
              // Load template file for each array item if repository available
              if (this.templateRepository) {
                const templatePathResult = TemplatePath.create(pathResult.data);
                if (templatePathResult.ok) {
                  // Note: This needs async restructuring in real implementation
                  result.push({
                    __async_array_template__: pathResult.data,
                    item,
                  });
                  continue;
                }
              }

              // Fallback: return item as-is
              result.push(item);
            }
            return result;
          }

          // If data is not array, this template reference doesn't apply
          return undefined;
        }
        case "literal": {
          const literalResult = templateRef.getLiteralValue();
          return literalResult.ok ? literalResult.data : template;
        }
      }
    }

    if (Array.isArray(template)) {
      if (!Array.isArray(data)) {
        // Structure mismatch - template expects array but data is not array
        return undefined;
      }

      // Handle template arrays - distinguish between fixed-length and dynamic arrays
      if (template.length === 1) {
        // Single template item - apply to all data items (dynamic array processing)
        const templateItem = template[0];
        const result = [];
        for (const dataItem of data) {
          const mappedItem = this.applyDataToTemplateStrict(
            dataItem,
            templateItem,
            contextData,
          );
          if (mappedItem === undefined && templateItem !== undefined) {
            return undefined;
          }
          result.push(mappedItem);
        }
        return result;
      } else {
        // Multiple template items - strict length matching (fixed array processing)
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
    }

    if (isRecordObject(template)) {
      if (!isRecordObject(data)) {
        return undefined;
      }

      const result: Record<string, unknown> = {};

      // Process all template keys
      for (const [key, templateValue] of Object.entries(template)) {
        // For static values (non-placeholders), we don't need the key in data
        const mappedValue = this.applyDataToTemplateStrict(
          data[key], // This might be undefined for static values
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
      } else if (isRecordObject(current)) {
        if (!(part in current)) {
          return undefined;
        }
        current = current[part];
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

    if (isRecordObject(data)) {
      const entries = Object.entries(data);
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
}
