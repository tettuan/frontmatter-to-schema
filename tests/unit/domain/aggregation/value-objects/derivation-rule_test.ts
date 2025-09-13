import { assert, assertEquals } from "@std/assert";
import { DerivationRule } from "../../../../../src/domain/aggregation/value-objects/derivation-rule.ts";

Deno.test("DerivationRule - should create valid rule with required parameters", () => {
  const result = DerivationRule.create("commands[]", "allCommands");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.getSourceExpression(), "commands[]");
    assertEquals(result.data.getTargetField(), "allCommands");
    assertEquals(result.data.isUnique(), false);
  }
});

Deno.test("DerivationRule - should create unique rule when specified", () => {
  const result = DerivationRule.create("tags[]", "uniqueTags", true);
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.getSourceExpression(), "tags[]");
    assertEquals(result.data.getTargetField(), "uniqueTags");
    assertEquals(result.data.isUnique(), true);
  }
});

Deno.test("DerivationRule - should reject empty source expression", () => {
  const result = DerivationRule.create("", "targetField");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assert(result.error.message.includes("Source expression cannot be empty"));
  }
});

Deno.test("DerivationRule - should reject whitespace-only source expression", () => {
  const result = DerivationRule.create("   ", "targetField");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assert(result.error.message.includes("Source expression cannot be empty"));
  }
});

Deno.test("DerivationRule - should reject empty target field", () => {
  const result = DerivationRule.create("commands[]", "");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assert(result.error.message.includes("Target field cannot be empty"));
  }
});

Deno.test("DerivationRule - should reject whitespace-only target field", () => {
  const result = DerivationRule.create("commands[]", "   ");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assert(result.error.message.includes("Target field cannot be empty"));
  }
});

Deno.test("DerivationRule - should trim whitespace from parameters", () => {
  const result = DerivationRule.create("  commands[]  ", "  allCommands  ");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.getSourceExpression(), "commands[]");
    assertEquals(result.data.getTargetField(), "allCommands");
  }
});

Deno.test("DerivationRule - should detect array expressions", () => {
  const arrayRule = DerivationRule.create("commands[]", "allCommands");
  const propertyRule = DerivationRule.create("commands[].name", "commandNames");
  const nonArrayRule = DerivationRule.create("title", "documentTitle");

  assert(arrayRule.ok && propertyRule.ok && nonArrayRule.ok);

  if (arrayRule.ok && propertyRule.ok && nonArrayRule.ok) {
    assert(arrayRule.data.isArrayExpression());
    assert(propertyRule.data.isArrayExpression());
    assert(!nonArrayRule.data.isArrayExpression());
  }
});

Deno.test("DerivationRule - should extract base path correctly", () => {
  const simpleArray = DerivationRule.create("commands[]", "allCommands");
  const nestedArray = DerivationRule.create("metadata.tags[]", "allTags");
  const propertyAccess = DerivationRule.create(
    "commands[].name",
    "commandNames",
  );
  const nonArray = DerivationRule.create("title", "documentTitle");

  assert(simpleArray.ok && nestedArray.ok && propertyAccess.ok && nonArray.ok);

  if (simpleArray.ok && nestedArray.ok && propertyAccess.ok && nonArray.ok) {
    assertEquals(simpleArray.data.getBasePath(), "commands");
    assertEquals(nestedArray.data.getBasePath(), "metadata.tags");
    assertEquals(propertyAccess.data.getBasePath(), "commands");
    assertEquals(nonArray.data.getBasePath(), "title"); // Non-array expressions return full path
  }
});

Deno.test("DerivationRule - should extract property path correctly", () => {
  const simpleArray = DerivationRule.create("commands[]", "allCommands");
  const propertyAccess = DerivationRule.create(
    "commands[].name",
    "commandNames",
  );
  const nestedProperty = DerivationRule.create(
    "items[].metadata.category",
    "categories",
  );
  const noProperty = DerivationRule.create("tags[]", "allTags");

  assert(
    simpleArray.ok && propertyAccess.ok && nestedProperty.ok && noProperty.ok,
  );

  if (
    simpleArray.ok && propertyAccess.ok && nestedProperty.ok && noProperty.ok
  ) {
    assertEquals(simpleArray.data.getPropertyPath(), "");
    assertEquals(propertyAccess.data.getPropertyPath(), "name");
    assertEquals(nestedProperty.data.getPropertyPath(), "metadata.category");
    assertEquals(noProperty.data.getPropertyPath(), "");
  }
});

Deno.test("DerivationRule - should handle complex expressions", () => {
  const complexRule = DerivationRule.create(
    "workflow.steps[].actions.commands",
    "allStepCommands",
  );
  assert(complexRule.ok);

  if (complexRule.ok) {
    assertEquals(
      complexRule.data.getSourceExpression(),
      "workflow.steps[].actions.commands",
    );
    assertEquals(complexRule.data.getBasePath(), "workflow.steps");
    assertEquals(complexRule.data.getPropertyPath(), "actions.commands");
    assert(complexRule.data.isArrayExpression());
  }
});

Deno.test("DerivationRule - should handle expressions without dot after array", () => {
  const result = DerivationRule.create("commands[]extraPart", "result");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.getBasePath(), "commands");
    assertEquals(result.data.getPropertyPath(), ""); // No leading dot, so empty property path
  }
});

Deno.test("DerivationRule - toString should provide readable representation", () => {
  const regularRule = DerivationRule.create("commands[]", "allCommands");
  const uniqueRule = DerivationRule.create("tags[]", "uniqueTags", true);

  assert(regularRule.ok && uniqueRule.ok);

  if (regularRule.ok && uniqueRule.ok) {
    assertEquals(regularRule.data.toString(), "commands[] -> allCommands");
    assertEquals(uniqueRule.data.toString(), "tags[] -> uniqueTags (unique)");
  }
});

Deno.test("DerivationRule - should handle edge case expressions", () => {
  const multipleArrays = DerivationRule.create("first[]second[]", "result");
  const emptyBrackets = DerivationRule.create("data[]", "items");
  const justBrackets = DerivationRule.create("[]", "rootArray");

  assert(multipleArrays.ok && emptyBrackets.ok && justBrackets.ok);

  if (multipleArrays.ok && emptyBrackets.ok && justBrackets.ok) {
    // Multiple arrays - first part becomes base path
    assertEquals(multipleArrays.data.getBasePath(), "first");
    assertEquals(multipleArrays.data.getPropertyPath(), ""); // "second[]" doesn't start with dot

    // Empty brackets case
    assertEquals(emptyBrackets.data.getBasePath(), "data");
    assertEquals(emptyBrackets.data.getPropertyPath(), "");

    // Just brackets case
    assertEquals(justBrackets.data.getBasePath(), "");
    assertEquals(justBrackets.data.getPropertyPath(), "");
  }
});

Deno.test("DerivationRule - should handle special characters in expressions", () => {
  const specialChars = DerivationRule.create(
    "x-metadata.items[].special-field",
    "specialValues",
  );
  assert(specialChars.ok);

  if (specialChars.ok) {
    assertEquals(
      specialChars.data.getSourceExpression(),
      "x-metadata.items[].special-field",
    );
    assertEquals(specialChars.data.getBasePath(), "x-metadata.items");
    assertEquals(specialChars.data.getPropertyPath(), "special-field");
  }
});

Deno.test("DerivationRule - should handle numeric field names", () => {
  const numericRule = DerivationRule.create("items[]", "field123");
  assert(numericRule.ok);

  if (numericRule.ok) {
    assertEquals(numericRule.data.getTargetField(), "field123");
  }
});

Deno.test("DerivationRule - should maintain immutability", () => {
  const rule = DerivationRule.create("commands[]", "allCommands");
  assert(rule.ok);

  if (rule.ok) {
    const expression1 = rule.data.getSourceExpression();
    const expression2 = rule.data.getSourceExpression();
    const field1 = rule.data.getTargetField();
    const field2 = rule.data.getTargetField();

    assertEquals(expression1, expression2);
    assertEquals(field1, field2);
    assertEquals(expression1, "commands[]");
    assertEquals(field1, "allCommands");
  }
});
