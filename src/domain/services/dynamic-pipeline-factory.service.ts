/**
 * DynamicPipelineFactory service
 * Extracted from schema-management.ts for better domain separation
 * Creates pipelines based on runtime schema configuration
 *
 * @deprecated Use PipelineDomainFactory from component-factory.ts for better domain separation
 */

import type { DomainError, Result } from "../core/result.ts";
import type {
  ExecutionConfiguration,
  SchemaProcessor,
} from "../types/pipeline-types.ts";
import { ValidSchema } from "../value-objects/valid-schema.value-object.ts";
import { SchemaLoader } from "./schema-loader.service.ts";
// deno-lint-ignore verbatim-module-syntax
import { SchemaSwitcher } from "./schema-switcher.service.ts";
import { ExecutablePipeline } from "./executable-pipeline.service.ts";

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
