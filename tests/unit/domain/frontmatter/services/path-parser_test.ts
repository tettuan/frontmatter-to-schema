import { assertEquals } from "@std/assert";
import { PathParser } from "../../../../../src/domain/frontmatter/services/path-parser.ts";
import { isOk } from "../../../../../src/domain/shared/types/result.ts";

Deno.test("PathParser - should create successfully", () => {
  // Act
  const result = PathParser.create();

  // Assert
  assertEquals(isOk(result), true);
});

Deno.test("PathParser - should parse simple property", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 1);
    assertEquals(result.data[0], { kind: "property", value: "name" });
  }
});

Deno.test("PathParser - should parse dot notation", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("user.name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "user" });
    assertEquals(result.data[1], { kind: "property", value: "name" });
  }
});

Deno.test("PathParser - should parse array index access", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("items[0]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "items" });
    assertEquals(result.data[1], { kind: "arrayIndex", value: 0 });
  }
});

Deno.test("PathParser - should parse complex mixed paths", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("commands[0].name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 3);
    assertEquals(result.data[0], { kind: "property", value: "commands" });
    assertEquals(result.data[1], { kind: "arrayIndex", value: 0 });
    assertEquals(result.data[2], { kind: "property", value: "name" });
  }
});

Deno.test("PathParser - should parse nested array access", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("config.items[1].value");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 4);
    assertEquals(result.data[0], { kind: "property", value: "config" });
    assertEquals(result.data[1], { kind: "property", value: "items" });
    assertEquals(result.data[2], { kind: "arrayIndex", value: 1 });
    assertEquals(result.data[3], { kind: "property", value: "value" });
  }
});

Deno.test("PathParser - should parse multiple array indices", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("matrix[0][1]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 3);
    assertEquals(result.data[0], { kind: "property", value: "matrix" });
    assertEquals(result.data[1], { kind: "arrayIndex", value: 0 });
    assertEquals(result.data[2], { kind: "arrayIndex", value: 1 });
  }
});

Deno.test("PathParser - should handle tools.commands pattern", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("tools.commands");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "tools" });
    assertEquals(result.data[1], { kind: "property", value: "commands" });
  }
});

// Error cases

Deno.test("PathParser - should reject empty path", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("PathParser - should reject whitespace-only path", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("   ");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("PathParser - should reject invalid array index", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("items[abc]");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "ParseError");
  }
});

Deno.test("PathParser - should reject negative array index", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("items[-1]");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "ParseError");
  }
});

Deno.test("PathParser - should handle underscore and dollar in property names", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("_private.$special");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "_private" });
    assertEquals(result.data[1], { kind: "property", value: "$special" });
  }
});

Deno.test("PathParser - should handle numbers in property names", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("field123.value456");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "field123" });
    assertEquals(result.data[1], { kind: "property", value: "value456" });
  }
});

Deno.test("PathParser - should handle edge case with array at end", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("items[0]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "items" });
    assertEquals(result.data[1], { kind: "arrayIndex", value: 0 });
  }
});

Deno.test("PathParser - should handle large array indices", () => {
  // Arrange
  const parser = PathParser.create();
  if (!isOk(parser)) throw new Error("Failed to create parser");

  // Act
  const result = parser.data.parseComplex("items[999]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data.length, 2);
    assertEquals(result.data[0], { kind: "property", value: "items" });
    assertEquals(result.data[1], { kind: "arrayIndex", value: 999 });
  }
});
