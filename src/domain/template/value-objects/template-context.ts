/**
 * @fileoverview Template Context
 *
 * Provides the execution context for template rendering, containing
 * variable scope, rendering options, and metadata.
 */

import { TemplateIntermediateRepresentation } from "./template-intermediate-representation.ts";
import { VariableContext as _VariableContext } from "./variable-context.ts";

/**
 * Template Context for rendering execution
 *
 * Contains the runtime context needed for template variable resolution
 * and rendering operations, derived from Template IR.
 */
export interface TemplateContext {
  /** Main template variables and values */
  readonly mainVariables: Record<string, unknown>;

  /** Items array for {@items} expansion */
  readonly itemsData: unknown[] | undefined;

  /** Variable resolution context */
  readonly variableContext: Record<string, unknown>;

  /** Template rendering options */
  readonly renderingOptions: {
    /** Output format (json, yaml, xml, md) */
    readonly format: string;
    /** Whether to expand {@items} tokens */
    readonly expandItems: boolean;
    /** Template file paths */
    readonly templatePaths: {
      readonly main: string;
      readonly items: string | undefined;
    };
  };

  /** Processing metadata */
  readonly metadata: {
    /** Processing stage */
    readonly stage: string;
    /** Source schema path */
    readonly schemaPath: string;
    /** Variable mappings count */
    readonly mappingsCount: number;
  };
}

/**
 * Factory for creating Template Context from IR
 */
export class TemplateContextBuilder {
  /**
   * Create a Template Context from Template Intermediate Representation
   */
  static fromIR(ir: TemplateIntermediateRepresentation): TemplateContext {
    return {
      mainVariables: { ...ir.mainContext },
      itemsData: ir.itemsArray ? [...ir.itemsArray] : undefined,
      variableContext: TemplateContextBuilder.createVariableContext(ir),
      renderingOptions: {
        format: ir.outputFormat,
        expandItems: ir.itemsTemplatePath !== undefined,
        templatePaths: {
          main: ir.mainTemplatePath,
          items: ir.itemsTemplatePath,
        },
      },
      metadata: {
        stage: ir.metadata.stage,
        schemaPath: ir.metadata.schemaPath,
        mappingsCount: ir.variableMappings.length,
      },
    };
  }

  /**
   * Create variable context from IR variable mappings
   */
  private static createVariableContext(
    ir: TemplateIntermediateRepresentation,
  ): Record<string, unknown> {
    const context: Record<string, unknown> = { ...ir.mainContext };

    // Add items array if present
    if (ir.itemsArray) {
      context["@items"] = ir.itemsArray;
    }

    return context;
  }

  /**
   * Create a context for individual item rendering
   */
  static forItem(
    baseContext: TemplateContext,
    itemData: unknown,
    itemIndex: number,
  ): TemplateContext {
    return {
      mainVariables: itemData as Record<string, unknown>,
      itemsData: undefined, // Items don't have nested items
      variableContext: {
        ...baseContext.variableContext,
        "@index": itemIndex,
        "@item": itemData,
      },
      renderingOptions: {
        ...baseContext.renderingOptions,
        expandItems: false, // No nested expansion for items
      },
      metadata: {
        ...baseContext.metadata,
        stage: "item-rendering",
      },
    };
  }
}
