import { assertEquals, assertExists } from "jsr:@std/assert@1.0.14";
import {
  DenoEnvironmentRepository,
  DenoFileSystemRepository,
} from "./deno-file-system-repository.ts";
import { join } from "jsr:@std/path@1.0.9";

const testDir = await Deno.makeTempDir({ prefix: "deno-fs-repo-test-" });

Deno.test("DenoFileSystemRepository", async (t) => {
  const repo = new DenoFileSystemRepository();

  await t.step("readFile() - should read existing file", async () => {
    const testFile = join(testDir, "test-read.txt");
    const content = "Test content for reading";
    await Deno.writeTextFile(testFile, content);

    const result = await repo.readFile(testFile);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, content);
    }
  });

  await t.step(
    "readFile() - should return error for non-existent file",
    async () => {
      const nonExistentFile = join(testDir, "non-existent.txt");

      const result = await repo.readFile(nonExistentFile);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    },
  );

  await t.step("writeFile() - should write content to file", async () => {
    const testFile = join(testDir, "test-write.txt");
    const content = "Written content";

    const writeResult = await repo.writeFile(testFile, content);
    assertEquals(writeResult.ok, true);

    // Verify the file was written
    const readContent = await Deno.readTextFile(testFile);
    assertEquals(readContent, content);
  });

  await t.step("writeFile() - should overwrite existing file", async () => {
    const testFile = join(testDir, "test-overwrite.txt");
    await Deno.writeTextFile(testFile, "Original content");

    const newContent = "Overwritten content";
    const writeResult = await repo.writeFile(testFile, newContent);
    assertEquals(writeResult.ok, true);

    const readContent = await Deno.readTextFile(testFile);
    assertEquals(readContent, newContent);
  });

  await t.step("ensureDirectory() - should create directory", async () => {
    const dirPath = join(testDir, "new-dir");

    const result = await repo.ensureDirectory(dirPath);
    assertEquals(result.ok, true);

    const stat = await Deno.stat(dirPath);
    assertEquals(stat.isDirectory, true);
  });

  await t.step(
    "ensureDirectory() - should create nested directories",
    async () => {
      const dirPath = join(testDir, "nested", "deep", "dir");

      const result = await repo.ensureDirectory(dirPath);
      assertEquals(result.ok, true);

      const stat = await Deno.stat(dirPath);
      assertEquals(stat.isDirectory, true);
    },
  );

  await t.step(
    "ensureDirectory() - should not fail if directory exists",
    async () => {
      const dirPath = join(testDir, "existing-dir");
      await Deno.mkdir(dirPath);

      const result = await repo.ensureDirectory(dirPath);
      assertEquals(result.ok, true);
    },
  );

  await t.step("exists() - should return true for existing file", async () => {
    const testFile = join(testDir, "test-exists.txt");
    await Deno.writeTextFile(testFile, "content");

    const result = await repo.exists(testFile);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step(
    "exists() - should return true for existing directory",
    async () => {
      const dirPath = join(testDir, "test-exists-dir");
      await Deno.mkdir(dirPath);

      const result = await repo.exists(dirPath);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, true);
      }
    },
  );

  await t.step(
    "exists() - should return false for non-existent path",
    async () => {
      const nonExistentPath = join(testDir, "non-existent-path");

      const result = await repo.exists(nonExistentPath);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, false);
      }
    },
  );

  await t.step("findFiles() - should find files matching pattern", async () => {
    // Create test files
    await Deno.writeTextFile(join(testDir, "file1.md"), "content");
    await Deno.writeTextFile(join(testDir, "file2.md"), "content");
    await Deno.writeTextFile(join(testDir, "file3.txt"), "content");

    const pattern = join(testDir, "*.md");
    const files: string[] = [];

    for await (const file of repo.findFiles(pattern)) {
      files.push(file);
    }

    assertEquals(files.length, 2);
    assertEquals(files.some((f) => f.endsWith("file1.md")), true);
    assertEquals(files.some((f) => f.endsWith("file2.md")), true);
    assertEquals(files.some((f) => f.endsWith("file3.txt")), false);
  });

  await t.step("findFiles() - should handle nested patterns", async () => {
    // Create nested structure
    const subDir = join(testDir, "subdir");
    await Deno.mkdir(subDir);
    await Deno.writeTextFile(join(subDir, "nested.md"), "content");

    const pattern = join(testDir, "**/*.md");
    const files: string[] = [];

    for await (const file of repo.findFiles(pattern)) {
      files.push(file);
    }

    assertEquals(files.some((f) => f.includes("nested.md")), true);
  });

  await t.step(
    "findFiles() - should handle no matches gracefully",
    async () => {
      const pattern = join(testDir, "*.nonexistent");
      const files: string[] = [];

      for await (const file of repo.findFiles(pattern)) {
        files.push(file);
      }

      assertEquals(files.length, 0);
    },
  );
});

Deno.test("DenoEnvironmentRepository", async (t) => {
  const repo = new DenoEnvironmentRepository();

  await t.step("get() - should return environment variable", () => {
    // Use a known environment variable
    Deno.env.set("TEST_VAR", "test_value");

    const value = repo.get("TEST_VAR");
    assertEquals(value, "test_value");

    // Clean up
    Deno.env.delete("TEST_VAR");
  });

  await t.step(
    "get() - should return undefined for non-existent variable",
    () => {
      const value = repo.get("NON_EXISTENT_VAR_12345");
      assertEquals(value, undefined);
    },
  );

  await t.step(
    "getOrDefault() - should return environment variable if exists",
    () => {
      Deno.env.set("TEST_VAR_DEFAULT", "actual_value");

      const value = repo.getOrDefault("TEST_VAR_DEFAULT", "default_value");
      assertEquals(value, "actual_value");

      // Clean up
      Deno.env.delete("TEST_VAR_DEFAULT");
    },
  );

  await t.step(
    "getOrDefault() - should return default if variable doesn't exist",
    () => {
      const value = repo.getOrDefault(
        "NON_EXISTENT_VAR_67890",
        "default_value",
      );
      assertEquals(value, "default_value");
    },
  );

  await t.step(
    "getCurrentDirectory() - should return current working directory",
    () => {
      const cwd = repo.getCurrentDirectory();
      assertExists(cwd);
      assertEquals(typeof cwd, "string");
      assertEquals(cwd.length > 0, true);

      // Should match Deno.cwd()
      assertEquals(cwd, Deno.cwd());
    },
  );
});

// Cleanup
Deno.test("cleanup", () => {
  try {
    Deno.removeSync(testDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
});
