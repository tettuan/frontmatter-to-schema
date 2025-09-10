/**
 * ValidationRules Value Object Tests
 *
 * Tests for ValidationRules Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  type ValidationRule,
  ValidationRules,
} from "../../../../src/domain/value-objects/validation-rules.ts";

Deno.test("ValidationRules - should create valid rules", () => {
  const rules: ValidationRule[] = [
    {
      name: "requiredField",
      type: "required",
      severity: "error",
      message: "Field is required",
    },
    {
      name: "typeCheck",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
  ];

  const result = ValidationRules.create(rules);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.count(), 2);
    assertEquals(result.data.hasRule("requiredField"), true);
    assertEquals(result.data.hasRule("typeCheck"), true);
  }
});

Deno.test("ValidationRules - should create empty rules in non-strict mode", () => {
  const result = ValidationRules.create([], false);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isEmpty(), true);
    assertEquals(result.data.count(), 0);
  }
});

Deno.test("ValidationRules - should reject empty rules in strict mode", () => {
  const result = ValidationRules.create([], true);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("ValidationRules - should reject rule without name", () => {
  const rules = [
    {
      type: "required" as const,
      severity: "error" as const,
    },
  ] as unknown as ValidationRule[];

  const result = ValidationRules.create(rules);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("ValidationRules - should reject duplicate rule names", () => {
  const rules: ValidationRule[] = [
    { name: "rule1", type: "required", severity: "error" },
    {
      name: "rule1",
      type: "type",
      severity: "warning",
      params: { expectedType: "string" },
    },
  ];

  const result = ValidationRules.create(rules);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("ValidationRules - should reject invalid rule type", () => {
  const rules = [
    {
      name: "test",
      type: "invalid" as const,
      severity: "error" as const,
    },
  ] as unknown as ValidationRule[];

  const result = ValidationRules.create(rules);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("ValidationRules - should reject invalid severity", () => {
  const rules = [
    {
      name: "test",
      type: "required" as const,
      severity: "critical" as const,
    },
  ] as unknown as ValidationRule[];

  const result = ValidationRules.create(rules);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("ValidationRules - should validate type rule params", () => {
  const rulesWithoutParam: ValidationRule[] = [
    {
      name: "typeRule",
      type: "type",
      severity: "error",
    },
  ];

  const resultWithout = ValidationRules.create(rulesWithoutParam);
  assertEquals(resultWithout.ok, false);
  if (!resultWithout.ok) {
    assertEquals(resultWithout.error.kind, "InvalidFormat");
  }

  const rulesWithParam: ValidationRule[] = [
    {
      name: "typeRule",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
  ];

  const resultWith = ValidationRules.create(rulesWithParam);
  assertEquals(resultWith.ok, true);
});

Deno.test("ValidationRules - should validate pattern rule params", () => {
  const invalidPattern: ValidationRule[] = [
    {
      name: "patternRule",
      type: "pattern",
      severity: "error",
      params: { pattern: "[invalid(regex" },
    },
  ];

  const resultInvalid = ValidationRules.create(invalidPattern);
  assertEquals(resultInvalid.ok, false);

  const validPattern: ValidationRule[] = [
    {
      name: "patternRule",
      type: "pattern",
      severity: "error",
      params: { pattern: "^[a-z]+$" },
    },
  ];

  const resultValid = ValidationRules.create(validPattern);
  assertEquals(resultValid.ok, true);
});

Deno.test("ValidationRules - should validate range rule params", () => {
  const noParams: ValidationRule[] = [
    {
      name: "rangeRule",
      type: "range",
      severity: "error",
      params: {},
    },
  ];

  const resultNo = ValidationRules.create(noParams);
  assertEquals(resultNo.ok, false);

  const withMin: ValidationRule[] = [
    {
      name: "rangeRule",
      type: "range",
      severity: "error",
      params: { min: 0 },
    },
  ];

  const resultMin = ValidationRules.create(withMin);
  assertEquals(resultMin.ok, true);
});

Deno.test("ValidationRules - should validate length rule params", () => {
  const noParams: ValidationRule[] = [
    {
      name: "lengthRule",
      type: "length",
      severity: "error",
      params: {},
    },
  ];

  const resultNo = ValidationRules.create(noParams);
  assertEquals(resultNo.ok, false);

  const withMaxLength: ValidationRule[] = [
    {
      name: "lengthRule",
      type: "length",
      severity: "error",
      params: { maxLength: 100 },
    },
  ];

  const resultMax = ValidationRules.create(withMaxLength);
  assertEquals(resultMax.ok, true);
});

Deno.test("ValidationRules - should validate enum rule params", () => {
  const noValues: ValidationRule[] = [
    {
      name: "enumRule",
      type: "enum",
      severity: "error",
      params: {},
    },
  ];

  const resultNo = ValidationRules.create(noValues);
  assertEquals(resultNo.ok, false);

  const withValues: ValidationRule[] = [
    {
      name: "enumRule",
      type: "enum",
      severity: "error",
      params: { values: ["option1", "option2"] },
    },
  ];

  const resultWith = ValidationRules.create(withValues);
  assertEquals(resultWith.ok, true);
});

Deno.test("ValidationRules - should get rules by type", () => {
  const rules: ValidationRule[] = [
    { name: "req1", type: "required", severity: "error" },
    { name: "req2", type: "required", severity: "warning" },
    {
      name: "type1",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
  ];

  const result = ValidationRules.create(rules);
  if (result.ok) {
    const requiredRules = result.data.getRulesByType("required");
    assertEquals(requiredRules.length, 2);

    const typeRules = result.data.getRulesByType("type");
    assertEquals(typeRules.length, 1);
  }
});

Deno.test("ValidationRules - should get rules by severity", () => {
  const rules: ValidationRule[] = [
    { name: "error1", type: "required", severity: "error" },
    {
      name: "error2",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
    { name: "warn1", type: "required", severity: "warning" },
  ];

  const result = ValidationRules.create(rules);
  if (result.ok) {
    const errorRules = result.data.getRulesBySeverity("error");
    assertEquals(errorRules.length, 2);

    const warningRules = result.data.getRulesBySeverity("warning");
    assertEquals(warningRules.length, 1);
  }
});

Deno.test("ValidationRules - should get specific rule", () => {
  const rules: ValidationRule[] = [
    {
      name: "testRule",
      type: "required",
      severity: "error",
      message: "Test message",
    },
  ];

  const result = ValidationRules.create(rules);
  if (result.ok) {
    const ruleResult = result.data.getRule("testRule");
    assertEquals(ruleResult.ok, true);
    if (ruleResult.ok) {
      assertEquals(ruleResult.data.name, "testRule");
      assertEquals(ruleResult.data.message, "Test message");
    }

    const notFoundResult = result.data.getRule("nonexistent");
    assertEquals(notFoundResult.ok, false);
    if (!notFoundResult.ok) {
      assertEquals(notFoundResult.error.kind, "NotFound");
    }
  }
});

Deno.test("ValidationRules - should check for errors and warnings", () => {
  const rulesWithErrors: ValidationRule[] = [
    { name: "error1", type: "required", severity: "error" },
    { name: "warn1", type: "required", severity: "warning" },
  ];

  const resultWithErrors = ValidationRules.create(rulesWithErrors);
  if (resultWithErrors.ok) {
    assertEquals(resultWithErrors.data.hasErrors(), true);
    assertEquals(resultWithErrors.data.hasWarnings(), true);
  }

  const rulesNoErrors: ValidationRule[] = [
    { name: "info1", type: "required", severity: "info" },
  ];

  const resultNoErrors = ValidationRules.create(rulesNoErrors);
  if (resultNoErrors.ok) {
    assertEquals(resultNoErrors.data.hasErrors(), false);
    assertEquals(resultNoErrors.data.hasWarnings(), false);
  }
});

Deno.test("ValidationRules - should merge rules", () => {
  const rules1: ValidationRule[] = [
    { name: "rule1", type: "required", severity: "error" },
  ];
  const rules2: ValidationRule[] = [
    {
      name: "rule2",
      type: "type",
      severity: "warning",
      params: { expectedType: "string" },
    },
  ];

  const result1 = ValidationRules.create(rules1);
  const result2 = ValidationRules.create(rules2);

  if (result1.ok && result2.ok) {
    const mergeResult = result1.data.merge(result2.data);
    assertEquals(mergeResult.ok, true);
    if (mergeResult.ok) {
      assertEquals(mergeResult.data.count(), 2);
      assertEquals(mergeResult.data.hasRule("rule1"), true);
      assertEquals(mergeResult.data.hasRule("rule2"), true);
    }
  }
});

Deno.test("ValidationRules - should handle merge conflicts in strict mode", () => {
  const rules1: ValidationRule[] = [
    { name: "rule1", type: "required", severity: "error" },
  ];
  const rules2: ValidationRule[] = [
    {
      name: "rule1",
      type: "type",
      severity: "warning",
      params: { expectedType: "string" },
    },
  ];

  const result1 = ValidationRules.create(rules1, true);
  const result2 = ValidationRules.create(rules2, true);

  if (result1.ok && result2.ok) {
    const mergeResult = result1.data.merge(result2.data);
    assertEquals(mergeResult.ok, false);
    if (!mergeResult.ok) {
      assertEquals(mergeResult.error.kind, "InvalidFormat");
    }
  }
});

Deno.test("ValidationRules - should filter rules", () => {
  const rules: ValidationRule[] = [
    { name: "error1", type: "required", severity: "error" },
    { name: "warn1", type: "required", severity: "warning" },
    {
      name: "error2",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
  ];

  const result = ValidationRules.create(rules);
  if (result.ok) {
    const filterResult = result.data.filter((rule) =>
      rule.severity === "error"
    );
    assertEquals(filterResult.ok, true);
    if (filterResult.ok) {
      assertEquals(filterResult.data.count(), 2);
    }
  }
});

Deno.test("ValidationRules - should create empty rules with factory", () => {
  const empty = ValidationRules.createEmpty();
  assertEquals(empty.isEmpty(), true);
  assertEquals(empty.isStrictMode(), false);
});

Deno.test("ValidationRules - should have string representation", () => {
  const rules: ValidationRule[] = [
    { name: "rule1", type: "required", severity: "error" },
    {
      name: "rule2",
      type: "type",
      severity: "warning",
      params: { expectedType: "string" },
    },
  ];

  const result = ValidationRules.create(rules, true);
  if (result.ok) {
    assertEquals(
      result.data.toString(),
      "ValidationRules(2 rules, strict mode)",
    );
  }

  const normalResult = ValidationRules.create(rules, false);
  if (normalResult.ok) {
    assertEquals(
      normalResult.data.toString(),
      "ValidationRules(2 rules, normal mode)",
    );
  }
});
