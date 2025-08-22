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
import { MockSchemaAnalyzer } from "./src/infrastructure/adapters/mock-schema-analyzer.ts";
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
  // Pre-process args to handle --key=value format
  const processedArgs = Deno.args.map((arg) => {
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      return [key, value];
    }
    return arg;
  }).flat();

  // Debug logging if needed
  const debugMode = Deno.env.get("FRONTMATTER_TO_SCHEMA_DEBUG") === "true" ||
    Deno.env.get("FRONTMATTER_DEBUG") === "true"; // backward compatibility
  if (debugMode) {
    console.log("Raw args:", Deno.args);
    console.log("Processed args:", processedArgs);
  }

  const args = parseArgs(processedArgs, {
    string: ["schema", "template", "destination"],
    boolean: ["help"],
    stopEarly: false,
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

    // Validate required files exist before processing
    console.log("🔍 Validating files...");

    try {
      await Deno.stat(schemaPath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`❌ Schema file not found: ${schemaPath}`);
        console.error(
          "Please ensure the schema file exists and the path is correct.",
        );
        Deno.exit(1);
      }
      throw error;
    }

    try {
      await Deno.stat(templatePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`❌ Template file not found: ${templatePath}`);
        console.error(
          "Please ensure the template file exists and the path is correct.",
        );
        Deno.exit(1);
      }
      throw error;
    }

    try {
      await Deno.stat(markdownDir);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`❌ Markdown directory not found: ${markdownDir}`);
        console.error(
          "Please ensure the directory exists and the path is correct.",
        );
        Deno.exit(1);
      }
      throw error;
    }

    console.log("✅ All required files validated successfully");

    // Create value objects
    // DocumentPath expects markdown files, but CLI accepts directories
    // So we need to handle this differently
    const documentsPathResult = DocumentPath.create(
      markdownDir.endsWith(".md") || markdownDir.endsWith(".markdown")
        ? markdownDir
        : `${markdownDir}/*.md`,
    );
    const schemaPathResult = ConfigPath.create(schemaPath);
    const templatePathResult = ConfigPath.create(templatePath);

    // Determine output filename based on template extension
    const templateExt =
      templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")
        ? "yaml"
        : "json";
    const outputFileName = `registry.${templateExt}`;
    const outputPathResult = OutputPath.create(
      join(destinationDir, outputFileName),
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
    const useMock =
      Deno.env.get("FRONTMATTER_TO_SCHEMA_TEST_MODE") === "true" ||
      Deno.env.get("FRONTMATTER_TEST_MODE") === "true"; // backward compatibility
    const schemaAnalyzer = useMock
      ? new MockSchemaAnalyzer(
        { aiProvider: "mock", aiConfig: {} },
        prompts.extraction,
        prompts.mapping,
      )
      : new ClaudeSchemaAnalyzer(
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

      // Show more details for ConfigurationInvalid errors
      if (
        result.error.kind === "ConfigurationInvalid" && "errors" in result.error
      ) {
        console.error("\nConfiguration errors:");
        for (const err of result.error.errors) {
          if ("path" in err && "reason" in err) {
            console.error(`  - ${err.path}: ${err.reason}`);
          } else {
            console.error(`  - ${JSON.stringify(err)}`);
          }
        }
      }

      // Show debug info if debug mode is enabled
      if (debugMode) {
        console.error("\nDebug info:");
        console.error(JSON.stringify(result.error, null, 2));
      }

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
