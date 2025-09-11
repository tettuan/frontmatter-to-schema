/**
 * Specification Tests for ValidationPatternConfig
 *
 * Tests business requirements for configurable validation patterns
 * Addresses Issue #663: Hardcoded regex pattern elimination
 */

import { assertEquals } from "jsr:@std/assert";
import {
  type ValidationPattern,
  ValidationPatternConfig,
} from "../../../../src/domain/shared/value-objects/validation-pattern-config.ts";

Deno.test("ValidationPatternConfig Specification Tests", async (t) => {
  await t.step(
    "SPEC: Default config must include hardcoded patterns from codebase",
    () => {
      const result = ValidationPatternConfig.createDefault();

      assertEquals(result.ok, true, "Default config creation must succeed");
      if (result.ok) {
        const config = result.data;

        // Test pattern from aggregation/value-objects.ts:55
        const jsonPathPattern = config.getPattern("jsonPathExpression");
        assertEquals(jsonPathPattern.ok, true, "Must include JSONPath pattern");

        if (jsonPathPattern.ok) {
          // Test the actual pattern that was hardcoded
          const testResult = config.validate(
            "commands[].c1",
            "jsonPathExpression",
          );
          assertEquals(testResult.ok, true);
          if (testResult.ok) {
            assertEquals(
              testResult.data,
              true,
              "Must validate JSONPath expressions",
            );
          }
        }

        // Common patterns should be available
        const patterns = config.getAvailablePatterns();
        assertEquals(
          patterns.includes("identifier"),
          true,
          "Must include identifier pattern",
        );
        assertEquals(
          patterns.includes("jsonPathExpression"),
          true,
          "Must include JSONPath pattern",
        );
      }
    },
  );

  await t.step(
    "SPEC: JSONPath expression validation must work correctly",
    () => {
      const result = ValidationPatternConfig.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const config = result.data;

        const validExpressions = [
          "commands[].c1",
          "items.name",
          "data.values",
          "properties[]",
          "nested.array[].field",
        ];

        for (const expr of validExpressions) {
          const validateResult = config.validate(expr, "jsonPathExpression");
          assertEquals(
            validateResult.ok,
            true,
            `Should validate expression: ${expr}`,
          );
          if (validateResult.ok) {
            assertEquals(
              validateResult.data,
              true,
              `Expression ${expr} should be valid`,
            );
          }
        }
      }
    },
  );

  await t.step(
    "SPEC: Invalid patterns must be rejected with Result type",
    () => {
      const result = ValidationPatternConfig.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const config = result.data;

        // Empty input
        const emptyResult = config.validate("", "identifier");
        assertEquals(emptyResult.ok, false);
        if (!emptyResult.ok) {
          assertEquals(emptyResult.error.kind, "EmptyInput");
        }

        // Nonexistent pattern
        const missingResult = config.validate("test", "nonexistent");
        assertEquals(missingResult.ok, false);
        if (!missingResult.ok) {
          assertEquals(missingResult.error.kind, "PatternNotFound");
        }
      }
    },
  );

  await t.step("SPEC: Custom pattern registration must work", () => {
    const result = ValidationPatternConfig.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const config = result.data;

      const customPattern: ValidationPattern = {
        name: "customIdentifier",
        pattern: /^[a-z][a-z0-9]*$/,
        description: "Lowercase identifier pattern",
        examples: ["myvar", "item123"],
      };

      const registerResult = config.registerPattern(customPattern);
      assertEquals(
        registerResult.ok,
        true,
        "Custom pattern registration should succeed",
      );

      const validateResult = config.validate("myvar", "customIdentifier");
      assertEquals(validateResult.ok, true);
      if (validateResult.ok) {
        assertEquals(
          validateResult.data,
          true,
          "Custom pattern should validate correctly",
        );
      }
    }
  });

  await t.step("SPEC: Pattern matching helpers must work", () => {
    const result = ValidationPatternConfig.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const config = result.data;

      // matchesAny should find the first matching pattern
      const matchResult = config.matchesAny("myVariable", [
        "identifier",
        "camelCaseIdentifier",
      ]);
      assertEquals(matchResult.ok, true);
      if (matchResult.ok) {
        assertEquals(
          matchResult.data,
          "identifier",
          "Should match identifier pattern",
        );
      }

      // No match should return null
      const noMatchResult = config.matchesAny("123invalid", [
        "identifier",
        "camelCaseIdentifier",
      ]);
      assertEquals(noMatchResult.ok, true);
      if (noMatchResult.ok) {
        assertEquals(
          noMatchResult.data,
          null,
          "Should return null for no matches",
        );
      }
    }
  });

  await t.step("SPEC: Regex extraction must work for migration", () => {
    const result = ValidationPatternConfig.createDefault();
    assertEquals(result.ok, true);

    if (result.ok) {
      const config = result.data;

      const regexResult = config.getRegex("identifier");
      assertEquals(regexResult.ok, true);

      if (regexResult.ok) {
        const regex = regexResult.data;
        assertEquals(
          regex.test("validIdentifier"),
          true,
          "Extracted regex should work",
        );
        assertEquals(
          regex.test("123invalid"),
          false,
          "Extracted regex should reject invalid",
        );
      }
    }
  });

  await t.step("SPEC: Pattern creation from string must work", () => {
    const patternResult = ValidationPatternConfig.createPatternFromString(
      "testPattern",
      "^test[0-9]+$",
      "Test pattern for numbers",
      "i",
    );

    assertEquals(patternResult.ok, true, "Pattern creation should succeed");

    if (patternResult.ok) {
      const pattern = patternResult.data;
      assertEquals(pattern.name, "testPattern");
      assertEquals(pattern.description, "Test pattern for numbers");
      assertEquals(pattern.flags, "i");
      assertEquals(
        pattern.pattern.test("test123"),
        true,
        "Pattern should validate correctly",
      );
      assertEquals(
        pattern.pattern.test("TEST456"),
        true,
        "Case insensitive flag should work",
      );
    }
  });

  await t.step("SPEC: Error cases must provide detailed information", () => {
    // Invalid regex pattern
    const invalidPatternResult = ValidationPatternConfig
      .createPatternFromString(
        "invalid",
        "[unclosed",
        "Invalid regex",
      );

    assertEquals(invalidPatternResult.ok, false);
    if (!invalidPatternResult.ok) {
      assertEquals(invalidPatternResult.error.kind, "CompilationFailed");
      if (invalidPatternResult.error.kind === "CompilationFailed") {
        assertEquals(invalidPatternResult.error.pattern, "[unclosed");
      }
    }

    // Duplicate pattern registration
    const result = ValidationPatternConfig.createDefault();
    if (result.ok) {
      const config = result.data;

      const duplicatePattern: ValidationPattern = {
        name: "identifier", // Already exists
        pattern: /^[a-z]+$/,
        description: "Duplicate pattern",
      };

      const registerResult = config.registerPattern(duplicatePattern);
      assertEquals(registerResult.ok, false);
      if (!registerResult.ok) {
        assertEquals(registerResult.error.kind, "DuplicatePattern");
      }
    }
  });
});

Deno.test("ValidationPatternConfig - Hardcoding Replacement Tests", async (t) => {
  await t.step(
    "SPEC: Must replace aggregation value-objects regex hardcoding",
    () => {
      const result = ValidationPatternConfig.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const config = result.data;

        // Original hardcoded pattern: /^[a-zA-Z_][a-zA-Z0-9_]*(\[\])?(\.)?.*$/
        const originalTestCases = [
          "commands[].c1", // Should pass
          "items.name", // Should pass
          "data.values", // Should pass
          "123invalid", // Should fail
          "_private", // Should pass
        ];

        for (const testCase of originalTestCases) {
          const result = config.validate(testCase, "jsonPathExpression");
          assertEquals(result.ok, true, `Should handle test case: ${testCase}`);

          if (result.ok) {
            const expected = testCase !== "123invalid"; // Only this one should fail
            assertEquals(
              result.data,
              expected,
              `${testCase} should ${expected ? "pass" : "fail"} validation`,
            );
          }
        }
      }
    },
  );

  await t.step(
    "SPEC: Must provide configurable alternative to hardcoded patterns",
    () => {
      // Test that we can replace hardcoded patterns with configurable ones
      const customPatterns: ValidationPattern[] = [
        {
          name: "strictJsonPath",
          pattern:
            /^[a-zA-Z_][a-zA-Z0-9_]*(\[\])?(\.[a-zA-Z_][a-zA-Z0-9_]*(\[\])?)*$/,
          description: "Stricter JSONPath validation",
        },
      ];

      const result = ValidationPatternConfig.create(
        customPatterns,
        "custom-config",
      );
      assertEquals(result.ok, true);

      if (result.ok) {
        const config = result.data;

        // Custom pattern should be more strict
        const strictResult = config.validate("commands[].c1", "strictJsonPath");
        assertEquals(strictResult.ok, true);
        if (strictResult.ok) {
          assertEquals(
            strictResult.data,
            true,
            "Should validate strict JSONPath",
          );
        }

        // Should reject looser expressions that might pass default pattern
        const looseResult = config.validate("invalid..path", "strictJsonPath");
        assertEquals(looseResult.ok, true);
        if (looseResult.ok) {
          assertEquals(
            looseResult.data,
            false,
            "Should reject invalid JSONPath",
          );
        }
      }
    },
  );

  await t.step(
    "SPEC: Must support runtime pattern injection for extensibility",
    () => {
      const result = ValidationPatternConfig.createDefault();
      assertEquals(result.ok, true);

      if (result.ok) {
        const config = result.data;

        // Add domain-specific patterns at runtime
        const businessPattern: ValidationPattern = {
          name: "businessIdentifier",
          pattern: /^[A-Z]{2,4}-[0-9]{4,6}$/,
          description: "Business identifier format (e.g., ACME-1234)",
          examples: ["ACME-1234", "BIZ-567890"],
        };

        const registerResult = config.registerPattern(businessPattern);
        assertEquals(
          registerResult.ok,
          true,
          "Runtime pattern registration should work",
        );

        const validateResult = config.validate(
          "ACME-1234",
          "businessIdentifier",
        );
        assertEquals(validateResult.ok, true);
        if (validateResult.ok) {
          assertEquals(
            validateResult.data,
            true,
            "Runtime pattern should validate correctly",
          );
        }
      }
    },
  );
});
