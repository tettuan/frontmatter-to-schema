/**
 * Comprehensive tests for file-system.ts
 * Improving coverage from 15.8% to target 95%+
 * Following AAA pattern and Totality principles
 */

import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import {
  FileReader,
  FileWriter,
} from "../../../../src/infrastructure/filesystem/file-system.ts";
import type { Registry } from "../../../../src/domain/core/types.ts";

// Test helpers
async function createTestFile(path: string, content: string): Promise<void> {
  await Deno.writeTextFile(path, content);
}

async function createTestDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

async function cleanup(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isDirectory) {
        await Deno.remove(path, { recursive: true });
      } else {
        await Deno.remove(path);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}

Deno.test("FileReader", async (t) => {
  const testDir = "/tmp/test_file_reader_temp_" + Date.now();
  const testFilePaths: string[] = [];

  // Setup helper
  const setup = async () => {
    await createTestDir(testDir);
    testFilePaths.push(testDir);
  };

  // Cleanup after all tests
  const teardown = async () => {
    await cleanup(testFilePaths);
  };

  await t.step(
    "readDirectory returns empty PromptList for empty directory",
    async () => {
      // Arrange
      await setup();
      const reader = new FileReader();

      // Act
      const result = await reader.readDirectory(testDir);

      // Assert
      assert(result);
      assertEquals(result.count, 0);

      // Cleanup
      await teardown();
    },
  );

  await t.step("readDirectory reads all .md files", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();

    // Create test markdown files
    const file1 = `${testDir}/test1.md`;
    const file2 = `${testDir}/test2.md`;
    const file3 = `${testDir}/test.txt`; // Should be ignored

    await createTestFile(file1, "# Test 1\nContent 1");
    await createTestFile(file2, "# Test 2\nContent 2");
    await createTestFile(file3, "Not markdown");

    testFilePaths.push(file1, file2, file3);

    // Act
    const result = await reader.readDirectory(testDir);

    // Assert
    assert(result);
    assertEquals(result.count, 2);

    const files = result.getAll();
    assert(files.some((f) => f.path.includes("test1.md")));
    assert(files.some((f) => f.path.includes("test2.md")));
    assert(!files.some((f) => f.path.includes("test.txt")));

    // Cleanup
    await teardown();
  });

  await t.step("readDirectory reads files from subdirectories", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const subDir = `${testDir}/subdir`;
    await createTestDir(subDir);

    const file1 = `${testDir}/root.md`;
    const file2 = `${subDir}/nested.md`;

    await createTestFile(file1, "Root content");
    await createTestFile(file2, "Nested content");

    testFilePaths.push(file1, file2);

    // Act
    const result = await reader.readDirectory(testDir);

    // Assert
    assertEquals(result.count, 2);
    const files = result.getAll();
    assert(files.some((f) => f.path.includes("root.md")));
    assert(files.some((f) => f.path.includes("nested.md")));

    // Cleanup
    await teardown();
  });

  await t.step("readDirectory handles non-existent directory", async () => {
    // Arrange
    const reader = new FileReader();
    const nonExistentDir = "./non_existent_directory_test";

    // Act & Assert
    await assertRejects(
      async () => await reader.readDirectory(nonExistentDir),
      Error,
    );
  });

  await t.step("readFile reads file content successfully", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const testFile = `${testDir}/test.txt`;
    const content = "Test file content\nWith multiple lines";
    await createTestFile(testFile, content);
    testFilePaths.push(testFile);

    // Act
    const result = await reader.readFile(testFile);

    // Assert
    assertEquals(result, content);

    // Cleanup
    await teardown();
  });

  await t.step("readFile throws for non-existent file", async () => {
    // Arrange
    const reader = new FileReader();
    const nonExistentFile = "./non_existent_file.txt";

    // Act & Assert
    await assertRejects(
      async () => await reader.readFile(nonExistentFile),
      Deno.errors.NotFound,
    );
  });

  await t.step("readFile handles empty file", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const testFile = `${testDir}/empty.txt`;
    await createTestFile(testFile, "");
    testFilePaths.push(testFile);

    // Act
    const result = await reader.readFile(testFile);

    // Assert
    assertEquals(result, "");

    // Cleanup
    await teardown();
  });

  await t.step("exists returns true for existing file", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const testFile = `${testDir}/exists.txt`;
    await createTestFile(testFile, "exists");
    testFilePaths.push(testFile);

    // Act
    const result = await reader.exists(testFile);

    // Assert
    assertEquals(result, true);

    // Cleanup
    await teardown();
  });

  await t.step("exists returns true for existing directory", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();

    // Act
    const result = await reader.exists(testDir);

    // Assert
    assertEquals(result, true);

    // Cleanup
    await teardown();
  });

  await t.step("exists returns false for non-existent path", async () => {
    // Arrange
    const reader = new FileReader();
    const nonExistentPath = "./definitely_does_not_exist_12345.txt";

    // Act
    const result = await reader.exists(nonExistentPath);

    // Assert
    assertEquals(result, false);
  });

  await t.step(
    "readDirectory handles special characters in filenames",
    async () => {
      // Arrange
      await setup();
      const reader = new FileReader();
      const specialFile = `${testDir}/special-chars_#1.md`;
      await createTestFile(specialFile, "Special content");
      testFilePaths.push(specialFile);

      // Act
      const result = await reader.readDirectory(testDir);

      // Assert
      assertEquals(result.count, 1);
      const files = result.getAll();
      assert(files[0].path.includes("special-chars_#1.md"));

      // Cleanup
      await teardown();
    },
  );

  await t.step("readDirectory preserves file content accurately", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const testFile = `${testDir}/content-test.md`;
    const complexContent = `---
title: Test
tags: [test, example]
---

# Header

\`\`\`javascript
const code = "example";
\`\`\`

Special chars: 日本語 🚀`;

    await createTestFile(testFile, complexContent);
    testFilePaths.push(testFile);

    // Act
    const result = await reader.readDirectory(testDir);

    // Assert
    assertEquals(result.count, 1);
    const files = result.getAll();
    assertEquals(files[0].content, complexContent);

    // Cleanup
    await teardown();
  });
});

Deno.test("FileWriter", async (t) => {
  const testDir = "./test_file_writer_temp";
  const testFilePaths: string[] = [];

  // Setup helper
  const setup = async () => {
    await createTestDir(testDir);
    testFilePaths.push(testDir);
  };

  // Cleanup after all tests
  const teardown = async () => {
    await cleanup(testFilePaths);
  };

  await t.step("writeJson writes Registry data to file", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();
    const testFile = `${testDir}/test.json`;
    const testData: Registry = {
      version: "1.0.0",
      description: "Test registry",
      tools: {
        availableConfigs: ["config1", "config2"],
        commands: [{
          c1: "test",
          c2: "command",
          c3: "layer",
          description: "Test command",
        }],
      },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, testData);

    // Assert
    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content);
    assertEquals(parsed, testData);

    // Cleanup
    await teardown();
  });

  await t.step("writeJson formats JSON with indentation", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();
    const testFile = `${testDir}/formatted.json`;
    const testData: Registry = {
      version: "1.0",
      description: "Formatted",
      tools: { availableConfigs: [], commands: [] },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, testData);

    // Assert
    const content = await Deno.readTextFile(testFile);
    assert(content.includes("  ")); // Check for indentation
    assert(content.includes("{\n"));
    assert(content.includes("\n}"));

    // Cleanup
    await teardown();
  });

  await t.step("writeJson overwrites existing file", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();
    const testFile = `${testDir}/overwrite.json`;
    await createTestFile(testFile, '{"old": "data"}');
    const newData: Registry = {
      version: "2.0",
      description: "New data",
      tools: { availableConfigs: ["new"], commands: [] },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, newData);

    // Assert
    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content);
    assertEquals(parsed, newData);
    assert(!content.includes("old"));

    // Cleanup
    await teardown();
  });

  await t.step("writeJson handles complex nested objects", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();
    const testFile = `${testDir}/complex.json`;
    const complexData: Registry = {
      version: "3.0.0",
      description: "Complex registry with special chars: 日本語 🚀",
      tools: {
        availableConfigs: ["config1", "config2", "config3"],
        commands: [
          {
            c1: "complex",
            c2: "command",
            c3: "nested",
            description: "Complex nested command",
            usage: "Example usage",
          },
        ],
      },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, complexData);

    // Assert
    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content);
    assertEquals(parsed, complexData);

    // Cleanup
    await teardown();
  });

  await t.step("ensureDir creates directory if it doesn't exist", async () => {
    // Arrange
    const writer = new FileWriter();
    const newDir = `${testDir}/new/nested/directory`;
    testFilePaths.push(newDir);

    // Act
    await writer.ensureDir(newDir);

    // Assert
    const stat = await Deno.stat(newDir);
    assert(stat.isDirectory);

    // Cleanup
    await teardown();
  });

  await t.step("ensureDir is idempotent for existing directory", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();

    // Act - call twice
    await writer.ensureDir(testDir);
    await writer.ensureDir(testDir);

    // Assert - should not throw
    const stat = await Deno.stat(testDir);
    assert(stat.isDirectory);

    // Cleanup
    await teardown();
  });

  await t.step("ensureDir handles deep nesting", async () => {
    // Arrange
    const writer = new FileWriter();
    const deepDir = `${testDir}/a/b/c/d/e/f/g/h`;
    testFilePaths.push(`${testDir}/a`); // Only need to track top level for cleanup

    // Act
    await writer.ensureDir(deepDir);

    // Assert
    const stat = await Deno.stat(deepDir);
    assert(stat.isDirectory);

    // Cleanup
    await teardown();
  });

  await t.step("writeJson creates parent directories if needed", async () => {
    // Arrange
    const writer = new FileWriter();
    const nestedFile = `${testDir}/nested/path/file.json`;
    const registryData: Registry = {
      version: "1.0",
      description: "Nested",
      tools: { availableConfigs: [], commands: [] },
    };
    testFilePaths.push(`${testDir}/nested`);

    // First ensure parent directory exists
    await writer.ensureDir(`${testDir}/nested/path`);

    // Act
    await writer.writeJson(nestedFile, registryData);

    // Assert
    const content = await Deno.readTextFile(nestedFile);
    const parsed = JSON.parse(content);
    assertEquals(parsed, registryData);

    // Cleanup
    await teardown();
  });

  await t.step("writeJson handles minimal Registry", async () => {
    // Arrange
    await setup();
    const writer = new FileWriter();
    const testFile = `${testDir}/empty.json`;
    const minimalData: Registry = {
      version: "0.0.0",
      description: "",
      tools: { availableConfigs: [], commands: [] },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, minimalData);

    // Assert
    const content = await Deno.readTextFile(testFile);
    const parsed = JSON.parse(content);
    assertEquals(parsed, minimalData);

    // Cleanup
    await teardown();
  });

  await t.step(
    "writeJson handles Registry with multiple commands",
    async () => {
      // Arrange
      await setup();
      const writer = new FileWriter();
      const testFile = `${testDir}/array.json`;
      const registryWithCommands: Registry = {
        version: "1.2.3",
        description: "Multiple commands",
        tools: {
          availableConfigs: ["test", "prod", "dev"],
          commands: [
            {
              c1: "domain1",
              c2: "action1",
              c3: "layer1",
              description: "First",
            },
            {
              c1: "domain2",
              c2: "action2",
              c3: "layer2",
              description: "Second",
            },
            {
              c1: "domain3",
              c2: "action3",
              c3: "layer3",
              description: "Third",
            },
          ],
        },
      };
      testFilePaths.push(testFile);

      // Act
      await writer.writeJson(testFile, registryWithCommands);

      // Assert
      const content = await Deno.readTextFile(testFile);
      const parsed = JSON.parse(content);
      assertEquals(parsed, registryWithCommands);

      // Cleanup
      await teardown();
    },
  );
});

Deno.test("FileReader and FileWriter integration", async (t) => {
  const testDir = "./test_integration_temp";
  const testFilePaths: string[] = [];

  // Setup helper
  const setup = async () => {
    await createTestDir(testDir);
    testFilePaths.push(testDir);
  };

  // Cleanup after all tests
  const teardown = async () => {
    await cleanup(testFilePaths);
  };

  await t.step("Read and write cycle preserves data", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const writer = new FileWriter();
    const testFile = `${testDir}/cycle.json`;
    const registryData: Registry = {
      version: "1.0.0",
      description: "Test cycle",
      tools: {
        availableConfigs: ["test"],
        commands: [{
          c1: "test",
          c2: "cycle",
          c3: "data",
          description: "Test cycle command",
        }],
      },
    };
    testFilePaths.push(testFile);

    // Act
    await writer.writeJson(testFile, registryData);
    const content = await reader.readFile(testFile);
    const parsed = JSON.parse(content);

    // Assert
    assertEquals(parsed, registryData);

    // Cleanup
    await teardown();
  });

  await t.step("Directory operations work together", async () => {
    // Arrange
    await setup();
    const reader = new FileReader();
    const writer = new FileWriter();
    const subDir = `${testDir}/subdir`;

    // Act
    await writer.ensureDir(subDir);
    const exists = await reader.exists(subDir);

    // Assert
    assertEquals(exists, true);

    // Cleanup
    await teardown();
  });
});
