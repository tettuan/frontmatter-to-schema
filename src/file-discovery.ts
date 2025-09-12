import { walk } from "jsr:@std/fs@1/walk";
import { basename, relative } from "jsr:@std/path@1";
import type { CommandStructure, PromptFile } from "./domain/core/types.ts";
import { FILE_NAMING } from "./config/version.ts";
import type { DomainError, Result } from "./domain/core/result.ts";

/**
 * Discovers all f_*.md files in the prompts directory
 */
export async function discoverPromptFiles(
  promptsDir: string,
): Promise<Result<PromptFile[], DomainError>> {
  const promptFiles: PromptFile[] = [];

  try {
    for await (
      const entry of walk(promptsDir, {
        includeFiles: true,
        includeDirs: false,
        exts: [".md"],
        match: [/\/f_.*\.md$/],
      })
    ) {
      const content = await Deno.readTextFile(entry.path);
      const commandStructureResult = parseCommandStructure(
        entry.path,
        promptsDir,
      );

      if (!commandStructureResult.ok) {
        return { ok: false, error: commandStructureResult.error };
      }

      promptFiles.push({
        path: entry.path,
        content,
        commandStructure: commandStructureResult.data,
      });
    }

    return { ok: true, data: promptFiles };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "ReadError",
        path: promptsDir,
        details: `Failed to discover prompt files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}

/**
 * Parses command structure from file path
 * Expected format: .agent/climpt/prompts/{c1}/{c2}/{c3}/f_{input}_{adaptation}.md
 */
export function parseCommandStructure(
  filePath: string,
  promptsDir: string,
): Result<CommandStructure, DomainError> {
  const relativePath = relative(promptsDir, filePath);
  const pathParts = relativePath.split("/");

  if (pathParts.length < 4) {
    return {
      ok: false,
      error: {
        kind: "InvalidFormat",
        input: filePath,
        expectedFormat: "path with at least 4 segments",
      },
    };
  }

  const c1 = pathParts[0]; // domain/category
  const c2 = pathParts[1]; // directive/action
  const c3 = pathParts[2]; // layer/target
  const filename = basename(filePath, ".md");

  // Parse filename: f_{input}_{adaptation} or f_{input}
  const filenameParts = filename.split("_");
  if (
    filenameParts.length < 2 ||
    filenameParts[0] !== FILE_NAMING.FRONTMATTER_PREFIX
  ) {
    return {
      ok: false,
      error: {
        kind: "InvalidFormat",
        input: filename,
        expectedFormat:
          `f_*_*.md (starting with ${FILE_NAMING.FRONTMATTER_PREFIX})`,
      },
    };
  }

  const input = filenameParts[1];
  const adaptation = filenameParts.length > 2
    ? filenameParts.slice(2).join("_")
    : undefined;

  return {
    ok: true,
    data: {
      c1,
      c2,
      c3,
      input,
      adaptation,
    },
  };
}

/**
 * Extracts frontmatter from markdown content
 */
export function extractFrontmatter(
  content: string,
): { frontmatter: string; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: "", body: content };
  }

  return {
    frontmatter: match[1],
    body: match[2],
  };
}

/**
 * Finds template variables in content
 */
export function findTemplateVariables(content: string): string[] {
  const variableRegex = /\{([^}]+)\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}
