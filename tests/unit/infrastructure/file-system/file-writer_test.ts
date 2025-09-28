import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { DenoFileWriter } from "../../../../src/infrastructure/file-system/file-writer.ts";

describe("DenoFileWriter", () => {
  let fileWriter: DenoFileWriter;
  const testDir = "tests/fixtures/writer-test";

  beforeEach(async () => {
    fileWriter = new DenoFileWriter();

    // Ensure test directory exists and is clean
    try {
      await Deno.remove(testDir, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
    await Deno.mkdir(testDir, { recursive: true });
  });

  describe("write", () => {
    it("should successfully write content to a new file", async () => {
      // Arrange
      const filePath = `${testDir}/new-file.txt`;
      const content = "Hello, World!";

      // Act
      const result = fileWriter.write(filePath, content);

      // Assert
      assertEquals(result.ok, true);

      // Verify file was actually created with correct content
      const writtenContent = await Deno.readTextFile(filePath);
      assertEquals(writtenContent, content);
    });

    it("should overwrite existing file content", async () => {
      // Arrange
      const filePath = `${testDir}/existing-file.txt`;
      const initialContent = "Initial content";
      const newContent = "New content";

      await Deno.writeTextFile(filePath, initialContent);

      // Act
      const result = fileWriter.write(filePath, newContent);

      // Assert
      assertEquals(result.ok, true);

      // Verify file was overwritten
      const writtenContent = await Deno.readTextFile(filePath);
      assertEquals(writtenContent, newContent);
    });

    it("should handle empty content correctly", async () => {
      // Arrange
      const filePath = `${testDir}/empty-file.txt`;
      const emptyContent = "";

      // Act
      const result = fileWriter.write(filePath, emptyContent);

      // Assert
      assertEquals(result.ok, true);

      // Verify empty file was created
      const writtenContent = await Deno.readTextFile(filePath);
      assertEquals(writtenContent, emptyContent);
    });

    it("should handle large content correctly", async () => {
      // Arrange
      const filePath = `${testDir}/large-file.txt`;
      const largeContent = "x".repeat(50000); // 50KB of content

      // Act
      const result = fileWriter.write(filePath, largeContent);

      // Assert
      assertEquals(result.ok, true);

      // Verify large file was written correctly
      const writtenContent = await Deno.readTextFile(filePath);
      assertEquals(writtenContent, largeContent);
      assertEquals(writtenContent.length, 50000);
    });

    it("should handle unicode and special characters", async () => {
      // Arrange
      const filePath = `${testDir}/unicode-file.txt`;
      const unicodeContent =
        "Hello 世界 🚀\nNewline and émojis\tTab and spëcial chars";

      // Act
      const result = fileWriter.write(filePath, unicodeContent);

      // Assert
      assertEquals(result.ok, true);

      // Verify unicode content was preserved
      const writtenContent = await Deno.readTextFile(filePath);
      assertEquals(writtenContent, unicodeContent);
    });

    it("should handle nested directory creation failure gracefully", () => {
      // Arrange
      const nestedFilePath = `${testDir}/nested/deep/directory/file.txt`;
      const content = "File in nested directory";

      // Act
      const result = fileWriter.write(nestedFilePath, content);

      // Assert
      // Deno.writeTextFileSync doesn't automatically create parent directories
      // So this should fail with WriteFailed
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "WriteFailed");
        assertEquals(result.error.path, nestedFilePath);
        assertExists(result.error.message);
      }
    });

    it("should return PermissionDenied error when write access is denied", async () => {
      // Arrange: Create a directory and remove write permissions
      const restrictedDir = `${testDir}/restricted`;
      await Deno.mkdir(restrictedDir, { recursive: true });

      try {
        // Remove write permissions from directory
        await Deno.chmod(restrictedDir, 0o444);

        const restrictedFilePath = `${restrictedDir}/no-write.txt`;
        const content = "Should not be written";

        // Act
        const result = fileWriter.write(restrictedFilePath, content);

        // Assert
        assertEquals(result.ok, false);
        if (!result.ok) {
          // Permission behavior varies by OS and environment
          if (result.error.kind === "PermissionDenied") {
            assertEquals(result.error.path, restrictedFilePath);
            assertExists(result.error.message);
          } else {
            // In some environments, this may manifest as WriteFailed
            assertEquals(result.error.kind, "WriteFailed");
          }
        }
      } finally {
        // Cleanup: Restore permissions
        try {
          await Deno.chmod(restrictedDir, 0o755);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should handle invalid path characters gracefully", () => {
      // Arrange: Path with invalid characters (varies by OS)
      const invalidPath = `${testDir}/invalid\x00path.txt`;
      const content = "test content";

      // Act
      const result = fileWriter.write(invalidPath, content);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "WriteFailed");
        assertExists(result.error.message);
        assertEquals(result.error.path, invalidPath);
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange
      const filePath = `${testDir}/result-test.txt`;
      const content = "Result pattern test";

      // Act
      const result = fileWriter.write(filePath, content);

      // Assert: Verify Result pattern structure
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertEquals(result.data, undefined);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
        assertExists(result.error.path);
      }
    });

    it("should handle concurrent writes to different files", async () => {
      // Arrange
      const files = [
        { path: `${testDir}/concurrent-1.txt`, content: "Content 1" },
        { path: `${testDir}/concurrent-2.txt`, content: "Content 2" },
        { path: `${testDir}/concurrent-3.txt`, content: "Content 3" },
      ];

      // Act: Perform concurrent writes
      const results = files.map(({ path, content }) =>
        fileWriter.write(path, content)
      );

      // Assert: All writes should succeed
      results.forEach((result) => {
        assertEquals(result.ok, true);
      });

      // Verify all files were written correctly
      for (const { path, content } of files) {
        const writtenContent = await Deno.readTextFile(path);
        assertEquals(writtenContent, content);
      }
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", () => {
      // Arrange: Use a clearly invalid path
      const invalidPath = "/root/cannot/write/here.txt";
      const content = "test";

      // Act
      const result = fileWriter.write(invalidPath, content);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });

    it("should include path information in errors", () => {
      // Arrange
      const testPath = "/invalid/path/file.txt";
      const content = "test";

      // Act
      const result = fileWriter.write(testPath, content);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.path, testPath);
      }
    });
  });
});
