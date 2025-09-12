/**
 * Test Assertions - Reusable Assertion Helpers
 * 
 * Addresses Issue #666: Standardized assertion patterns
 * Provides domain-specific assertions for DDD testing
 * Follows Totality principles with Result<T,E> validation
 */

import { assertEquals, assertExists, assertInstanceOf } from "jsr:@std/assert";
import type { Result } from "../../src/domain/core/result.ts";

/**
 * Assertion helpers for Result<T,E> pattern validation
 */
export class ResultAssertions {
  
  /**
   * Assert that Result<T,E> is successful and return data
   */
  static assertResultOk<T, E>(result: Result<T, E>, message?: string): T {
    assertEquals(result.ok, true, message || "Expected result to be ok");
    if (!result.ok) {
      throw new Error(`Result assertion failed: ${message || "Expected success"}`);
    }
    assertExists(result.data, "Expected result data to exist");
    return result.data;
  }

  /**
   * Assert that Result<T,E> is error and return error
   */
  static assertResultError<T, E>(result: Result<T, E>, expectedErrorKind?: string, message?: string): E {
    assertEquals(result.ok, false, message || "Expected result to be error");
    if (result.ok) {
      throw new Error(`Result assertion failed: ${message || "Expected error"}`);
    }
    assertExists(result.error, "Expected result error to exist");
    
    if (expectedErrorKind && typeof result.error === 'object' && result.error !== null && 'kind' in result.error) {
      assertEquals((result.error as any).kind, expectedErrorKind, `Expected error kind to be ${expectedErrorKind}`);
    }
    
    return result.error;
  }

  /**
   * Assert that Result<T,E> has proper structure
   */
  static assertResultStructure<T, E>(result: Result<T, E>) {
    assertExists(result, "Result should exist");
    assertEquals(typeof result.ok, "boolean", "Result.ok should be boolean");
    
    if (result.ok) {
      assertExists(result.data, "Result data should exist when ok=true");
      assertEquals((result as any).error, undefined, "Result error should be undefined when ok=true");
    } else {
      assertExists(result.error, "Result error should exist when ok=false");
      assertEquals((result as any).data, undefined, "Result data should be undefined when ok=false");
    }
  }
}

/**
 * Assertion helpers for aggregation testing
 */
export class AggregationAssertions {
  
  /**
   * Assert that aggregated data has expected nested structure
   */
  static assertNestedStructure(aggregated: Record<string, unknown>, expectedPaths: string[]) {
    for (const path of expectedPaths) {
      const parts = path.split('.');
      let current = aggregated;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        assertExists(current[part], `Expected path ${parts.slice(0, i + 1).join('.')} to exist`);
        
        if (i < parts.length - 1) {
          assertEquals(typeof current[part], "object", `Expected ${parts.slice(0, i + 1).join('.')} to be object`);
          current = current[part] as Record<string, unknown>;
        }
      }
    }
  }

  /**
   * Assert that derived field contains expected values
   */
  static assertDerivedFieldValues(derivedFields: Record<string, unknown> | undefined, fieldPath: string, expectedValues: unknown[]) {
    assertExists(derivedFields, "Derived fields should exist");
    assertExists(derivedFields[fieldPath], `Expected derived field ${fieldPath} to exist`);
    
    const fieldValue = derivedFields[fieldPath];
    assertEquals(Array.isArray(fieldValue), true, `Expected derived field ${fieldPath} to be array`);
    
    const arrayValue = fieldValue as unknown[];
    for (const expectedValue of expectedValues) {
      assertEquals(arrayValue.includes(expectedValue), true, `Expected derived field ${fieldPath} to contain ${expectedValue}`);
    }
  }

  /**
   * Assert that unique values are properly filtered
   */
  static assertUniqueValues(values: unknown[], message?: string) {
    assertEquals(Array.isArray(values), true, "Values should be array");
    const uniqueCheck = new Set(values.map(v => JSON.stringify(v)));
    assertEquals(uniqueCheck.size, values.length, message || "Values should be unique");
  }

  /**
   * Assert that frontmatter part detection works correctly
   */
  static assertFrontmatterPartDetection(result: any, expectedItemCount: number, hasItems: boolean = false) {
    assertExists(result, "Result should exist");
    assertEquals(typeof result.itemCount, "number", "itemCount should be number");
    assertEquals(result.itemCount, expectedItemCount, `Expected item count to be ${expectedItemCount}`);
    
    if (!hasItems) {
      assertEquals("items" in result.aggregated, false, "Should NOT have 'items' property for ArrayBased processing");
    }
  }
}

/**
 * Assertion helpers for schema testing
 */
export class SchemaAssertions {
  
  /**
   * Assert schema template info extraction
   */
  static assertSchemaTemplateInfo(templateInfo: any, expectedRulesCount: number) {
    assertExists(templateInfo, "Template info should exist");
    
    if (expectedRulesCount > 0) {
      assertExists(templateInfo.rules, "Template info rules should exist");
      assertEquals(Array.isArray(templateInfo.rules), true, "Template info rules should be array");
      assertEquals(templateInfo.rules.length, expectedRulesCount, `Expected ${expectedRulesCount} rules`);
    }
  }

  /**
   * Assert derivation rule properties
   */
  static assertDerivationRule(rule: any, expectedTarget: string, expectedSource: string, expectedUnique: boolean) {
    assertExists(rule, "Derivation rule should exist");
    assertEquals(rule.getTargetField(), expectedTarget, `Expected target field ${expectedTarget}`);
    assertEquals(rule.getSourceExpression(), expectedSource, `Expected source expression ${expectedSource}`);
    assertEquals(rule.isUnique(), expectedUnique, `Expected unique flag ${expectedUnique}`);
  }
}

/**
 * Assertion helpers for performance testing
 */
export class PerformanceAssertions {
  
  /**
   * Assert execution time is within expected bounds
   */
  static assertExecutionTime(executionTime: number, maxTime: number, operation: string) {
    assertEquals(executionTime < maxTime, true, 
      `${operation} took ${executionTime}ms, expected < ${maxTime}ms`);
  }

  /**
   * Time a function execution and return both result and time
   */
  static timeExecution<T>(fn: () => T): { result: T; executionTime: number } {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    return {
      result,
      executionTime: endTime - startTime
    };
  }

  /**
   * Time an async function execution and return both result and time
   */
  static async timeAsyncExecution<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    return {
      result,
      executionTime: endTime - startTime
    };
  }
}

/**
 * Assertion helpers for template processing testing
 */
export class TemplateAssertions {
  
  /**
   * Assert template application result structure
   */
  static assertTemplateApplication(result: any, expectedFields: string[]) {
    assertExists(result, "Template application result should exist");
    
    for (const field of expectedFields) {
      assertExists(result[field], `Expected field ${field} in template result`);
    }
  }

  /**
   * Assert template variable resolution
   */
  static assertTemplateVariables(result: any, expectedVariables: Record<string, any>) {
    for (const [key, expectedValue] of Object.entries(expectedVariables)) {
      const actualValue = this.getNestedValue(result, key);
      assertExists(actualValue, `Expected template variable ${key} to be resolved`);
      
      if (typeof expectedValue === 'string' && expectedValue.startsWith('{{')) {
        // Variable should have been resolved (not contain template syntax)
        assertEquals(typeof actualValue === 'string' && actualValue.includes('{{'), false, 
          `Expected template variable ${key} to be resolved`);
      } else {
        assertEquals(actualValue, expectedValue, `Expected template variable ${key} to equal ${expectedValue}`);
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }
}