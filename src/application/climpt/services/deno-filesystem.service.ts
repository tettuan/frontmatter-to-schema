/**
 * Deno File System Service - File System Port Implementation
 *
 * Implements the FileSystemPort interface for Deno filesystem operations.
 * Extracted from climpt-adapter.ts for better organization.
 *
 * Updated to use FilePattern Smart Constructor to eliminate hardcoding violations.
 */

import type {
  FileInfo,
  FileSystemPort,
} from "../../../infrastructure/ports/index.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { FilePattern } from "../../../domain/value-objects/file-pattern.ts";

/**
 * Deno file system provider
 */
export class DenoFileSystemProvider implements FileSystemPort {
  async readFile(path: string): Promise<Result<string, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "FileNotFound", path },
      };
    }
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    try {
      // Ensure directory exists
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir) {
        await Deno.mkdir(dir, { recursive: true });
      }

      await Deno.writeTextFile(path, content);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "write" },
      };
    }
  }

  async listFiles(
    dirPath: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], DomainError>> {
    try {
      const files: FileInfo[] = [];
      const regex = pattern ? this.createRegexFromPattern(pattern) : null;

      // If pattern contains ** (recursive), walk directory tree recursively
      const isRecursive = pattern?.includes("**") ?? false;

      if (isRecursive) {
        await this.walkDirectoryRecursive(dirPath, files, regex, dirPath);
      } else {
        // Original non-recursive logic for simple patterns
        for await (const entry of Deno.readDir(dirPath)) {
          if (entry.isFile && (!regex || regex.test(entry.name))) {
            const fullPath = `${dirPath}/${entry.name}`;
            const stat = await Deno.stat(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              isDirectory: false,
              size: stat.size,
              modifiedAt: stat.mtime || new Date(),
            });
          }
        }
      }

      return { ok: true, data: files };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "DirectoryNotFound", path: dirPath },
      };
    }
  }

  /**
   * Recursively walk directory tree to find files matching pattern
   */
  private async walkDirectoryRecursive(
    currentPath: string,
    files: FileInfo[],
    regex: RegExp | null,
    basePath: string,
  ): Promise<void> {
    try {
      for await (const entry of Deno.readDir(currentPath)) {
        const fullPath = `${currentPath}/${entry.name}`;

        if (entry.isFile) {
          // For recursive patterns, test against relative path from base
          const relativePath = fullPath.replace(basePath + "/", "");
          if (!regex || regex.test(relativePath)) {
            const stat = await Deno.stat(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              isDirectory: false,
              size: stat.size,
              modifiedAt: stat.mtime || new Date(),
            });
          }
        } else if (entry.isDirectory) {
          // Recursively walk subdirectories
          await this.walkDirectoryRecursive(fullPath, files, regex, basePath);
        }
      }
    } catch (_error) {
      // Skip directories we can't read (permissions, etc.)
    }
  }

  async exists(path: string): Promise<Result<boolean, DomainError>> {
    try {
      await Deno.stat(path);
      return { ok: true, data: true };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "stat" },
      };
    }
  }

  async createDirectory(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.mkdir(path, { recursive: true });
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "mkdir" },
      };
    }
  }

  async deleteFile(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.remove(path);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "delete" },
      };
    }
  }

  /**
   * Create regex from pattern using FilePattern Smart Constructor
   * Eliminates flawed glob-to-regex conversion by delegating to domain logic
   */
  private createRegexFromPattern(pattern: string): RegExp {
    // If pattern looks like a regex (contains regex-specific characters), use it directly
    if (
      pattern.includes("\\") || pattern.includes("^") ||
      pattern.includes("$") ||
      pattern.includes("(") || pattern.includes(")") || pattern.includes("[") ||
      pattern.includes("]")
    ) {
      // Use FilePattern for regex validation and creation
      const regexResult = FilePattern.createRegex(pattern);
      if (regexResult.ok) {
        return regexResult.data.toRegex();
      }
      // Fallback to direct RegExp if FilePattern validation fails
      return new RegExp(pattern);
    }

    // Otherwise treat as glob pattern using FilePattern Smart Constructor
    const globResult = FilePattern.createGlob(pattern);
    if (globResult.ok) {
      return globResult.data.toRegex();
    }

    // Fallback to legacy conversion if FilePattern creation fails
    return this.globToRegex(pattern);
  }

  /**
   * Convert glob pattern to regular expression
   * Supports basic glob patterns like *.md, double-star patterns, etc.
   */
  private globToRegex(pattern: string): RegExp {
    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
      .replace(/\*/g, "[^/]*") // * matches any chars except /
      .replace(/\?/g, "[^/]"); // ? matches single char except /

    // Handle ** for recursive matching
    regexPattern = regexPattern.replace(/\[\\^\/\]\*\[\\^\/\]\*/g, ".*");

    return new RegExp(`^${regexPattern}$`);
  }

  // Legacy methods for backward compatibility
  async readDirectory(path: string): Promise<string[]> {
    const result = await this.listFiles(path, "\\.md$");
    if (result.ok) {
      return result.data.map((f) => f.name); // Return just the name, not full path
    }
    throw new Error(`Failed to read directory: ${result.error.kind}`);
  }
}
