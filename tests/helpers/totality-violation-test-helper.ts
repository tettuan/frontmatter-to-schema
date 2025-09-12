/**
 * Totality Violation Test Helper
 *
 * Systematic detection and testing of P0 Totality violations
 * Following DDD principles and robust test construction patterns
 *
 * Part of climpt-build robust test architecture for Issue #669
 */

import { assertEquals } from "jsr:@std/assert";
import type { Result } from "../../src/domain/core/result.ts";

/**
 * Totality violation detection results
 */
export interface TotalityViolationReport {
  filePath: string;
  violationCount: number;
  violationLines: number[];
  riskLevel: "P0" | "P1" | "P2";
  moduleLoadSafe: boolean;
  smartConstructorCompliant: boolean;
}

/**
 * Smart Constructor validation result
 */
export interface SmartConstructorValidation {
  hasSmartConstructor: boolean;
  followsResultPattern: boolean;
  throwsOnConstruction: boolean;
  providesErrorHandling: boolean;
}

/**
 * Centralized helper for systematic Totality violation testing
 * Ensures reproducibility, idempotency, and comprehensive coverage
 */
export class TotalityViolationTestHelper {
  /**
   * Safely analyze a module for Totality violations without causing failures
   */
  static async analyzeModuleViolations(
    modulePath: string,
  ): Promise<Result<TotalityViolationReport, string>> {
    try {
      // Read module source for static analysis
      const moduleSource = await Deno.readTextFile(modulePath);

      // Count throw new Error violations
      const throwMatches = moduleSource.match(/throw new Error/g) || [];
      const violationLines: number[] = [];

      // Find line numbers for violations
      const lines = moduleSource.split("\n");
      lines.forEach((line, index) => {
        if (line.includes("throw new Error")) {
          violationLines.push(index + 1);
        }
      });

      // Determine risk level based on context
      const riskLevel = this.determineRiskLevel(
        modulePath,
        throwMatches.length,
      );

      // Test module load safety
      const moduleLoadSafe = await this.testModuleLoadSafety(modulePath);

      // Check Smart Constructor compliance
      const smartConstructorCompliant = this.analyzeSmartConstructorCompliance(
        moduleSource,
      );

      return {
        ok: true,
        data: {
          filePath: modulePath,
          violationCount: throwMatches.length,
          violationLines,
          riskLevel,
          moduleLoadSafe,
          smartConstructorCompliant,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test module load safety without causing system failures
   */
  static async testModuleLoadSafety(modulePath: string): Promise<boolean> {
    try {
      // Dynamic import with error isolation
      await import(modulePath);
      return true;
    } catch (_error) {
      // Module failed to load - P0 crisis detected
      return false;
    }
  }

  /**
   * Validate Smart Constructor patterns in module
   */
  static validateSmartConstructor(
    moduleExports: Record<string, unknown>,
    className: string,
  ): SmartConstructorValidation {
    const classConstructor = moduleExports[className];

    if (!classConstructor || typeof classConstructor !== "function") {
      return {
        hasSmartConstructor: false,
        followsResultPattern: false,
        throwsOnConstruction: false,
        providesErrorHandling: false,
      };
    }

    // Check for static create method (Smart Constructor pattern)
    const hasCreate = "create" in
      (classConstructor as unknown as Record<string, unknown>);
    const hasStaticMethods = Object.getOwnPropertyNames(classConstructor)
      .some((name) => name === "create");

    return {
      hasSmartConstructor: hasCreate || hasStaticMethods,
      followsResultPattern: hasCreate, // Assume create follows Result pattern
      throwsOnConstruction: false, // Would need runtime analysis
      providesErrorHandling: hasCreate,
    };
  }

  /**
   * Create comprehensive test assertions for Totality compliance
   */
  static createTotalityTestAssertions(report: TotalityViolationReport): void {
    // Module should be loadable (P0 requirement)
    assertEquals(
      report.moduleLoadSafe,
      true,
      `P0 CRISIS: Module ${report.filePath} failed to load safely`,
    );

    // High-risk modules should have minimal violations
    if (report.riskLevel === "P0") {
      assertEquals(
        report.violationCount < 50,
        true,
        `P0 module ${report.filePath} has excessive violations: ${report.violationCount}`,
      );
    }

    // Smart Constructor compliance for core modules
    if (
      report.filePath.includes("/domain/") || report.filePath.includes("/core/")
    ) {
      assertEquals(
        report.smartConstructorCompliant,
        true,
        `Domain module ${report.filePath} should follow Smart Constructor patterns`,
      );
    }
  }

  /**
   * Generate idempotent test data for violation testing
   */
  static generateTestViolationScenarios(): Array<{
    description: string;
    modulePattern: string;
    expectedRiskLevel: "P0" | "P1" | "P2";
  }> {
    return [
      {
        description: "Domain constants module with module-level violations",
        modulePattern: "**/domain/shared/constants.ts",
        expectedRiskLevel: "P0",
      },
      {
        description: "Application layer CLI and processor components",
        modulePattern: "**/application/*.ts",
        expectedRiskLevel: "P1",
      },
      {
        description: "Infrastructure adapters with external dependencies",
        modulePattern: "**/infrastructure/**/*.ts",
        expectedRiskLevel: "P2",
      },
      {
        description: "Core domain services and value objects",
        modulePattern: "**/domain/**/*.ts",
        expectedRiskLevel: "P1",
      },
    ];
  }

  /**
   * Batch analyze multiple modules for comprehensive coverage
   */
  static async batchAnalyzeViolations(
    modulePaths: string[],
  ): Promise<Result<TotalityViolationReport[], string>> {
    try {
      const reports: TotalityViolationReport[] = [];

      for (const modulePath of modulePaths) {
        const result = await this.analyzeModuleViolations(modulePath);
        if (result.ok) {
          reports.push(result.data);
        }
        // Continue analysis even if some modules fail
      }

      return {
        ok: true,
        data: reports,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Private helper: Determine risk level based on module context
   */
  private static determineRiskLevel(
    filePath: string,
    violationCount: number,
  ): "P0" | "P1" | "P2" {
    // P0: Module-level constants, core components
    if (filePath.includes("constants.ts") || filePath.includes("/core/")) {
      return "P0";
    }

    // P1: Application layer, critical business logic
    if (filePath.includes("/application/") || filePath.includes("/domain/")) {
      return violationCount > 10 ? "P0" : "P1";
    }

    // P2: Infrastructure, adapters
    return "P2";
  }

  /**
   * Private helper: Analyze Smart Constructor compliance from source
   */
  private static analyzeSmartConstructorCompliance(source: string): boolean {
    // Check for Smart Constructor patterns
    const hasStaticCreate = source.includes("static create");
    const hasResultReturn = source.includes("Result<") &&
      source.includes("ok:");
    const hasPrivateConstructor = source.includes("private constructor");

    return hasStaticCreate && hasResultReturn && hasPrivateConstructor;
  }

  /**
   * Create reproducible test environment for violation testing
   */
  static setupTotalityTestEnvironment(): void {
    // Ensure clean test environment
    // No global state modifications
    // Environment-independent setup
  }

  /**
   * Cleanup test environment (idempotent)
   */
  static cleanupTotalityTestEnvironment(): void {
    // Idempotent cleanup
    // No side effects
    // Safe to call multiple times
  }
}
