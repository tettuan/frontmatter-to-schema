/**
 * Test Factory for FrontmatterData following DDD and Totality principles
 *
 * Reduces duplication of FrontmatterData.create() calls across 121 test locations.
 * Applies Smart Constructor pattern with Result types for type safety.
 */
import { assertEquals } from "@std/assert";
import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Result } from "../../src/domain/shared/types/result.ts";

export class FrontmatterTestFactory {
  /**
   * Create simple test data with common properties
   */
  static createSimpleData(): FrontmatterData {
    const result = FrontmatterData.create({
      name: "Test Name",
      value: "Test Value",
      active: true,
      count: 42,
    });
    if (!result.ok) {
      throw new Error(
        `Simple test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create project-style test data with nested structure
   */
  static createProjectData(): FrontmatterData {
    const result = FrontmatterData.create({
      project: {
        name: "Test Project",
        version: "1.0.0",
        description: "A test project",
      },
      metadata: {
        created: "2025-01-01",
        author: "Test Author",
      },
      published: true,
    });
    if (!result.ok) {
      throw new Error(
        `Project test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create command array test data for template processing tests
   */
  static createCommandArrayData(): FrontmatterData {
    const result = FrontmatterData.create({
      title: "Command Registry",
      commands: [
        { name: "build", script: "npm run build", type: "build" },
        { name: "test", script: "npm test", type: "test" },
        { name: "deploy", script: "npm run deploy", type: "deploy" },
      ],
      version: "1.0.0",
    });
    if (!result.ok) {
      throw new Error(
        `Command array test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create variable replacement test data
   */
  static createVariableData(): FrontmatterData {
    const result = FrontmatterData.create({
      user: {
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      },
      settings: {
        theme: "dark",
        notifications: true,
        language: "en",
      },
      tags: ["frontend", "typescript", "testing"],
    });
    if (!result.ok) {
      throw new Error(
        `Variable test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create custom test data with validation
   */
  static createCustomData<T extends Record<string, unknown>>(
    data: T,
  ): FrontmatterData {
    const result = FrontmatterData.create(data);
    if (!result.ok) {
      throw new Error(
        `Custom test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create minimal test data for edge cases
   */
  static createMinimalData(): FrontmatterData {
    const result = FrontmatterData.create({
      title: "Minimal Test",
    });
    if (!result.ok) {
      throw new Error(
        `Minimal test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create complex nested array data for aggregation tests
   */
  static createAggregationData(): FrontmatterData {
    const result = FrontmatterData.create({
      project: {
        name: "Aggregation Test",
        modules: [
          {
            id: { full: "mod:core:auth-1a2b3c#20250914" },
            name: "auth-module",
            type: "core",
          },
          {
            id: { full: "mod:ui:dashboard-4d5e6f#20250914" },
            name: "dashboard-module",
            type: "ui",
          },
        ],
      },
      metadata: {
        version: "2.0.0",
        created: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      throw new Error(
        `Aggregation test data creation failed: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Create array commands data for common test scenarios
   */
  static createArrayCommands(commands: string[]): FrontmatterData {
    return FrontmatterTestFactory.createCustomData({ commands });
  }

  /**
   * Create object array data with name/type pattern
   */
  static createObjectArray<T extends Record<string, unknown>>(
    items: T[],
    key = "items",
  ): FrontmatterData {
    return FrontmatterTestFactory.createCustomData({ [key]: items });
  }

  /**
   * Create empty data for boundary testing
   */
  static createEmptyData(): FrontmatterData {
    return FrontmatterTestFactory.createCustomData({});
  }

  /**
   * Create tags array data for testing
   */
  static createTagsData(tags: string[]): FrontmatterData {
    return FrontmatterTestFactory.createCustomData({ tags });
  }
}

/**
 * Totality-compliant test helper for Result unwrapping
 */
export function assertResultSuccess<T, E>(
  result: Result<T, E>,
  handler: (data: T) => void,
): void {
  assertEquals(result.ok, true);
  if (result.ok) {
    handler(result.data);
  }
}

/**
 * Helper for creating FrontmatterData with error handling in tests
 */
export function createTestFrontmatterData<T extends Record<string, unknown>>(
  data: T,
  errorMessage?: string,
): FrontmatterData {
  const result = FrontmatterData.create(data);
  if (!result.ok) {
    throw new Error(
      errorMessage || `Test data creation failed: ${result.error.message}`,
    );
  }
  return result.data;
}

/**
 * Assert helper for FrontmatterData creation results
 */
export function assertFrontmatterDataSuccess<T extends Record<string, unknown>>(
  data: T,
  test: (frontmatterData: FrontmatterData) => void,
): void {
  const result = FrontmatterData.create(data);
  assertResultSuccess(result, test);
}
