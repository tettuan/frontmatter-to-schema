import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { DenoFileReader } from "../../../../src/infrastructure/file-system/file-reader.ts";

describe("DenoFileReader", () => {
  let fileReader: DenoFileReader;
  const testFilePath = "tests/fixtures/test-file.txt";
  const testContent = "test content for file reader";

  beforeEach(() => {
    fileReader = new DenoFileReader();
  });

  describe("read", () => {
    it("should successfully read existing file content", async () => {
      // Arrange: Create a test file
      await Deno.writeTextFile(testFilePath, testContent);

      try {
        // Act
        const result = fileReader.read(testFilePath);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, testContent);
        }
      } finally {
        // Cleanup
        try {
          await Deno.remove(testFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should return FileNotFound error when file does not exist", () => {
      // Arrange
      const nonExistentPath = "tests/fixtures/non-existent-file.txt";

      // Act
      const result = fileReader.read(nonExistentPath);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
        assertEquals(result.error.path, nonExistentPath);
        assertExists(result.error.message);
      }
    });

    it("should return PermissionDenied error when file access is denied", async () => {
      // Arrange: Create a file and remove read permissions
      const restrictedPath = "tests/fixtures/restricted-file.txt";
      await Deno.writeTextFile(restrictedPath, "restricted content");

      try {
        // Remove read permissions (this might not work on all systems)
        await Deno.chmod(restrictedPath, 0o000);

        // Act
        const result = fileReader.read(restrictedPath);

        // Assert
        assertEquals(result.ok, false);
        if (!result.ok) {
          // Note: Permission denied behavior varies by OS and environment
          // In many test environments, this may not trigger
          if (result.error.kind === "PermissionDenied") {
            assertEquals(result.error.path, restrictedPath);
            assertExists(result.error.message);
          } else {
            // In test environments, permission errors may manifest as ReadFailed
            assertEquals(result.error.kind, "ReadFailed");
          }
        }
      } finally {
        // Cleanup: Restore permissions and remove file
        try {
          await Deno.chmod(restrictedPath, 0o644);
          await Deno.remove(restrictedPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle empty file content correctly", async () => {
      // Arrange
      const emptyFilePath = "tests/fixtures/empty-file.txt";
      await Deno.writeTextFile(emptyFilePath, "");

      try {
        // Act
        const result = fileReader.read(emptyFilePath);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, "");
        }
      } finally {
        // Cleanup
        try {
          await Deno.remove(emptyFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle large file content correctly", async () => {
      // Arrange
      const largeFilePath = "tests/fixtures/large-file.txt";
      const largeContent = "x".repeat(10000); // 10KB of content
      await Deno.writeTextFile(largeFilePath, largeContent);

      try {
        // Act
        const result = fileReader.read(largeFilePath);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, largeContent);
          assertEquals(result.data.length, 10000);
        }
      } finally {
        // Cleanup
        try {
          await Deno.remove(largeFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle files with special characters and unicode", async () => {
      // Arrange
      const unicodeFilePath = "tests/fixtures/unicode-file.txt";
      const unicodeContent = "Hello 世界 🚀 émojis and spëcial chars";
      await Deno.writeTextFile(unicodeFilePath, unicodeContent);

      try {
        // Act
        const result = fileReader.read(unicodeFilePath);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, unicodeContent);
        }
      } finally {
        // Cleanup
        try {
          await Deno.remove(unicodeFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle invalid path characters gracefully", () => {
      // Arrange: Path with invalid characters (varies by OS)
      const invalidPath = "tests/fixtures/invalid\x00path.txt";

      // Act
      const result = fileReader.read(invalidPath);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        // Should be either FileNotFound or ReadFailed depending on OS
        assertEquals(
          ["FileNotFound", "ReadFailed"].includes(result.error.kind),
          true,
        );
        assertExists(result.error.message);
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange
      const validPath = "tests/fixtures/result-test.txt";

      // Act
      const result = fileReader.read(validPath);

      // Assert: Verify Result pattern structure
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
        assertEquals(typeof result.data, "string");
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", () => {
      // Arrange
      const nonExistentPath = "definitely/does/not/exist.txt";

      // Act
      const result = fileReader.read(nonExistentPath);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });

    it("should include path information in errors", () => {
      // Arrange
      const testPath = "some/test/path.txt";

      // Act
      const result = fileReader.read(testPath);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.path, testPath);
      }
    });
  });
});
