/**
 * @fileoverview Template Variable Deep Path Resolution Test
 * @description Test to verify template variables can resolve deep nested paths like {id.full}
 *
 * This test verifies the fix for Issue #1071:
 * - Template variables with deep paths (e.g., {id.full}) should be resolved correctly
 * - Data from x-flatten-arrays should be accessible through template variables
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { BreakdownLogger } from "jsr:@tettuan/breakdownlogger";
import { TemplateVariableResolver } from "../../src/domain/template/services/template-variable-resolver.ts";
import { FrontmatterDataFactory } from "../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";
import { TemplateVariable } from "../../src/domain/template/value-objects/template-variable.ts";

Deno.test("Template Variable Deep Path Resolution Test", async (t) => {
  const _logger = new BreakdownLogger("template-variable-deep-path");
  await t.step("Should resolve nested object paths like {id.full}", () => {
    _logger.info("=== Testing Nested Object Path Resolution ===");

    // Create test data with nested structure (as produced by x-flatten-arrays)
    const testData = {
      id: {
        full: "req:auth:primary-key-5d8c2a#20250909",
        level: "req",
        scope: "auth",
        semantic: "primary-key",
        hash: "5d8c2a",
        version: "20250909",
      },
      summary: "ユーザー認証システムの要求定義",
      description:
        "Auth0を使用しPassKeyとSNSログインを主要認証手段とするシステム",
      derived_from: [],
      trace_to: [],
    };

    _logger.debug("Input test data structure", {
      hasIdObject: typeof testData.id === "object",
      idKeys: Object.keys(testData.id),
      targetPath: "id.full",
      expectedValue: testData.id.full,
    });

    // Create FrontmatterData
    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    _logger.debug("FrontmatterData created", {
      dataKeys: Object.keys(testData),
      hasIdProperty: frontmatterData.has("id"),
    });

    // Create resolver
    const resolverResult = TemplateVariableResolver.create();
    assert(resolverResult.ok);
    const resolver = resolverResult.data;

    // Test resolving nested path variable
    const variableResult = TemplateVariable.create("id.full");
    assert(variableResult.ok);
    const variable = variableResult.data;

    _logger.debug("Variable created for deep path", {
      variablePath: "id.full",
      variableType: variable.constructor.name,
    });

    // Create resolution context
    const context = {
      data: frontmatterData,
      arrayDataState: { kind: "not-available" as const },
      hierarchyRoot: undefined,
    };

    // Resolve the variable
    const resolvedResult = resolver.resolveVariable(variable, context);

    _logger.info("Variable resolution result", {
      success: resolvedResult.ok,
      resolvedValue: resolvedResult.ok ? resolvedResult.data : null,
      error: resolvedResult.ok ? null : resolvedResult.error.message,
    });

    // Verify resolution
    assert(
      resolvedResult.ok,
      `Failed to resolve {id.full}: ${
        resolvedResult.ok ? "" : resolvedResult.error.message
      }`,
    );
    assertEquals(
      resolvedResult.data,
      "req:auth:primary-key-5d8c2a#20250909",
      "Should resolve to the correct nested value",
    );

    _logger.info("✓ Successfully resolved nested path {id.full}");
  });

  await t.step("Should resolve multiple levels of nesting", () => {
    _logger.info("=== Testing Multiple Nesting Levels ===");

    const testData = {
      deeply: {
        nested: {
          value: "found-it",
        },
      },
    };

    _logger.debug("Input data with deep nesting", {
      nestingLevels: 3,
      targetPath: "deeply.nested.value",
      expectedValue: "found-it",
    });

    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    const resolverResult = TemplateVariableResolver.create();
    assert(resolverResult.ok);
    const resolver = resolverResult.data;

    const variableResult = TemplateVariable.create("deeply.nested.value");
    assert(variableResult.ok);
    const variable = variableResult.data;

    _logger.debug("Created variable for deep nested path", {
      path: "deeply.nested.value",
      pathSegments: ["deeply", "nested", "value"],
    });

    const context = {
      data: frontmatterData,
      arrayDataState: { kind: "not-available" as const },
      hierarchyRoot: undefined,
    };

    const resolvedResult = resolver.resolveVariable(variable, context);

    _logger.info("Deep nested resolution result", {
      success: resolvedResult.ok,
      resolvedValue: resolvedResult.ok ? resolvedResult.data : null,
      error: resolvedResult.ok ? null : resolvedResult.error.message,
    });

    assert(
      resolvedResult.ok,
      `Failed to resolve {deeply.nested.value}: ${
        resolvedResult.ok ? "" : resolvedResult.error.message
      }`,
    );
    assertEquals(resolvedResult.data, "found-it");

    _logger.info(
      "✓ Successfully resolved deep nested path {deeply.nested.value}",
    );
  });

  await t.step("Should handle arrays after x-flatten-arrays processing", () => {
    _logger.info("=== Testing Array Data After x-flatten-arrays ===");

    // Simulating data after x-flatten-arrays has processed it
    const testData = {
      traceability: [
        {
          id: { full: "REQ-001", level: "req" },
          derived_from: ["SPEC-001"],
          trace_to: ["IMPL-001"],
        },
        {
          id: { full: "REQ-002", level: "req" },
          derived_from: [],
          trace_to: ["IMPL-002", "IMPL-003"],
        },
      ],
    };

    _logger.debug("Test data with array of nested objects", {
      arrayField: "traceability",
      arrayLength: testData.traceability.length,
      firstItemIdFull: testData.traceability[0].id.full,
      secondItemIdFull: testData.traceability[1].id.full,
    });

    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    // Test accessing array element's nested property
    const arrayAccessResult = frontmatterData.get("traceability");
    assert(arrayAccessResult.ok);

    const traceabilityArray = arrayAccessResult.data as any[];

    _logger.debug("Array access results", {
      accessSuccessful: arrayAccessResult.ok,
      resultType: typeof arrayAccessResult.data,
      isArray: Array.isArray(arrayAccessResult.data),
      arrayLength: traceabilityArray.length,
    });

    assertEquals(traceabilityArray.length, 2);

    // Verify nested objects are preserved
    const firstIdFull = traceabilityArray[0].id.full;
    const secondIdFull = traceabilityArray[1].id.full;

    _logger.info("Nested object preservation check", {
      firstItem: {
        hasId: "id" in traceabilityArray[0],
        hasIdFull: "full" in traceabilityArray[0].id,
        idFullValue: firstIdFull,
      },
      secondItem: {
        hasId: "id" in traceabilityArray[1],
        hasIdFull: "full" in traceabilityArray[1].id,
        idFullValue: secondIdFull,
      },
    });

    assertEquals(firstIdFull, "REQ-001");
    assertEquals(secondIdFull, "REQ-002");

    _logger.info("✓ Successfully handled array data with nested objects");
  });

  _logger.info("=== All Template Variable Deep Path Tests Completed ===");
});

// Run with: deno test tests/integration/template-variable-deep-path_test.ts --allow-all
