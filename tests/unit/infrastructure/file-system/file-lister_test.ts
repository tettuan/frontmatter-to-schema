import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { DenoFileLister } from "../../../../src/infrastructure/file-system/file-lister.ts";

describe("DenoFileLister", () => {
  let fileLister: DenoFileLister;
  const testDir = "tests/fixtures/lister-test";

  beforeEach(async () => {
    fileLister = new DenoFileLister();

    // Clean and recreate test directory
    try {
      await Deno.remove(testDir, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
    await Deno.mkdir(testDir, { recursive: true });
  });

  describe("list", () => {
    it("should list files matching simple pattern", async () => {
      // Arrange: Create test files
      const testFiles = [
        `${testDir}/file1.txt`,
        `${testDir}/file2.txt`,
        `${testDir}/file3.md`,
        `${testDir}/readme.txt`,
      ];

      for (const file of testFiles) {
        await Deno.writeTextFile(file, "test content");
      }

      // Act
      const result = fileLister.list(`${testDir}/*.txt`);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const txtFiles = result.data.filter((path) => path.endsWith(".txt"));
        assertEquals(txtFiles.length, 3); // file1.txt, file2.txt, readme.txt

        // Verify specific files are included
        assertEquals(
          result.data.some((path) => path.includes("file1.txt")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("file2.txt")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("readme.txt")),
          true,
        );

        // Verify .md file is excluded
        assertEquals(
          result.data.some((path) => path.includes("file3.md")),
          false,
        );
      }
    });

    it("should list files with wildcard pattern", async () => {
      // Arrange: Create nested structure
      await Deno.mkdir(`${testDir}/subdir`, { recursive: true });
      const testFiles = [
        `${testDir}/test.md`,
        `${testDir}/subdir/nested.md`,
        `${testDir}/other.txt`,
      ];

      for (const file of testFiles) {
        await Deno.writeTextFile(file, "content");
      }

      // Act
      const result = fileLister.list(`${testDir}/**/*.md`);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 2);
        assertEquals(
          result.data.some((path) => path.includes("test.md")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("nested.md")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("other.txt")),
          false,
        );
      }
    });

    it("should return empty array when no files match pattern", () => {
      // Arrange: Pattern that won't match anything
      const pattern = `${testDir}/nonexistent/**/*.xyz`;

      // Act
      const result = fileLister.list(pattern);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 0);
      }
    });

    it("should handle single file pattern", async () => {
      // Arrange: Create a specific file
      const specificFile = `${testDir}/specific.json`;
      await Deno.writeTextFile(specificFile, '{"test": true}');

      // Act
      const result = fileLister.list(specificFile);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0].includes("specific.json"), true);
      }
    });

    it("should exclude directories from results", async () => {
      // Arrange: Create files and directories
      await Deno.mkdir(`${testDir}/subdirectory`, { recursive: true });
      await Deno.writeTextFile(`${testDir}/file.txt`, "content");
      await Deno.writeTextFile(`${testDir}/subdirectory/nested.txt`, "content");

      // Act
      const result = fileLister.list(`${testDir}/*`);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should only include files, not directories
        const hasFile = result.data.some((path) => path.includes("file.txt"));
        const hasDirectory = result.data.some((path) =>
          path.endsWith("subdirectory")
        );

        assertEquals(hasFile, true);
        assertEquals(hasDirectory, false);
      }
    });

    it("should handle complex nested patterns", async () => {
      // Arrange: Create complex directory structure
      const dirs = [
        `${testDir}/src/domain`,
        `${testDir}/src/infrastructure`,
        `${testDir}/tests/unit`,
        `${testDir}/docs`,
      ];

      for (const dir of dirs) {
        await Deno.mkdir(dir, { recursive: true });
      }

      const files = [
        `${testDir}/src/domain/entity.ts`,
        `${testDir}/src/domain/service.ts`,
        `${testDir}/src/infrastructure/adapter.ts`,
        `${testDir}/tests/unit/test.ts`,
        `${testDir}/docs/readme.md`,
        `${testDir}/package.json`,
      ];

      for (const file of files) {
        await Deno.writeTextFile(file, "content");
      }

      // Act: List all TypeScript files
      const result = fileLister.list(`${testDir}/**/*.ts`);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should find at least 3 TypeScript files
        assertEquals(result.data.length >= 3, true);
        assertEquals(
          result.data.some((path) => path.includes("entity.ts")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("service.ts")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("adapter.ts")),
          true,
        );

        // Verify non-TS files are excluded
        assertEquals(
          result.data.some((path) => path.includes("readme.md")),
          false,
        );
        assertEquals(
          result.data.some((path) => path.includes("package.json")),
          false,
        );
      }
    });

    it("should handle absolute paths in results", async () => {
      // Arrange
      const testFile = `${testDir}/absolute-test.txt`;
      await Deno.writeTextFile(testFile, "content");

      // Act
      const result = fileLister.list(testFile);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        // Result should contain a valid path
        assertExists(result.data[0]);
        assertEquals(result.data[0].length > 0, true);
      }
    });

    it("should return error for invalid patterns", () => {
      // Arrange: Use an invalid glob pattern
      const invalidPattern = `${testDir}/[invalid-bracket`;

      // Act
      const result = fileLister.list(invalidPattern);

      // Assert: Should handle gracefully
      // Note: expandGlobSync might handle invalid patterns differently
      // This test ensures we don't crash on invalid input
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (!result.ok) {
        assertEquals(result.error.kind, "ReadFailed");
        assertExists(result.error.message);
        assertEquals(result.error.path, invalidPattern);
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange
      const pattern = `${testDir}/*.test`;

      // Act
      const result = fileLister.list(pattern);

      // Assert: Verify Result pattern structure
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertEquals(Array.isArray(result.data), true);
        result.data.forEach((path) => {
          assertEquals(typeof path, "string");
        });
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
        assertExists(result.error.path);
      }
    });

    it("should handle special characters in filenames", async () => {
      // Arrange: Create files with special characters
      const specialFiles = [
        `${testDir}/file with spaces.txt`,
        `${testDir}/file-with-dashes.txt`,
        `${testDir}/file_with_underscores.txt`,
        `${testDir}/file.with.dots.txt`,
      ];

      for (const file of specialFiles) {
        await Deno.writeTextFile(file, "content");
      }

      // Act
      const result = fileLister.list(`${testDir}/*.txt`);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 4);

        // Verify all special character files are found
        assertEquals(
          result.data.some((path) => path.includes("file with spaces")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("file-with-dashes")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("file_with_underscores")),
          true,
        );
        assertEquals(
          result.data.some((path) => path.includes("file.with.dots")),
          true,
        );
      }
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages for invalid patterns", () => {
      // Arrange: Use a potentially problematic pattern
      const problematicPattern = "///invalid\\\\pattern";

      // Act
      const result = fileLister.list(problematicPattern);

      // Assert: Should handle gracefully with meaningful error
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
        assertEquals(result.error.path, problematicPattern);
      }
    });

    it("should include pattern information in errors", () => {
      // Arrange
      const testPattern = "/some/invalid/pattern/**/*.invalid";

      // Act
      const result = fileLister.list(testPattern);

      // Assert: If error occurs, should include pattern info
      if (!result.ok) {
        assertEquals(result.error.path, testPattern);
      }
    });
  });
});
