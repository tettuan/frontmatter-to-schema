/**
 * SchemaSwitcher service
 * Extracted from schema-management.ts for better domain separation
 * Manages switching between schemas at runtime
 * Follows DDD principles with proper domain service responsibilities
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import {
  type ActiveSchema,
  RuntimeSchemaInjector,
} from "../core/schema-injection.ts";
import type { ValidSchema } from "../value-objects/valid-schema.value-object.ts";

/**
 * Schema Switcher service - Manages switching between schemas at runtime
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
   * Get current active schema (Totality-compliant - no nulls)
   */
  getCurrentSchema(): Result<ActiveSchema, DomainError & { message: string }> {
    const schema = this.injector.getCurrentSchema();
    if (schema.kind === "None") {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "active schema",
        }),
      };
    }
    return { ok: true, data: schema };
  }

  /**
   * List available schemas
   */
  listAvailableSchemas(): string[] {
    return Array.from(this.availableSchemas.keys());
  }

  /**
   * Check if schema is registered
   */
  hasSchema(schemaName: string): boolean {
    return this.availableSchemas.has(schemaName);
  }

  /**
   * Get registered schema
   */
  getSchema(
    schemaName: string,
  ): Result<ValidSchema, DomainError & { message: string }> {
    const schema = this.availableSchemas.get(schemaName);
    if (!schema) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "schema",
          name: schemaName,
        }),
      };
    }
    return { ok: true, data: schema };
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

  /**
   * Backward compatibility method for tests (returns nullable)
   * @deprecated Use getCurrentSchema() which returns Result<ActiveSchema, Error> for Totality compliance
   */
  getCurrentSchemaLegacy(): ActiveSchema | null {
    const result = this.getCurrentSchema();
    return result.ok ? result.data : null;
  }
}
