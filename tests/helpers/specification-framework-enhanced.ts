/**
 * @module specification-framework-enhanced
 * @description Enhanced specification-driven testing framework utilities
 * Supporting Issue #886 - Test Quality Migration
 */

import {
  err as _err,
  ok as _ok,
  Result,
} from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

/**
 * Business Requirement Definition
 * Represents a high-level business requirement that must be satisfied
 */
export interface BusinessRequirement<T = any> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: RequirementCategory;
  readonly priority: RequirementPriority;
  readonly validator: RequirementValidator<T>;
  readonly metadata?: RequirementMetadata;
}

/**
 * Requirement Categories aligned with business domains
 */
export type RequirementCategory =
  | "frontmatter-processing"
  | "schema-validation"
  | "template-rendering"
  | "pipeline-execution"
  | "error-handling"
  | "performance"
  | "security";

/**
 * Requirement Priority Levels
 */
export type RequirementPriority = "critical" | "high" | "medium" | "low";

/**
 * Requirement Metadata for tracking
 */
export interface RequirementMetadata {
  readonly issueNumber?: string;
  readonly documentReference?: string;
  readonly createdDate: Date;
  readonly lastValidated?: Date;
}

/**
 * Requirement Validator Function
 */
export type RequirementValidator<T> = (
  actual: T,
) => RequirementValidationResult;

/**
 * Requirement Validation Result
 */
export interface RequirementValidationResult {
  readonly isValid: boolean;
  readonly violation?: string;
  readonly actualValue?: any;
  readonly expectedValue?: any;
  readonly evidence?: string[];
}

/**
 * Business Scenario for Testing
 * Represents a concrete scenario that exercises business requirements
 */
export interface BusinessScenario<TInput = any, TOutput = any> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly given: ScenarioContext;
  readonly when: ScenarioAction<TInput>;
  readonly then: ScenarioExpectation<TOutput>;
  readonly requirements: string[]; // Requirement IDs this scenario validates
}

/**
 * Scenario Context (Given)
 */
export interface ScenarioContext {
  readonly state: Record<string, any>;
  readonly fixtures?: Record<string, any>;
  readonly preconditions?: string[];
}

/**
 * Scenario Action (When)
 */
export interface ScenarioAction<TInput> {
  readonly action: string;
  readonly input: TInput;
  readonly parameters?: Record<string, any>;
}

/**
 * Scenario Expectation (Then)
 */
export interface ScenarioExpectation<TOutput> {
  readonly outcome: TOutput;
  readonly sideEffects?: SideEffect[];
  readonly invariants?: Invariant[];
}

/**
 * Side Effect Definition
 */
export interface SideEffect {
  readonly type:
    | "file-created"
    | "file-modified"
    | "event-emitted"
    | "log-written";
  readonly target: string;
  readonly validation?: (actual: any) => boolean;
}

/**
 * Domain Invariant
 */
export interface Invariant {
  readonly name: string;
  readonly description: string;
  readonly check: () => boolean;
}

/**
 * Specification Test Suite
 * Groups related requirements and scenarios
 */
export class SpecificationTestSuite {
  private requirements: Map<string, BusinessRequirement> = new Map();
  private scenarios: Map<string, BusinessScenario> = new Map();
  private results: Map<string, TestResult> = new Map();

  /**
   * Register a business requirement
   */
  registerRequirement(requirement: BusinessRequirement): void {
    this.requirements.set(requirement.id, requirement);
  }

  /**
   * Register a business scenario
   */
  registerScenario(scenario: BusinessScenario): void {
    this.scenarios.set(scenario.id, scenario);
    // Validate that referenced requirements exist
    for (const reqId of scenario.requirements) {
      if (!this.requirements.has(reqId)) {
        throw new Error(
          `Scenario ${scenario.id} references non-existent requirement ${reqId}`,
        );
      }
    }
  }

  /**
   * Execute a scenario and validate requirements
   */
  executeScenario<TInput, TOutput>(
    scenarioId: string,
    executor: ScenarioExecutor<TInput, TOutput>,
  ): ScenarioExecutionResult {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    // Setup context
    const context = this.setupContext(scenario.given);

    // Execute action
    const result = executor(scenario.when.input, context);

    // Validate outcome
    const validationResults: RequirementValidationResult[] = [];
    for (const reqId of scenario.requirements) {
      const requirement = this.requirements.get(reqId)!;
      const validation = requirement.validator(result);
      validationResults.push(validation);
    }

    // Check invariants
    const invariantResults = scenario.then.invariants?.map((inv) => ({
      name: inv.name,
      passed: inv.check(),
    })) || [];

    const executionResult: ScenarioExecutionResult = {
      scenarioId,
      passed: validationResults.every((v) => v.isValid) &&
        invariantResults.every((i) => i.passed),
      requirementValidations: validationResults,
      invariantChecks: invariantResults,
      actualOutput: result,
      expectedOutput: scenario.then.outcome,
    };

    this.results.set(scenarioId, {
      scenarioId,
      timestamp: new Date(),
      result: executionResult,
    });

    return executionResult;
  }

  /**
   * Generate test report
   */
  generateReport(): TestSuiteReport {
    const totalScenarios = this.scenarios.size;
    const executedScenarios = this.results.size;
    const passedScenarios = Array.from(this.results.values()).filter(
      (r) => r.result.passed,
    ).length;

    const requirementCoverage = new Map<string, number>();
    for (const scenario of this.scenarios.values()) {
      for (const reqId of scenario.requirements) {
        requirementCoverage.set(
          reqId,
          (requirementCoverage.get(reqId) || 0) + 1,
        );
      }
    }

    return {
      summary: {
        totalRequirements: this.requirements.size,
        totalScenarios,
        executedScenarios,
        passedScenarios,
        failedScenarios: executedScenarios - passedScenarios,
        coverage: (executedScenarios / totalScenarios) * 100,
        successRate: (passedScenarios / executedScenarios) * 100,
      },
      requirementCoverage: Array.from(requirementCoverage.entries()).map(
        ([reqId, count]) => ({
          requirementId: reqId,
          requirementName: this.requirements.get(reqId)!.name,
          scenarioCount: count,
        }),
      ),
      failedScenarios: Array.from(this.results.values())
        .filter((r) => !r.result.passed)
        .map((r) => ({
          scenarioId: r.scenarioId,
          scenarioName: this.scenarios.get(r.scenarioId)!.name,
          failures: r.result.requirementValidations
            .filter((v) => !v.isValid)
            .map((v) => v.violation || "Unknown violation"),
        })),
    };
  }

  private setupContext(given: ScenarioContext): any {
    // Initialize context state
    return {
      ...given.state,
      fixtures: given.fixtures,
    };
  }
}

/**
 * Scenario Executor Function Type
 */
export type ScenarioExecutor<TInput, TOutput> = (
  input: TInput,
  context: any,
) => TOutput;

/**
 * Scenario Execution Result
 */
export interface ScenarioExecutionResult {
  readonly scenarioId: string;
  readonly passed: boolean;
  readonly requirementValidations: RequirementValidationResult[];
  readonly invariantChecks: Array<{ name: string; passed: boolean }>;
  readonly actualOutput: any;
  readonly expectedOutput: any;
}

/**
 * Test Result Storage
 */
interface TestResult {
  readonly scenarioId: string;
  readonly timestamp: Date;
  readonly result: ScenarioExecutionResult;
}

/**
 * Test Suite Report
 */
export interface TestSuiteReport {
  readonly summary: {
    readonly totalRequirements: number;
    readonly totalScenarios: number;
    readonly executedScenarios: number;
    readonly passedScenarios: number;
    readonly failedScenarios: number;
    readonly coverage: number;
    readonly successRate: number;
  };
  readonly requirementCoverage: Array<{
    readonly requirementId: string;
    readonly requirementName: string;
    readonly scenarioCount: number;
  }>;
  readonly failedScenarios: Array<{
    readonly scenarioId: string;
    readonly scenarioName: string;
    readonly failures: string[];
  }>;
}

/**
 * Specification Builder - Fluent API for creating specifications
 */
export class SpecificationBuilder {
  private id?: string;
  private name?: string;
  private description?: string;
  private category?: RequirementCategory;
  private priority?: RequirementPriority;
  private validator?: RequirementValidator<any>;
  private metadata?: RequirementMetadata;

  static forRequirement(name: string): SpecificationBuilder {
    const builder = new SpecificationBuilder();
    builder.name = name;
    builder.id = name.toLowerCase().replace(/\s+/g, "-");
    return builder;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  inCategory(category: RequirementCategory): this {
    this.category = category;
    return this;
  }

  withPriority(priority: RequirementPriority): this {
    this.priority = priority;
    return this;
  }

  validateWith<T>(validator: RequirementValidator<T>): this {
    this.validator = validator;
    return this;
  }

  build(): BusinessRequirement {
    if (
      !this.id ||
      !this.name ||
      !this.description ||
      !this.category ||
      !this.priority ||
      !this.validator
    ) {
      throw new Error("Incomplete requirement specification");
    }
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      priority: this.priority,
      validator: this.validator,
      metadata: this.metadata,
    };
  }
}

/**
 * Scenario Builder - Fluent API for creating scenarios
 */
export class ScenarioBuilder<TInput = any, TOutput = any> {
  private id?: string;
  private name?: string;
  private description?: string;
  private givenContext?: ScenarioContext;
  private whenAction?: ScenarioAction<TInput>;
  private thenExpectation?: ScenarioExpectation<TOutput>;
  private requirements: string[] = [];

  static scenario(name: string): ScenarioBuilder {
    const builder = new ScenarioBuilder();
    builder.name = name;
    builder.id = name.toLowerCase().replace(/\s+/g, "-");
    return builder;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  given(context: ScenarioContext): this {
    this.givenContext = context;
    return this;
  }

  when(action: ScenarioAction<TInput>): this {
    this.whenAction = action;
    return this;
  }

  then(expectation: ScenarioExpectation<TOutput>): this {
    this.thenExpectation = expectation;
    return this;
  }

  validatesRequirement(requirementId: string): this {
    this.requirements.push(requirementId);
    return this;
  }

  build(): BusinessScenario<TInput, TOutput> {
    if (
      !this.id ||
      !this.name ||
      !this.description ||
      !this.givenContext ||
      !this.whenAction ||
      !this.thenExpectation ||
      this.requirements.length === 0
    ) {
      throw new Error("Incomplete scenario specification");
    }
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      given: this.givenContext,
      when: this.whenAction,
      then: this.thenExpectation,
      requirements: this.requirements,
    };
  }
}

/**
 * Common Requirement Validators
 */
export const CommonValidators = {
  /**
   * Validates that a Result is successful
   */
  resultIsSuccessful: <T, E>(
    result: Result<T, E>,
  ): RequirementValidationResult => ({
    isValid: result.ok,
    violation: result.ok ? undefined : `Expected success but got error`,
    actualValue: result,
  }),

  /**
   * Validates that output contains expected fields
   */
  containsRequiredFields: (
    fields: string[],
  ) =>
  (output: any): RequirementValidationResult => {
    const missingFields = fields.filter((f) => !(f in output));
    return {
      isValid: missingFields.length === 0,
      violation: missingFields.length > 0
        ? `Missing required fields: ${missingFields.join(", ")}`
        : undefined,
      actualValue: Object.keys(output),
      expectedValue: fields,
    };
  },

  /**
   * Validates performance requirements
   */
  performanceWithinThreshold: (
    maxMs: number,
  ) =>
  (metrics: { duration: number }): RequirementValidationResult => ({
    isValid: metrics.duration <= maxMs,
    violation: metrics.duration > maxMs
      ? `Performance ${metrics.duration}ms exceeds threshold ${maxMs}ms`
      : undefined,
    actualValue: metrics.duration,
    expectedValue: maxMs,
  }),

  /**
   * Validates error handling
   */
  handlesErrorGracefully: (
    error: DomainError,
  ) =>
  (result: Result<any, DomainError>): RequirementValidationResult => ({
    isValid: !result.ok && result.error.kind === error.kind,
    violation: result.ok
      ? "Expected error but got success"
      : result.error.kind !== error.kind
      ? `Expected error ${error.kind} but got ${result.error.kind}`
      : undefined,
    actualValue: result.ok ? "success" : result.error.kind,
    expectedValue: error.kind,
  }),
};

/**
 * Test Assertion Helpers
 */
export function assertRequirement(
  requirement: BusinessRequirement,
  actual: any,
): void {
  const validation = requirement.validator(actual);
  if (!validation.isValid) {
    throw new Error(
      `Requirement "${requirement.name}" failed: ${validation.violation}`,
    );
  }
}

export function assertScenario(
  result: ScenarioExecutionResult,
): void {
  if (!result.passed) {
    const failures = result.requirementValidations
      .filter((v) => !v.isValid)
      .map((v) => v.violation)
      .join(", ");
    throw new Error(`Scenario ${result.scenarioId} failed: ${failures}`);
  }
}

/**
 * Migration Helper - Convert Mock Test to Specification Test
 */
export interface MockToSpecMigration {
  readonly originalTest: string;
  readonly mockCount: number;
  readonly suggestedRequirements: BusinessRequirement[];
  readonly suggestedScenarios: BusinessScenario[];
  readonly migrationComplexity: "simple" | "moderate" | "complex";
}

/**
 * Analyze mock test for migration
 */
export function analyzeMockTest(testCode: string): MockToSpecMigration {
  // Count mock occurrences
  const mockCount = (testCode.match(/mock|Mock|spy|Spy|stub|Stub/g) || [])
    .length;

  // Determine complexity
  const complexity: "simple" | "moderate" | "complex" = mockCount < 3
    ? "simple"
    : mockCount < 10
    ? "moderate"
    : "complex";

  // Generate migration suggestions (simplified for example)
  return {
    originalTest: testCode,
    mockCount,
    suggestedRequirements: [],
    suggestedScenarios: [],
    migrationComplexity: complexity,
  };
}
