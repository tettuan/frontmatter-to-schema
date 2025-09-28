import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { ErrorHandler } from "../../domain/shared/services/unified-error-handler.ts";

/**
 * Business requirement specification for testing
 * Following DDD principles and Totality
 */
export interface BusinessRequirement {
  readonly id: string;
  readonly description: string;
  readonly given: GivenContext;
  readonly when: WhenAction;
  readonly then: ThenAssertion[];
}

/**
 * Context setup for specification
 */
export interface GivenContext {
  readonly description: string;
  readonly setup: () => Promise<TestContext>;
}

/**
 * Action to perform in specification
 */
export interface WhenAction {
  readonly description: string;
  readonly execute: (context: TestContext) => Promise<TestResult>;
}

/**
 * Assertion to validate in specification
 */
export interface ThenAssertion {
  readonly description: string;
  readonly assert: (result: TestResult) => Result<void, AssertionError>;
}

/**
 * Test context containing domain data
 */
export interface TestContext {
  readonly schemas: Map<string, SchemaSpecification>;
  readonly frontmatters: Map<string, FrontmatterSpecification>;
  readonly templates: Map<string, TemplateSpecification>;
  readonly configurations: ConfigurationSpecification;
}

/**
 * Test result containing domain outcomes
 */
export interface TestResult {
  readonly output?: ProcessingOutput;
  readonly errors?: DomainError[];
  readonly metrics?: ProcessingMetrics;
}

/**
 * Schema specification for testing
 */
export interface SchemaSpecification {
  readonly path: string;
  readonly content: Record<string, unknown>;
  readonly hasXTemplate: boolean;
  readonly hasXTemplateItems: boolean;
  readonly hasXDerivedFrom: boolean;
  readonly validationRules: string[];
}

/**
 * Frontmatter specification for testing
 */
export interface FrontmatterSpecification {
  readonly path: string;
  readonly frontmatter: Record<string, unknown>;
  readonly content: string;
}

/**
 * Template specification for testing
 */
export interface TemplateSpecification {
  readonly path: string;
  readonly content: string;
  readonly variables: string[];
  readonly itemsMarker?: string;
}

/**
 * Configuration specification for testing
 */
export interface ConfigurationSpecification {
  readonly inputPattern: string;
  readonly outputPath: string;
  readonly schemaPath: string;
  readonly templatePath?: string;
}

/**
 * Processing output specification
 */
export interface ProcessingOutput {
  readonly content: string;
  readonly format: "json" | "yaml" | "text";
  readonly metadata?: Record<string, unknown>;
}

/**
 * Processing metrics specification
 */
export interface ProcessingMetrics {
  readonly filesProcessed: number;
  readonly processingTime: number;
  readonly memoryUsage: number;
  readonly errors: number;
}

/**
 * Assertion error for test failures
 */
export interface AssertionError {
  readonly kind: "AssertionError";
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message: string;
}

/**
 * Specification test runner following DDD principles
 */
export class SpecificationTestRunner {
  private readonly requirements: BusinessRequirement[] = [];

  /**
   * Add a business requirement specification
   */
  addRequirement(requirement: BusinessRequirement): void {
    this.requirements.push(requirement);
  }

  /**
   * Run all business requirement tests
   */
  async runAll(): Promise<
    Result<TestReport, DomainError & { message: string }>
  > {
    const results: RequirementTestResult[] = [];

    for (const requirement of this.requirements) {
      const result = await this.runRequirement(requirement);
      results.push(result);
    }

    return ok({
      totalRequirements: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results,
    });
  }

  /**
   * Run a single business requirement test
   */
  private async runRequirement(
    requirement: BusinessRequirement,
  ): Promise<RequirementTestResult> {
    try {
      // Given: Setup context
      const context = await requirement.given.setup();

      // When: Execute action
      const result = await requirement.when.execute(context);

      // Then: Validate assertions
      const assertionResults: AssertionResult[] = [];
      for (const assertion of requirement.then) {
        const assertResult = assertion.assert(result);
        assertionResults.push({
          description: assertion.description,
          passed: assertResult.ok,
          error: assertResult.ok ? undefined : assertResult.error,
        });
      }

      const allPassed = assertionResults.every((r) => r.passed);

      return {
        requirementId: requirement.id,
        description: requirement.description,
        passed: allPassed,
        assertions: assertionResults,
      };
    } catch (error) {
      return {
        requirementId: requirement.id,
        description: requirement.description,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Test report for all requirements
 */
export interface TestReport {
  readonly totalRequirements: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: RequirementTestResult[];
}

/**
 * Result for a single requirement test
 */
export interface RequirementTestResult {
  readonly requirementId: string;
  readonly description: string;
  readonly passed: boolean;
  readonly assertions?: AssertionResult[];
  readonly error?: string;
}

/**
 * Result for a single assertion
 */
export interface AssertionResult {
  readonly description: string;
  readonly passed: boolean;
  readonly error?: AssertionError;
}

/**
 * Builder for creating business requirement specifications
 */
export class RequirementBuilder {
  private id: string = "";
  private description: string = "";
  private given?: GivenContext;
  private when?: WhenAction;
  private then: ThenAssertion[] = [];

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withGiven(description: string, setup: () => Promise<TestContext>): this {
    this.given = { description, setup };
    return this;
  }

  withWhen(
    description: string,
    execute: (context: TestContext) => Promise<TestResult>,
  ): this {
    this.when = { description, execute };
    return this;
  }

  withThen(
    description: string,
    assert: (result: TestResult) => Result<void, AssertionError>,
  ): this {
    this.then.push({ description, assert });
    return this;
  }

  build(): Result<BusinessRequirement, DomainError & { message: string }> {
    if (!this.id) {
      return ErrorHandler.validation().missingRequired("id");
    }
    if (!this.description) {
      return ErrorHandler.validation().missingRequired("description");
    }
    if (!this.given) {
      return ErrorHandler.validation().missingRequired("given");
    }
    if (!this.when) {
      return ErrorHandler.validation().missingRequired("when");
    }
    if (this.then.length === 0) {
      return ErrorHandler.validation().missingRequired("then");
    }

    return ok({
      id: this.id,
      description: this.description,
      given: this.given,
      when: this.when,
      then: this.then,
    });
  }
}

/**
 * Assertion helpers for common business requirement validations
 */
export class AssertionHelpers {
  /**
   * Assert that output contains expected content
   */
  static outputContains(
    expected: string,
  ): (result: TestResult) => Result<void, AssertionError> {
    return (result) => {
      if (!result.output) {
        return err({
          kind: "AssertionError",
          expected,
          actual: "no output",
          message: "Expected output to be present",
        });
      }

      if (result.output.content.includes(expected)) {
        return ok(undefined);
      }

      return err({
        kind: "AssertionError",
        expected,
        actual: result.output.content,
        message: `Expected output to contain "${expected}"`,
      });
    };
  }

  /**
   * Assert that no errors occurred
   */
  static noErrors(): (result: TestResult) => Result<void, AssertionError> {
    return (result) => {
      if (!result.errors || result.errors.length === 0) {
        return ok(undefined);
      }

      return err({
        kind: "AssertionError",
        expected: "no errors",
        actual: result.errors,
        message: `Expected no errors but got ${result.errors.length}`,
      });
    };
  }

  /**
   * Assert that specific metrics are met
   */
  static metricsMatch(
    expected: Partial<ProcessingMetrics>,
  ): (result: TestResult) => Result<void, AssertionError> {
    return (result) => {
      if (!result.metrics) {
        return err({
          kind: "AssertionError",
          expected,
          actual: "no metrics",
          message: "Expected metrics to be present",
        });
      }

      for (const [key, value] of Object.entries(expected)) {
        const actualValue = (result.metrics as any)[key];
        if (actualValue !== value) {
          return err({
            kind: "AssertionError",
            expected: value,
            actual: actualValue,
            message: `Expected ${key} to be ${value} but got ${actualValue}`,
          });
        }
      }

      return ok(undefined);
    };
  }

  /**
   * Assert that output format matches expected
   */
  static outputFormat(
    format: "json" | "yaml" | "text",
  ): (result: TestResult) => Result<void, AssertionError> {
    return (result) => {
      if (!result.output) {
        return err({
          kind: "AssertionError",
          expected: format,
          actual: "no output",
          message: "Expected output to be present",
        });
      }

      if (result.output.format === format) {
        return ok(undefined);
      }

      return err({
        kind: "AssertionError",
        expected: format,
        actual: result.output.format,
        message: `Expected output format to be ${format}`,
      });
    };
  }
}
