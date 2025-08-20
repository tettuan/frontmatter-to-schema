#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * CLI Entry Point for frontmatter-to-schema
 *
 * Usage:
 * frontmatter-to-schema <markdownfile_root_dir> --schema=<schema_json_file> --template=<template_file> [--destination=<saving_to_this_dir>]
 *
 * Options:
 * - markdownfile_root_dir: Path to markdown files directory
 * - --schema: Path to schema file (JSON or YAML)
 * - --template: Path to template file (any format)
 * - --destination: Output directory (optional, defaults to markdownfile_root_dir)
 */

import { parseArgs } from "jsr:@std/cli@1.0.9/parse-args";
import { join } from "jsr:@std/path@1.1.2";
import { ProcessDocumentsUseCase } from "./src/application/use-cases/process-documents.ts";
import { DenoDocumentRepository } from "./src/infrastructure/adapters/deno-document-repository.ts";
import { ClaudeSchemaAnalyzer } from "./src/infrastructure/adapters/claude-schema-analyzer.ts";
import { SimpleTemplateMapper } from "./src/infrastructure/adapters/simple-template-mapper.ts";
import { FrontMatterExtractorImpl } from "./src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { ResultAggregatorImpl } from "./src/infrastructure/adapters/result-aggregator-impl.ts";
import {
  ConfigurationLoader,
  TemplateLoader,
} from "./src/infrastructure/adapters/configuration-loader.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
} from "./src/domain/models/value-objects.ts";

function printUsage() {
  console.log(`
frontmatter-to-schema - Extract and transform markdown frontmatter using AI

Usage:
  frontmatter-to-schema <markdownfile_root_dir> --schema=<schema_file> --template=<template_file> [--destination=<output_dir>]

Arguments:
  markdownfile_root_dir    Path to markdown files directory or pattern

Options:
  --schema=<file>         Path to schema file (JSON or YAML)
  --template=<file>       Path to template file (any format)
  --destination=<dir>     Output directory (optional, defaults to markdown directory)
  --help                  Show this help message

Examples:
  frontmatter-to-schema ./docs --schema=schema.json --template=template.md
  frontmatter-to-schema ./prompts/* --schema=config/schema.yml --template=config/template.txt --destination=./output
`);
}

async function loadPromptTemplates(): Promise<
  { extraction: string; mapping: string }
> {
  try {
    const extraction = await Deno.readTextFile(
      "src/infrastructure/prompts/extract-information.md",
    );
    const mapping = await Deno.readTextFile(
      "src/infrastructure/prompts/map-to-template.md",
    );
    return { extraction, mapping };
  } catch {
    return {
      extraction:
        `Extract information from the following frontmatter according to the schema.
FrontMatter: {{FRONTMATTER}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the extracted data.`,
      mapping: `Map the extracted data to the template structure.
Data: {{EXTRACTED_DATA}}
Schema: {{SCHEMA}}
Return ONLY a JSON object with the mapped data.`,
    };
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["schema", "template", "destination"],
    boolean: ["help"],
    stopEarly: true,
  });

  if (args.help || args._.length === 0) {
    printUsage();
    Deno.exit(args.help ? 0 : 1);
  }

  const markdownDir = args._[0] as string;
  const schemaPath = args.schema;
  const templatePath = args.template;
  const destinationDir = args.destination || markdownDir;

  if (!schemaPath || !templatePath) {
    console.error("Error: --schema and --template options are required");
    printUsage();
    Deno.exit(1);
  }

  try {
    console.log("🚀 Starting frontmatter-to-schema CLI...");
    console.log(`📁 Markdown directory: ${markdownDir}`);
    console.log(`📋 Schema: ${schemaPath}`);
    console.log(`📝 Template: ${templatePath}`);
    console.log(`💾 Destination: ${destinationDir}`);

    // Create value objects
    const documentsPathResult = DocumentPath.create(markdownDir);
    const schemaPathResult = ConfigPath.create(schemaPath);
    const templatePathResult = ConfigPath.create(templatePath);
    const outputPathResult = OutputPath.create(
      join(destinationDir, "output.json"),
    );

    if (
      !documentsPathResult.ok || !schemaPathResult.ok ||
      !templatePathResult.ok || !outputPathResult.ok
    ) {
      console.error("Error: Invalid paths provided");
      if (!documentsPathResult.ok) {
        console.error(`  Documents: ${documentsPathResult.error.message}`);
      }
      if (!schemaPathResult.ok) {
        console.error(`  Schema: ${schemaPathResult.error.message}`);
      }
      if (!templatePathResult.ok) {
        console.error(`  Template: ${templatePathResult.error.message}`);
      }
      if (!outputPathResult.ok) {
        console.error(`  Output: ${outputPathResult.error.message}`);
      }
      Deno.exit(1);
    }

    // Initialize services
    const configLoader = new ConfigurationLoader();
    const templateLoader = new TemplateLoader();
    const documentRepo = new DenoDocumentRepository();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    const templateMapper = new SimpleTemplateMapper();
    const resultAggregator = new ResultAggregatorImpl("json");

    // Load prompts and create analyzer
    const prompts = await loadPromptTemplates();
    const schemaAnalyzer = new ClaudeSchemaAnalyzer(
      { aiProvider: "claude", aiConfig: {} },
      prompts.extraction,
      prompts.mapping,
    );

    // Create use case
    const processDocumentsUseCase = new ProcessDocumentsUseCase(
      documentRepo,
      configLoader,
      templateLoader,
      configLoader,
      frontMatterExtractor,
      schemaAnalyzer,
      templateMapper,
      resultAggregator,
    );

    // Execute processing
    const processingConfig = {
      documentsPath: documentsPathResult.data,
      schemaPath: schemaPathResult.data,
      templatePath: templatePathResult.data,
      outputPath: outputPathResult.data,
      options: {
        parallel: true,
        continueOnError: false,
      },
    };

    const result = await processDocumentsUseCase.execute({
      config: processingConfig,
    });

    if (result.ok) {
      console.log("\n✅ Processing completed successfully!");
      console.log(`📊 Processed: ${result.data.processedCount} documents`);
      console.log(`❌ Failed: ${result.data.failedCount} documents`);
      console.log(`💾 Output saved to: ${result.data.outputPath}`);
    } else {
      console.error("\n❌ Processing failed:", result.error.message);
      Deno.exit(1);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
