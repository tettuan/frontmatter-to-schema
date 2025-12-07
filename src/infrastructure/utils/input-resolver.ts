import { expandGlob } from "@std/fs";
import { globToRegExp, resolve } from "@std/path";
import { FileSystemPort } from "../ports/file-system-port.ts";

/**
 * Checks if a path contains glob pattern characters.
 */
export function isGlobPattern(path: string): boolean {
  return /[*?{\[]/.test(path);
}

/**
 * Resolves input paths to a list of actual markdown file paths using FileSystemPort.
 * This version respects the injected port adapter, enabling use in alternative runtimes
 * (virtual FS, WASM/Edge, remote storage, tests).
 *
 * Handles:
 * - Glob patterns (e.g., docs/*.md, **\/*.markdown)
 * - Directories (recursively finds markdown files)
 * - Individual files
 *
 * @param inputPaths - Array of input paths (files, directories, or glob patterns)
 * @param fileSystem - FileSystemPort adapter to use for file operations
 * @returns Array of resolved file paths
 */
export async function resolveInputToFilesWithPort(
  inputPaths: string[],
  fileSystem: FileSystemPort,
): Promise<string[]> {
  const files: string[] = [];
  const markdownExtensions = /\.(md|mdown|markdown)$/;

  for (const inputPath of inputPaths) {
    // Check if it's a glob pattern
    if (isGlobPattern(inputPath)) {
      // Use port's expandGlob if available (optimized implementation)
      if (fileSystem.expandGlob) {
        const root = fileSystem.cwd?.() ?? ".";
        const result = await fileSystem.expandGlob(inputPath, root);
        if (result.isOk()) {
          const expandedFiles = result.unwrap();
          // Filter for markdown files
          for (const file of expandedFiles) {
            if (markdownExtensions.test(file)) {
              files.push(file);
            }
          }
        }
        continue;
      }

      // Fallback: walk directories with pattern matching using port operations
      const expandedFiles = await expandGlobWithPort(inputPath, fileSystem);
      files.push(...expandedFiles);
      continue;
    }

    // Check if it's a file or directory using port
    const statResult = await fileSystem.stat(inputPath);
    if (statResult.isError()) {
      // Path doesn't exist or can't be accessed, skip
      continue;
    }

    const info = statResult.unwrap();
    if (info.isFile) {
      // Single file - add it if it's a markdown file or add it anyway (let caller decide)
      files.push(inputPath);
    } else if (info.isDirectory) {
      // Directory - recursively find markdown files through port
      const dirFiles = await walkDirectoryWithPort(inputPath, fileSystem);
      files.push(...dirFiles);
    }
  }

  return files;
}

/**
 * Recursively walks a directory to find markdown files using FileSystemPort.
 */
async function walkDirectoryWithPort(
  dirPath: string,
  fileSystem: FileSystemPort,
): Promise<string[]> {
  const markdownFiles: string[] = [];
  const markdownExtensions = /\.(md|mdown|markdown)$/;

  const dirResult = await fileSystem.readDir(dirPath);
  if (dirResult.isError()) {
    return markdownFiles;
  }

  const entries = dirResult.unwrap();
  for (const entry of entries) {
    const entryPath = `${dirPath}/${entry.name}`;

    if (entry.isFile && markdownExtensions.test(entry.name)) {
      markdownFiles.push(entryPath);
    } else if (entry.isDirectory) {
      const subFiles = await walkDirectoryWithPort(entryPath, fileSystem);
      markdownFiles.push(...subFiles);
    }
  }

  return markdownFiles;
}

/**
 * Expands a glob pattern using FileSystemPort operations.
 * Uses globToRegExp for pattern matching against walked files.
 */
async function expandGlobWithPort(
  pattern: string,
  fileSystem: FileSystemPort,
): Promise<string[]> {
  const files: string[] = [];
  const markdownExtensions = /\.(md|mdown|markdown)$/;

  // Determine the root directory from the pattern
  // For patterns like "docs/**/*.md", start from "docs"
  // For patterns like "**/*.md", start from cwd
  const patternParts = pattern.split("/");
  let rootDir = "";
  let globPart = pattern;

  // Find the first part that contains glob characters
  for (let i = 0; i < patternParts.length; i++) {
    if (isGlobPattern(patternParts[i])) {
      rootDir = patternParts.slice(0, i).join("/") || ".";
      globPart = patternParts.slice(i).join("/");
      break;
    }
  }

  if (rootDir === "") {
    rootDir = fileSystem.cwd?.() ?? ".";
  }

  // Check if root exists
  const rootStat = await fileSystem.stat(rootDir);
  if (rootStat.isError()) {
    return files;
  }

  // Convert glob pattern to regex
  const regex = globToRegExp(globPart, { extended: true, globstar: true });

  // Walk directory and match against pattern
  const allFiles = await walkAllFilesWithPort(rootDir, fileSystem);

  for (const file of allFiles) {
    // Get relative path from root for matching
    const relativePath = file.startsWith(rootDir + "/")
      ? file.slice(rootDir.length + 1)
      : file;

    if (regex.test(relativePath) && markdownExtensions.test(file)) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Recursively walks a directory to collect all files using FileSystemPort.
 */
async function walkAllFilesWithPort(
  dirPath: string,
  fileSystem: FileSystemPort,
): Promise<string[]> {
  const files: string[] = [];

  const dirResult = await fileSystem.readDir(dirPath);
  if (dirResult.isError()) {
    return files;
  }

  const entries = dirResult.unwrap();
  for (const entry of entries) {
    const entryPath = `${dirPath}/${entry.name}`;

    if (entry.isFile) {
      files.push(entryPath);
    } else if (entry.isDirectory) {
      const subFiles = await walkAllFilesWithPort(entryPath, fileSystem);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * @deprecated Use resolveInputToFilesWithPort for port-aware resolution.
 *
 * Resolves input paths to a list of actual markdown file paths.
 * Uses native Deno APIs directly - not compatible with custom FileSystemPort adapters.
 *
 * Handles:
 * - Glob patterns (e.g., docs + wildcard patterns)
 * - Directories (recursively finds .md files)
 * - Individual files
 * - Relative and absolute paths
 */
export async function resolveInputToFiles(
  inputPaths: string[],
): Promise<string[]> {
  const files: string[] = [];

  for (const inputPath of inputPaths) {
    // Check if it's a glob pattern
    if (/[*?{\[]/.test(inputPath)) {
      // Expand glob pattern
      try {
        for await (
          const entry of expandGlob(inputPath, { root: Deno.cwd() })
        ) {
          if (
            entry.isFile &&
            (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))
          ) {
            files.push(entry.path);
          }
        }
      } catch (_error) {
        // Glob expansion failed, skip this pattern
        continue;
      }
      continue;
    }

    // Check if it's a file or directory
    try {
      const stat = await Deno.stat(inputPath);

      if (stat.isFile) {
        // Single file - add it
        files.push(resolve(inputPath));
      } else if (stat.isDirectory) {
        // Directory - recursively find .md files
        try {
          for await (
            const entry of expandGlob("**/*.{md,markdown}", { root: inputPath })
          ) {
            if (entry.isFile) {
              files.push(entry.path);
            }
          }
        } catch (_error) {
          // Directory traversal failed, skip
          continue;
        }
      }
    } catch (_error) {
      // File/directory doesn't exist or can't be accessed, skip
      continue;
    }
  }

  return files;
}
