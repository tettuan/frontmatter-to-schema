// Configuration loader implementation

import {
  type Result,
  type IOError,
  type ValidationError,
  createError,
} from "../../domain/shared/types.ts";
import {
  DocumentPath,
  ConfigPath,
  OutputPath,
} from "../../domain/models/value-objects.ts";
import {
  Schema,
  SchemaId,
  SchemaVersion,
  Template,
  TemplateId,
} from "../../domain/models/entities.ts";
import {
  SchemaDefinition,
  TemplateFormat,
  MappingRule,
} from "../../domain/models/value-objects.ts";
import type {
  ConfigurationRepository,
  SchemaRepository,
  TemplateRepository,
  ResultRepository,
  ProcessingConfiguration,
  AnalysisConfiguration,
} from "../../domain/services/interfaces.ts";
import type { AggregatedResult, AnalysisResult } from "../../domain/models/entities.ts";

export class ConfigurationLoader implements ConfigurationRepository, SchemaRepository, ResultRepository {
  async loadProcessingConfig(
    path: ConfigPath
  ): Promise<Result<ProcessingConfiguration, IOError & { message: string }>> {
    try {
      const configPath = path.getValue();
      const content = await Deno.readTextFile(configPath);
      const config = JSON.parse(content);

      // Validate and create value objects
      const documentsPathResult = DocumentPath.create(config.documentsPath || config.documents_path || ".");
      if (!documentsPathResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: configPath,
            reason: "Invalid documents path"
          })
        };
      }

      const schemaPathResult = ConfigPath.create(config.schemaPath || config.schema_path || "schema.json");
      if (!schemaPathResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: configPath,
            reason: "Invalid schema path"
          })
        };
      }

      const templatePathResult = ConfigPath.create(config.templatePath || config.template_path || "template.json");
      if (!templatePathResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: configPath,
            reason: "Invalid template path"
          })
        };
      }

      const outputPathResult = OutputPath.create(config.outputPath || config.output_path || "output.json");
      if (!outputPathResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: configPath,
            reason: "Invalid output path"
          })
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
        }
      };

      return { ok: true, data: processingConfig };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  async loadAnalysisConfig(
    path: ConfigPath
  ): Promise<Result<AnalysisConfiguration, IOError & { message: string }>> {
    try {
      const configPath = path.getValue();
      const content = await Deno.readTextFile(configPath);
      const config = JSON.parse(content);

      const promptsPathResult = config.promptsPath ? ConfigPath.create(config.promptsPath) : null;
      const analysisConfig: AnalysisConfiguration = {
        promptsPath: promptsPathResult && promptsPathResult.ok ? promptsPathResult.data : undefined,
        extractionPrompt: config.extractionPrompt,
        mappingPrompt: config.mappingPrompt,
        aiProvider: config.aiProvider || "claude",
        aiConfig: {
          apiKey: config.aiConfig?.apiKey || Deno.env.get("CLAUDE_API_KEY"),
          model: config.aiConfig?.model || "claude-3-sonnet",
          maxTokens: config.aiConfig?.maxTokens || 4000,
          temperature: config.aiConfig?.temperature || 0.7,
        }
      };

      return { ok: true, data: analysisConfig };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  async load(path: ConfigPath): Promise<Result<Schema, IOError & { message: string }>> {
    try {
      const schemaPath = path.getValue();
      const content = await Deno.readTextFile(schemaPath);
      const schemaData = JSON.parse(content);

      const idResult = SchemaId.create(schemaData.id || "default-schema");
      if (!idResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: schemaPath,
            reason: "Invalid schema ID"
          })
        };
      }

      const definitionResult = SchemaDefinition.create(
        schemaData.properties || schemaData,
        schemaData.version || "1.0.0"
      );
      if (!definitionResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: schemaPath,
            reason: "Invalid schema definition"
          })
        };
      }

      const versionResult = SchemaVersion.create(schemaData.version || "1.0.0");
      if (!versionResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: schemaPath,
            reason: "Invalid schema version"
          })
        };
      }

      const schema = Schema.create(
        idResult.data,
        definitionResult.data,
        versionResult.data,
        schemaData.description || ""
      );

      return { ok: true, data: schema };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  validate(
    config: ProcessingConfiguration | AnalysisConfiguration | Schema | Template
  ): Result<void, ValidationError & { message: string }> {
    // Basic validation - can be extended
    return { ok: true, data: undefined };
  }

  async save(
    result: AggregatedResult,
    path: OutputPath
  ): Promise<Result<void, IOError & { message: string }>> {
    try {
      const output = result.toOutput();
      await Deno.writeTextFile(path.getValue(), output);
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createError({ kind: "PermissionDenied", path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "WriteError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  async append(
    result: AnalysisResult,
    path: OutputPath
  ): Promise<Result<void, IOError & { message: string }>> {
    try {
      const data = result.getMappedData().toJSON();
      await Deno.writeTextFile(path.getValue(), `${data}\n`, { append: true });
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "WriteError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }
}

// Template repository implementation
export class TemplateLoader implements TemplateRepository {
  async load(path: ConfigPath): Promise<Result<Template, IOError & { message: string }>> {
    try {
      const templatePath = path.getValue();
      const content = await Deno.readTextFile(templatePath);
      
      // Detect format
      let format: "json" | "yaml" | "toml";
      let templateData: any;

      if (templatePath.endsWith(".json")) {
        format = "json";
        templateData = JSON.parse(content);
      } else if (templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")) {
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

      const idResult = TemplateId.create(templateData.id || "default-template");
      if (!idResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: templatePath,
            reason: "Invalid template ID"
          })
        };
      }

      const formatResult = TemplateFormat.create(format, content);
      if (!formatResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ReadError",
            path: templatePath,
            reason: "Invalid template format"
          })
        };
      }

      // Create mapping rules from template metadata if present
      const mappingRules: MappingRule[] = [];
      if (templateData.mappings) {
        for (const mapping of templateData.mappings) {
          const ruleResult = MappingRule.create(
            mapping.source,
            mapping.target,
            mapping.transform
          );
          if (ruleResult.ok) {
            mappingRules.push(ruleResult.data);
          }
        }
      }

      const template = Template.create(
        idResult.data,
        formatResult.data,
        mappingRules,
        templateData.description || ""
      );

      return { ok: true, data: template };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createError({ kind: "FileNotFound", path: path.getValue() })
        };
      }
      return {
        ok: false,
        error: createError({
          kind: "ReadError",
          path: path.getValue(),
          reason: error instanceof Error ? error.message : "Unknown error"
        })
      };
    }
  }

  validate(template: Template): Result<void, ValidationError & { message: string }> {
    // Basic validation
    return { ok: true, data: undefined };
  }

  private parseYAML(content: string): any {
    // Simplified YAML parsing - would use proper YAML library in production
    const result: any = {};
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
}