#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * Simple Processor - Direct implementation following requirements
 * No complex abstractions, just direct processing
 */

import { globToRegExp } from "jsr:@std/path@1.0.8/glob-to-regexp";
import { join } from "jsr:@std/path@1.0.8";
import { parse as parseYaml } from "jsr:@std/yaml@1.0.7";
import { TemplateEngine } from "./core/template-engine.ts";
import { SchemaExtensionConfig } from "./domain/config/schema-extension-config.ts";
import { SchemaPropertyAccessor } from "./domain/schema/services/schema-property-accessor.ts";

interface CLIArgs {
  schemaPath: string;
  outputPath: string;
  inputPattern: string;
  verbose: boolean;
}

function parseArgs(args: string[]): CLIArgs | null {
  if (args.length < 3) {
    console.error(
      "Usage: frontmatter-to-schema <schema> <output> <pattern> [--verbose]",
    );
    return null;
  }

  return {
    schemaPath: args[0],
    outputPath: args[1],
    inputPattern: args[2],
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

async function loadJsonFile(path: string): Promise<unknown> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

async function findMarkdownFiles(pattern: string): Promise<string[]> {
  const files: string[] = [];
  const baseDir = pattern.replace(/\*.*$/, "").replace(/\/$/, "") || ".";
  const globPattern = pattern.includes("*") ? pattern : `${pattern}/**/*.md`;
  const regex = globToRegExp(globPattern);

  for await (const entry of Deno.readDir(baseDir)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      const fullPath = join(baseDir, entry.name);
      if (regex.test(fullPath)) {
        files.push(fullPath);
      }
    }

    if (entry.isDirectory) {
      // Recursive search
      const subPattern = join(baseDir, entry.name, "**/*.md");
      const subFiles = await findMarkdownFiles(subPattern);
      files.push(...subFiles);
    }
  }

  return files;
}

function extractFrontmatter(content: string): Record<string, unknown> | null {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    try {
      return parseYaml(yamlMatch[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const jsonMatch = content.match(/^(\{[\s\S]*?\})\n/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

async function processFiles(args: CLIArgs): Promise<void> {
  const { schemaPath, outputPath, inputPattern, verbose } = args;

  // Load schema
  if (verbose) console.log(`Loading schema from: ${schemaPath}`);
  const schema = await loadJsonFile(schemaPath) as Record<string, unknown>;

  // Load template using SchemaPropertyAccessor to eliminate hardcoding
  let templateContent: string;
  const configResult = SchemaExtensionConfig.createDefault();
  if (!configResult.ok) {
    console.error("Configuration error:", configResult.error.message);
    Deno.exit(1);
  }

  const accessor = new SchemaPropertyAccessor(configResult.data);
  const templatePath = accessor.getTemplate(schema);
  if (templatePath) {
    // Template path is relative to schema file
    const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));
    const fullTemplatePath = join(schemaDir, templatePath);
    if (verbose) console.log(`Loading template from: ${fullTemplatePath}`);
    templateContent = await Deno.readTextFile(fullTemplatePath);
  } else {
    // Default empty template
    templateContent = "{}";
  }

  // Find markdown files
  if (verbose) console.log(`Scanning for files matching: ${inputPattern}`);
  const files = await findMarkdownFiles(inputPattern);
  if (verbose) console.log(`Found ${files.length} files`);

  // Extract frontmatter from each file
  const documents: Record<string, unknown>[] = [];
  for (const file of files) {
    if (verbose) console.log(`Processing: ${file}`);
    const content = await Deno.readTextFile(file);
    const frontmatter = extractFrontmatter(content);
    if (frontmatter) {
      documents.push(frontmatter);
    }
  }

  // Process with template engine
  const engine = new TemplateEngine();
  const output = engine.process({
    schemaData: schema,
    documentData: documents,
    templateContent,
  });

  // Write output
  if (verbose) console.log(`Writing output to: ${outputPath}`);
  await Deno.writeTextFile(outputPath, output);

  if (verbose) console.log("✅ Processing complete");
}

// Main entry point
if (import.meta.main) {
  const args = parseArgs(Deno.args);
  if (!args) {
    Deno.exit(1);
  }

  try {
    await processFiles(args);
  } catch (error) {
    console.error("Error:", error);
    Deno.exit(1);
  }
}
