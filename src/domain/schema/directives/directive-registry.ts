/**
 * @fileoverview Enhanced Directive Registry - DDD and Totality compliant directive management
 * @description Combines configuration-driven approach with DirectiveHandler pattern
 * Following DDD, TDD, and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { parse } from "jsr:@std/yaml@1.0.5";
import {
  DirectiveHandler,
  DirectiveHandlerError,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";
import { SchemaExtensions } from "../value-objects/schema-property-types.ts";

/**
 * Configuration for a single directive
 */
export interface DirectiveConfig {
  readonly name: string;
  readonly stage: number;
  readonly description: string;
  readonly dependsOn: readonly string[];
}

/**
 * Complete directive configuration structure
 */
export interface DirectiveConfiguration {
  readonly directives: Record<string, {
    readonly name: string;
    readonly stage: number;
    readonly description: string;
    readonly dependsOn: readonly string[];
  }>;
}

/**
 * Directive dependency relationship
 */
export interface DirectiveDependency {
  readonly directive: string;
  readonly dependsOn: readonly string[];
  readonly stage: number;
  readonly description: string;
}

/**
 * Enhanced Directive Registry
 *
 * Combines configuration-driven approach with DirectiveHandler pattern.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No hardcoded directive processing
 * - Extensible handler registration
 */
export class DirectiveRegistry {
  private static instance: DirectiveRegistry | null = null;
  private readonly directives = new Map<string, DirectiveConfig>();
  private readonly nameToKey = new Map<string, string>();
  private readonly handlers = new Map<string, DirectiveHandler>();

  private constructor(config: DirectiveConfiguration) {
    for (const [key, directive] of Object.entries(config.directives)) {
      const directiveConfig: DirectiveConfig = {
        name: directive.name,
        stage: directive.stage,
        description: directive.description,
        dependsOn: directive.dependsOn,
      };

      this.directives.set(key, directiveConfig);
      this.nameToKey.set(directive.name, key);
    }
  }

  /**
   * Create registry from configuration
   */
  static create(
    config: DirectiveConfiguration,
  ): Result<DirectiveRegistry, DomainError & { message: string }> {
    try {
      const registry = new DirectiveRegistry(config);
      DirectiveRegistry.instance = registry;
      return ok(registry);
    } catch (error) {
      return ErrorHandler.system({
        operation: "create",
        method: "createRegistry",
      }).configurationError(
        `Failed to create directive registry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Load configuration from YAML file
   */
  static async loadFromFile(
    filePath: string,
  ): Promise<Result<DirectiveRegistry, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(filePath);
      const config = parse(content) as DirectiveConfiguration;
      return DirectiveRegistry.create(config);
    } catch (error) {
      return ErrorHandler.system({
        operation: "loadFromFile",
        method: "loadConfiguration",
      }).configurationError(
        `Failed to load directive configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Get singleton instance (must be initialized first)
   */
  static getInstance(): Result<
    DirectiveRegistry,
    DomainError & { message: string }
  > {
    if (!DirectiveRegistry.instance) {
      return ErrorHandler.system({
        operation: "getInstance",
        method: "checkInitialized",
      }).configurationError(
        "DirectiveRegistry not initialized. Call create() or loadFromFile() first.",
      );
    }
    return ok(DirectiveRegistry.instance);
  }

  /**
   * Get directive configuration by key
   */
  get(key: string): Result<DirectiveConfig, DomainError & { message: string }> {
    const directive = this.directives.get(key);
    if (!directive) {
      return ErrorHandler.system({
        operation: "get",
        method: "findDirective",
      }).configurationError(`Directive '${key}' not found in registry`);
    }
    return ok(directive);
  }

  /**
   * Get directive configuration by name
   */
  getByName(
    name: string,
  ): Result<DirectiveConfig, DomainError & { message: string }> {
    const key = this.nameToKey.get(name);
    if (!key) {
      return ErrorHandler.system({
        operation: "getByName",
        method: "findDirectiveByName",
      }).configurationError(
        `Directive with name '${name}' not found in registry`,
      );
    }
    return this.get(key);
  }

  /**
   * Get all directive names in processing order
   */
  getProcessingOrder(): string[] {
    const dependencies = Array.from(this.directives.values());

    // Sort by stage first, then by dependencies
    return dependencies
      .sort((a, b) => a.stage - b.stage)
      .map((d) => d.name);
  }

  /**
   * Get all directive dependencies
   */
  getAllDependencies(): DirectiveDependency[] {
    return Array.from(this.directives.entries()).map(([_key, config]) => ({
      directive: config.name,
      dependsOn: config.dependsOn.map((depKey) => {
        const depConfig = this.directives.get(depKey);
        return depConfig ? depConfig.name : depKey;
      }),
      stage: config.stage,
      description: config.description,
    }));
  }

  /**
   * Check if a directive is registered
   */
  has(key: string): boolean {
    return this.directives.has(key);
  }

  /**
   * Check if a directive name is registered
   */
  hasName(name: string): boolean {
    return this.nameToKey.has(name);
  }

  /**
   * Get all registered directive names
   */
  getAllNames(): string[] {
    return Array.from(this.nameToKey.keys());
  }

  /**
   * Get all registered directive keys
   */
  getAllKeys(): string[] {
    return Array.from(this.directives.keys());
  }

  // ===== NEW DIRECTIVE HANDLER METHODS =====

  /**
   * Register a directive handler
   * Following Totality principles with Result<T,E>
   */
  registerHandler(
    handler: DirectiveHandler,
  ): Result<void, DirectiveHandlerError> {
    if (!handler || handler.kind !== "DirectiveHandler") {
      return err({
        kind: "ValidationError",
        directiveName: handler?.directiveName || "unknown",
        message: "Invalid DirectiveHandler provided",
        invalidValue: handler,
      });
    }

    if (this.handlers.has(handler.directiveName)) {
      return err({
        kind: "ConfigurationError",
        directiveName: handler.directiveName,
        message:
          `Handler for directive '${handler.directiveName}' already registered`,
      });
    }

    this.handlers.set(handler.directiveName, handler);
    return ok(undefined);
  }

  /**
   * Get directive handler by name
   * Returns Result<T,E> following Totality principles
   */
  getHandler(
    directiveName: string,
  ): Result<DirectiveHandler, DirectiveHandlerError> {
    const handler = this.handlers.get(directiveName);
    if (!handler) {
      return err({
        kind: "ConfigurationError",
        directiveName,
        message: `No handler registered for directive '${directiveName}'`,
      });
    }
    return ok(handler);
  }

  /**
   * Get all registered handlers
   */
  getAllHandlers(): readonly DirectiveHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Extract all extensions from legacy schema using registered handlers
   * Replaces hardcoded if-condition chains in schema-property-migration
   * Following Totality principles with discriminated union handling
   */
  extractAllExtensions(
    legacySchema: LegacySchemaProperty,
  ): Result<SchemaExtensions, DirectiveHandlerError> {
    const extensions: Record<string, unknown> = {};

    // Process all registered handlers
    for (const handler of this.handlers.values()) {
      const extractionResult = handler.extractExtension(legacySchema);
      if (!extractionResult.ok) {
        return extractionResult;
      }

      // Handle discriminated union result
      const extractionData = extractionResult.data;
      if (extractionData.kind === "ExtensionFound") {
        extensions[extractionData.key] = extractionData.value;
      }
      // ExtensionNotApplicable case: do nothing (handler doesn't apply to this schema)
    }

    // Handle standard description property
    if (legacySchema.description !== undefined) {
      extensions.description = legacySchema.description;
    }

    return ok(extensions as SchemaExtensions);
  }

  /**
   * Get processing order based on handler priorities and dependencies
   * Returns handlers sorted by dependency order
   */
  getProcessingOrderByHandlers(): Result<
    readonly DirectiveHandler[],
    DirectiveHandlerError
  > {
    const handlers = Array.from(this.handlers.values());

    // Topological sort based on dependencies and priorities
    try {
      const sorted = this.topologicalSort(handlers);
      return ok(sorted);
    } catch (error) {
      return err({
        kind: "ConfigurationError",
        directiveName: "registry",
        message: `Failed to determine processing order: ${
          error instanceof Error ? error.message : String(error)
        }`,
        details: error,
      });
    }
  }

  /**
   * Check if handler is registered for directive
   */
  hasHandler(directiveName: string): boolean {
    return this.handlers.has(directiveName);
  }

  /**
   * Get all supported directive names (from handlers)
   */
  getSupportedDirectiveNames(): readonly string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Topological sort for dependency resolution
   * Private utility method
   */
  private topologicalSort(handlers: DirectiveHandler[]): DirectiveHandler[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: DirectiveHandler[] = [];
    const handlerMap = new Map(handlers.map((h) => [h.directiveName, h]));

    const visit = (handler: DirectiveHandler) => {
      if (visiting.has(handler.directiveName)) {
        throw new Error(
          `Circular dependency detected involving ${handler.directiveName}`,
        );
      }
      if (visited.has(handler.directiveName)) {
        return;
      }

      visiting.add(handler.directiveName);

      // Process dependencies first
      for (const dep of handler.getDependencies()) {
        const depHandler = handlerMap.get(dep);
        if (depHandler) {
          visit(depHandler);
        }
      }

      visiting.delete(handler.directiveName);
      visited.add(handler.directiveName);
      result.push(handler);
    };

    // Sort by priority first, then topological order
    const prioritySorted = handlers.sort((a, b) =>
      a.getPriority() - b.getPriority()
    );

    for (const handler of prioritySorted) {
      if (!visited.has(handler.directiveName)) {
        visit(handler);
      }
    }

    return result;
  }

  /**
   * Validate configuration structure
   */
  static validateConfiguration(
    config: unknown,
  ): Result<DirectiveConfiguration, DomainError & { message: string }> {
    try {
      if (!config || typeof config !== "object") {
        return ErrorHandler.system({
          operation: "validateConfiguration",
          method: "validateObjectType",
        }).configurationError("Configuration must be an object");
      }

      const typedConfig = config as Record<string, unknown>;

      if (
        !typedConfig.directives || typeof typedConfig.directives !== "object"
      ) {
        return ErrorHandler.system({
          operation: "validateConfiguration",
          method: "validateDirectivesProperty",
        }).configurationError("Configuration must have 'directives' object");
      }

      const directives = typedConfig.directives as Record<string, unknown>;

      for (const [key, directive] of Object.entries(directives)) {
        if (!directive || typeof directive !== "object") {
          return ErrorHandler.system({
            operation: "validateConfiguration",
            method: "validateDirectiveObject",
          }).configurationError(`Directive '${key}' must be an object`);
        }

        const dir = directive as Record<string, unknown>;

        if (typeof dir.name !== "string") {
          return ErrorHandler.system({
            operation: "validateConfiguration",
            method: "validateDirectiveName",
          }).configurationError(`Directive '${key}' must have string 'name'`);
        }

        if (typeof dir.stage !== "number") {
          return ErrorHandler.system({
            operation: "validateConfiguration",
            method: "validateDirectiveStage",
          }).configurationError(`Directive '${key}' must have number 'stage'`);
        }

        if (typeof dir.description !== "string") {
          return ErrorHandler.system({
            operation: "validateConfiguration",
            method: "validateDirectiveDescription",
          }).configurationError(
            `Directive '${key}' must have string 'description'`,
          );
        }

        if (!Array.isArray(dir.dependsOn)) {
          return ErrorHandler.system({
            operation: "validateConfiguration",
            method: "validateDirectiveDependencies",
          }).configurationError(
            `Directive '${key}' must have array 'dependsOn'`,
          );
        }
      }

      return ok(config as DirectiveConfiguration);
    } catch (error) {
      return ErrorHandler.system({
        operation: "validateConfiguration",
        method: "handleValidationError",
      }).configurationError(
        `Configuration validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
