/**
 * CLI Arguments Parser
 *
 * Parses and validates command-line arguments for the frontmatter-to-schema tool.
 * Implements the specification from schema_process_architecture.ja.md.
 */

import type { Result } from "../domain/core/result.ts";
import {
  CLI_OPTIONS,
  getOptionProperty,
  isCLIOption,
} from "./cli-constants.ts";
import {
  FILE_PATTERNS,
  isMarkdownFile,
  SCHEMA_EXTENSIONS,
} from "../domain/core/file-extensions.constants.ts";

/**
 * Named constants to avoid magic numbers (Totality principle)
 */
const PATH_SEPARATOR_NOT_FOUND = -1;
const CURRENT_DIRECTORY = ".";
const PATH_SEPARATOR = "/";

/**
 * CLI argument values after parsing
 */
export interface CLIArguments {
  schemaPath: SchemaPath;
  outputPath: OutputPath;
  inputPattern: InputPattern;
  options: CLIOptions;
}

/**
 * CLI options
 */
export interface CLIOptions {
  verbose: boolean;
  help: boolean;
  version: boolean;
  quiet: boolean;
  dryRun: boolean;
  parallel: boolean;
  maxWorkers?: number;
}

/**
 * Schema file path value object
 */
export class SchemaPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<SchemaPath, { kind: string; message: string }> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyPath",
          message: "Schema path cannot be empty",
        },
      };
    }

    if (!path.endsWith(SCHEMA_EXTENSIONS.JSON)) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          message:
            `Schema file must be ${SCHEMA_EXTENSIONS.JSON}, got: ${path}`,
        },
      };
    }

    const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
    return { ok: true, data: new SchemaPath(normalized) };
  }

  toString(): string {
    return this.value;
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf(PATH_SEPARATOR);
    return lastSlash === PATH_SEPARATOR_NOT_FOUND
      ? CURRENT_DIRECTORY
      : this.value.substring(0, lastSlash);
  }

  getFileName(): string {
    const lastSlash = this.value.lastIndexOf(PATH_SEPARATOR);
    return lastSlash === PATH_SEPARATOR_NOT_FOUND
      ? this.value
      : this.value.substring(lastSlash + 1);
  }
}

/**
 * Output file path value object
 */
export class OutputPath {
  private constructor(
    private readonly value: string,
    private readonly format: OutputFormat,
  ) {}

  static create(
    path: string,
  ): Result<OutputPath, { kind: string; message: string }> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyPath",
          message: "Output path cannot be empty",
        },
      };
    }

    const ext = path.split(".").pop()?.toLowerCase();
    const validExtensions = ["json", "yml", "yaml", "toml"];

    if (!ext || !validExtensions.includes(ext)) {
      return {
        ok: false,
        error: {
          kind: "UnsupportedFormat",
          message: `Output format must be one of: ${
            validExtensions.join(", ")
          }`,
        },
      };
    }

    // Smart Constructor pattern: explicit validation without type assertions
    const normalizedExt = ext === "yml" ? "yaml" : ext;

    // Exhaustive validation using switch statement for type safety
    let format: OutputFormat;
    switch (normalizedExt) {
      case "json":
        format = "json";
        break;
      case "yaml":
        format = "yaml";
        break;
      case "toml":
        format = "toml";
        break;
      default:
        return {
          ok: false,
          error: {
            kind: "UnsupportedFormat",
            message:
              `Invalid output format "${normalizedExt}". Supported formats: json, yaml, toml`,
          },
        };
    }

    return { ok: true, data: new OutputPath(path, format) };
  }

  toString(): string {
    return this.value;
  }

  getFormat(): OutputFormat {
    return this.format;
  }
}

/**
 * Input file pattern value object
 */
export class InputPattern {
  private constructor(
    private readonly value: string,
    private readonly isMultipleFiles: boolean = false,
  ) {}

  static create(
    pattern: string,
  ): Result<InputPattern, { kind: string; message: string }> {
    if (!pattern || pattern.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyPattern",
          message: "Input pattern cannot be empty",
        },
      };
    }

    return { ok: true, data: new InputPattern(pattern.trim(), false) };
  }

  static createFromMultipleFiles(
    files: string,
  ): Result<InputPattern, { kind: string; message: string }> {
    if (!files || files.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyPattern",
          message: "Input files cannot be empty",
        },
      };
    }

    return { ok: true, data: new InputPattern(files.trim(), true) };
  }

  toString(): string {
    return this.value;
  }

  toGlob(): string {
    // If multiple files were provided (shell expansion), return as-is
    if (this.isMultipleFiles) {
      return this.value;
    }

    // If it's a directory path without wildcards, add **/*.md pattern
    if (!this.value.includes("*") && !isMarkdownFile(this.value)) {
      return this.value.endsWith("/")
        ? `${this.value}${FILE_PATTERNS.ALL_MARKDOWN}`
        : `${this.value}/${FILE_PATTERNS.ALL_MARKDOWN}`;
    }
    return this.value;
  }

  isMultiple(): boolean {
    return this.isMultipleFiles;
  }

  getFiles(): string[] {
    if (this.isMultipleFiles) {
      return this.value.split(",");
    }
    return [this.value];
  }
}

/**
 * Supported output formats
 */
export type OutputFormat = "json" | "yaml" | "toml";

/**
 * Parse command-line arguments
 */
export class CLIArgumentParser {
  /**
   * Parse arguments array into structured CLI arguments
   */
  static parse(
    args: string[],
  ): Result<CLIArguments, { kind: string; message: string }> {
    // Check for help or version flags first
    if (
      args.includes(CLI_OPTIONS.HELP_SHORT) ||
      args.includes(CLI_OPTIONS.HELP_LONG)
    ) {
      // Return early with help flag - actual paths won't be used
      const dummySchema = SchemaPath.create(`dummy${SCHEMA_EXTENSIONS.JSON}`);
      const dummyOutput = OutputPath.create(`dummy${SCHEMA_EXTENSIONS.JSON}`);
      const dummyPattern = InputPattern.create("dummy");

      if (!dummySchema.ok || !dummyOutput.ok || !dummyPattern.ok) {
        // This should never happen with valid dummy values
        throw new Error("Failed to create dummy values for help");
      }

      return {
        ok: true,
        data: {
          schemaPath: dummySchema.data,
          outputPath: dummyOutput.data,
          inputPattern: dummyPattern.data,
          options: {
            help: true,
            version: false,
            verbose: false,
            quiet: false,
            dryRun: false,
            parallel: false,
          },
        },
      };
    }

    if (args.includes(CLI_OPTIONS.VERSION)) {
      // Return early with version flag - actual paths won't be used
      const dummySchema = SchemaPath.create(`dummy${SCHEMA_EXTENSIONS.JSON}`);
      const dummyOutput = OutputPath.create(`dummy${SCHEMA_EXTENSIONS.JSON}`);
      const dummyPattern = InputPattern.create("dummy");

      if (!dummySchema.ok || !dummyOutput.ok || !dummyPattern.ok) {
        // This should never happen with valid dummy values
        throw new Error("Failed to create dummy values for version");
      }

      return {
        ok: true,
        data: {
          schemaPath: dummySchema.data,
          outputPath: dummyOutput.data,
          inputPattern: dummyPattern.data,
          options: {
            help: false,
            version: true,
            verbose: false,
            quiet: false,
            dryRun: false,
            parallel: false,
          },
        },
      };
    }

    // Separate positional arguments from options
    const positional: string[] = [];
    const options: CLIOptions = {
      help: false,
      version: false,
      verbose: false,
      quiet: false,
      dryRun: false,
      parallel: false,
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith("-")) {
        // Handle options using constants
        if (isCLIOption(arg)) {
          const optionProperty = getOptionProperty(arg);

          if (optionProperty) {
            switch (arg) {
              case CLI_OPTIONS.VERBOSE_SHORT:
              case CLI_OPTIONS.VERBOSE_LONG:
                options.verbose = true;
                break;
              case CLI_OPTIONS.QUIET_SHORT:
              case CLI_OPTIONS.QUIET_LONG:
                options.quiet = true;
                break;
              case CLI_OPTIONS.DRY_RUN:
                options.dryRun = true;
                break;
              case CLI_OPTIONS.PARALLEL_SHORT:
              case CLI_OPTIONS.PARALLEL_LONG:
                options.parallel = true;
                break;
              case CLI_OPTIONS.MAX_WORKERS:
                if (i + 1 < args.length) {
                  const workers = parseInt(args[i + 1], 10);
                  if (!isNaN(workers) && workers > 0) {
                    options.maxWorkers = workers;
                    i++; // Skip next arg
                  }
                }
                break;
            }
          }
        }
      } else {
        // Positional argument
        positional.push(arg);
      }
      i++;
    }

    // Require at least 3 positional arguments
    if (positional.length < 3) {
      return {
        ok: false,
        error: {
          kind: "InsufficientArguments",
          message:
            `Expected at least 3 arguments (schema, output, pattern/files), got ${positional.length}`,
        },
      };
    }

    // Parse positional arguments
    const schemaResult = SchemaPath.create(positional[0]);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const outputResult = OutputPath.create(positional[1]);
    if (!outputResult.ok) {
      return outputResult;
    }

    // Handle multiple input files (when shell expands glob)
    // If we have more than 3 positional args, treat args 2+ as individual files
    let patternResult: Result<InputPattern, { kind: string; message: string }>;

    if (positional.length > 3) {
      // Shell expanded the glob - join all remaining args as individual files
      // Create a pattern that will match these specific files
      const files = positional.slice(2).join(",");
      patternResult = InputPattern.createFromMultipleFiles(files);
    } else {
      // Single pattern argument (may be glob or single file)
      patternResult = InputPattern.create(positional[2]);
    }

    if (!patternResult.ok) {
      return patternResult;
    }

    return {
      ok: true,
      data: {
        schemaPath: schemaResult.data,
        outputPath: outputResult.data,
        inputPattern: patternResult.data,
        options,
      },
    };
  }

  /**
   * Generate usage text
   */
  static getUsage(): string {
    return `Usage: frontmatter-to-schema <schema-file> <output-file> <input-pattern> [options]
       fm2s <schema-file> <output-file> <input-pattern> [options]

Arguments:
  schema-file    Path to JSON schema file
  output-file    Output file path (.json, .yml, .yaml, .toml)
  input-pattern  Glob pattern for input Markdown files

Options:
  -v, --verbose      Enable verbose logging
  -q, --quiet        Minimal output
  -h, --help         Show this help message
  --version          Show version information
  --dry-run          Simulate execution without writing files
  -p, --parallel     Enable parallel processing
  --max-workers <n>  Maximum number of parallel workers

Examples:
  frontmatter-to-schema schema.json output.json "**/*.md"
  frontmatter-to-schema registry.json registry.json "prompts/"
  fm2s schema.json result.yml "docs/**/*.md" --verbose --parallel`;
  }

  /**
   * Generate help text
   */
  static getHelp(): string {
    return `FrontMatter to Schema - Convert Markdown frontmatter to structured output

${CLIArgumentParser.getUsage()}

Description:
  This tool processes Markdown files with frontmatter, validates them against
  a JSON schema, and outputs structured data in various formats. It supports
  schema-driven template processing, data aggregation, and field derivation.

Features:
  - JSON Schema validation with $ref resolution
  - Multiple output formats (JSON, YAML, TOML)
  - Template-based output generation
  - Field derivation with x-derived-from
  - Parallel processing for large file sets
  - Dry-run mode for testing

For more information, see: https://github.com/tettuan/frontmatter-to-schema`;
  }
}
