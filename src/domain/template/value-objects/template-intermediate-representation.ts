/**
 * @fileoverview Template Intermediate Representation (IR)
 *
 * The IR serves as a normalized intermediate layer between frontmatter processing
 * and template rendering, providing scope management and variable resolution.
 */

import { TemplateConfiguration } from "./template-configuration.ts";
import { VariableMapping } from "./variable-mapping.ts";
import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError as _DomainError } from "../../shared/types/errors.ts";
import type { DomainLogger } from "../../shared/interfaces/domain-logger.ts";
import {
  LogContext,
  LogMessages,
} from "../../shared/interfaces/domain-logger.ts";

/**
 * DDD-Compliant Debug Logger for TemplateIRBuilder
 * Environment-controlled debug logging using domain logger abstraction
 */
class IRDebugLogger {
  private static logger?: DomainLogger;
  private static logContext?: LogContext;

  static initialize(logger: DomainLogger): void {
    this.logger = logger;
    const contextResult = LogContext.create(
      "template",
      "ir-building",
      "template-intermediate-representation",
    );
    if (contextResult.ok) {
      this.logContext = contextResult.data;
    }
  }

  private static isEnabled(
    level: "error" | "warn" | "info" | "debug" | "verbose" = "debug",
  ): boolean {
    const debugLevel = Deno.env.get("DEBUG_LEVEL") || "none";
    const debugComponents = Deno.env.get("DEBUG_COMPONENTS")?.split(",") || [];

    if (debugLevel === "none") return false;
    if (debugComponents.length > 0 && !debugComponents.includes("ir")) {
      return false;
    }

    const levelPriority = { error: 0, warn: 1, info: 2, debug: 3, verbose: 4 };
    const currentPriority =
      levelPriority[debugLevel as keyof typeof levelPriority] ?? 0;
    const messagePriority = levelPriority[level];

    return messagePriority <= currentPriority;
  }

  static log(
    level: "error" | "warn" | "info" | "debug" | "verbose",
    message: string,
    data?: unknown,
  ): void {
    if (!this.isEnabled(level) || !this.logger || !this.logContext) return;

    const outputFormat = Deno.env.get("DEBUG_OUTPUT_FORMAT") || "plain";

    if (outputFormat === "json") {
      const structuredData = {
        timestamp: new Date().toISOString(),
        level,
        component: "ir",
        message,
        data,
      };
      this.logger.logStructured(this.logContext, structuredData);
    } else {
      const prefix = `[${level.toUpperCase()}] [IR] ${message}`;
      if (data) {
        this.logger.logTrace(
          this.logContext,
          LogMessages.trace(prefix, data),
        );
      } else {
        this.logger.logDebug(
          this.logContext,
          LogMessages.debug(prefix),
        );
      }
    }
  }

  static error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  static warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  static info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  static debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  static verbose(message: string, data?: unknown): void {
    this.log("verbose", message, data);
  }
}

/**
 * IR Builder Error Types
 */
export type IRBuilderError =
  | {
    kind: "IRBuilderValidationFailed";
    errors: string[];
    partialState: {
      mainTemplatePath?: string;
      outputFormat?: string;
      hasTemplateConfig: boolean;
    };
    message: string;
  }
  | {
    kind: "IRBuilderStateFailed";
    field: string;
    value: unknown;
    message: string;
  };

/**
 * Intermediate Representation for template processing
 *
 * Contains normalized variable scope, metadata, and template paths
 * to bridge the gap between directive processing and template rendering.
 */
export interface TemplateIntermediateRepresentation {
  /** Main template path specified by x-template */
  readonly mainTemplatePath: string;

  /** Items template path specified by x-template-items (optional) */
  readonly itemsTemplatePath: string | undefined;

  /** Output format derived from x-template-format or template file extension */
  readonly outputFormat: string;

  /** Normalized variable mappings for the main template context */
  readonly mainContext: Record<string, unknown>;

  /** Array of items for {@items} expansion (from x-frontmatter-part arrays) */
  readonly itemsArray: unknown[] | undefined;

  /** Template configuration derived from schema directives */
  readonly templateConfig: TemplateConfiguration;

  /** Variable mappings for scope resolution */
  readonly variableMappings: VariableMapping[];

  /** Metadata for processing context */
  readonly metadata: {
    /** Processing stage when IR was created */
    readonly stage: string;
    /** Source schema path */
    readonly schemaPath: string;
    /** Source data files processed */
    readonly sourceFiles: string[];
  };
}

/**
 * Factory for creating Template IR instances with enhanced debug capabilities
 */
export class TemplateIRBuilder {
  private mainTemplatePath?: string;
  private itemsTemplatePath?: string;
  private outputFormat?: string;
  private mainContext: Record<string, unknown> = {};
  private itemsArray?: unknown[];
  private templateConfig?: TemplateConfiguration;
  private variableMappings: VariableMapping[] = [];
  private metadata: {
    stage: string;
    schemaPath: string;
    sourceFiles: string[];
  } = {
    stage: "unknown",
    schemaPath: "",
    sourceFiles: [],
  };
  private buildCount = 0; // Debug counter for state tracking
  private readonly instanceId = Math.random().toString(36).substr(2, 9); // Unique instance tracking

  constructor(logger?: DomainLogger) {
    if (logger) {
      IRDebugLogger.initialize(logger);
    }
    IRDebugLogger.debug("TemplateIRBuilder instance created", {
      instanceId: this.instanceId,
    });
  }

  setMainTemplatePath(path: string): this {
    IRDebugLogger.debug("Setting main template path", {
      instanceId: this.instanceId,
      path,
      previousPath: this.mainTemplatePath,
    });
    this.mainTemplatePath = path;
    return this;
  }

  setItemsTemplatePath(path: string | undefined): this {
    IRDebugLogger.debug("Setting items template path", {
      instanceId: this.instanceId,
      path,
      previousPath: this.itemsTemplatePath,
    });
    this.itemsTemplatePath = path;
    return this;
  }

  setOutputFormat(format: string): this {
    IRDebugLogger.debug("Setting output format", {
      instanceId: this.instanceId,
      format,
      previousFormat: this.outputFormat,
    });
    this.outputFormat = format;
    return this;
  }

  setMainContext(context: Record<string, unknown>): this {
    IRDebugLogger.debug("Setting main context", {
      instanceId: this.instanceId,
      contextKeys: Object.keys(context),
      contextSize: Object.keys(context).length,
      previousContextSize: Object.keys(this.mainContext).length,
    });
    this.mainContext = { ...context };
    return this;
  }

  setItemsArray(items: unknown[] | undefined): this {
    IRDebugLogger.debug("Setting items array", {
      instanceId: this.instanceId,
      itemsLength: items?.length,
      hasItems: !!items,
      previousItemsLength: this.itemsArray?.length,
    });
    this.itemsArray = items ? [...items] : undefined;
    return this;
  }

  setTemplateConfig(config: TemplateConfiguration): this {
    IRDebugLogger.debug("Setting template configuration", {
      instanceId: this.instanceId,
      hasConfig: !!config,
      previousConfig: !!this.templateConfig,
    });
    this.templateConfig = config;
    return this;
  }

  setVariableMappings(mappings: VariableMapping[]): this {
    IRDebugLogger.debug("Setting variable mappings", {
      instanceId: this.instanceId,
      mappingsCount: mappings.length,
      previousMappingsCount: this.variableMappings.length,
    });
    this.variableMappings = [...mappings];
    return this;
  }

  setMetadata(metadata: {
    stage: string;
    schemaPath: string;
    sourceFiles: string[];
  }): this {
    IRDebugLogger.debug("Setting metadata", {
      instanceId: this.instanceId,
      stage: metadata.stage,
      schemaPath: metadata.schemaPath,
      sourceFilesCount: metadata.sourceFiles.length,
      previousStage: this.metadata.stage,
    });
    this.metadata = {
      stage: metadata.stage,
      schemaPath: metadata.schemaPath,
      sourceFiles: [...metadata.sourceFiles],
    };
    return this;
  }

  build(): Result<TemplateIntermediateRepresentation, IRBuilderError> {
    this.buildCount++;

    IRDebugLogger.info(`TemplateIRBuilder.build() called #${this.buildCount}`, {
      instanceId: this.instanceId,
      buildCount: this.buildCount,
    });

    // Comprehensive state validation with detailed logging
    const currentState = {
      mainTemplatePath: this.mainTemplatePath,
      itemsTemplatePath: this.itemsTemplatePath,
      outputFormat: this.outputFormat,
      mainContextSize: Object.keys(this.mainContext).length,
      itemsArrayLength: this.itemsArray?.length,
      hasTemplateConfig: !!this.templateConfig,
      variableMappingsCount: this.variableMappings.length,
      metadataStage: this.metadata.stage,
    };

    IRDebugLogger.debug("Builder state before validation", {
      instanceId: this.instanceId,
      buildCount: this.buildCount,
      state: currentState,
    });

    const validationErrors: string[] = [];

    if (!this.mainTemplatePath) {
      validationErrors.push("mainTemplatePath is required");
    }
    if (!this.outputFormat) {
      validationErrors.push("outputFormat is required");
    }
    if (!this.templateConfig) {
      validationErrors.push("templateConfig is required");
    }
    if (this.metadata.stage === "unknown") {
      validationErrors.push(
        "metadata.stage should be set to a specific processing stage",
      );
    }

    if (validationErrors.length > 0) {
      const errorDetails = {
        instanceId: this.instanceId,
        buildCount: this.buildCount,
        errors: validationErrors,
        partialState: {
          mainTemplatePath: this.mainTemplatePath,
          outputFormat: this.outputFormat,
          hasTemplateConfig: !!this.templateConfig,
        },
      };

      IRDebugLogger.error("IR Builder validation failed", errorDetails);

      return err({
        kind: "IRBuilderValidationFailed",
        errors: validationErrors,
        partialState: errorDetails.partialState,
        message: `IR Builder validation failed: ${validationErrors.join(", ")}`,
      });
    }

    // Build successful - create IR
    const ir: TemplateIntermediateRepresentation = {
      mainTemplatePath: this.mainTemplatePath!,
      itemsTemplatePath: this.itemsTemplatePath,
      outputFormat: this.outputFormat!,
      mainContext: { ...this.mainContext },
      itemsArray: this.itemsArray ? [...this.itemsArray] : undefined,
      templateConfig: this.templateConfig!,
      variableMappings: [...this.variableMappings],
      metadata: {
        stage: this.metadata.stage,
        schemaPath: this.metadata.schemaPath,
        sourceFiles: [...this.metadata.sourceFiles],
      },
    };

    IRDebugLogger.info(`IR build successful for: ${this.mainTemplatePath}`, {
      instanceId: this.instanceId,
      buildCount: this.buildCount,
      finalState: {
        mainTemplatePath: ir.mainTemplatePath,
        itemsTemplatePath: ir.itemsTemplatePath,
        outputFormat: ir.outputFormat,
        mainContextKeys: Object.keys(ir.mainContext),
        itemsArrayLength: ir.itemsArray?.length,
        variableMappingsCount: ir.variableMappings.length,
        stage: ir.metadata.stage,
        sourceFilesCount: ir.metadata.sourceFiles.length,
      },
    });

    return ok(ir);
  }

  /**
   * Get current builder state for debugging purposes
   */
  getDebugState(): Record<string, unknown> {
    return {
      instanceId: this.instanceId,
      buildCount: this.buildCount,
      mainTemplatePath: this.mainTemplatePath,
      itemsTemplatePath: this.itemsTemplatePath,
      outputFormat: this.outputFormat,
      mainContextKeys: Object.keys(this.mainContext),
      itemsArrayLength: this.itemsArray?.length,
      hasTemplateConfig: !!this.templateConfig,
      variableMappingsCount: this.variableMappings.length,
      metadataStage: this.metadata.stage,
      metadataSchemaPath: this.metadata.schemaPath,
      sourceFilesCount: this.metadata.sourceFiles.length,
    };
  }
}
