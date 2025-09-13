/**
 * Schema Injection Layer - Following DDD boundary design
 * Enables runtime schema injection and switching for complete variability
 */

import { createDomainError, type DomainError, type Result } from "./result.ts";

/**
 * Schema Context - Runtime injected schema information
 * Following Totality: all states are explicitly defined
 */
export class SchemaContext {
  private constructor(
    readonly id: string,
    readonly schema: unknown,
    readonly validationRules: unknown[],
    readonly createdAt: Date,
  ) {}

  static create(
    id: string,
    schema: unknown,
    validationRules?: unknown[],
  ): Result<SchemaContext, DomainError & { message: string }> {
    if (!id || id.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
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

    return {
      ok: true,
      data: new SchemaContext(
        id.trim(),
        schema,
        validationRules || [],
        new Date(),
      ),
    };
  }

  isExpired(maxAgeMs: number = 3600000): boolean {
    return Date.now() - this.createdAt.getTime() > maxAgeMs;
  }
}

/**
 * Template Context - Runtime injected template information
 */
export class TemplateContext {
  private constructor(
    readonly id: string,
    readonly template: unknown,
    readonly format: "json" | "yaml" | "xml",
    readonly createdAt: Date,
  ) {}

  static create(
    id: string,
    template: unknown,
    format: "json" | "yaml" | "xml" = "json",
  ): Result<TemplateContext, DomainError & { message: string }> {
    if (!id || id.trim() === "") {
      return {
        ok: false,
        error: createDomainError({ kind: "EmptyInput" }),
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

    return {
      ok: true,
      data: new TemplateContext(id.trim(), template, format, new Date()),
    };
  }
}

/**
 * Prompt Context - Runtime injected prompt information
 */
export class PromptContext {
  private constructor(
    readonly extractionPrompt: string,
    readonly mappingPrompt: string,
    readonly createdAt: Date,
  ) {}

  static create(
    extractionPrompt: string,
    mappingPrompt: string,
  ): Result<PromptContext, DomainError & { message: string }> {
    if (!extractionPrompt || extractionPrompt.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "extractionPrompt",
        }),
      };
    }

    if (!mappingPrompt || mappingPrompt.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "mappingPrompt",
        }),
      };
    }

    return {
      ok: true,
      data: new PromptContext(
        extractionPrompt.trim(),
        mappingPrompt.trim(),
        new Date(),
      ),
    };
  }
}

/**
 * Active Schema - Currently selected schema configuration
 * Discriminated union for different schema states
 */
export type ActiveSchema =
  | {
    kind: "Loaded";
    name: string;
    schemaContext: SchemaContext;
    templateContext: TemplateContext;
    promptContext: PromptContext;
    activatedAt: Date;
  }
  | {
    kind: "Loading";
    name: string;
    startedAt: Date;
  }
  | {
    kind: "Failed";
    name: string;
    error: DomainError & { message: string };
    failedAt: Date;
  }
  | {
    kind: "None";
  };

/**
 * Runtime Schema Injector - Manages schema injection at runtime
 */
export class RuntimeSchemaInjector {
  private currentSchema: ActiveSchema = { kind: "None" };
  private schemaCache = new Map<string, SchemaContext>();
  private templateCache = new Map<string, TemplateContext>();
  private promptCache = new Map<string, PromptContext>();

  /**
   * Inject schema at runtime
   */
  injectSchema(
    name: string,
    schema: unknown,
  ): Result<SchemaContext, DomainError & { message: string }> {
    const contextResult = SchemaContext.create(name, schema);
    if (!contextResult.ok) {
      return contextResult;
    }

    this.schemaCache.set(name, contextResult.data);
    return contextResult;
  }

  /**
   * Inject template at runtime
   */
  injectTemplate(
    name: string,
    template: unknown,
    format?: "json" | "yaml" | "xml",
  ): Result<TemplateContext, DomainError & { message: string }> {
    const contextResult = TemplateContext.create(name, template, format);
    if (!contextResult.ok) {
      return contextResult;
    }

    this.templateCache.set(name, contextResult.data);
    return contextResult;
  }

  /**
   * Inject prompts at runtime
   */
  injectPrompts(
    name: string,
    extractionPrompt: string,
    mappingPrompt: string,
  ): Result<PromptContext, DomainError & { message: string }> {
    const contextResult = PromptContext.create(
      extractionPrompt,
      mappingPrompt,
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    this.promptCache.set(name, contextResult.data);
    return contextResult;
  }

  /**
   * Activate a schema configuration
   */
  activate(
    name: string,
  ): Result<ActiveSchema, DomainError & { message: string }> {
    const schemaContext = this.schemaCache.get(name);
    const templateContext = this.templateCache.get(name);
    const promptContext = this.promptCache.get(name);

    if (!schemaContext) {
      const error = createDomainError({
        kind: "NotFound",
        resource: "schema",
        name,
      });
      this.currentSchema = {
        kind: "Failed",
        name,
        error,
        failedAt: new Date(),
      };
      return { ok: false, error };
    }

    if (!templateContext) {
      const error = createDomainError({
        kind: "NotFound",
        resource: "template",
        name,
      });
      this.currentSchema = {
        kind: "Failed",
        name,
        error,
        failedAt: new Date(),
      };
      return { ok: false, error };
    }

    if (!promptContext) {
      const error = createDomainError({
        kind: "NotFound",
        resource: "prompts",
        name,
      });
      this.currentSchema = {
        kind: "Failed",
        name,
        error,
        failedAt: new Date(),
      };
      return { ok: false, error };
    }

    this.currentSchema = {
      kind: "Loaded",
      name,
      schemaContext,
      templateContext,
      promptContext,
      activatedAt: new Date(),
    };

    return { ok: true, data: this.currentSchema };
  }

  /**
   * Get current active schema
   */
  getCurrentSchema(): ActiveSchema {
    return this.currentSchema;
  }

  /**
   * List available schemas
   */
  listAvailableSchemas(): string[] {
    const schemas = new Set<string>();
    for (const key of this.schemaCache.keys()) {
      schemas.add(key);
    }
    return Array.from(schemas);
  }

  /**
   * Clear a specific schema from cache
   */
  clearSchema(name: string): void {
    this.schemaCache.delete(name);
    this.templateCache.delete(name);
    this.promptCache.delete(name);

    if (
      this.currentSchema.kind === "Loaded" &&
      this.currentSchema.name === name
    ) {
      this.currentSchema = { kind: "None" };
    }
  }

  /**
   * Clear all schemas
   */
  clearAll(): void {
    this.schemaCache.clear();
    this.templateCache.clear();
    this.promptCache.clear();
    this.currentSchema = { kind: "None" };
  }
}

/**
 * Schema Injection Container - Dependency injection for schema-dependent components
 */
export class SchemaInjectionContainer {
  private bindings = new Map<string, unknown>();

  /**
   * Bind a schema or component at runtime
   */
  bind(
    key: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    if (!key || key.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "key",
        }),
      };
    }
    this.bindings.set(key.trim(), value);
    return { ok: true, data: undefined };
  }

  /**
   * Resolve a bound value
   */
  resolve<T>(key: string): Result<T, DomainError & { message: string }> {
    const value = this.bindings.get(key);
    if (value === undefined) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "binding",
          key,
        }),
      };
    }

    // Note: This cast is necessary due to TypeScript's limitation with generic resolution
    // The caller is responsible for ensuring T matches the bound value type
    return { ok: true, data: value as T };
  }

  /**
   * Check if a key is bound
   */
  has(key: string): boolean {
    return this.bindings.has(key);
  }

  /**
   * Clear a specific binding
   */
  unbind(key: string): void {
    this.bindings.delete(key);
  }

  /**
   * Clear all bindings
   */
  clear(): void {
    this.bindings.clear();
  }

  /**
   * Get all binding keys
   */
  keys(): string[] {
    return Array.from(this.bindings.keys());
  }
}

/**
 * Type guards for ActiveSchema
 */
export const isLoadedSchema = (
  schema: ActiveSchema,
): schema is Extract<ActiveSchema, { kind: "Loaded" }> => {
  return schema.kind === "Loaded";
};

export const isLoadingSchema = (
  schema: ActiveSchema,
): schema is Extract<ActiveSchema, { kind: "Loading" }> => {
  return schema.kind === "Loading";
};

export const isFailedSchema = (
  schema: ActiveSchema,
): schema is Extract<ActiveSchema, { kind: "Failed" }> => {
  return schema.kind === "Failed";
};

export const isNoSchema = (
  schema: ActiveSchema,
): schema is Extract<ActiveSchema, { kind: "None" }> => {
  return schema.kind === "None";
};
