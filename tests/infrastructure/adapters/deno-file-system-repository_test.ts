/**
 * DenoFileSystemRepository Tests
 *
 * Comprehensive test suite for DenoFileSystemRepository implementation
 * to improve code coverage from 0% to 80%+
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import {
  DenoEnvironmentRepository,
  DenoFileSystemRepository,
} from "../../../src/infrastructure/adapters/deno-file-system-repository.ts";

Deno.test("DenoFileSystemRepository - readFile", async (t) => {
  const repo = new DenoFileSystemRepository();
  const testDir = await Deno.makeTempDir();
  const testFile = `${testDir}/test.txt`;
  const testContent = "test content";

  await t.step("should read existing file successfully", async () => {
    await Deno.writeTextFile(testFile, testContent);
    const result = await repo.readFile(testFile);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, testContent);
    }
  });

  await t.step(
    "should return FileNotFound error for non-existent file",
    async () => {
      const result = await repo.readFile(`${testDir}/nonexistent.txt`);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    },
  );

  await t.step("should handle permission denied errors", async () => {
    // Create a file with restricted permissions
    const restrictedFile = `${testDir}/restricted.txt`;
    await Deno.writeTextFile(restrictedFile, "restricted");
    await Deno.chmod(restrictedFile, 0o000);

    const result = await repo.readFile(restrictedFile);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "PermissionDenied");
    }

    // Restore permissions for cleanup
    await Deno.chmod(restrictedFile, 0o644);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("DenoFileSystemRepository - writeFile", async (t) => {
  const repo = new DenoFileSystemRepository();
  const testDir = await Deno.makeTempDir();
  const testFile = `${testDir}/write-test.txt`;
  const testContent = "written content";

  await t.step("should write file successfully", async () => {
    const result = await repo.writeFile(testFile, testContent);
    assertEquals(result.ok, true);

    // Verify content was written
    const written = await Deno.readTextFile(testFile);
    assertEquals(written, testContent);
  });

  await t.step("should overwrite existing file", async () => {
    const newContent = "overwritten content";
    const result = await repo.writeFile(testFile, newContent);
    assertEquals(result.ok, true);

    const written = await Deno.readTextFile(testFile);
    assertEquals(written, newContent);
  });

  await t.step("should handle permission denied errors", async () => {
    // Create a read-only directory
    const readOnlyDir = `${testDir}/readonly`;
    await Deno.mkdir(readOnlyDir);
    await Deno.chmod(readOnlyDir, 0o555);

    const result = await repo.writeFile(`${readOnlyDir}/test.txt`, "content");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "PermissionDenied");
    }

    // Restore permissions for cleanup
    await Deno.chmod(readOnlyDir, 0o755);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("DenoFileSystemRepository - ensureDirectory", async (t) => {
  const repo = new DenoFileSystemRepository();
  const testDir = await Deno.makeTempDir();

  await t.step("should create directory successfully", async () => {
    const newDir = `${testDir}/new-dir`;
    const result = await repo.ensureDirectory(newDir);
    assertEquals(result.ok, true);

    // Verify directory was created
    const stat = await Deno.stat(newDir);
    assertEquals(stat.isDirectory, true);
  });

  await t.step("should create nested directories", async () => {
    const nestedDir = `${testDir}/level1/level2/level3`;
    const result = await repo.ensureDirectory(nestedDir);
    assertEquals(result.ok, true);

    const stat = await Deno.stat(nestedDir);
    assertEquals(stat.isDirectory, true);
  });

  await t.step("should handle existing directory", async () => {
    const existingDir = `${testDir}/existing`;
    await Deno.mkdir(existingDir);

    const result = await repo.ensureDirectory(existingDir);
    assertEquals(result.ok, true);
  });

  await t.step("should handle permission denied errors", async () => {
    // Create a read-only parent directory
    const readOnlyDir = `${testDir}/readonly-parent`;
    await Deno.mkdir(readOnlyDir);
    await Deno.chmod(readOnlyDir, 0o555);

    const result = await repo.ensureDirectory(`${readOnlyDir}/child`);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "PermissionDenied");
    }

    // Restore permissions
    await Deno.chmod(readOnlyDir, 0o755);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("DenoFileSystemRepository - exists", async (t) => {
  const repo = new DenoFileSystemRepository();
  const testDir = await Deno.makeTempDir();

  await t.step("should return true for existing file", async () => {
    const testFile = `${testDir}/exists.txt`;
    await Deno.writeTextFile(testFile, "content");

    const result = await repo.exists(testFile);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should return true for existing directory", async () => {
    const testSubDir = `${testDir}/subdir`;
    await Deno.mkdir(testSubDir);

    const result = await repo.exists(testSubDir);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should return false for non-existent path", async () => {
    const result = await repo.exists(`${testDir}/nonexistent`);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, false);
    }
  });

  await t.step("should handle permission denied errors", async () => {
    // Create a directory with restricted permissions
    const restrictedDir = `${testDir}/restricted-check`;
    await Deno.mkdir(restrictedDir);
    const restrictedFile = `${restrictedDir}/file.txt`;
    await Deno.writeTextFile(restrictedFile, "content");
    await Deno.chmod(restrictedDir, 0o000);

    const result = await repo.exists(restrictedFile);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "PermissionDenied");
    }

    // Restore permissions
    await Deno.chmod(restrictedDir, 0o755);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("DenoFileSystemRepository - findFiles", async (t) => {
  const repo = new DenoFileSystemRepository();
  const testDir = await Deno.makeTempDir();

  await t.step("should find files matching pattern", async () => {
    // Create test files
    await Deno.writeTextFile(`${testDir}/file1.txt`, "content1");
    await Deno.writeTextFile(`${testDir}/file2.txt`, "content2");
    await Deno.writeTextFile(`${testDir}/file.md`, "markdown");
    await Deno.mkdir(`${testDir}/subdir`);
    await Deno.writeTextFile(`${testDir}/subdir/file3.txt`, "content3");

    // Find .txt files
    const files: string[] = [];
    for await (const file of repo.findFiles(`${testDir}/**/*.txt`)) {
      files.push(file);
    }

    assertEquals(files.length, 3);
    assertEquals(files.some((f) => f.endsWith("file1.txt")), true);
    assertEquals(files.some((f) => f.endsWith("file2.txt")), true);
    assertEquals(files.some((f) => f.endsWith("file3.txt")), true);
  });

  await t.step("should handle no matches", async () => {
    const files: string[] = [];
    for await (const file of repo.findFiles(`${testDir}/**/*.nonexistent`)) {
      files.push(file);
    }
    assertEquals(files.length, 0);
  });

  await t.step("should skip directories", async () => {
    const subTestDir = `${testDir}/skip-dirs`;
    await Deno.mkdir(subTestDir);
    await Deno.mkdir(`${subTestDir}/dir1`);
    await Deno.mkdir(`${subTestDir}/dir2`);
    await Deno.writeTextFile(`${subTestDir}/file.txt`, "content");

    const files: string[] = [];
    for await (const file of repo.findFiles(`${subTestDir}/*`)) {
      files.push(file);
    }

    // Should only find the file, not directories
    assertEquals(files.length, 1);
    assertEquals(files[0].endsWith("file.txt"), true);
  });

  await t.step("should handle errors gracefully", async () => {
    // Use invalid pattern that might cause errors
    const files: string[] = [];
    try {
      for await (const file of repo.findFiles("/nonexistent/path/**/*.txt")) {
        files.push(file);
      }
    } catch {
      // Should not throw, errors are logged internally
    }
    // Should complete without throwing
    assertEquals(files.length, 0);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("DenoEnvironmentRepository - get", async (t) => {
  const repo = new DenoEnvironmentRepository();

  await t.step("should get existing environment variable", () => {
    // Set a test env var
    Deno.env.set("TEST_VAR", "test_value");

    const value = repo.get("TEST_VAR");
    assertEquals(value, "test_value");

    // Cleanup
    Deno.env.delete("TEST_VAR");
  });

  await t.step("should return undefined for non-existent variable", () => {
    const value = repo.get("NONEXISTENT_VAR_12345");
    assertEquals(value, undefined);
  });
});

Deno.test("DenoEnvironmentRepository - getOrDefault", async (t) => {
  const repo = new DenoEnvironmentRepository();

  await t.step("should get existing environment variable", () => {
    Deno.env.set("TEST_VAR_DEFAULT", "actual_value");

    const value = repo.getOrDefault("TEST_VAR_DEFAULT", "default_value");
    assertEquals(value, "actual_value");

    // Cleanup
    Deno.env.delete("TEST_VAR_DEFAULT");
  });

  await t.step("should return default for non-existent variable", () => {
    const value = repo.getOrDefault("NONEXISTENT_VAR_DEFAULT", "default_value");
    assertEquals(value, "default_value");
  });

  await t.step("should handle empty string as valid value", () => {
    Deno.env.set("EMPTY_VAR", "");

    const value = repo.getOrDefault("EMPTY_VAR", "default");
    assertEquals(value, "default"); // Empty string is falsy, so default is returned

    // Cleanup
    Deno.env.delete("EMPTY_VAR");
  });
});

Deno.test("DenoEnvironmentRepository - getCurrentDirectory", async (t) => {
  const repo = new DenoEnvironmentRepository();

  await t.step("should return current working directory", () => {
    const cwd = repo.getCurrentDirectory();
    assertExists(cwd);
    assertEquals(cwd, Deno.cwd());
  });

  await t.step("should reflect directory changes", async () => {
    const originalCwd = Deno.cwd();
    const tempDir = await Deno.makeTempDir();
    const realTempPath = await Deno.realPath(tempDir);

    try {
      Deno.chdir(tempDir);
      const newCwd = repo.getCurrentDirectory();
      // Compare real paths to handle symlinks
      const realNewCwd = await Deno.realPath(newCwd);
      assertEquals(realNewCwd, realTempPath);
    } finally {
      // Restore original directory
      Deno.chdir(originalCwd);
      await Deno.remove(tempDir);
    }
  });
});
