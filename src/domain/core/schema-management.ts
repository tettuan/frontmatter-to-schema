/**
 * Dynamic Schema Management Layer - Following DDD boundary design
 * Manages loading, switching, and lifecycle of schemas at runtime
 */

import { createDomainError, type DomainError, type Result } from "./result.ts";
import {
  type ActiveSchema,
  type PromptContext,
  RuntimeSchemaInjector,
  type SchemaContext,
  type TemplateContext,
} from "./schema-injection.ts";

/**
 * Valid schema format for loading
 */
export class ValidSchema {
  private constructor(
    readonly name: string,
    readonly schema: unknown,
    readonly template: unknown,
    readonly prompts: {
      extraction: string;
      mapping: string;
    },
  ) {}

  static create(
    name: string,
    schema: unknown,
    template: unknown,
    prompts: { extraction: string; mapping: string },
  ): Result<ValidSchema, DomainError & { message: string }> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput", field: "name" }),
      };
    }

    if (!schema) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(schema),
          expectedFormat: "valid schema object",
        }),
      };
    }

    if (!template) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(template),
          expectedFormat: "valid template object",
        }),
      };
    }

    if (!prompts?.extraction || !prompts?.mapping) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "prompts",
          expectedFormat: "object with extraction and mapping fields",
        }),
      };
    }

    return {
      ok: true,
      data: new ValidSchema(name.trim(), schema, template, prompts),
    };
  }
}

/**
 * Schema Loader - Loads schemas from external sources
 */
export class SchemaLoader {
  constructor(
    private readonly fileSystem?: {
      readFile(path: string): Promise<string>;
    },
  ) {}

  /**
   * Load schema from file path
   */
  async loadSchema(
    path: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    if (!this.fileSystem) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "fileSystem",
        }),
      };
    }

    try {
      const content = await this.fileSystem.readFile(path);
      const schema = JSON.parse(content);
      return { ok: true, data: schema };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: path,
          details: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Load template from file path
   */
  async loadTemplate(
    path: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    if (!this.fileSystem) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "fileSystem",
        }),
      };
    }

    try {
      const content = await this.fileSystem.readFile(path);

      // Try JSON first
      try {
        const template = JSON.parse(content);
        return { ok: true, data: template };
      } catch {
        // If JSON fails, return raw content for YAML/other formats
        return { ok: true, data: content };
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: path,
          details: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Load prompts from file paths
   */
  async loadPrompts(
    extractionPath: string,
    mappingPath: string,
  ): Promise<
    Result<
      { extraction: string; mapping: string },
      DomainError & { message: string }
    >
  > {
    if (!this.fileSystem) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "fileSystem",
        }),
      };
    }

    try {
      const extraction = await this.fileSystem.readFile(extractionPath);
      const mapping = await this.fileSystem.readFile(mappingPath);
      return {
        ok: true,
        data: { extraction, mapping },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: `${extractionPath} or ${mappingPath}`,
          details: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Validate schema format
   */
  validateSchemaFormat(
    schema: unknown,
  ): Result<ValidSchema, DomainError & { message: string }> {
    // Basic validation - check if it's an object with expected structure
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(schema),
          expectedFormat: "object",
        }),
      };
    }

    // For now, accept any object as valid
    // In production, would validate against meta-schema
    return {
      ok: true,
      data: schema as unknown as ValidSchema,
    };
  }
}

/**
 * Schema Switcher - Manages switching between schemas at runtime
 */
export class SchemaSwitcher {
  private injector = new RuntimeSchemaInjector();
  private availableSchemas = new Map<string, ValidSchema>();

  /**
   * Register a schema for switching
   */
  registerSchema(
    validSchema: ValidSchema,
  ): Result<void, DomainError & { message: string }> {
    // Inject all components
    const schemaResult = this.injector.injectSchema(
      validSchema.name,
      validSchema.schema,
    );
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const templateResult = this.injector.injectTemplate(
      validSchema.name,
      validSchema.template,
    );
    if (!templateResult.ok) {
      return templateResult;
    }

    const promptResult = this.injector.injectPrompts(
      validSchema.name,
      validSchema.prompts.extraction,
      validSchema.prompts.mapping,
    );
    if (!promptResult.ok) {
      return promptResult;
    }

    this.availableSchemas.set(validSchema.name, validSchema);
    return { ok: true, data: undefined };
  }

  /**
   * Switch to a registered schema
   */
  switchToSchema(
    schemaName: string,
  ): Result<ActiveSchema, DomainError & { message: string }> {
    if (!this.availableSchemas.has(schemaName)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "schema",
          name: schemaName,
        }),
      };
    }

    return this.injector.activate(schemaName);
  }

  /**
   * Get current active schema
   */
  getCurrentSchema(): ActiveSchema | null {
    const schema = this.injector.getCurrentSchema();
    return schema.kind !== "None" ? schema : null;
  }

  /**
   * List available schemas
   */
  listAvailableSchemas(): string[] {
    return Array.from(this.availableSchemas.keys());
  }

  /**
   * Unregister a schema
   */
  unregisterSchema(schemaName: string): void {
    this.availableSchemas.delete(schemaName);
    this.injector.clearSchema(schemaName);
  }

  /**
   * Clear all schemas
   */
  clearAll(): void {
    this.availableSchemas.clear();
    this.injector.clearAll();
  }
}

/**
 * Dynamic Pipeline Factory - Creates pipelines based on runtime schema
 * @deprecated Use PipelineDomainFactory from component-factory.ts for better domain separation
 */
export class DynamicPipelineFactory {
  constructor(
    private readonly switcher: SchemaSwitcher,
    private readonly processors: Map<string, SchemaProcessor>,
  ) {}

  /**
   * Create pipeline for current schema
   */
  async createPipeline(
    config: ExecutionConfiguration,
  ): Promise<
    Result<ExecutablePipeline, DomainError & { message: string }>
  > {
    // Load and register schema
    const loader = new SchemaLoader(config.fileSystem);

    const schemaResult = await loader.loadSchema(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const templateResult = await loader.loadTemplate(config.templatePath);
    if (!templateResult.ok) {
      return templateResult;
    }

    const promptsResult = await loader.loadPrompts(
      config.promptPaths.extraction,
      config.promptPaths.mapping,
    );
    if (!promptsResult.ok) {
      return promptsResult;
    }

    const validSchemaResult = ValidSchema.create(
      config.name || "runtime-schema",
      schemaResult.data,
      templateResult.data,
      promptsResult.data,
    );
    if (!validSchemaResult.ok) {
      return validSchemaResult;
    }

    const registerResult = this.switcher.registerSchema(validSchemaResult.data);
    if (!registerResult.ok) {
      return registerResult;
    }

    const activateResult = this.switcher.switchToSchema(
      validSchemaResult.data.name,
    );
    if (!activateResult.ok) {
      return activateResult;
    }

    return {
      ok: true,
      data: new ExecutablePipeline(
        crypto.randomUUID(),
        config,
        activateResult.data,
        this.processors,
      ),
    };
  }
}

/**
 * Execution Configuration
 */
export interface ExecutionConfiguration {
  name?: string;
  schemaPath: string;
  templatePath: string;
  promptPaths: {
    extraction: string;
    mapping: string;
  };
  inputPath: string;
  outputPath: string;
  outputFormat: "json" | "yaml" | "xml";
  fileSystem?: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  };
}

/**
 * Executable Pipeline - One-time use pipeline with injected schema
 */
export class ExecutablePipeline {
  private executed = false;

  constructor(
    readonly id: string,
    readonly config: ExecutionConfiguration,
    private readonly activeSchema: ActiveSchema,
    private readonly processors: Map<string, SchemaProcessor>,
  ) {}

  /**
   * Execute the pipeline once
   */
  async execute(): Promise<
    Result<PipelineOutput, DomainError & { message: string }>
  > {
    if (this.executed) {
      return {
        ok: false,
        error: createDomainError({
          kind: "AlreadyExecuted",
          pipeline: this.id,
        }),
      };
    }

    if (this.activeSchema.kind !== "Loaded") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidState",
          expected: "Loaded",
          actual: this.activeSchema.kind,
        }),
      };
    }

    this.executed = true;

    // Get appropriate processor for this schema
    const processor = this.processors.get("default") ||
      this.processors.values().next().value;
    if (!processor) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "processor",
        }),
      };
    }

    // Process with injected schema
    const result = await processor.process(
      this.config.inputPath,
      this.activeSchema.schemaContext,
      this.activeSchema.templateContext,
      this.activeSchema.promptContext,
    );

    if (!result.ok) {
      return result;
    }

    // Write output
    if (this.config.fileSystem) {
      await this.config.fileSystem.writeFile(
        this.config.outputPath,
        this.formatOutput(result.data, this.config.outputFormat),
      );
    }

    return {
      ok: true,
      data: {
        id: this.id,
        output: result.data,
        outputPath: this.config.outputPath,
        format: this.config.outputFormat,
        executedAt: new Date(),
      },
    };
  }

  /**
   * Dispose of the pipeline
   */
  dispose(): void {
    this.executed = true;
    // Clean up resources if needed
  }

  private formatOutput(data: unknown, format: "json" | "yaml" | "xml"): string {
    switch (format) {
      case "json":
        return JSON.stringify(data, null, 2);
      case "yaml":
        // Simple YAML formatting - would use proper library
        return this.toYAML(data);
      case "xml":
        // Simple XML formatting - would use proper library
        return this.toXML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  private toYAML(data: unknown): string {
    // Simplified YAML generation
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    const lines: string[] = [];
    for (
      const [key, value] of Object.entries(data as Record<string, unknown>)
    ) {
      if (typeof value === "object" && value !== null) {
        lines.push(`${key}:`);
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          lines.push(`  ${k}: ${JSON.stringify(v)}`);
        }
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    return lines.join("\n");
  }

  private toXML(data: unknown): string {
    // Simplified XML generation
    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${
      this.objectToXML(data)
    }</root>`;
  }

  private objectToXML(data: unknown, indent = 1): string {
    if (typeof data !== "object" || data === null) {
      return String(data);
    }

    const spaces = "  ".repeat(indent);
    const lines: string[] = [];

    for (
      const [key, value] of Object.entries(data as Record<string, unknown>)
    ) {
      if (typeof value === "object" && value !== null) {
        lines.push(`${spaces}<${key}>`);
        lines.push(this.objectToXML(value, indent + 1));
        lines.push(`${spaces}</${key}>`);
      } else {
        lines.push(`${spaces}<${key}>${value}</${key}>`);
      }
    }

    return lines.join("\n");
  }
}

/**
 * Pipeline Output
 */
export interface PipelineOutput {
  id: string;
  output: unknown;
  outputPath: string;
  format: "json" | "yaml" | "xml";
  executedAt: Date;
}

/**
 * Schema Processor Interface
 */
export interface SchemaProcessor {
  process(
    inputPath: string,
    schemaContext: SchemaContext,
    templateContext: TemplateContext,
    promptContext: PromptContext,
  ): Promise<Result<unknown, DomainError & { message: string }>>;
}
