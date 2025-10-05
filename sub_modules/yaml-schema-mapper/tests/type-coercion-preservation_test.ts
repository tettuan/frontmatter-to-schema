/**
 * Comprehensive tests for type coercion preservation strategy
 *
 * Tests the 3-layer type coercion policy:
 * - Layer 1: Safe conversions (always applied)
 * - Layer 2: Semantic conversions (opt-in)
 * - Layer 3: Preservation strategy (default for ambiguous cases)
 */

import { assertEquals } from "jsr:@std/assert";
import { mapDataToSchema, WarningCode } from "../src/mod.ts";

// ===== Layer 1: Safe Conversions (Always Applied) =====

Deno.test("Safe conversion: Single-element array unwrap to boolean", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.value, true);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.TYPE_COERCION),
    true,
  );
  assertEquals(
    mapped.warnings.some((w) =>
      w.message.includes("Single-element array unwrapped")
    ),
    true,
  );
});

Deno.test("Safe conversion: Numeric string to number", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    },
    data: {
      count: "42",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.count, 42);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.TYPE_COERCION),
    true,
  );
});

Deno.test("Safe conversion: Numeric string to integer", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        count: { type: "integer" },
      },
    },
    data: {
      count: "42",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.count, 42);
});

Deno.test("Safe conversion: Boolean string 'true' to boolean", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
    },
    data: {
      active: "true",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.active, true);
});

Deno.test("Safe conversion: Boolean string 'false' to boolean", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
    },
    data: {
      active: "false",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.active, false);
});

Deno.test("Safe conversion: Primitive to string", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        count: { type: "string" },
      },
    },
    data: {
      count: 42,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.count, "42");
});

// ===== Layer 3: Preservation Strategy (Default for Ambiguous Cases) =====

Deno.test("Preservation: Multi-element array to boolean", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true, false],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original array
  assertEquals(mapped.data.value, [true, false]);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.AMBIGUOUS_CONVERSION),
    true,
  );
  assertEquals(
    mapped.warnings.some((w) =>
      w.message.includes("Multi-element array cannot be unwrapped")
    ),
    true,
  );
});

Deno.test("Preservation: Invalid string to integer", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        count: { type: "integer" },
      },
    },
    data: {
      count: "abc123",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original string
  assertEquals(mapped.data.count, "abc123");
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.INVALID_CONVERSION),
    true,
  );
});

Deno.test("Preservation: Float to integer (precision loss)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "integer" },
      },
    },
    data: {
      value: 3.14,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original float by default
  assertEquals(mapped.data.value, 3.14);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.VALUE_PRESERVED),
    true,
  );
  assertEquals(
    mapped.warnings.some((w) => w.message.includes("precision loss")),
    true,
  );
});

Deno.test("Preservation: 'yes' string to boolean (not safe)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
    },
    data: {
      active: "yes",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original string (only "true"/"false" are safe)
  assertEquals(mapped.data.active, "yes");
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.INVALID_CONVERSION),
    true,
  );
});

Deno.test("Preservation: Number 0 to boolean (requires semantic conversion)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        disabled: { type: "boolean" },
      },
    },
    data: {
      disabled: 0,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original number (semantic conversion disabled by default)
  assertEquals(mapped.data.disabled, 0);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.INVALID_CONVERSION),
    true,
  );
});

Deno.test("Preservation: null to string (requires semantic conversion)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    },
    data: {
      name: null,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve null (semantic conversion disabled by default)
  assertEquals(mapped.data.name, null);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.INVALID_CONVERSION),
    true,
  );
});

// ===== Layer 2: Semantic Conversions (Opt-In) =====

Deno.test("Semantic conversion: number-to-boolean (0 → false)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        disabled: { type: "boolean" },
      },
    },
    data: {
      disabled: 0,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["number-to-boolean"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.disabled, false);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.TYPE_COERCION),
    true,
  );
  assertEquals(
    mapped.warnings.some((w) => w.message.includes("semantic conversion")),
    true,
  );
});

Deno.test("Semantic conversion: number-to-boolean (1 → true)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
    },
    data: {
      active: 1,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["number-to-boolean"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.active, true);
});

Deno.test("Semantic conversion: null-to-empty-string", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    },
    data: {
      name: null,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["null-to-empty-string"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.name, "");
  assertEquals(
    mapped.warnings.some((w) => w.message.includes("semantic conversion")),
    true,
  );
});

Deno.test("Semantic conversion: boolean-to-number (true → 1)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        flag: { type: "integer" },
      },
    },
    data: {
      flag: true,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["boolean-to-number"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.flag, 1);
});

Deno.test("Semantic conversion: boolean-to-number (false → 0)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        flag: { type: "integer" },
      },
    },
    data: {
      flag: false,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["boolean-to-number"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.flag, 0);
});

Deno.test("Semantic conversion: null-to-empty-array", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    data: {
      tags: null,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["null-to-empty-array"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.tags, []);
});

// ===== Configuration: invalidConversionAction =====

Deno.test("Config: invalidConversionAction=error throws on multi-element array", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true, false],
    },
    options: {
      invalidConversionAction: "error",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should have error-severity warning
  assertEquals(
    mapped.warnings.some((w) => w.severity === "error"),
    true,
  );
});

Deno.test("Config: invalidConversionAction=fallback uses default value", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true, false],
    },
    options: {
      invalidConversionAction: "fallback",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should use default value (false for boolean)
  assertEquals(mapped.data.value, false);
});

Deno.test("Config: invalidConversionAction=preserve keeps original", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true, false],
    },
    options: {
      invalidConversionAction: "preserve",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve original array
  assertEquals(mapped.data.value, [true, false]);
});

Deno.test("Config: invalidConversionAction=fallback for float to integer", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "integer" },
      },
    },
    data: {
      value: 3.14,
    },
    options: {
      invalidConversionAction: "fallback",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should truncate to integer
  assertEquals(mapped.data.value, 3);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.PRECISION_LOSS),
    true,
  );
});

// ===== Configuration: warnOnCoercion =====

Deno.test("Config: warnOnCoercion=false suppresses coercion warnings", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [true],
    },
    options: {
      warnOnCoercion: false,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.value, true);
  // Should NOT have TYPE_COERCION warning
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.TYPE_COERCION),
    false,
  );
});

// ===== Edge Cases =====

Deno.test("Edge case: Empty array to boolean", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "boolean" },
      },
    },
    data: {
      value: [],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should preserve empty array
  assertEquals(mapped.data.value, []);
});

Deno.test("Edge case: NaN to number", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "number" },
      },
    },
    data: {
      value: NaN,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should handle NaN
  assertEquals(Number.isNaN(mapped.data.value), true);
});

Deno.test("Edge case: Infinity to number", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "number" },
      },
    },
    data: {
      value: Infinity,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.value, Infinity);
});

Deno.test("Edge case: Object to string (data loss)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: { type: "string" },
      },
    },
    data: {
      value: { nested: "object" },
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  // Should stringify object
  assertEquals(mapped.data.value, "[object Object]");
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.DATA_LOSS),
    true,
  );
});

// ===== Integration: Nested Objects =====

Deno.test("Integration: Nested object with preservation", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            input_file: { type: "boolean" },
            count: { type: "integer" },
          },
        },
      },
    },
    data: {
      options: {
        input_file: [true, false], // Multi-element - preserve
        count: 3.14, // Float - preserve
      },
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  const options = mapped.data.options as Record<string, unknown>;
  assertEquals(options.input_file, [true, false]);
  assertEquals(options.count, 3.14);
  assertEquals(mapped.warnings.length >= 2, true);
});

// ===== Integration: Array of Objects =====

Deno.test("Integration: Array of objects with mixed coercion", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              count: { type: "integer" },
            },
          },
        },
      },
    },
    data: {
      items: [
        { enabled: [true], count: "42" }, // Safe conversions
        { enabled: [true, false], count: 3.14 }, // Preservation
      ],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  const items = mapped.data.items as Array<Record<string, unknown>>;
  assertEquals(items[0].enabled, true);
  assertEquals(items[0].count, 42);
  assertEquals(items[1].enabled, [true, false]);
  assertEquals(items[1].count, 3.14);
});

// ===== Metadata Tracking =====

Deno.test("Metadata: typesCoerced count", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value1: { type: "boolean" },
        value2: { type: "number" },
        value3: { type: "string" },
      },
    },
    data: {
      value1: [true], // Coercion
      value2: "42", // Coercion
      value3: 42, // Coercion
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.metadata.typesCoerced, 3);
});

// ===== Issue #1310 Regression Test =====

Deno.test("Issue #1310: Single-element array unwrapping for template variables", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            input_file: {
              type: "boolean",
              "x-map-from": "file",
            },
            stdin: { type: "boolean" },
          },
        },
      },
    },
    data: {
      options: {
        file: [false],
        stdin: [true],
      },
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  const options = mapped.data.options as Record<string, unknown>;
  assertEquals(options.input_file, false);
  assertEquals(options.stdin, true);
  // Should have coercion warnings
  assertEquals(
    mapped.warnings.filter((w) => w.code === WarningCode.TYPE_COERCION).length,
    2,
  );
});
