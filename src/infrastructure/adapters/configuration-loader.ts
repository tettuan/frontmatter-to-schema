// Configuration loader implementation

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { SchemaRefResolver } from "../../domain/config/schema-ref-resolver.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";

// Type guard helper following Totality principle
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Type guard for string extraction
function getStringProperty(
  obj: Record<string, unknown>,
  key: string,
  defaultValue = "",
): string {
  const value = obj[key];
  return typeof value === "string" ? value : defaultValue;
}
// Removed unused imports: ValidationError, IOError
// Removed unused import: createError

// Use unified DomainError approach - no conversion needed
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "../../domain/models/value-objects.ts";
import {
  Schema,
  SchemaId,
  SchemaVersion,
  Template,
  TemplateId,
} from "../../domain/models/entities.ts";
import {
  MappingRule,
  SchemaDefinition,
  TemplateFormat,
} from "../../domain/models/value-objects.ts";
import type {
  ConfigurationRepository,
  ProcessingConfiguration,
  ResultRepository,
  SchemaRepository,
  TemplateRepository,
} from "../../domain/services/interfaces.ts";
import type {
  AggregatedResult,
  AnalysisResult,
} from "../../domain/models/entities.ts";

export class ConfigurationLoader
  implements ConfigurationRepository, SchemaRepository, ResultRepository {
  private readonly refResolver: SchemaRefResolver;

  constructor(fileSystemRepository: FileSystemRepository) {
    this.refResolver = new SchemaRefResolver(fileSystemRepository, ".");
  }
  async loadProcessingConfig(
    path: ConfigPath,
  ): Promise<
    Result<ProcessingConfiguration, DomainError & { message: string }>
  > {
    try {
      const configPath = path.getValue();
      const content = await Deno.readTextFile(configPath);
      const config = JSON.parse(content);

      // Validate and create value objects
      const documentsPathResult = DocumentPath.create(
        config.documentsPath || config.documents_path || ".",
      );
      if (!documentsPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid documents path",
          }),
        };
      }

      const schemaPathResult = ConfigPath.create(
        config.schemaPath || config.schema_path || "schema.json",
      );
      if (!schemaPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid schema path",
          }),
        };
      }

      const templatePathResult = TemplatePath.create(
        config.templatePath || config.template_path || "template.json",
      );
      if (!templatePathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid template path",
          }),
        };
      }

      const outputPathResult = OutputPath.create(
        config.outputPath || config.output_path || "output.json",
      );
      if (!outputPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid output path",
          }),
        };
      }

      const processingConfig: ProcessingConfiguration = {
        documentsPath: documentsPathResult.data,
        schemaPath: schemaPathResult.data,
        templatePath: templatePathResult.data,
        outputPath: outputPathResult.data,
        options: {
          parallel: config.options?.parallel ?? true,
          maxConcurrency: config.options?.maxConcurrency ?? 5,
          continueOnError: config.options?.continueOnError ?? false,
        },
      };

      return { ok: true, data: processingConfig };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: path.getValue(),
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async load(
    path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    try {
      const schemaPath = path.getValue();
      let content: string;

      try {
        content = await Deno.readTextFile(schemaPath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return {
            ok: false,
            error: createDomainError({
              kind: "FileNotFound",
              path: schemaPath,
            }),
          };
        }
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: error instanceof Error ? error.message : "Unknown error",
          }, `Failed to read schema file: ${schemaPath}`),
        };
      }

      let schemaData: unknown;
      try {
        const parsedSchema = JSON.parse(content);

        // Resolve $ref references recursively
        const resolvedResult = await this.refResolver.resolveSchema(
          parsedSchema,
          schemaPath,
        );
        if (!resolvedResult.ok) {
          return {
            ok: false,
            error: createDomainError({
              kind: "ReadError",
              path: schemaPath,
              details:
                `Failed to resolve $ref: ${resolvedResult.error.message}`,
            }),
          };
        }

        schemaData = resolvedResult.data;
      } catch (error) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: `Invalid JSON: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          }),
        };
      }

      if (!isRecord(schemaData)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: typeof schemaData,
            expectedFormat: "object",
          }, "Schema data must be an object"),
        };
      }

      const data = schemaData;
      const idResult = SchemaId.create(
        getStringProperty(data, "id", "default-schema"),
      );
      if (!idResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: "Invalid schema ID",
          }),
        };
      }

      const definitionResult = SchemaDefinition.create(
        data,
        getStringProperty(data, "version", "1.0.0"),
      );
      if (!definitionResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: "Invalid schema definition",
          }),
        };
      }

      const versionResult = SchemaVersion.create(
        getStringProperty(data, "version", "1.0.0"),
      );
      if (!versionResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: schemaPath,
            details: "Invalid schema version",
          }),
        };
      }

      const schema = Schema.create(
        idResult.data,
        definitionResult.data,
        versionResult.data,
        getStringProperty(data, "description"),
      );

      return { ok: true, data: schema };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  validate(
    _config:
      | ProcessingConfiguration
      | Schema
      | Template,
  ): Result<void, DomainError & { message: string }> {
    // Basic validation - can be extended
    return { ok: true, data: undefined };
  }

  async save(
    result: AggregatedResult,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      // Extract the raw data from the AggregatedResult
      const rawData = result.getRawData();
      // Wrap in results array to match expected format
      const outputData = {
        results: rawData,
        metadata: {
          timestamp: result.getTimestamp().toISOString(),
          format: result.getFormat(),
        },
      };
      const data = JSON.stringify(outputData, null, 2);
      await Deno.writeTextFile(path.getValue(), data);
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError({
            kind: "PermissionDenied",
            path: path.getValue(),
            operation: "write",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async append(
    result: AnalysisResult,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const data = result.getMappedData().toJSON();
      await Deno.writeTextFile(path.getValue(), `${data}\n`, { append: true });
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}

// Template repository implementation
export class TemplateLoader implements TemplateRepository {
  async load(
    templateId: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    // For TemplateLoader, we treat templateId as a direct path
    const pathResult = TemplatePath.create(templateId);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidPath",
          path: templateId,
        }),
      };
    }
    return await this.loadFromPath(pathResult.data);
  }

  async loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const templatePath = path.getValue();
      let content: string;

      try {
        content = await Deno.readTextFile(templatePath);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return {
            ok: false,
            error: createDomainError({
              kind: "FileNotFound",
              path: templatePath,
            }),
          };
        }
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: templatePath,
            details: error instanceof Error ? error.message : "Unknown error",
          }, `Failed to read template file: ${templatePath}`),
        };
      }

      // Detect format
      let format: "json" | "yaml" | "toml";
      let templateData: unknown;

      if (templatePath.endsWith(".json")) {
        format = "json";
        templateData = JSON.parse(content);
      } else if (
        templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")
      ) {
        format = "yaml";
        templateData = this.parseYAML(content);
      } else {
        format = "json";
        try {
          templateData = JSON.parse(content);
        } catch {
          format = "yaml";
          templateData = this.parseYAML(content);
        }
      }

      if (!isRecord(templateData)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: typeof templateData,
            expectedFormat: "object",
          }, "Template data must be an object"),
        };
      }

      const data = templateData;
      const idResult = TemplateId.create(
        getStringProperty(data, "id", "default-template"),
      );
      if (!idResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: templatePath,
            details: "Invalid template ID",
          }),
        };
      }

      const formatResult = TemplateFormat.create(format, content);
      if (!formatResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: templatePath,
            details: "Invalid template format",
          }),
        };
      }

      // Create mapping rules from template metadata if present
      const mappingRules: MappingRule[] = [];
      if (data.mappings && Array.isArray(data.mappings)) {
        for (const mappingItem of data.mappings) {
          if (!isRecord(mappingItem)) {
            continue; // Skip invalid mapping entries
          }

          const mapping = mappingItem;
          const transformFn = mapping.transform
            ? (value: unknown) => {
              // If transform is a string, we'd need to evaluate it somehow
              // For now, just return the value unchanged if transform is provided
              return value;
            }
            : undefined;

          const sourceProperty = getStringProperty(mapping, "source");
          const targetProperty = getStringProperty(mapping, "target");

          // Only create mapping rule if both source and target are valid strings
          if (sourceProperty && targetProperty) {
            const ruleResult = MappingRule.create(
              sourceProperty,
              targetProperty,
              transformFn,
            );
            if (ruleResult.ok) {
              mappingRules.push(ruleResult.data);
            }
          }
        }
      }

      // Auto-detect placeholders in template and create mapping rules
      const placeholders = this.extractPlaceholders(content);
      for (const placeholder of placeholders) {
        // Create a mapping rule for each placeholder
        // e.g., {{title}} or {title} -> maps from "title" field to "title" in output
        const fieldName = placeholder.replace(/\{|\}/g, "").trim();
        const ruleResult = MappingRule.create(
          fieldName, // source field from data
          fieldName, // target field in output
          undefined, // no transformation
        );
        if (ruleResult.ok) {
          // Only add if not already defined in explicit mappings
          const exists = mappingRules.some((r) =>
            r.getSource() === fieldName && r.getTarget() === fieldName
          );
          if (!exists) {
            mappingRules.push(ruleResult.data);
          }
        }
      }

      const templateResult = Template.create(
        idResult.data,
        formatResult.data,
        mappingRules,
        getStringProperty(data, "description"),
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

      return { ok: true, data: templateResult.data };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  save(
    _template: Template,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Not implemented for TemplateLoader - this is primarily a read-only loader
    return Promise.resolve({
      ok: false,
      error: createDomainError({
        kind: "NotConfigured",
        component: "TemplateLoader save functionality",
      }),
    });
  }

  exists(_templateId: string): Promise<boolean> {
    // Not implemented for TemplateLoader
    return Promise.resolve(false);
  }

  list(): Promise<Result<string[], DomainError & { message: string }>> {
    // Not implemented for TemplateLoader
    return Promise.resolve({
      ok: false,
      error: createDomainError({
        kind: "NotConfigured",
        component: "TemplateLoader list functionality",
      }),
    });
  }

  validate(
    _template: Template,
  ): Result<void, DomainError & { message: string }> {
    // Basic validation
    return { ok: true, data: undefined };
  }

  private parseYAML(content: string): unknown {
    // Simplified YAML parsing - would use proper YAML library in production
    const result: Record<string, unknown> = {};
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (value) {
          result[key] = value.replace(/^["']|["']$/g, "");
        }
      }
    }

    return result;
  }

  private extractPlaceholders(content: string): string[] {
    // Extract all {placeholder} or {{placeholder}} patterns from the template
    // Support both single and double brace formats
    // Exclude JSON $ref patterns and object/array structures
    const placeholders: string[] = [];

    // First, remove JSON structures that shouldn't be treated as placeholders
    // This includes $ref and actual JSON object/array content
    let cleanContent = content;

    // Remove "$ref": "..." patterns
    cleanContent = cleanContent.replace(/"\$ref"\s*:\s*"[^"]*"/g, "");

    // Now extract placeholders, but only simple variable references
    // Match {word} or {{word}} or {path.to.field} but not JSON structures
    const placeholderRegex = /\{([a-zA-Z_][\w.]*)\}|\{\{([a-zA-Z_][\w.]*)\}\}/g;
    let match;

    while ((match = placeholderRegex.exec(cleanContent)) !== null) {
      // match[0] is the full match, match[1] is single brace content, match[2] is double brace content
      placeholders.push(match[0]); // Full placeholder including braces
    }

    // Return unique placeholders
    return [...new Set(placeholders)];
  }
}
