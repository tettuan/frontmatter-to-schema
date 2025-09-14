import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError, SchemaError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { VariableContext } from "../value-objects/variable-context.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { DebugLoggerFactory } from "../../../infrastructure/adapters/debug-logger.ts";

/**
 * Template-Schema Binding Service ensures consistency between template variables
 * and schema structure. Implements the architectural constraint that {@items}
 * variables are resolved from x-frontmatter-part hierarchy level.
 *
 * This service is part of the Template-Schema Binding Layer solution for
 * maintaining variable mapping consistency.
 */
export class TemplateSchemaBindingService {
  private constructor() {}
  private debugLogger = DebugLoggerFactory.create();

  /**
   * Smart Constructor following Totality principles.
   */
  static create(): Result<
    TemplateSchemaBindingService,
    TemplateError & { message: string }
  > {
    return ok(new TemplateSchemaBindingService());
  }

  /**
   * Creates a schema-aware variable context that respects hierarchy rules.
   * This replaces direct VariableContext creation to ensure proper binding.
   */
  createVariableContext(
    schema: Schema,
    data: FrontmatterData,
  ): Result<VariableContext, TemplateError & { message: string }> {
    this.debugLogger?.logInfo(
      "template-schema-binding",
      "Creating schema-aware variable context",
    );

    const contextResult = VariableContext.create(schema, data);
    if (!contextResult.ok) {
      return err(contextResult.error);
    }

    const context = contextResult.data;

    // Validate the binding if {@items} might be used
    const hasItemsTemplateResult = this.checkForItemsTemplate(schema);
    if (hasItemsTemplateResult.ok && hasItemsTemplateResult.data) {
      const validationResult = context.validateItemsResolution();
      if (!validationResult.ok) {
        this.debugLogger?.logError(
          "template-schema-binding",
          validationResult.error,
        );
        return err(validationResult.error);
      }

      this.debugLogger?.logInfo(
        "template-schema-binding",
        "Variable context validated for {@items} resolution",
        {
          hierarchyRoot: context.getHierarchyRoot(),
        },
      );
    }

    return ok(context);
  }

  /**
   * Validates template-schema binding consistency.
   * Ensures that template variables can be resolved from the schema structure.
   */
  validateBinding(
    schema: Schema,
    templateContent: string,
    data: FrontmatterData,
  ): Result<BindingValidationReport, TemplateError & { message: string }> {
    this.debugLogger?.logInfo(
      "template-schema-binding",
      "Starting binding validation",
    );

    const report = new BindingValidationReport();

    // Extract variables from template
    const variablesResult = this.extractTemplateVariables(templateContent);
    if (!variablesResult.ok) {
      return err(variablesResult.error);
    }

    const variables = variablesResult.data;
    report.totalVariables = variables.length;

    // Create variable context for validation
    const contextResult = this.createVariableContext(schema, data);
    if (!contextResult.ok) {
      return err(contextResult.error);
    }

    const context = contextResult.data;

    // Validate each variable
    for (const variable of variables) {
      const validationResult = this.validateVariable(variable, context);
      if (validationResult.ok) {
        report.validVariables.push(variable);
      } else {
        report.invalidVariables.push({
          variable,
          error: validationResult.error.message,
        });
      }
    }

    // Special validation for {@items} if present
    const itemsVariables = variables.filter(v => v === "@items");
    if (itemsVariables.length > 0) {
      const itemsValidationResult = this.validateItemsBinding(schema, data);
      if (!itemsValidationResult.ok) {
        report.itemsBindingError = itemsValidationResult.error.message;
      } else {
        report.itemsBindingValid = true;
        report.hierarchyRoot = context.getHierarchyRoot();
      }
    }

    this.debugLogger?.logInfo(
      "template-schema-binding",
      "Binding validation completed",
      {
        totalVariables: report.totalVariables,
        validVariables: report.validVariables.length,
        invalidVariables: report.invalidVariables.length,
        itemsBindingValid: report.itemsBindingValid,
      },
    );

    return ok(report);
  }

  /**
   * Checks if the schema has a template that might use {@items}.
   */
  private checkForItemsTemplate(
    schema: Schema,
  ): Result<boolean, TemplateError & { message: string }> {
    const templatePathResult = schema.getTemplatePath();
    if (!templatePathResult.ok) {
      // No template path means no {@items} usage
      return ok(false);
    }

    // For now, assume any schema with a template might use {@items}
    // In the future, we could analyze the actual template content
    return ok(true);
  }

  /**
   * Extracts template variables from content.
   * Supports both {variable} and {{variable}} syntax.
   */
  private extractTemplateVariables(
    content: string,
  ): Result<string[], TemplateError & { message: string }> {
    const variables = new Set<string>();

    // Extract double-brace variables: {{variable}}
    const doubleBraceRegex = /\{\{([^}]+)\}\}/g;
    let match;
    while ((match = doubleBraceRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    // Extract single-brace variables: {variable}
    const singleBraceRegex = /\{([^}]+)\}/g;
    while ((match = singleBraceRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return ok(Array.from(variables));
  }

  /**
   * Validates that a variable can be resolved within the given context.
   */
  private validateVariable(
    variable: string,
    context: VariableContext,
  ): Result<void, TemplateError & { message: string }> {
    const resolveResult = context.resolveVariable(variable);
    if (!resolveResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: `Variable '${variable}' cannot be resolved: ${resolveResult.error.message}`,
      }));
    }

    return ok(undefined);
  }

  /**
   * Validates {@items} binding specifically, ensuring proper hierarchy.
   */
  private validateItemsBinding(
    schema: Schema,
    data: FrontmatterData,
  ): Result<void, TemplateError & { message: string }> {
    // Check if schema has x-frontmatter-part
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: "Schema must have x-frontmatter-part for {@items} binding",
      }));
    }

    const hierarchyRoot = frontmatterPartResult.data;

    // Check if data has array at hierarchy root
    const rootDataResult = data.get(hierarchyRoot);
    if (!rootDataResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: `Data must contain array at hierarchy root: ${hierarchyRoot}`,
      }));
    }

    const rootData = rootDataResult.data;
    if (!Array.isArray(rootData)) {
      return err(createError({
        kind: "RenderFailed",
        message: `Hierarchy root ${hierarchyRoot} must be an array for {@items} binding`,
      }));
    }

    return ok(undefined);
  }

  /**
   * Creates item-specific variable contexts for array expansion.
   * Each array item gets its own context with proper hierarchical scope.
   */
  createItemContexts(
    schema: Schema,
    arrayData: unknown[],
  ): Result<VariableContext[], TemplateError & { message: string }> {
    const contexts: VariableContext[] = [];

    for (const item of arrayData) {
      const itemDataResult = FrontmatterData.create(item);
      if (!itemDataResult.ok) {
        return err(createError({
          kind: "RenderFailed",
          message: `Failed to create FrontmatterData for array item: ${itemDataResult.error.message}`,
        }));
      }

      const contextResult = this.createVariableContext(schema, itemDataResult.data);
      if (!contextResult.ok) {
        return err(contextResult.error);
      }

      contexts.push(contextResult.data);
    }

    return ok(contexts);
  }
}

/**
 * Report of template-schema binding validation results.
 */
export class BindingValidationReport {
  totalVariables: number = 0;
  validVariables: string[] = [];
  invalidVariables: Array<{ variable: string; error: string }> = [];
  itemsBindingValid: boolean = false;
  itemsBindingError?: string;
  hierarchyRoot?: string | null;

  /**
   * Checks if the binding is completely valid.
   */
  isValid(): boolean {
    return this.invalidVariables.length === 0 &&
           !this.itemsBindingError &&
           (this.totalVariables === 0 || this.validVariables.length > 0);
  }

  /**
   * Gets a summary of validation results.
   */
  getSummary(): string {
    if (this.isValid()) {
      return `Binding valid: ${this.validVariables.length}/${this.totalVariables} variables resolved`;
    }

    const errors = [];
    if (this.invalidVariables.length > 0) {
      errors.push(`${this.invalidVariables.length} invalid variables`);
    }
    if (this.itemsBindingError) {
      errors.push("@items binding error");
    }

    return `Binding invalid: ${errors.join(", ")}`;
  }
}