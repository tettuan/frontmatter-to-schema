/**
 * @module tests/helpers/specification-test-framework
 * @description Specification-driven test framework for business requirement validation
 * Addresses Issue #890 - migrating from mock-driven to specification-driven testing
 */

import { assert } from "jsr:@std/assert";
import { Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";
import { TestEnvironmentManager } from "./robust-test-utilities.ts";

/**
 * Business requirement validation framework for specification-driven testing
 * Replaces mock-focused testing with business rule validation
 */
export class BusinessRequirementValidator {
  /**
   * Validate that a result meets specified business requirements
   * Replaces brittle mock assertion patterns
   */
  static validateBusinessRequirement<T, E>(
    result: Result<T, E>,
    requirement: BusinessRequirement<T>,
    context?: ValidationContext,
  ): BusinessValidationResult {
    // Use robust test utilities for Result validation
    if (!result.ok) {
      return {
        isValid: false,
        requirement: requirement.name,
        violation: `Business requirement failed with error: ${
          JSON.stringify(result.error)
        }`,
        context: context?.description || "unknown",
      };
    }

    // Apply business rule validation
    const validationResult = requirement.validator(result.data);

    return {
      isValid: validationResult.isValid,
      requirement: requirement.name,
      violation: validationResult.isValid
        ? undefined
        : validationResult.violation,
      context: context?.description || "business-requirement-validation",
      actualValue: result.data,
      expectedCriteria: requirement.description,
    };
  }

  /**
   * Validate multiple business requirements simultaneously
   * Enables comprehensive business rule testing
   */
  static validateMultipleRequirements<T, E>(
    result: Result<T, E>,
    requirements: BusinessRequirement<T>[],
    context?: ValidationContext,
  ): BusinessValidationSummary {
    const validations = requirements.map((requirement) =>
      this.validateBusinessRequirement(result, requirement, context)
    );

    const failedValidations = validations.filter((v) => !v.isValid);

    return {
      overallValid: failedValidations.length === 0,
      totalRequirements: requirements.length,
      passedRequirements: validations.length - failedValidations.length,
      failedRequirements: failedValidations.length,
      violations: failedValidations.map((v) => ({
        requirement: v.requirement,
        violation: v.violation || "unknown violation",
      })),
      context: context?.description || "multi-requirement-validation",
    };
  }

  /**
   * Create business scenario test from requirements
   * Replaces mock setup with business scenario definition
   */
  static createBusinessScenario<TInput, TOutput, E>(
    scenario: BusinessScenario<TInput, TOutput, E>,
  ): BusinessScenarioTest<TInput, TOutput, E> {
    return {
      name: scenario.name,
      description: scenario.description,
      execute: async (input: TInput) => {
        // Execute business scenario in isolated environment
        return await TestEnvironmentManager.withIsolatedEnvironment(
          `business-scenario-${scenario.name}`,
          () => ({
            resources: scenario.requiredResources || {},
            cleanup: scenario.cleanup,
          }),
          async (env) => {
            try {
              const result = await scenario.execute(input, env);

              // Validate business requirements
              const validation = this.validateMultipleRequirements(
                result,
                scenario.requirements,
                { description: `business-scenario-${scenario.name}` },
              );

              if (!validation.overallValid) {
                return {
                  ok: false,
                  error: {
                    kind: "BusinessRequirementViolation" as E,
                    scenario: scenario.name,
                    violations: validation.violations,
                  } as E,
                };
              }

              return result;
            } catch (error) {
              return {
                ok: false,
                error: {
                  kind: "BusinessScenarioError" as E,
                  scenario: scenario.name,
                  originalError: error,
                } as E,
              };
            }
          },
        );
      },
      validateRequirements: (result: Result<TOutput, E>) => {
        return this.validateMultipleRequirements(result, scenario.requirements);
      },
    };
  }
}

/**
 * Domain rule testing utilities for specification-driven testing
 * Validates domain-specific business rules instead of implementation details
 */
export class DomainRuleValidator {
  /**
   * Validate pipeline execution business rules
   * Replaces mock-driven pipeline orchestrator tests
   */
  static validatePipelineExecutionRules(
    input: PipelineExecutionInput,
    output: Result<PipelineExecutionOutput, DomainError>,
  ): DomainRuleValidationResult {
    const rules: DomainRule<PipelineExecutionOutput>[] = [
      {
        name: "schema-validation-integrity",
        description: "Schema must be properly validated and applied",
        validator: (data) =>
          this.validateSchemaIntegrity(data, input.schemaRequirements),
      },
      {
        name: "frontmatter-extraction-completeness",
        description: "All required frontmatter fields must be extracted",
        validator: (data) =>
          this.validateFrontmatterCompleteness(
            data,
            input.frontmatterRequirements,
          ),
      },
      {
        name: "template-rendering-consistency",
        description: "Template rendering must produce consistent output format",
        validator: (data) =>
          this.validateTemplateConsistency(data, input.templateRequirements),
      },
      {
        name: "error-recovery-compliance",
        description: "Error recovery must follow defined business rules",
        validator: (data) =>
          this.validateErrorRecovery(data, input.errorRecoveryRequirements),
      },
    ];

    if (!output.ok) {
      return {
        isValid: false,
        ruleName: "pipeline-execution-success",
        violation: `Pipeline execution failed: ${output.error}`,
        domainContext: "pipeline-orchestration",
      };
    }

    // Validate each domain rule
    for (const rule of rules) {
      const validation = rule.validator(output.data);
      if (!validation.isValid) {
        return {
          isValid: false,
          ruleName: rule.name,
          violation: validation.violation,
          domainContext: "pipeline-orchestration",
          expectedBehavior: rule.description,
        };
      }
    }

    return {
      isValid: true,
      ruleName: "all-pipeline-rules",
      domainContext: "pipeline-orchestration",
      validatedRules: rules.map((r) => r.name),
    };
  }

  /**
   * Private validation helpers for domain-specific rules
   */
  private static validateSchemaIntegrity(
    data: PipelineExecutionOutput,
    requirements: SchemaRequirements,
  ): ValidationResult {
    // Validate schema business rules instead of mock calls
    if (!data.schemaValidated) {
      return { isValid: false, violation: "Schema validation not performed" };
    }

    if (
      !requirements.enforceConstraints &&
      (data.constraintViolations?.length || 0) > 0
    ) {
      return {
        isValid: false,
        violation: "Schema constraints not properly enforced",
      };
    }

    return { isValid: true };
  }

  private static validateFrontmatterCompleteness(
    data: PipelineExecutionOutput,
    requirements: FrontmatterRequirements,
  ): ValidationResult {
    // Validate frontmatter business rules instead of service mock calls
    const requiredFields = requirements.requiredFields || [];
    const missingFields = requiredFields.filter((field) =>
      !data.extractedFrontmatter || !(field in data.extractedFrontmatter)
    );

    if (missingFields.length > 0) {
      return {
        isValid: false,
        violation: `Missing required frontmatter fields: ${
          missingFields.join(", ")
        }`,
      };
    }

    return { isValid: true };
  }

  private static validateTemplateConsistency(
    data: PipelineExecutionOutput,
    requirements: TemplateRequirements,
  ): ValidationResult {
    // Validate template business rules instead of rendering service mocks
    if (!data.renderedOutput) {
      return { isValid: false, violation: "Template rendering not performed" };
    }

    if (
      requirements.outputFormat &&
      !this.validateOutputFormat(data.renderedOutput, requirements.outputFormat)
    ) {
      return {
        isValid: false,
        violation:
          `Output format does not match requirement: ${requirements.outputFormat}`,
      };
    }

    return { isValid: true };
  }

  private static validateErrorRecovery(
    data: PipelineExecutionOutput,
    requirements: ErrorRecoveryRequirements,
  ): ValidationResult {
    // Validate error recovery business rules
    if (
      requirements.mustRecoverFromErrors && data.errorRecoveryAttempts === 0
    ) {
      return {
        isValid: false,
        violation: "Error recovery required but not attempted",
      };
    }

    return { isValid: true };
  }

  private static validateOutputFormat(
    output: string,
    expectedFormat: string,
  ): boolean {
    // Simple format validation - can be extended for specific formats
    switch (expectedFormat) {
      case "json":
        try {
          JSON.parse(output);
          return true;
        } catch {
          return false;
        }
      case "markdown":
        return output.includes("# ") || output.includes("## ");
      case "yaml":
        return output.includes(":") && !output.startsWith("{");
      default:
        return true; // Unknown format assumed valid
    }
  }
}

/**
 * Specification test assertion utilities
 * Provides business-focused assertions instead of implementation details
 */
export class SpecificationAssertions {
  /**
   * Assert that business requirements are met
   * Replaces mock verification with requirement validation
   */
  static assertBusinessRequirement<T>(
    actual: T,
    requirement: BusinessRequirement<T>,
    message?: string,
  ): void {
    const validation = BusinessRequirementValidator.validateBusinessRequirement(
      { ok: true, data: actual },
      requirement,
    );

    assert(
      validation.isValid,
      message ||
        `Business requirement '${requirement.name}' not met: ${validation.violation}`,
    );
  }

  /**
   * Assert domain rule compliance
   * Validates domain-specific business logic
   */
  static assertDomainRule<T>(
    actual: T,
    rule: DomainRule<T>,
    context: string,
    message?: string,
  ): void {
    const validation = rule.validator(actual);

    assert(
      validation.isValid,
      message ||
        `Domain rule '${rule.name}' violated in ${context}: ${validation.violation}`,
    );
  }

  /**
   * Assert pipeline execution meets business requirements
   * High-level business logic validation for pipeline orchestration
   */
  static assertPipelineBusinessLogic(
    input: PipelineExecutionInput,
    output: Result<PipelineExecutionOutput, DomainError>,
    message?: string,
  ): void {
    const validation = DomainRuleValidator.validatePipelineExecutionRules(
      input,
      output,
    );

    assert(
      validation.isValid,
      message || `Pipeline business logic violation: ${validation.violation}`,
    );
  }
}

/**
 * Type definitions for specification-driven testing
 */
export interface BusinessRequirement<T> {
  name: string;
  description: string;
  validator: (data: T) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  violation?: string;
}

export interface BusinessValidationResult {
  isValid: boolean;
  requirement: string;
  violation?: string;
  context: string;
  actualValue?: unknown;
  expectedCriteria?: string;
}

export interface BusinessValidationSummary {
  overallValid: boolean;
  totalRequirements: number;
  passedRequirements: number;
  failedRequirements: number;
  violations: Array<{ requirement: string; violation: string }>;
  context: string;
}

export interface ValidationContext {
  description: string;
  additionalInfo?: Record<string, unknown>;
}

export interface BusinessScenario<TInput, TOutput, E> {
  name: string;
  description: string;
  requirements: BusinessRequirement<TOutput>[];
  requiredResources?: Record<string, unknown>;
  execute: (input: TInput, env: any) => Promise<Result<TOutput, E>>;
  cleanup?: (env: any) => void | Promise<void>;
}

export interface BusinessScenarioTest<TInput, TOutput, E> {
  name: string;
  description: string;
  execute: (input: TInput) => Promise<Result<TOutput, E>>;
  validateRequirements: (
    result: Result<TOutput, E>,
  ) => BusinessValidationSummary;
}

export interface DomainRule<T> {
  name: string;
  description: string;
  validator: (data: T) => ValidationResult;
}

export interface DomainRuleValidationResult {
  isValid: boolean;
  ruleName: string;
  violation?: string;
  domainContext: string;
  expectedBehavior?: string;
  validatedRules?: string[];
}

// Pipeline-specific type definitions
export interface PipelineExecutionInput {
  schemaRequirements: SchemaRequirements;
  frontmatterRequirements: FrontmatterRequirements;
  templateRequirements: TemplateRequirements;
  errorRecoveryRequirements: ErrorRecoveryRequirements;
}

export interface PipelineExecutionOutput {
  schemaValidated: boolean;
  constraintViolations?: string[];
  extractedFrontmatter?: Record<string, unknown>;
  renderedOutput?: string;
  errorRecoveryAttempts: number;
}

export interface SchemaRequirements {
  enforceConstraints: boolean;
  requiredValidation: string[];
}

export interface FrontmatterRequirements {
  requiredFields?: string[];
  validationRules?: string[];
}

export interface TemplateRequirements {
  outputFormat?: string;
  requiredElements?: string[];
}

export interface ErrorRecoveryRequirements {
  mustRecoverFromErrors: boolean;
  maxRetryAttempts?: number;
}
