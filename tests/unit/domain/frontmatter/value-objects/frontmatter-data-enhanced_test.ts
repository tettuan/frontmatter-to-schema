import { assertEquals } from "jsr:@std/assert";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { isOk } from "../../../../../src/domain/shared/types/result.ts";

// Test data that includes arrays and nested objects
const testData = {
  title: "Test Document",
  commands: [
    { name: "first-command", description: "First command description" },
    { name: "second-command", description: "Second command description" },
    { name: "third-command", description: "Third command description" },
  ],
  tools: {
    commands: [
      { c1: "git", c2: "create", c3: "issue" },
      { c1: "spec", c2: "analyze", c3: "quality" },
    ],
  },
  metadata: {
    version: "1.0.0",
    created: "2023-01-01",
    tags: ["test", "example"],
  },
  matrix: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ],
};

function createTestData(): FrontmatterData {
  const result = TestDataFactory.createFrontmatterData(testData);
  if (!isOk(result)) {
    throw new Error("Failed to create test data");
  }
  return result.data;
}

// Enhanced path resolution tests

Deno.test("FrontmatterData Enhanced - should get simple property", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("title");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "Test Document");
  }
});

Deno.test("FrontmatterData Enhanced - should get nested property", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("metadata.version");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "1.0.0");
  }
});

Deno.test("FrontmatterData Enhanced - should get array element by index", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[0]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const command = result.data as Record<string, unknown>;
    assertEquals(command.name, "first-command");
    assertEquals(command.description, "First command description");
  }
});

Deno.test("FrontmatterData Enhanced - should get nested property from array element", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[0].name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "first-command");
  }
});

Deno.test("FrontmatterData Enhanced - should get array element from nested object", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("tools.commands[1]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const command = result.data as Record<string, unknown>;
    assertEquals(command.c1, "spec");
    assertEquals(command.c2, "analyze");
    assertEquals(command.c3, "quality");
  }
});

Deno.test("FrontmatterData Enhanced - should get complex nested path", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("tools.commands[1].c2");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "analyze");
  }
});

Deno.test("FrontmatterData Enhanced - should get multidimensional array element", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("matrix[1][2]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, 6);
  }
});

Deno.test("FrontmatterData Enhanced - should get array from nested object (tools.commands)", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("tools.commands");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const commands = result.data as Array<Record<string, unknown>>;
    assertEquals(Array.isArray(commands), true);
    assertEquals(commands.length, 2);
    assertEquals(commands[0].c1, "git");
  }
});

Deno.test("FrontmatterData Enhanced - should get nested array (metadata.tags)", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("metadata.tags");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    const tags = result.data as string[];
    assertEquals(Array.isArray(tags), true);
    assertEquals(tags.length, 2);
    assertEquals(tags[0], "test");
    assertEquals(tags[1], "example");
  }
});

Deno.test("FrontmatterData Enhanced - should get array element from nested array", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("metadata.tags[1]");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "example");
  }
});

// Error cases

Deno.test("FrontmatterData Enhanced - should handle array index out of bounds", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[10]");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "FieldNotFound");
  }
});

Deno.test("FrontmatterData Enhanced - should handle array index on non-array", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("title[0]");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "InvalidType");
  }
});

Deno.test("FrontmatterData Enhanced - should handle property access on non-object", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("title.length");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "InvalidType");
  }
});

Deno.test("FrontmatterData Enhanced - should handle nonexistent nested property", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("nonexistent.property");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "FieldNotFound");
  }
});

Deno.test("FrontmatterData Enhanced - should handle nonexistent array element property", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[0].nonexistent");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "FieldNotFound");
  }
});

// Backward compatibility tests

Deno.test("FrontmatterData Enhanced - should maintain backward compatibility with simple dot notation", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("metadata.version");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "1.0.0");
  }
});

Deno.test("FrontmatterData Enhanced - should handle empty path", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("");

  // Assert
  assertEquals(isOk(result), false);
  if (!isOk(result)) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

// Edge cases

Deno.test("FrontmatterData Enhanced - should handle complex nested access patterns", () => {
  // Arrange
  const complexData = {
    users: [
      {
        name: "John",
        projects: [
          { name: "Project A", tasks: [{ id: 1, title: "Task 1" }] },
          { name: "Project B", tasks: [{ id: 2, title: "Task 2" }] },
        ],
      },
      {
        name: "Jane",
        projects: [
          { name: "Project C", tasks: [{ id: 3, title: "Task 3" }] },
        ],
      },
    ],
  };

  const dataResult = TestDataFactory.createFrontmatterData(complexData);
  if (!isOk(dataResult)) throw new Error("Failed to create complex data");
  const data = dataResult.data;

  // Act & Assert
  const result1 = data.get("users[0].name");
  assertEquals(isOk(result1), true);
  if (isOk(result1)) {
    assertEquals(result1.data, "John");
  }

  const result2 = data.get("users[0].projects[1].name");
  assertEquals(isOk(result2), true);
  if (isOk(result2)) {
    assertEquals(result2.data, "Project B");
  }

  const result3 = data.get("users[1].projects[0].tasks[0].title");
  assertEquals(isOk(result3), true);
  if (isOk(result3)) {
    assertEquals(result3.data, "Task 3");
  }
});

Deno.test("FrontmatterData Enhanced - should handle zero index correctly", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[0].name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "first-command");
  }
});

Deno.test("FrontmatterData Enhanced - should handle large indices", () => {
  // Arrange
  const data = createTestData();

  // Act
  const result = data.get("commands[2].name");

  // Assert
  assertEquals(isOk(result), true);
  if (isOk(result)) {
    assertEquals(result.data, "third-command");
  }
});
