import { expandGlob } from "@std/fs";
import { resolve } from "@std/path";

/**
 * Resolves input paths to a list of actual markdown file paths.
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
