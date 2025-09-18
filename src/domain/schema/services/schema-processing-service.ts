import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaRepository } from "../repositories/schema-repository.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
import { BasePropertyPopulator } from "./base-property-populator.ts";
import { JMESPathFilterService } from "./jmespath-filter-service.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import {
  Decision,
  ErrorContextFactory,
  ProcessingProgress,
} from "../../shared/types/error-context.ts";

export type ProcessedSchema =
  | {
    readonly kind: "WithTemplate";
    readonly schema: Schema;
    readonly validationRules: ValidationRules;
    readonly templatePath: string;
  }
  | {
    readonly kind: "WithoutTemplate";
    readonly schema: Schema;
    readonly validationRules: ValidationRules;
  };

/**
 * Domain service responsible for Schema processing stage of the 3-stage pipeline.
 * Handles: SchemaDefinition → ValidationRules + BaseProperties extraction
 */
export class SchemaProcessingService {
  constructor(
    private readonly schemaRepository: SchemaRepository,
    private readonly basePropertyPopulator: BasePropertyPopulator,
    private readonly jmespathFilterService: JMESPathFilterService,
  ) {}

  /**
   * Load and process schema to extract validation rules and metadata.
   * Follows Totality principle - all paths return Result types.
   */
  processSchema(
    schemaPath: string,
  ): Result<ProcessedSchema, DomainError & { message: string }> {
    // Create ErrorContext for schema processing operation
    const contextResult = ErrorContextFactory.forDomainService(
      "SchemaProcessingService",
      "Process schema",
      "processSchema",
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data.withInput("schemaPath", schemaPath);

    // Create processing progress tracker
    const progressResult = ProcessingProgress.create(
      "Schema Processing",
      "Validating schema path",
      [],
      5,
    );
    if (!progressResult.ok) {
      return progressResult;
    }

    let currentContext = context.withProgress(progressResult.data);

    // Stage 1: Create and validate schema path
    const schemaPathResult = SchemaPath.create(schemaPath);
    if (!schemaPathResult.ok) {
      return schemaPathResult;
    }

    // Update progress: Schema path validated
    const progressAfterPath = ProcessingProgress.create(
      "Schema Processing",
      "Loading schema from repository",
      ["Validating schema path"],
      5,
    );
    if (progressAfterPath.ok) {
      currentContext = currentContext.withProgress(progressAfterPath.data);
    }

    // Stage 2: Load schema from repository
    const schemaResult = this.schemaRepository.load(schemaPathResult.data);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Update progress: Schema loaded
    const progressAfterLoad = ProcessingProgress.create(
      "Schema Processing",
      "Resolving schema references",
      ["Validating schema path", "Loading schema from repository"],
      5,
    );
    if (progressAfterLoad.ok) {
      currentContext = currentContext.withProgress(progressAfterLoad.data);
    }

    // Stage 3: Resolve schema references
    const resolvedSchemaResult = this.schemaRepository.resolve(
      schemaResult.data,
    );
    if (!resolvedSchemaResult.ok) {
      return resolvedSchemaResult;
    }

    const schema = resolvedSchemaResult.data;

    // Update progress: References resolved
    const progressAfterResolve = ProcessingProgress.create(
      "Schema Processing",
      "Extracting validation rules",
      [
        "Validating schema path",
        "Loading schema from repository",
        "Resolving schema references",
      ],
      5,
    );
    if (progressAfterResolve.ok) {
      currentContext = currentContext.withProgress(progressAfterResolve.data);
    }

    // Stage 4: Extract validation rules
    const validationRulesResult = schema.getValidationRules();
    if (!validationRulesResult.ok) {
      return err(validationRulesResult.error);
    }
    const validationRules = validationRulesResult.data;

    // Stage 5: Extract template path and create appropriate discriminated union
    const templatePathResult = schema.getTemplatePath();

    // Create decision tracking for template path resolution
    const templateDecisionResult = Decision.create(
      "Template path availability determination",
      ["WithTemplate", "WithoutTemplate"],
      templatePathResult.ok
        ? "Schema contains x-template attribute with valid path"
        : "Schema does not contain x-template attribute or path is invalid",
    );

    if (templateDecisionResult.ok) {
      currentContext = currentContext.withDecision(templateDecisionResult.data);
    }

    if (templatePathResult.ok) {
      return ok({
        kind: "WithTemplate",
        schema,
        validationRules,
        templatePath: templatePathResult.data,
      });
    } else {
      return ok({
        kind: "WithoutTemplate",
        schema,
        validationRules,
      });
    }
  }

  /**
   * Extract template path and resolve relative paths.
   * Returns Result with resolved path or error if no template specified.
   */
  resolveTemplatePath(
    schema: Schema,
    schemaPath: string,
  ): Result<string, DomainError & { message: string }> {
    const templatePathResult = schema.getTemplatePath();
    if (!templatePathResult.ok) {
      return templatePathResult;
    }
    const templatePath = templatePathResult.data;

    // Resolve relative template paths
    if (templatePath.startsWith("./")) {
      const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));
      const resolvedPath = schemaDir
        ? `${schemaDir}/${templatePath.substring(2)}`
        : templatePath.substring(2);
      return ok(resolvedPath);
    }

    return ok(templatePath);
  }

  /**
   * Extract items template path (x-template-items) and resolve relative paths.
   * Returns Result with resolved path or undefined if not specified.
   */
  resolveItemsTemplatePath(
    schema: Schema,
    schemaPath: string,
  ): Result<string | undefined, DomainError & { message: string }> {
    // Use proper domain method instead of unsafe type assertion
    const itemsTemplateResult = schema.getDefinition().getTemplateItems();

    if (!itemsTemplateResult.ok) {
      // x-template-items not defined, return undefined (not an error)
      return ok(undefined);
    }

    const itemsTemplatePath = itemsTemplateResult.data;

    if (!itemsTemplatePath) {
      return ok(undefined);
    }

    // Resolve relative template paths
    if (itemsTemplatePath.startsWith("./")) {
      const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));
      const resolvedPath = schemaDir
        ? `${schemaDir}/${itemsTemplatePath.substring(2)}`
        : itemsTemplatePath.substring(2);
      return ok(resolvedPath);
    }

    return ok(itemsTemplatePath);
  }

  /**
   * Apply JMESPath filtering to frontmatter data based on schema configuration
   * Returns filtered data if schema has x-jmespath-filter, otherwise returns original data
   *
   * @param data - FrontmatterData to potentially filter
   * @param schema - Schema containing potential JMESPath filter expression
   * @returns Result with filtered data or error if filtering fails
   */
  applyJMESPathFiltering(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const schemaDefinition = schema.getDefinition();

    // Check if schema has JMESPath filter directive
    if (!schemaDefinition.hasJMESPathFilter()) {
      // No filtering required - return original data
      return ok(data);
    }

    // Get the JMESPath expression
    const filterExpressionResult = schemaDefinition.getJMESPathFilter();
    if (!filterExpressionResult.ok) {
      return filterExpressionResult;
    }

    const expression = filterExpressionResult.data;

    // Apply the filter
    const filteredResult = this.jmespathFilterService.applyFilter(
      data,
      expression,
    );
    if (!filteredResult.ok) {
      return filteredResult;
    }

    // Convert filtered result back to FrontmatterData
    const filteredDataResult = FrontmatterData.create(filteredResult.data);
    if (!filteredDataResult.ok) {
      return filteredDataResult;
    }

    return ok(filteredDataResult.data);
  }

  /**
   * Apply JMESPath filtering to a specific property within a schema
   * Useful for filtering array items or nested objects with their own filter expressions
   *
   * @param data - FrontmatterData to filter
   * @param propertyPath - Path to the property in the schema (e.g., "commands", "metadata.tags")
   * @param schema - Schema containing the property with potential JMESPath filter
   * @returns Result with filtered data or original data if no filter is applied
   */
  applyPropertyJMESPathFiltering(
    data: FrontmatterData,
    propertyPath: string,
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const schemaDefinition = schema.getDefinition();

    // Find the property at the given path
    const propertyResult = schemaDefinition.findProperty(propertyPath);
    if (!propertyResult.ok) {
      // Property not found - return original data (no filtering)
      return ok(data);
    }

    // Create a temporary schema definition for the property
    const propertySchemaDefinition = SchemaDefinition.fromSchemaProperty(
      propertyResult.data,
    );

    // Check if the property has JMESPath filter
    if (!propertySchemaDefinition.hasJMESPathFilter()) {
      return ok(data);
    }

    // Get the filter expression for this property
    const filterExpressionResult = propertySchemaDefinition.getJMESPathFilter();
    if (!filterExpressionResult.ok) {
      return filterExpressionResult;
    }

    const expression = filterExpressionResult.data;

    // Apply the filter
    const filteredResult = this.jmespathFilterService.applyFilter(
      data,
      expression,
    );
    if (!filteredResult.ok) {
      return filteredResult;
    }

    // Convert filtered result back to FrontmatterData
    const filteredDataResult = FrontmatterData.create(filteredResult.data);
    if (!filteredDataResult.ok) {
      return filteredDataResult;
    }

    return ok(filteredDataResult.data);
  }
}
