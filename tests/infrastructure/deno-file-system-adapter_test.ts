import { assertEquals, assertStringIncludes } from "@std/assert";
import { ensureDir, ensureFile } from "jsr:@std/fs";
import { join } from "@std/path";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";

/**
 * Infrastructure tests for DenoFileSystemAdapter
 * Tests the actual Deno file system integration with totality principles
 */

const TEST_DIR = "./tmp/test-infrastructure";

async function setupTestDirectory() {
  await ensureDir(TEST_DIR);
}

async function cleanupTestDirectory() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

Deno.test("DenoFileSystemAdapter - create instance", () => {
  const adapter = DenoFileSystemAdapter.create();
  assertEquals(typeof adapter, "object");
  assertEquals(adapter !== null, true);
});

Deno.test("DenoFileSystemAdapter - readTextFile success", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "test-read.txt");
  const testContent = "Hello, World!";

  await Deno.writeTextFile(testFile, testContent);

  const result = await adapter.readTextFile(testFile);

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), testContent);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - readTextFile file not found", async () => {
  const adapter = DenoFileSystemAdapter.create();
  const nonExistentFile = join(TEST_DIR, "non-existent.txt");

  const result = await adapter.readTextFile(nonExistentFile);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.kind, "FileNotFound");
  assertEquals(error.path, nonExistentFile);
});

Deno.test("DenoFileSystemAdapter - writeTextFile success", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "test-write.txt");
  const testContent = "Written content";

  const result = await adapter.writeTextFile(testFile, testContent);

  assertEquals(result.isOk(), true);

  // Verify file was actually written
  const writtenContent = await Deno.readTextFile(testFile);
  assertEquals(writtenContent, testContent);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - writeTextFile permission denied", async () => {
  const adapter = DenoFileSystemAdapter.create();
  // Try to write to a system directory that should be read-only
  const readOnlyPath = "/etc/test-write-fail.txt";

  const result = await adapter.writeTextFile(readOnlyPath, "test");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  // Could be PermissionDenied or IOError depending on system
  assertEquals(["PermissionDenied", "IOError"].includes(error.kind), true);
});

Deno.test("DenoFileSystemAdapter - stat file success", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "test-stat.txt");
  const testContent = "File for stat testing";

  await Deno.writeTextFile(testFile, testContent);

  const result = await adapter.stat(testFile);

  assertEquals(result.isOk(), true);
  const fileInfo = result.unwrap();
  assertEquals(fileInfo.isFile, true);
  assertEquals(fileInfo.isDirectory, false);
  assertEquals(fileInfo.size, testContent.length);
  assertEquals(fileInfo.mtime instanceof Date || fileInfo.mtime === null, true);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - stat directory success", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testDir = join(TEST_DIR, "test-subdir");

  await ensureDir(testDir);

  const result = await adapter.stat(testDir);

  assertEquals(result.isOk(), true);
  const fileInfo = result.unwrap();
  assertEquals(fileInfo.isFile, false);
  assertEquals(fileInfo.isDirectory, true);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - stat non-existent", async () => {
  const adapter = DenoFileSystemAdapter.create();
  const nonExistentPath = join(TEST_DIR, "non-existent");

  const result = await adapter.stat(nonExistentPath);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.kind, "FileNotFound");
  assertEquals(error.path, nonExistentPath);
});

Deno.test("DenoFileSystemAdapter - exists file true", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "test-exists.txt");

  await ensureFile(testFile);

  const result = await adapter.exists(testFile);

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - exists directory true", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testDir = join(TEST_DIR, "test-exists-dir");

  await ensureDir(testDir);

  const result = await adapter.exists(testDir);

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - exists false", async () => {
  const adapter = DenoFileSystemAdapter.create();
  const nonExistentPath = join(TEST_DIR, "non-existent");

  const result = await adapter.exists(nonExistentPath);

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), false);
});

Deno.test("DenoFileSystemAdapter - readDir success", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testDir = join(TEST_DIR, "test-readdir");

  await ensureDir(testDir);
  await ensureFile(join(testDir, "file1.txt"));
  await ensureFile(join(testDir, "file2.md"));
  await ensureDir(join(testDir, "subdir"));

  const result = await adapter.readDir(testDir);

  assertEquals(result.isOk(), true);
  const entries = result.unwrap();
  assertEquals(entries.length, 3);

  // Check that all expected entries are present
  const names = entries.map((e) => e.name).sort();
  assertEquals(names, ["file1.txt", "file2.md", "subdir"]);

  // Check entry types
  const file1 = entries.find((e) => e.name === "file1.txt");
  assertEquals(file1?.isFile, true);
  assertEquals(file1?.isDirectory, false);

  const subdir = entries.find((e) => e.name === "subdir");
  assertEquals(subdir?.isFile, false);
  assertEquals(subdir?.isDirectory, true);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - readDir non-existent directory", async () => {
  const adapter = DenoFileSystemAdapter.create();
  const nonExistentDir = join(TEST_DIR, "non-existent-dir");

  const result = await adapter.readDir(nonExistentDir);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.kind, "FileNotFound");
  assertEquals(error.path, nonExistentDir);
});

Deno.test("DenoFileSystemAdapter - readDir on file (not directory)", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "not-a-directory.txt");

  await ensureFile(testFile);

  const result = await adapter.readDir(testFile);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  // Should be an IOError since we're trying to read a file as directory
  assertEquals(error.kind, "IOError");
  if (error.kind === "IOError") {
    assertStringIncludes(error.message.toLowerCase(), "not a directory");
  }

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - error mapping for various error types", async () => {
  const adapter = DenoFileSystemAdapter.create();

  // Test FileNotFound mapping
  const notFoundResult = await adapter.readTextFile("/non/existent/path");
  assertEquals(notFoundResult.isError(), true);
  assertEquals(notFoundResult.unwrapError().kind, "FileNotFound");

  // Test permission denied (try to read a system file without permission)
  // Note: This might not work on all systems, so we'll check if we get the expected error type
  const permissionResult = await adapter.readTextFile("/etc/shadow");
  assertEquals(permissionResult.isError(), true);
  // Could be FileNotFound or PermissionDenied depending on system
  assertEquals(
    ["FileNotFound", "PermissionDenied", "IOError"].includes(
      permissionResult.unwrapError().kind,
    ),
    true,
  );
});

Deno.test("DenoFileSystemAdapter - concurrent operations", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();

  // Test concurrent read/write operations
  const operations = Array.from({ length: 5 }, async (_, i) => {
    const testFile = join(TEST_DIR, `concurrent-${i}.txt`);
    const content = `Content ${i}`;

    await adapter.writeTextFile(testFile, content);
    const result = await adapter.readTextFile(testFile);

    assertEquals(result.isOk(), true);
    assertEquals(result.unwrap(), content);
  });

  await Promise.all(operations);

  await cleanupTestDirectory();
});

Deno.test("DenoFileSystemAdapter - large file handling", async () => {
  await setupTestDirectory();
  const adapter = DenoFileSystemAdapter.create();
  const testFile = join(TEST_DIR, "large-file.txt");

  // Create a reasonably large content (1MB)
  const largeContent = "x".repeat(1024 * 1024);

  const writeResult = await adapter.writeTextFile(testFile, largeContent);
  assertEquals(writeResult.isOk(), true);

  const readResult = await adapter.readTextFile(testFile);
  assertEquals(readResult.isOk(), true);
  assertEquals(readResult.unwrap().length, largeContent.length);

  const statResult = await adapter.stat(testFile);
  assertEquals(statResult.isOk(), true);
  assertEquals(statResult.unwrap().size, largeContent.length);

  await cleanupTestDirectory();
});
