/**
 * FrontmatterValidator Domain Service Tests
 *
 * Tests for FrontmatterValidator following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { FrontmatterValidator } from "../../../../../src/domain/frontmatter/services/frontmatter-validator.ts";
import { FrontmatterData } from "../../../../../src/domain/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../../../../src/domain/value-objects/validation-rules.ts";

Deno.test("FrontmatterValidator - should create valid validator", () => {
  const result = FrontmatterValidator.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("FrontmatterValidator - should validate against empty rules", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    author: "John Doe",
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const emptyRules = ValidationRules.createEmpty();

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    emptyRules,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
  }
});

Deno.test("FrontmatterValidator - should validate required fields correctly", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    author: "John Doe",
    published: true,
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const requiredFields = ["title", "author"];

  const result = validator.data.validateRequiredFields(
    frontmatterData.data,
    requiredFields,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
    assertEquals(result.data.fieldResults.length, 2);

    const titleResult = result.data.fieldResults.find((r) =>
      r.fieldName === "title"
    );
    assertEquals(titleResult?.isValid, true);

    const authorResult = result.data.fieldResults.find((r) =>
      r.fieldName === "author"
    );
    assertEquals(authorResult?.isValid, true);
  }
});

Deno.test("FrontmatterValidator - should detect missing required fields", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    // missing 'author' field
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const requiredFields = ["title", "author"];

  const result = validator.data.validateRequiredFields(
    frontmatterData.data,
    requiredFields,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 1);
    assertEquals(result.data.errors[0].includes("author"), true);
    assertEquals(result.data.errors[0].includes("missing"), true);
  }
});

Deno.test("FrontmatterValidator - should detect empty required fields", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    author: "", // empty string
    description: null, // null value
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const requiredFields = ["title", "author", "description"];

  const result = validator.data.validateRequiredFields(
    frontmatterData.data,
    requiredFields,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 2); // author and description are empty
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("author") && e.includes("empty")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("description") && e.includes("empty")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should validate field types correctly", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    count: 42,
    published: true,
    tags: ["test", "example"],
    metadata: { version: "1.0" },
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const typeRules = [
    { fieldName: "title", expectedType: "string" },
    { fieldName: "count", expectedType: "number" },
    { fieldName: "published", expectedType: "boolean" },
    { fieldName: "tags", expectedType: "array" },
    { fieldName: "metadata", expectedType: "object" },
  ];

  const result = validator.data.validateFieldTypes(
    frontmatterData.data,
    typeRules,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
    assertEquals(result.data.fieldResults.length, 5);

    for (const fieldResult of result.data.fieldResults) {
      assertEquals(fieldResult.isValid, true);
    }
  }
});

Deno.test("FrontmatterValidator - should detect type mismatches", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: 123, // should be string
    count: "not a number", // should be number
    published: "true", // should be boolean
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const typeRules = [
    { fieldName: "title", expectedType: "string" },
    { fieldName: "count", expectedType: "number" },
    { fieldName: "published", expectedType: "boolean" },
  ];

  const result = validator.data.validateFieldTypes(
    frontmatterData.data,
    typeRules,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 3);

    assertEquals(
      result.data.errors.some((e) =>
        e.includes("title") && e.includes("string") && e.includes("number")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("count") && e.includes("number") && e.includes("string")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("published") && e.includes("boolean") && e.includes("string")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should validate against validation rules", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    email: "test@example.com",
    count: 42,
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "title",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
    {
      name: "email",
      type: "format",
      severity: "error",
      params: { format: "email" },
    },
    {
      name: "count",
      type: "range",
      severity: "warning",
      params: { min: 1, max: 100 },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
  }
});

Deno.test("FrontmatterValidator - should detect validation rule violations", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: 123, // should be string
    email: "invalid-email", // invalid email format
    count: 150, // exceeds max range
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "title",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
    {
      name: "email",
      type: "format",
      severity: "error",
      params: { format: "email" },
    },
    {
      name: "count",
      type: "range",
      severity: "warning",
      params: { min: 1, max: 100 },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 3);

    assertEquals(
      result.data.errors.some((e) =>
        e.includes("title") && e.includes("string")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("email") && e.includes("valid email")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("count") && e.includes("at most")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should handle missing fields for optional rules", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    title: "Test Document",
    // optional fields are missing
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "title",
      type: "type",
      severity: "error",
      params: { expectedType: "string" },
    },
    {
      name: "description",
      type: "type",
      severity: "warning", // optional field
      params: { expectedType: "string" },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
  }
});

Deno.test("FrontmatterValidator - should validate string length constraints", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    shortTitle: "Hi", // too short
    goodTitle: "This is a good title",
    longTitle:
      "This is a very long title that exceeds the maximum allowed length for this field", // too long
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "shortTitle",
      type: "length",
      severity: "error",
      params: { minLength: 5, maxLength: 50 },
    },
    {
      name: "goodTitle",
      type: "length",
      severity: "error",
      params: { minLength: 5, maxLength: 50 },
    },
    {
      name: "longTitle",
      type: "length",
      severity: "error",
      params: { minLength: 5, maxLength: 50 },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 2); // shortTitle and longTitle fail

    assertEquals(
      result.data.errors.some((e) =>
        e.includes("shortTitle") && e.includes("at least")
      ),
      true,
    );
    assertEquals(
      result.data.errors.some((e) =>
        e.includes("longTitle") && e.includes("at most")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should validate enum constraints", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    status: "published", // valid
    category: "invalid-category", // invalid
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "status",
      type: "enum",
      severity: "error",
      params: { values: ["draft", "published", "archived"] },
    },
    {
      name: "category",
      type: "enum",
      severity: "error",
      params: { values: ["tech", "science", "business"] },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 1);

    assertEquals(
      result.data.errors.some((e) =>
        e.includes("category") && e.includes("one of")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should validate pattern constraints", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    slug: "valid-slug-123", // valid
    invalidSlug: "Invalid Slug!", // invalid
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  const validationRules = ValidationRules.create([
    {
      name: "slug",
      type: "pattern",
      severity: "error",
      params: { pattern: "^[a-z0-9-]+$" },
    },
    {
      name: "invalidSlug",
      type: "pattern",
      severity: "error",
      params: { pattern: "^[a-z0-9-]+$" },
    },
  ]);
  if (!validationRules.ok) throw new Error("Failed to create validation rules");

  const result = validator.data.validateAgainstRules(
    frontmatterData.data,
    validationRules.data,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, false);
    assertEquals(result.data.errors.length, 1);

    assertEquals(
      result.data.errors.some((e) =>
        e.includes("invalidSlug") && e.includes("pattern")
      ),
      true,
    );
  }
});

Deno.test("FrontmatterValidator - should handle empty frontmatter data", () => {
  const validator = FrontmatterValidator.create();
  if (!validator.ok) throw new Error("Failed to create validator");

  const frontmatterData = FrontmatterData.createFromParsed({
    _empty: "placeholder",
  });
  if (!frontmatterData.ok) throw new Error("Failed to create frontmatter data");

  // Create empty frontmatter by filtering out all fields
  const emptyResult = frontmatterData.data.filter(() => false);
  assertEquals(emptyResult.ok, false); // Filter results in empty data, which is invalid

  // Test with actual empty validation rules
  const requiredFields: string[] = [];
  const result = validator.data.validateRequiredFields(
    frontmatterData.data,
    requiredFields,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.isValid, true);
    assertEquals(result.data.errors.length, 0);
  }
});
