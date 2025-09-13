/**
 * DenoFileSystemProvider Tests - Robust Test Implementation
 *
 * Following DDD and Totality principles for complete coverage
 * Addresses Issue #723: Test Coverage Below Target - CLI Services
 */

import { assertEquals, assertExists } from "@std/assert";
import { DenoFileSystemProvider } from "../../../../../src/application/climpt/services/deno-filesystem.service.ts";
import type {
  FileInfo as _FileInfo,
  FileSystemPort as _FileSystemPort,
} from "../../../../../src/infrastructure/ports/index.ts";

Deno.test("DenoFileSystemProvider - Robust Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step("should implement FileSystemPort interface", () => {
      const provider = new DenoFileSystemProvider();
      assertExists(provider, "Provider instance should be created");
      assertEquals(
        typeof provider.readFile,
        "function",
        "Should have readFile method",
      );
      assertEquals(
        typeof provider.writeFile,
        "function",
        "Should have writeFile method",
      );
      assertEquals(
        typeof provider.listFiles,
        "function",
        "Should have listFiles method",
      );
      assertEquals(
        typeof provider.exists,
        "function",
        "Should have exists method",
      );
      assertEquals(
        typeof provider.createDirectory,
        "function",
        "Should have createDirectory method",
      );
      assertEquals(
        typeof provider.deleteFile,
        "function",
        "Should have deleteFile method",
      );
      assertEquals(
        typeof provider.readDirectory,
        "function",
        "Should have readDirectory method",
      );
    });

    await t.step("should create multiple independent instances", () => {
      const provider1 = new DenoFileSystemProvider();
      const provider2 = new DenoFileSystemProvider();

      assertExists(provider1, "First provider should be created");
      assertExists(provider2, "Second provider should be created");
      assertEquals(
        provider1 === provider2,
        false,
        "Instances should be independent",
      );
    });
  });

  await t.step("readFile Method - Successful Scenarios", async (t) => {
    await t.step("should read file content successfully", async () => {
      const provider = new DenoFileSystemProvider();
      const testContent = "Test file content\nLine 2\nLine 3";

      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = (
          path: string,
        ) => {
          if (path === "/test/file.txt") {
            return testContent;
          }
          throw new Deno.errors.NotFound(`File not found: ${path}`);
        };

        const result = await provider.readFile("/test/file.txt");

        assertEquals(result.ok, true, "Result should be successful");
        if (result.ok) {
          assertEquals(result.data, testContent, "Should return file content");
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle empty files", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return "";
        };

        const result = await provider.readFile("/test/empty.txt");

        assertEquals(result.ok, true, "Should handle empty files");
        if (result.ok) {
          assertEquals(result.data, "", "Should return empty string");
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle files with special characters", async () => {
      const provider = new DenoFileSystemProvider();
      const specialContent =
        'Content with unicode: 你好 🚀 ñáéíóú\n\tTabbed content\n"Quoted content"';

      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          return specialContent;
        };

        const result = await provider.readFile("/test/special.txt");

        assertEquals(result.ok, true, "Should handle special characters");
        if (result.ok) {
          assertEquals(
            result.data,
            specialContent,
            "Should preserve special characters",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("readFile Method - Error Scenarios", async (t) => {
    await t.step("should handle file not found", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          throw new Deno.errors.NotFound("File not found");
        };

        const result = await provider.readFile("/nonexistent/file.txt");

        assertEquals(result.ok, false, "Should return error for missing file");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "FileNotFound",
            "Should be FileNotFound error",
          );
          if (result.error.kind === "FileNotFound") {
            assertEquals(
              result.error.path,
              "/nonexistent/file.txt",
              "Should include file path",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });

    await t.step("should handle permission denied", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadTextFile = Deno.readTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).readTextFile = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.readFile("/restricted/file.txt");

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "FileNotFound",
            "Should handle as FileNotFound",
          );
          if (result.error.kind === "FileNotFound") {
            assertEquals(
              result.error.path,
              "/restricted/file.txt",
              "Should include file path",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readTextFile =
          originalReadTextFile;
      }
    });
  });

  await t.step("writeFile Method - Successful Scenarios", async (t) => {
    await t.step("should write file content successfully", async () => {
      const provider = new DenoFileSystemProvider();
      const testContent = "Test write content";
      let writtenPath: string | undefined;
      let writtenContent: string | undefined;

      const originalMkdir = Deno.mkdir;
      const originalWriteTextFile = Deno.writeTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          // Mock successful directory creation
        };

        (Deno as unknown as Record<string, unknown>).writeTextFile = (
          path: string,
          content: string,
        ) => {
          writtenPath = path;
          writtenContent = content;
        };

        const result = await provider.writeFile(
          "/test/output.txt",
          testContent,
        );

        assertEquals(result.ok, true, "Should write file successfully");
        assertEquals(
          writtenPath,
          "/test/output.txt",
          "Should write to correct path",
        );
        assertEquals(
          writtenContent,
          testContent,
          "Should write correct content",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });

    await t.step("should create directory structure when needed", async () => {
      const provider = new DenoFileSystemProvider();
      let createdPath: string | undefined;

      const originalMkdir = Deno.mkdir;
      const originalWriteTextFile = Deno.writeTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = (
          path: string,
          options?: { recursive?: boolean },
        ) => {
          createdPath = path;
          assertEquals(options?.recursive, true, "Should use recursive option");
        };

        (Deno as unknown as Record<string, unknown>).writeTextFile =
          async () => {
            // Mock successful file write
          };

        const result = await provider.writeFile(
          "/deep/nested/directory/file.txt",
          "content",
        );

        assertEquals(
          result.ok,
          true,
          "Should write file with directory creation",
        );
        assertEquals(
          createdPath,
          "/deep/nested/directory",
          "Should create parent directory",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });

    await t.step("should handle root directory files", async () => {
      const provider = new DenoFileSystemProvider();

      const originalMkdir = Deno.mkdir;
      const originalWriteTextFile = Deno.writeTextFile;
      let mkdirCalled = false;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          mkdirCalled = true;
        };

        (Deno as unknown as Record<string, unknown>).writeTextFile = () => {
          // Mock successful file write
        };

        const result = await provider.writeFile("file.txt", "content");

        assertEquals(result.ok, true, "Should write file at root");
        assertEquals(
          mkdirCalled,
          false,
          "Should not create directory for root files",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });
  });

  await t.step("writeFile Method - Error Scenarios", async (t) => {
    await t.step("should handle write permission denied", async () => {
      const provider = new DenoFileSystemProvider();

      const originalMkdir = Deno.mkdir;
      const originalWriteTextFile = Deno.writeTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          // Mock successful directory creation
        };

        (Deno as unknown as Record<string, unknown>).writeTextFile = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.writeFile(
          "/restricted/file.txt",
          "content",
        );

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "PermissionDenied",
            "Should be PermissionDenied error",
          );
          if (result.error.kind === "PermissionDenied") {
            assertEquals(
              result.error.path,
              "/restricted/file.txt",
              "Should include file path",
            );
            assertEquals(
              result.error.operation,
              "write",
              "Should indicate write operation",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });

    await t.step("should handle directory creation failure", async () => {
      const provider = new DenoFileSystemProvider();

      const originalMkdir = Deno.mkdir;
      const originalWriteTextFile = Deno.writeTextFile;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          throw new Error("Cannot create directory");
        };

        (Deno as unknown as Record<string, unknown>).writeTextFile = () => {
          // Should not be called
        };

        const result = await provider.writeFile(
          "/test/dir/file.txt",
          "content",
        );

        assertEquals(
          result.ok,
          false,
          "Should return error for directory creation failure",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "PermissionDenied",
            "Should handle as PermissionDenied",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
        (Deno as unknown as Record<string, unknown>).writeTextFile =
          originalWriteTextFile;
      }
    });
  });

  await t.step("listFiles Method - Successful Scenarios", async (t) => {
    await t.step("should list files in directory without pattern", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;
      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).readDir =
          async function* () {
            yield { name: "file1.txt", isFile: true, isDirectory: false };
            yield { name: "file2.md", isFile: true, isDirectory: false };
            yield { name: "subdir", isFile: false, isDirectory: true };
          };

        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 1024,
          mtime: new Date("2024-01-15T10:00:00Z"),
        });

        const result = await provider.listFiles("/test/dir");

        assertEquals(result.ok, true, "Should list files successfully");
        if (result.ok) {
          assertEquals(
            result.data.length,
            2,
            "Should return only files, not directories",
          );
          assertEquals(
            result.data[0].name,
            "file1.txt",
            "Should include first file",
          );
          assertEquals(
            result.data[1].name,
            "file2.md",
            "Should include second file",
          );
          assertEquals(result.data[0].size, 1024, "Should include file size");
          assertExists(
            result.data[0].modifiedAt,
            "Should include modification time",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });

    await t.step("should filter files by simple pattern", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;
      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).readDir =
          async function* () {
            yield { name: "file1.txt", isFile: true, isDirectory: false };
            yield { name: "file2.md", isFile: true, isDirectory: false };
            yield { name: "file3.ts", isFile: true, isDirectory: false };
          };

        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 512,
          mtime: new Date("2024-01-15T10:00:00Z"),
        });

        const result = await provider.listFiles("/test/dir", "*.md");

        assertEquals(result.ok, true, "Should filter files by pattern");
        if (result.ok) {
          assertEquals(
            result.data.length,
            1,
            "Should return only matching files",
          );
          assertEquals(
            result.data[0].name,
            "file2.md",
            "Should return correct file",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });

    await t.step("should handle recursive patterns with **", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;
      const originalStat = Deno.stat;

      try {
        let readDirCallCount = 0;
        (Deno as unknown as Record<string, unknown>).readDir = async function* (
          path: string,
        ) {
          readDirCallCount++;

          if (path === "/test/dir") {
            yield { name: "file1.md", isFile: true, isDirectory: false };
            yield { name: "subdir", isFile: false, isDirectory: true };
          } else if (path === "/test/dir/subdir") {
            yield { name: "file2.md", isFile: true, isDirectory: false };
          }
        };

        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 256,
          mtime: new Date("2024-01-15T10:00:00Z"),
        });

        const result = await provider.listFiles("/test/dir", "**/*.md");

        assertEquals(result.ok, true, "Should handle recursive patterns");
        if (result.ok) {
          assertEquals(result.data.length, 2, "Should find files recursively");
          assertEquals(readDirCallCount, 2, "Should read multiple directories");
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });
  });

  await t.step("listFiles Method - Error Scenarios", async (t) => {
    await t.step("should handle directory not found", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;

      try {
        (Deno as unknown as Record<string, unknown>).readDir = () => {
          throw new Deno.errors.NotFound("Directory not found");
        };

        const result = await provider.listFiles("/nonexistent/dir");

        assertEquals(
          result.ok,
          false,
          "Should return error for missing directory",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "DirectoryNotFound",
            "Should be DirectoryNotFound error",
          );
          if (result.error.kind === "DirectoryNotFound") {
            assertEquals(
              result.error.path,
              "/nonexistent/dir",
              "Should include directory path",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
      }
    });

    await t.step("should handle permission denied on directory", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;

      try {
        (Deno as unknown as Record<string, unknown>).readDir = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.listFiles("/restricted/dir");

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "DirectoryNotFound",
            "Should handle as DirectoryNotFound",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
      }
    });
  });

  await t.step("exists Method - All Scenarios", async (t) => {
    await t.step("should return true for existing file", async () => {
      const provider = new DenoFileSystemProvider();

      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 1024,
          mtime: new Date(),
        });

        const result = await provider.exists("/test/existing.txt");

        assertEquals(result.ok, true, "Should check existence successfully");
        if (result.ok) {
          assertEquals(
            result.data,
            true,
            "Should return true for existing file",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });

    await t.step("should return false for non-existing file", async () => {
      const provider = new DenoFileSystemProvider();

      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).stat = () => {
          throw new Deno.errors.NotFound("File not found");
        };

        const result = await provider.exists("/test/missing.txt");

        assertEquals(result.ok, true, "Should check existence successfully");
        if (result.ok) {
          assertEquals(
            result.data,
            false,
            "Should return false for missing file",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });

    await t.step("should handle permission denied", async () => {
      const provider = new DenoFileSystemProvider();

      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).stat = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.exists("/restricted/file.txt");

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "PermissionDenied",
            "Should be PermissionDenied error",
          );
          if (result.error.kind === "PermissionDenied") {
            assertEquals(
              result.error.operation,
              "stat",
              "Should indicate stat operation",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });
  });

  await t.step("createDirectory Method - All Scenarios", async (t) => {
    await t.step("should create directory successfully", async () => {
      const provider = new DenoFileSystemProvider();
      let createdPath: string | undefined;

      const originalMkdir = Deno.mkdir;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = (
          path: string,
          options?: { recursive?: boolean },
        ) => {
          createdPath = path;
          assertEquals(options?.recursive, true, "Should use recursive option");
        };

        const result = await provider.createDirectory("/test/new/dir");

        assertEquals(result.ok, true, "Should create directory successfully");
        assertEquals(
          createdPath,
          "/test/new/dir",
          "Should create correct directory",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
      }
    });

    await t.step("should handle permission denied", async () => {
      const provider = new DenoFileSystemProvider();

      const originalMkdir = Deno.mkdir;

      try {
        (Deno as unknown as Record<string, unknown>).mkdir = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.createDirectory("/restricted/dir");

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "PermissionDenied",
            "Should be PermissionDenied error",
          );
          if (result.error.kind === "PermissionDenied") {
            assertEquals(
              result.error.operation,
              "mkdir",
              "Should indicate mkdir operation",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).mkdir = originalMkdir;
      }
    });
  });

  await t.step("deleteFile Method - All Scenarios", async (t) => {
    await t.step("should delete file successfully", async () => {
      const provider = new DenoFileSystemProvider();
      let deletedPath: string | undefined;

      const originalRemove = Deno.remove;

      try {
        (Deno as unknown as Record<string, unknown>).remove = (
          path: string,
        ) => {
          deletedPath = path;
        };

        const result = await provider.deleteFile("/test/file.txt");

        assertEquals(result.ok, true, "Should delete file successfully");
        assertEquals(
          deletedPath,
          "/test/file.txt",
          "Should delete correct file",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).remove = originalRemove;
      }
    });

    await t.step("should handle permission denied", async () => {
      const provider = new DenoFileSystemProvider();

      const originalRemove = Deno.remove;

      try {
        (Deno as unknown as Record<string, unknown>).remove = () => {
          throw new Deno.errors.PermissionDenied("Permission denied");
        };

        const result = await provider.deleteFile("/restricted/file.txt");

        assertEquals(
          result.ok,
          false,
          "Should return error for permission denied",
        );
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "PermissionDenied",
            "Should be PermissionDenied error",
          );
          if (result.error.kind === "PermissionDenied") {
            assertEquals(
              result.error.operation,
              "delete",
              "Should indicate delete operation",
            );
          }
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).remove = originalRemove;
      }
    });
  });

  await t.step("readDirectory Legacy Method", async (t) => {
    await t.step(
      "should read directory and return markdown files",
      async () => {
        const provider = new DenoFileSystemProvider();

        const originalReadDir = Deno.readDir;
        const originalStat = Deno.stat;

        try {
          (Deno as unknown as Record<string, unknown>).readDir =
            async function* () {
              yield { name: "file1.md", isFile: true, isDirectory: false };
              yield { name: "file2.txt", isFile: true, isDirectory: false };
              yield { name: "file3.md", isFile: true, isDirectory: false };
            };

          (Deno as unknown as Record<string, unknown>).stat = () => ({
            size: 512,
            mtime: new Date(),
          });

          const files = await provider.readDirectory("/test/dir");

          assertEquals(files.length, 2, "Should return only markdown files");
          assertEquals(
            files.includes("file1.md"),
            true,
            "Should include first md file",
          );
          assertEquals(
            files.includes("file3.md"),
            true,
            "Should include second md file",
          );
          assertEquals(
            files.includes("file2.txt"),
            false,
            "Should exclude txt file",
          );
        } finally {
          (Deno as unknown as Record<string, unknown>).readDir =
            originalReadDir;
          (Deno as unknown as Record<string, unknown>).stat = originalStat;
        }
      },
    );

    await t.step("should throw error for directory read failure", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;

      try {
        (Deno as unknown as Record<string, unknown>).readDir = () => {
          throw new Error("Directory read failed");
        };

        let caughtError: Error | undefined;
        try {
          await provider.readDirectory("/failing/dir");
        } catch (error) {
          caughtError = error as Error;
        }

        assertExists(caughtError, "Should throw error for read failure");
        assertEquals(
          caughtError.message.includes("Failed to read directory"),
          true,
          "Should have descriptive error message",
        );
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
      }
    });
  });

  await t.step("Pattern Matching Edge Cases", async (t) => {
    await t.step("should handle regex patterns", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;
      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).readDir =
          async function* () {
            yield { name: "test1.js", isFile: true, isDirectory: false };
            yield { name: "test2.ts", isFile: true, isDirectory: false };
            yield { name: "test3.jsx", isFile: true, isDirectory: false };
          };

        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 256,
          mtime: new Date(),
        });

        const result = await provider.listFiles("/test/dir", "\\.(js|ts)$");

        assertEquals(result.ok, true, "Should handle regex patterns");
        if (result.ok) {
          assertEquals(result.data.length, 2, "Should match js and ts files");
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });

    await t.step("should handle complex glob patterns", async () => {
      const provider = new DenoFileSystemProvider();

      const originalReadDir = Deno.readDir;
      const originalStat = Deno.stat;

      try {
        (Deno as unknown as Record<string, unknown>).readDir =
          async function* () {
            yield {
              name: "component.test.ts",
              isFile: true,
              isDirectory: false,
            };
            yield { name: "service.spec.ts", isFile: true, isDirectory: false };
            yield { name: "utils.ts", isFile: true, isDirectory: false };
          };

        (Deno as unknown as Record<string, unknown>).stat = () => ({
          size: 512,
          mtime: new Date(),
        });

        const result = await provider.listFiles("/test/dir", "*.test.*");

        assertEquals(result.ok, true, "Should handle complex glob patterns");
        if (result.ok) {
          assertEquals(result.data.length, 1, "Should match test files");
          assertEquals(
            result.data[0].name,
            "component.test.ts",
            "Should match correct file",
          );
        }
      } finally {
        (Deno as unknown as Record<string, unknown>).readDir = originalReadDir;
        (Deno as unknown as Record<string, unknown>).stat = originalStat;
      }
    });
  });
});
