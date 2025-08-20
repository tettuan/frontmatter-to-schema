#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

// Main composition root - wires up all dependencies

import { parseArgs } from "jsr:@std/cli@1.0.9/parse-args";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
} from "./domain/models/value-objects.ts";
import type {
  AnalysisConfiguration,
  ProcessingConfiguration,
} from "./domain/services/interfaces.ts";
import { ProcessDocumentsUseCase } from "./application/use-cases/process-documents.ts";
import { DenoDocumentRepository } from "./infrastructure/adapters/deno-document-repository.ts";
import { ClaudeSchemaAnalyzer } from "./infrastructure/adapters/claude-schema-analyzer.ts";
import { SimpleTemplateMapper } from "./infrastructure/adapters/simple-template-mapper.ts";
import { FrontMatterExtractorImpl } from "./infrastructure/adapters/frontmatter-extractor-impl.ts";
import { ResultAggregatorImpl } from "./infrastructure/adapters/result-aggregator-impl.ts";
import {
  ConfigurationLoader,
  TemplateLoader,
} from "./infrastructure/adapters/configuration-loader.ts";

// Legacy imports for BuildRegistryUseCase
import { FileReader } from "./infrastructure/filesystem/FileReader.ts";
import { FileWriter } from "./infrastructure/filesystem/FileWriter.ts";
import { FrontMatterExtractor } from "./domain/frontmatter/Extractor.ts";
import { ClaudeAnalyzer } from "./domain/analysis/Analyzer.ts";
import { BuildRegistryUseCase } from "./application/usecases/BuildRegistryUseCase.ts";

// Load prompt templates
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
    // Fallback to embedded prompts
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

// Legacy function for BuildRegistryUseCase
async function runBuildRegistry() {
  const PROMPTS_PATH = ".agent/climpt/prompts";
  const OUTPUT_PATH = ".agent/climpt/registry.json";
  const EXTRACT_PROMPT_PATH = "./src/prompts/extract-information.md";
  const MAPPING_PROMPT_PATH = "./src/prompts/map-to-template.md";

  try {
    const fileReader = new FileReader();
    const fileWriter = new FileWriter();
    const extractor = new FrontMatterExtractor();

    const extractPrompt = await Deno.readTextFile(EXTRACT_PROMPT_PATH);
    const mappingPrompt = await Deno.readTextFile(MAPPING_PROMPT_PATH);
    const analyzer = new ClaudeAnalyzer(extractPrompt, mappingPrompt);

    const useCase = new BuildRegistryUseCase(
      fileReader,
      fileWriter,
      extractor,
      analyzer,
    );

    const registry = await useCase.execute(PROMPTS_PATH, OUTPUT_PATH);

    console.log("\n✅ Registry build completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Total commands: ${registry.tools.commands.length}`);
    console.log(
      `   - Available configs: ${registry.tools.availableConfigs.length}`,
    );
    console.log(`   - Output: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("❌ Failed to build registry:", error);
    Deno.exit(1);
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["config", "documents", "schema", "template", "output", "format"],
    boolean: ["help", "parallel", "continue-on-error", "build-registry"],
    default: {
      config: "config.json",
      format: "json",
      parallel: true,
      "continue-on-error": false,
      "build-registry": false,
    },
  });

  if (args.help) {
    console.log(`
Frontmatter to Schema - Extract and transform markdown frontmatter using AI

Usage:
  deno run --allow-all src/main.ts [options]

Options:
  --config <path>         Configuration file path (default: config.json)
  --documents <path>      Documents directory path
  --schema <path>         Schema file path
  --template <path>       Template file path
  --output <path>         Output file path
  --format <json|yaml>    Output format (default: json)
  --parallel              Process documents in parallel (default: true)
  --continue-on-error     Continue processing on errors (default: false)
  --build-registry        Run legacy BuildRegistryUseCase
  --help                  Show this help message

Examples:
  # Use configuration file
  deno run --allow-all src/main.ts --config examples/climpt-registry/config.json

  # Specify paths directly
  deno run --allow-all src/main.ts \\
    --documents .agent/climpt/prompts \\
    --schema examples/climpt-registry/schema.json \\
    --template examples/climpt-registry/template.json \\
    --output .agent/climpt/registry.json
    
  # Run legacy build registry
  deno run --allow-all src/main.ts --build-registry
`);
    Deno.exit(0);
  }

  // Check if legacy build-registry mode is requested
  if (args["build-registry"]) {
    await runBuildRegistry();
    return;
  }

  try {
    // Initialize repositories and adapters
    const configLoader = new ConfigurationLoader();
    const templateLoader = new TemplateLoader();
    const documentRepo = new DenoDocumentRepository();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    const templateMapper = new SimpleTemplateMapper();
    const resultAggregator = new ResultAggregatorImpl(
      args.format as "json" | "yaml",
    );

    // Load configuration
    let processingConfig: ProcessingConfiguration;
    let analysisConfig: AnalysisConfiguration;

    if (args.config && !args.documents) {
      // Load from config file
      const configPathResult = ConfigPath.create(args.config);
      if (!configPathResult.ok) {
        console.error("Error:", configPathResult.error.message);
        Deno.exit(1);
      }

      const configResult = await configLoader.loadProcessingConfig(
        configPathResult.data,
      );
      if (!configResult.ok) {
        console.error("Error loading config:", configResult.error.message);
        Deno.exit(1);
      }
      processingConfig = configResult.data;

      // Try to load analysis config
      const analysisResult = await configLoader.loadAnalysisConfig(
        configPathResult.data,
      );
      if (analysisResult.ok) {
        analysisConfig = analysisResult.data;
      } else {
        // Use defaults
        analysisConfig = {
          aiProvider: "claude",
          aiConfig: {},
        };
      }
    } else {
      // Build config from command line args
      const documentsPathResult = DocumentPath.create(args.documents || ".");
      const schemaPathResult = ConfigPath.create(args.schema || "schema.json");
      const templatePathResult = ConfigPath.create(
        args.template || "template.json",
      );
      const outputPathResult = OutputPath.create(args.output || "output.json");

      if (
        !documentsPathResult.ok || !schemaPathResult.ok ||
        !templatePathResult.ok || !outputPathResult.ok
      ) {
        console.error("Error: Invalid path arguments");
        Deno.exit(1);
      }

      processingConfig = {
        documentsPath: documentsPathResult.data,
        schemaPath: schemaPathResult.data,
        templatePath: templatePathResult.data,
        outputPath: outputPathResult.data,
        options: {
          parallel: args.parallel,
          continueOnError: args["continue-on-error"],
        },
      };

      analysisConfig = {
        aiProvider: "claude",
        aiConfig: {},
      };
    }

    // Load prompt templates
    const prompts = await loadPromptTemplates();

    // Initialize schema analyzer
    const schemaAnalyzer = new ClaudeSchemaAnalyzer(
      analysisConfig,
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
    console.log("🚀 Starting document processing...");
    console.log(`📁 Documents: ${processingConfig.documentsPath.getValue()}`);
    console.log(`📋 Schema: ${processingConfig.schemaPath.getValue()}`);
    console.log(`📝 Template: ${processingConfig.templatePath.getValue()}`);
    console.log(`💾 Output: ${processingConfig.outputPath.getValue()}`);
    console.log(`⚙️  Options:`, processingConfig.options);

    const result = await processDocumentsUseCase.execute({
      config: processingConfig,
    });

    if (result.ok) {
      console.log("\n✅ Processing completed successfully!");
      console.log(`📊 Processed: ${result.data.processedCount} documents`);
      console.log(`❌ Failed: ${result.data.failedCount} documents`);
      console.log(`💾 Output saved to: ${result.data.outputPath}`);

      if (result.data.errors.length > 0) {
        console.log("\n⚠️  Errors encountered:");
        for (const error of result.data.errors) {
          console.log(`  - ${error.document}: ${error.error}`);
        }
      }
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
