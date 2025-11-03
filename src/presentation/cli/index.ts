import { ProcessingError } from "../../domain/shared/types/errors.ts";
import {
  PipelineConfig,
  PipelineOrchestrator,
} from "../../application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../infrastructure/adapters/deno-file-system-adapter.ts";
import { DIRECTIVE_NAMES } from "../../domain/schema/constants/directive-names.ts";
import denoConfig from "../../../deno.json" with { type: "json" };
import { dirname, isAbsolute, join } from "@std/path";
import { resolveInputToFiles } from "../../infrastructure/utils/input-resolver.ts";

export interface CLIResponse {
  ok: boolean;
  data?: unknown;
  error?: ProcessingError;
}

/**
 * Command-line interface for the frontmatter-to-schema tool.
 * Provides a simple interface to process markdown files with schemas and templates.
 */
export class CLI {
  private constructor(private readonly orchestrator: PipelineOrchestrator) {}

  static create(): { ok: boolean; data?: CLI; error?: ProcessingError } {
    const fileSystem = DenoFileSystemAdapter.create();
    const orchestratorResult = PipelineOrchestrator.create(fileSystem);
    if (orchestratorResult.isError()) {
      return {
        ok: false,
        error: new ProcessingError(
          `Failed to initialize pipeline: ${orchestratorResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: orchestratorResult.unwrapError() },
        ),
      };
    }

    return { ok: true, data: new CLI(orchestratorResult.unwrap()) };
  }

  async run(args: string[]): Promise<CLIResponse> {
    try {
      if (args.length === 0) {
        return this.showHelp();
      }

      const command = args[0];

      // Check for explicit commands first
      switch (command) {
        case "process":
          return await this.processCommand(args.slice(1));
        case "help":
        case "--help":
        case "-h":
          return this.showHelp();
        case "version":
        case "--version":
        case "-v":
          return this.showVersion();
      }

      // Check for direct invocation pattern (schema as first argument)
      // If first arg looks like a file path (ends with .json or .yaml),
      // assume direct invocation pattern
      if (this.looksLikeFilePath(command)) {
        return await this.processDirectInvocation(args);
      }

      // If we get here, it's an unknown command
      return {
        ok: false,
        error: new ProcessingError(
          `Unknown command: ${command}`,
          "UNKNOWN_COMMAND",
          { command, availableCommands: ["process", "help", "version"] },
        ),
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return {
        ok: false,
        error: new ProcessingError(
          `CLI execution failed: ${errorMessage}`,
          "CLI_ERROR",
          { args, error },
        ),
      };
    }
  }

  private looksLikeFilePath(arg: string): boolean {
    return arg.endsWith(".json") || arg.endsWith(".yaml") ||
      arg.endsWith(".yml");
  }

  private async processDirectInvocation(args: string[]): Promise<CLIResponse> {
    // Direct invocation expects: <schema> <output> <input...> [--verbose] [--translate=<lang>]
    // This order allows shell glob expansion to work correctly
    if (args.length < 3) {
      return {
        ok: false,
        error: new ProcessingError(
          "Insufficient arguments. Usage: <schema> <output> <input...> [--verbose] [--translate=<lang>]",
          "INVALID_ARGUMENTS",
          { args },
        ),
      };
    }

    // Parse arguments from end to beginning to handle glob expansion
    let endIndex = args.length;
    let hasVerbose = false;
    let translateLang: string | null = null;

    // Parse options from the end
    while (endIndex > 2) {
      const arg = args[endIndex - 1];

      if (arg === "--verbose") {
        hasVerbose = true;
        endIndex -= 1;
      } else if (arg.startsWith("--translate=")) {
        const value = arg.split("=")[1];
        if (!value || value.trim().length === 0) {
          return {
            ok: false,
            error: new ProcessingError(
              "--translate requires a language code (e.g., --translate=en)",
              "INVALID_ARGUMENTS",
              { args },
            ),
          };
        }
        translateLang = value;
        endIndex -= 1;
      } else {
        // Not an option, stop parsing
        break;
      }
    }

    const options = hasVerbose ? ["--verbose"] : [];

    const schemaPath = args[0];
    const outputPath = args[1];
    const inputPaths = args.slice(2, endIndex);

    // Try to extract template from schema's x-template directive
    const templatePath = await this.extractTemplateFromSchema(schemaPath);
    if (!templatePath) {
      return {
        ok: false,
        error: new ProcessingError(
          "Schema does not contain x-template directive. Use 'process' command to specify template explicitly.",
          "MISSING_TEMPLATE",
          { schemaPath },
        ),
      };
    }

    // Determine output format from output file extension or options
    let outputFormat: "json" | "yaml" | "xml" | "markdown" = "json";
    if (outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")) {
      outputFormat = "yaml";
    } else if (outputPath.endsWith(".xml")) {
      outputFormat = "xml";
    } else if (outputPath.endsWith(".md") || outputPath.endsWith(".markdown")) {
      outputFormat = "markdown";
    }

    // Resolve all input paths to actual markdown files
    // This handles glob patterns, directories (recursive), and individual files
    const resolvedFiles = await resolveInputToFiles(inputPaths);

    if (resolvedFiles.length === 0) {
      return {
        ok: false,
        error: new ProcessingError(
          "No markdown files found matching the input patterns",
          "NO_FILES_FOUND",
          { inputPaths },
        ),
      };
    }

    // Set VERBOSE environment variable if --verbose flag is present
    if (hasVerbose && typeof Deno !== "undefined") {
      Deno.env.set("VERBOSE", "1");
    }

    const config: PipelineConfig = {
      schemaPath,
      templatePath,
      inputPath: resolvedFiles,
      outputPath,
      outputFormat,
    };

    const result = await this.orchestrator.execute(config);

    // Clear VERBOSE environment variable after execution
    if (hasVerbose && typeof Deno !== "undefined") {
      Deno.env.delete("VERBOSE");
    }

    if (result.isError()) {
      return {
        ok: false,
        error: result.unwrapError(),
      };
    }

    const pipelineResult = result.unwrap();

    // Only log if --verbose flag is present
    if (options.includes("--verbose")) {
      console.log(
        `✅ Processed ${pipelineResult.processedDocuments} documents`,
      );
      console.log(`📄 Output written to: ${pipelineResult.outputPath}`);
      console.log(
        `⏱️  Execution time: ${pipelineResult.executionTime.toFixed(2)}ms`,
      );
    }

    // Translate output file if --translate option is specified
    if (translateLang) {
      const translateResult = await this.translateOutputFile(
        pipelineResult.outputPath,
        translateLang,
        hasVerbose,
      );
      if (!translateResult.ok) {
        return translateResult;
      }
    }

    return {
      ok: true,
      data: pipelineResult,
    };
  }

  private async extractTemplateFromSchema(
    schemaPath: string,
  ): Promise<string | null> {
    try {
      const schemaContent = await Deno.readTextFile(schemaPath);
      const schema = JSON.parse(schemaContent);

      if (schema[DIRECTIVE_NAMES.TEMPLATE]) {
        // If x-template is a relative path, resolve it relative to the schema directory
        const templatePath = schema[DIRECTIVE_NAMES.TEMPLATE];
        if (!isAbsolute(templatePath)) {
          // Relative path - resolve relative to schema directory using cross-platform path utilities
          const schemaDir = dirname(schemaPath);
          return join(schemaDir, templatePath);
        }
        return templatePath;
      }

      return null;
    } catch (_error) {
      // If we can't read or parse the schema, return null
      return null;
    }
  }

  private async processCommand(args: string[]): Promise<CLIResponse> {
    const parseResult = this.parseProcessArgs(args);
    if (!parseResult.ok) {
      return parseResult;
    }

    const { pipelineConfig: initialConfig, translateLang, verbose } =
      parseResult
        .data as {
          pipelineConfig: PipelineConfig;
          translateLang: string | null;
          verbose: boolean;
        };
    let pipelineConfig = initialConfig;

    // Resolve input path to actual files if it's a single string
    // This handles directories and glob patterns
    if (typeof pipelineConfig.inputPath === "string") {
      const resolvedFiles = await resolveInputToFiles([
        pipelineConfig.inputPath,
      ]);

      if (resolvedFiles.length === 0) {
        return {
          ok: false,
          error: new ProcessingError(
            "No markdown files found matching the input pattern",
            "NO_FILES_FOUND",
            { inputPath: pipelineConfig.inputPath },
          ),
        };
      }

      pipelineConfig = {
        ...pipelineConfig,
        inputPath: resolvedFiles,
      };
    }

    const result = await this.orchestrator.execute(pipelineConfig);

    if (result.isError()) {
      return {
        ok: false,
        error: result.unwrapError(),
      };
    }

    const pipelineResult = result.unwrap();
    console.log(`✅ Processed ${pipelineResult.processedDocuments} documents`);
    console.log(`📄 Output written to: ${pipelineResult.outputPath}`);
    console.log(
      `⏱️  Execution time: ${pipelineResult.executionTime.toFixed(2)}ms`,
    );

    // Translate output file if --translate option is specified
    if (translateLang) {
      const translateResult = await this.translateOutputFile(
        pipelineResult.outputPath,
        translateLang,
        verbose,
      );
      if (!translateResult.ok) {
        return translateResult;
      }
    }

    return {
      ok: true,
      data: pipelineResult,
    };
  }

  private parseProcessArgs(args: string[]): CLIResponse {
    if (args.length < 4) {
      return {
        ok: false,
        error: new ProcessingError(
          "Insufficient arguments. Usage: process <schema> <template> <input> <output> [format] [--verbose] [--translate=<lang>]",
          "INVALID_ARGUMENTS",
          { args },
        ),
      };
    }

    // Parse positional arguments
    const [schemaPath, templatePath, inputPath, outputPath] = args;

    // Parse remaining arguments for format and options
    let outputFormat: "json" | "yaml" | "xml" | "markdown" = "json";
    let translateLang: string | null = null;
    let verbose = false;

    // Start from index 4 (after required positional args)
    for (let i = 4; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--verbose") {
        verbose = true;
      } else if (arg.startsWith("--translate=")) {
        const value = arg.split("=")[1];
        if (!value || value.trim().length === 0) {
          return {
            ok: false,
            error: new ProcessingError(
              "--translate requires a language code (e.g., --translate=en)",
              "INVALID_ARGUMENTS",
              { args },
            ),
          };
        }
        translateLang = value;
      } else if (!arg.startsWith("--") && i === 4) {
        // Fifth argument is format if it's not an option
        outputFormat = arg as "json" | "yaml" | "xml" | "markdown";
      }
    }

    const config: PipelineConfig = {
      schemaPath,
      templatePath,
      inputPath,
      outputPath,
      outputFormat,
    };

    return {
      ok: true,
      data: { pipelineConfig: config, translateLang, verbose },
    };
  }

  private showHelp(): CLIResponse {
    const helpText = `
Frontmatter to Schema Processor

USAGE:
    frontmatter-to-schema <COMMAND> [OPTIONS]
    frontmatter-to-schema <schema> <input> <output> [OPTIONS]

COMMANDS:
    process <schema> <template> <input> <output> [format] [OPTIONS]
        Process markdown files with explicit schema and template

        Arguments:
            schema      Path to JSON schema file
            template    Path to template file (JSON or YAML)
            input       Path to markdown file or directory
            output      Path for output file
            format      Output format: json or yaml (default: json)

        Options:
            --verbose            Show processing details
            --translate=<lang>   Translate output to specified language (requires Claude Code)

    help, --help, -h
        Show this help message

    version, --version, -v
        Show version information

DIRECT INVOCATION:
    When schema contains x-template directive:
        <schema> <output> <input...> [OPTIONS]

        Arguments:
            schema      Path to JSON schema with x-template
            output      Path for output file
            input...    Path(s) to markdown file(s) or directory or glob pattern

        Options:
            --verbose            Show processing details
            --translate=<lang>   Translate output to specified language (requires Claude Code)
                                Supported languages: en, ja, zh, ko, es, fr, de

        Note: Input is specified AFTER output to allow shell glob expansion.
              The shell will expand patterns like *.md before passing to CLI.

TRANSLATION:
    The --translate option uses Claude Code's 'claude -p' command to translate
    the output file after processing. This is useful for converting Japanese
    frontmatter to English for better searchability and universality.

    Requirements:
        - Claude Code must be installed and available in PATH
        - Translation happens after processing completes
        - The output file is updated in-place with translated content

EXAMPLES:
    # Process with explicit template
    frontmatter-to-schema process schema.json template.json article.md output.json

    # Direct invocation (schema has x-template) - single file
    frontmatter-to-schema schema.json output.json article.md --verbose

    # Direct invocation with translation to English
    frontmatter-to-schema schema.json output.json article.md --verbose --translate=en

    # Direct invocation with glob pattern (shell expands *.md)
    frontmatter-to-schema schema.json output.json *.md --verbose

    # Direct invocation with directory and translation
    frontmatter-to-schema schema.json output.json ./docs/ --translate=en

    # Process directory with YAML output and translation
    frontmatter-to-schema process schema.json template.json ./docs/ output.yaml yaml --translate=en

    # Show help
    frontmatter-to-schema help
`;

    console.log(helpText);
    return { ok: true, data: helpText };
  }

  private showVersion(): CLIResponse {
    const version = denoConfig.version;
    const versionInfo = `frontmatter-to-schema ${version}`;

    console.log(versionInfo);
    return { ok: true, data: version };
  }

  /**
   * Translates the output file using claude -p command.
   * This requires Claude Code to be available in the environment.
   *
   * @param outputPath - Path to the output file to translate
   * @param targetLang - Target language code (e.g., "en")
   * @param verbose - Whether to show verbose output
   */
  private async translateOutputFile(
    outputPath: string,
    targetLang: string,
    verbose: boolean,
  ): Promise<CLIResponse> {
    try {
      if (verbose) {
        console.log(`🌐 Translating output to ${targetLang}...`);
      }

      // Convert to absolute path for Claude Code
      const absolutePath = isAbsolute(outputPath)
        ? outputPath
        : join(Deno.cwd(), outputPath);

      // Prepare translation prompt - simple and direct like the successful example
      const translationPrompt = this.getTranslationPrompt(
        targetLang,
        absolutePath,
      );

      // Execute claude command with model, permission mode, and prompt
      // Using haiku model for faster translation and bypass permissions for direct file access
      const command = new Deno.Command("claude", {
        args: [
          "--model",
          "haiku",
          "--permission-mode",
          "bypassPermissions",
          "-p",
          translationPrompt,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const process = await command.output();

      if (!process.success) {
        const errorOutput = new TextDecoder().decode(process.stderr);
        return {
          ok: false,
          error: new ProcessingError(
            `Translation failed: ${errorOutput}`,
            "TRANSLATION_ERROR",
            { outputPath, targetLang },
          ),
        };
      }

      if (verbose) {
        console.log(`✅ Translation completed: ${outputPath}`);
      }

      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return {
        ok: false,
        error: new ProcessingError(
          `Translation failed: ${errorMessage}`,
          "TRANSLATION_ERROR",
          { outputPath, targetLang, error },
        ),
      };
    }
  }

  /**
   * Generates the translation prompt for the given target language.
   * Uses a simple, direct prompt style similar to the successful example.
   * @param targetLang - Target language code (e.g., "en")
   * @param filePath - Absolute path to the file to translate
   */
  private getTranslationPrompt(targetLang: string, filePath: string): string {
    const langNames: Record<string, string> = {
      "en": "English",
      "ja": "Japanese",
      "zh": "Chinese",
      "ko": "Korean",
      "es": "Spanish",
      "fr": "French",
      "de": "German",
    };

    const targetLangName = langNames[targetLang] || targetLang;

    // Simple, direct prompt that preserves structure exactly
    // Similar to successful example: "translate to English and overwrite it: file.json"
    return `Translate to ${targetLangName} and overwrite it: ${filePath}

CRITICAL RULES:
1. Keep the EXACT same structure - do not add, remove, or reorganize any elements
2. Keep ALL keys, field names, and property names unchanged
3. Only translate the VALUES of text fields (descriptions, titles, instructions)
4. Preserve all formatting, indentation, and special characters exactly
5. Do not modify any technical identifiers, URLs, file paths, or code snippets
6. Output must be valid, parseable ${
      filePath.endsWith(".json") ? "JSON" : "YAML"
    }

Translate ONLY the human-readable text values to ${targetLangName} while preserving everything else exactly as-is.`;
  }
}
