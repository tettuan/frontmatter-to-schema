/**
 * @fileoverview Template Variable Deep Path Resolution Test
 * @description Test to verify template variables can resolve deep nested paths like {id.full}
 *
 * This test verifies the fix for Issue #1071:
 * - Template variables with deep paths (e.g., {id.full}) should be resolved correctly
 * - Data from x-flatten-arrays should be accessible through template variables
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { TemplateVariableResolver } from "../../src/domain/template/services/template-variable-resolver.ts";
import { FrontmatterDataFactory } from "../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";
import { TemplateVariable } from "../../src/domain/template/value-objects/template-variable.ts";

Deno.test("Template Variable Deep Path Resolution Test", async (t) => {
  await t.step("Should resolve nested object paths like {id.full}", () => {
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

    // Create FrontmatterData
    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    // Create resolver
    const resolverResult = TemplateVariableResolver.create();
    assert(resolverResult.ok);
    const resolver = resolverResult.data;

    // Test resolving nested path variable
    const variableResult = TemplateVariable.create("id.full");
    assert(variableResult.ok);
    const variable = variableResult.data;

    // Create resolution context
    const context = {
      data: frontmatterData,
      arrayDataState: { kind: "not-available" as const },
      hierarchyRoot: undefined,
    };

    // Resolve the variable
    const resolvedResult = resolver.resolveVariable(variable, context);

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
  });

  await t.step("Should resolve multiple levels of nesting", () => {
    const testData = {
      deeply: {
        nested: {
          value: "found-it",
        },
      },
    };

    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    const resolverResult = TemplateVariableResolver.create();
    assert(resolverResult.ok);
    const resolver = resolverResult.data;

    const variableResult = TemplateVariable.create("deeply.nested.value");
    assert(variableResult.ok);
    const variable = variableResult.data;

    const context = {
      data: frontmatterData,
      arrayDataState: { kind: "not-available" as const },
      hierarchyRoot: undefined,
    };

    const resolvedResult = resolver.resolveVariable(variable, context);

    assert(
      resolvedResult.ok,
      `Failed to resolve {deeply.nested.value}: ${
        resolvedResult.ok ? "" : resolvedResult.error.message
      }`,
    );
    assertEquals(resolvedResult.data, "found-it");
  });

  await t.step("Should handle arrays after x-flatten-arrays processing", () => {
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

    const dataResult = FrontmatterDataFactory.fromObject(testData);
    assert(dataResult.ok);
    const frontmatterData = dataResult.data;

    // Test accessing array element's nested property
    const arrayAccessResult = frontmatterData.get("traceability");
    assert(arrayAccessResult.ok);

    const traceabilityArray = arrayAccessResult.data as any[];
    assertEquals(traceabilityArray.length, 2);

    // Verify nested objects are preserved
    assertEquals(traceabilityArray[0].id.full, "REQ-001");
    assertEquals(traceabilityArray[1].id.full, "REQ-002");
  });
});

// Run with: deno test tests/integration/template-variable-deep-path_test.ts --allow-all
