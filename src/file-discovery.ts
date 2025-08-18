import { walk } from "jsr:@std/fs@1/walk";
import { basename, relative } from "jsr:@std/path@1";
import type { CommandStructure, PromptFile } from "./types.ts";

/**
 * Discovers all f_*.md files in the prompts directory
 */
export async function discoverPromptFiles(
  promptsDir: string,
): Promise<PromptFile[]> {
  const promptFiles: PromptFile[] = [];

  for await (
    const entry of walk(promptsDir, {
      includeFiles: true,
      includeDirs: false,
      exts: [".md"],
      match: [/\/f_.*\.md$/],
    })
  ) {
    const content = await Deno.readTextFile(entry.path);
    const commandStructure = parseCommandStructure(entry.path, promptsDir);

    promptFiles.push({
      path: entry.path,
      content,
      commandStructure,
    });
  }

  return promptFiles;
}

/**
 * Parses command structure from file path
 * Expected format: .agent/climpt/prompts/{c1}/{c2}/{c3}/f_{input}_{adaptation}.md
 */
export function parseCommandStructure(
  filePath: string,
  promptsDir: string,
): CommandStructure {
  const relativePath = relative(promptsDir, filePath);
  const pathParts = relativePath.split("/");

  if (pathParts.length < 4) {
    throw new Error(`Invalid file path structure: ${filePath}`);
  }

  const c1 = pathParts[0]; // domain/category
  const c2 = pathParts[1]; // directive/action
  const c3 = pathParts[2]; // layer/target
  const filename = basename(filePath, ".md");

  // Parse filename: f_{input}_{adaptation} or f_{input}
  const filenameParts = filename.split("_");
  if (filenameParts.length < 2 || filenameParts[0] !== "f") {
    throw new Error(`Invalid filename format: ${filename}`);
  }

  const input = filenameParts[1];
  const adaptation = filenameParts.length > 2
    ? filenameParts.slice(2).join("_")
    : undefined;

  return {
    c1,
    c2,
    c3,
    input,
    adaptation,
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
