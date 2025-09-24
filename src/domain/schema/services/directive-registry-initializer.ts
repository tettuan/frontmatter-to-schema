/**
 * @fileoverview Directive Registry Initializer
 * @description Initializes and configures the DirectiveRegistry with all available handlers
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { DirectiveRegistry } from "../directives/directive-registry.ts";
import { DirectiveHandlerError } from "../interfaces/directive-handler.ts";
import { TemplateDirectiveHandler } from "../handlers/template-directive-handler.ts";
import { TemplateItemsDirectiveHandler } from "../handlers/template-items-directive-handler.ts";
import { JMESPathFilterDirectiveHandler } from "../handlers/jmespath-filter-directive-handler.ts";
import { FlattenArraysDirectiveHandler } from "../handlers/flatten-arrays-directive-handler.ts";
import { FrontmatterPartDirectiveHandler } from "../handlers/frontmatter-part-directive-handler.ts";

/**
 * Registry initialization result
 */
interface RegistryInitializationResult {
  readonly registry: DirectiveRegistry;
  readonly handlersRegistered: readonly string[];
}

/**
 * Directive Registry Initializer Service
 *
 * Provides centralized initialization of the DirectiveRegistry with all available handlers.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No hardcoded handler instantiation
 */
export class DirectiveRegistryInitializer {
  private constructor() {
    // Private constructor for Smart Constructor pattern
  }

  /**
   * Initialize DirectiveRegistry with default configuration and all available handlers
   * Smart Constructor pattern returning Result<T,E>
   */
  static initializeWithDefaults(): Result<
    RegistryInitializationResult,
    DomainError & { message: string }
  > {
    try {
      // Create default directive configuration
      const defaultConfig = this.createDefaultConfiguration();

      // Create registry instance
      const registryResult = DirectiveRegistry.create(defaultConfig);
      if (!registryResult.ok) {
        return registryResult;
      }

      const registry = registryResult.data;

      // Register all available handlers
      const handlersResult = this.registerAllHandlers(registry);
      if (!handlersResult.ok) {
        return err({
          kind: "ConfigurationError",
          message:
            `Failed to register handlers: ${handlersResult.error.message}`,
        });
      }

      return ok({
        registry,
        handlersRegistered: handlersResult.data,
      });
    } catch (error) {
      return ErrorHandler.system({
        operation: "initializeWithDefaults",
        method: "initialize",
      }).configurationError(
        `Registry initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Register all available directive handlers
   */
  private static registerAllHandlers(
    registry: DirectiveRegistry,
  ): Result<readonly string[], DirectiveHandlerError> {
    const registeredHandlers: string[] = [];

    // Register Frontmatter Part Handler
    const frontmatterPartHandlerResult = FrontmatterPartDirectiveHandler
      .create();
    if (!frontmatterPartHandlerResult.ok) {
      return err({
        kind: "ConfigurationError",
        directiveName: "frontmatter-part",
        message: "Failed to create FrontmatterPartDirectiveHandler",
        details: frontmatterPartHandlerResult.error,
      });
    }

    const frontmatterPartRegisterResult = registry.registerHandler(
      frontmatterPartHandlerResult.data,
    );
    if (!frontmatterPartRegisterResult.ok) {
      return frontmatterPartRegisterResult;
    }
    registeredHandlers.push("frontmatter-part");

    // Register Template Handler
    const templateHandlerResult = TemplateDirectiveHandler.create();
    if (!templateHandlerResult.ok) {
      return err({
        kind: "ConfigurationError",
        directiveName: "template",
        message: "Failed to create TemplateDirectiveHandler",
        details: templateHandlerResult.error,
      });
    }

    const templateRegisterResult = registry.registerHandler(
      templateHandlerResult.data,
    );
    if (!templateRegisterResult.ok) {
      return templateRegisterResult;
    }
    registeredHandlers.push("template");

    // Register Template Items Handler
    const templateItemsHandlerResult = TemplateItemsDirectiveHandler.create();
    if (!templateItemsHandlerResult.ok) {
      return err({
        kind: "ConfigurationError",
        directiveName: "template-items",
        message: "Failed to create TemplateItemsDirectiveHandler",
        details: templateItemsHandlerResult.error,
      });
    }

    const templateItemsRegisterResult = registry.registerHandler(
      templateItemsHandlerResult.data,
    );
    if (!templateItemsRegisterResult.ok) {
      return templateItemsRegisterResult;
    }
    registeredHandlers.push("template-items");

    // Register JMESPath Filter Handler
    const jmespathHandlerResult = JMESPathFilterDirectiveHandler.create();
    if (!jmespathHandlerResult.ok) {
      return err({
        kind: "ConfigurationError",
        directiveName: "jmespath-filter",
        message: "Failed to create JMESPathFilterDirectiveHandler",
        details: jmespathHandlerResult.error,
      });
    }

    const jmespathRegisterResult = registry.registerHandler(
      jmespathHandlerResult.data,
    );
    if (!jmespathRegisterResult.ok) {
      return jmespathRegisterResult;
    }
    registeredHandlers.push("jmespath-filter");

    // Register Flatten Arrays Handler
    const flattenHandlerResult = FlattenArraysDirectiveHandler.create();
    if (!flattenHandlerResult.ok) {
      return err({
        kind: "ConfigurationError",
        directiveName: "flatten-arrays",
        message: "Failed to create FlattenArraysDirectiveHandler",
        details: flattenHandlerResult.error,
      });
    }

    const flattenRegisterResult = registry.registerHandler(
      flattenHandlerResult.data,
    );
    if (!flattenRegisterResult.ok) {
      return flattenRegisterResult;
    }
    registeredHandlers.push("flatten-arrays");

    // TODO: Add more handlers as they are implemented
    // - DerivedFromDirectiveHandler
    // - DerivedUniqueDirectiveHandler
    // - TemplateFormatDirectiveHandler

    return ok(registeredHandlers);
  }

  /**
   * Create default directive configuration
   */
  private static createDefaultConfiguration() {
    return {
      directives: {
        "template": {
          name: "template",
          stage: 8,
          description: "Template Processing",
          dependsOn: [],
        },
        "frontmatter-part": {
          name: "frontmatter-part",
          stage: 1,
          description: "Data Structure Foundation",
          dependsOn: [],
        },
        "derived-from": {
          name: "derived-from",
          stage: 6,
          description: "Field Derivation",
          dependsOn: ["frontmatter-part"],
        },
        "flatten-arrays": {
          name: "flatten-arrays",
          stage: 3,
          description: "Array Flattening",
          dependsOn: ["frontmatter-part"],
        },
        "jmespath-filter": {
          name: "jmespath-filter",
          stage: 4,
          description: "JMESPath Filtering",
          dependsOn: ["flatten-arrays"],
        },
        "derived-unique": {
          name: "derived-unique",
          stage: 7,
          description: "Uniqueness Processing",
          dependsOn: ["derived-from"],
        },
        "template-items": {
          name: "template-items",
          stage: 9,
          description: "Items Template Processing",
          dependsOn: ["template"],
        },
        "template-format": {
          name: "template-format",
          stage: 10,
          description: "Format Processing",
          dependsOn: ["template-items"],
        },
      },
    };
  }

  /**
   * Get singleton registry instance (must be initialized first)
   * Convenience method for accessing initialized registry
   */
  static getRegistry(): Result<
    DirectiveRegistry,
    DomainError & { message: string }
  > {
    return DirectiveRegistry.getInstance();
  }
}
