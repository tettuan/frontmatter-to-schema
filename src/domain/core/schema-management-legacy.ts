/**
 * Legacy API compatibility wrapper
 * Provides backward compatibility for existing tests during transition
 * @deprecated This file maintains old API during migration to Totality-compliant design
 */

import {
  type FileSystemAdapter,
  SchemaLoader as NewSchemaLoader,
} from "../services/schema-loader.service.ts";
import { SchemaSwitcher as NewSchemaSwitcher } from "../services/schema-switcher.service.ts";
import type { ValidSchema } from "../value-objects/valid-schema.value-object.ts";
import type { DomainError, Result } from "../core/result.ts";
import type { ActiveSchema } from "../core/schema-injection.ts";

/**
 * Legacy SchemaLoader wrapper maintaining old API using composition
 */
export class SchemaLoader {
  private impl: NewSchemaLoader;

  constructor(fileSystem?: FileSystemAdapter) {
    this.impl = new NewSchemaLoader(fileSystem);
  }

  // Forward all methods to the implementation
  async loadSchema(
    path: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    return await this.impl.loadSchema(path);
  }

  async loadTemplate(
    path: string,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    return await this.impl.loadTemplate(path);
  }

  async loadPrompts(
    extractionPath: string,
    mappingPath: string,
  ): Promise<
    Result<
      { extraction: string; mapping: string },
      DomainError & { message: string }
    >
  > {
    return await this.impl.loadPrompts(extractionPath, mappingPath);
  }

  createValidSchema(
    name: string,
    schema: unknown,
    template: unknown,
    prompts: { extraction: string; mapping: string },
  ): Result<ValidSchema, DomainError & { message: string }> {
    return this.impl.createValidSchema(name, schema, template, prompts);
  }

  validateSchemaStructure(
    schema: unknown,
  ): Result<boolean, DomainError & { message: string }> {
    return this.impl.validateSchemaStructure(schema);
  }

  // Legacy method for backward compatibility
  validateSchemaFormat(
    schema: unknown,
  ): Result<ValidSchema, DomainError & { message: string }> {
    return this.impl.validateSchemaFormat(schema);
  }
}

/**
 * Legacy SchemaSwitcher wrapper maintaining old API using composition
 */
export class SchemaSwitcher {
  private impl: NewSchemaSwitcher;

  constructor() {
    this.impl = new NewSchemaSwitcher();
  }

  // Forward methods to implementation
  registerSchema(
    validSchema: ValidSchema,
  ): Result<void, DomainError & { message: string }> {
    return this.impl.registerSchema(validSchema);
  }

  switchToSchema(
    schemaName: string,
  ): Result<ActiveSchema, DomainError & { message: string }> {
    return this.impl.switchToSchema(schemaName);
  }

  // Legacy method returning nullable for backward compatibility
  getCurrentSchema(): ActiveSchema | null {
    return this.impl.getCurrentSchemaLegacy();
  }

  listAvailableSchemas(): string[] {
    return this.impl.listAvailableSchemas();
  }

  hasSchema(schemaName: string): boolean {
    return this.impl.hasSchema(schemaName);
  }

  getSchema(
    schemaName: string,
  ): Result<ValidSchema, DomainError & { message: string }> {
    return this.impl.getSchema(schemaName);
  }

  unregisterSchema(schemaName: string): void {
    return this.impl.unregisterSchema(schemaName);
  }

  clearAll(): void {
    return this.impl.clearAll();
  }
}

// Re-export everything else unchanged
export { ValidSchema } from "../value-objects/valid-schema.value-object.ts";
export { ExecutablePipeline } from "../services/executable-pipeline.service.ts";
export { DynamicPipelineFactory } from "../services/dynamic-pipeline-factory.service.ts";
export type {
  ExecutionConfiguration,
  PipelineOutput,
  SchemaProcessor,
} from "../types/pipeline-types.ts";
export type { FileSystemAdapter };
