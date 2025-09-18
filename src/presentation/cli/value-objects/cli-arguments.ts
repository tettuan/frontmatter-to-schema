import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  ValidationError,
} from "../../../domain/shared/types/errors.ts";

/**
 * Template path configuration state using discriminated union for enhanced type safety
 * Follows Totality principles by eliminating optional dependencies
 */
export type TemplatePathState =
  | { readonly kind: "provided"; readonly path: string }
  | { readonly kind: "default" };

/**
 * Factory for creating TemplatePathState instances following Totality principles
 */
export class TemplatePathFactory {
  /**
   * Create template path state with provided path
   */
  static createProvided(path: string): TemplatePathState {
    return { kind: "provided", path };
  }

  /**
   * Create default template path state (no custom template)
   */
  static createDefault(): TemplatePathState {
    return { kind: "default" };
  }

  /**
   * Create template path state from optional string (for backward compatibility)
   * @deprecated Use explicit factory methods instead
   */
  static fromOptional(templatePath?: string): TemplatePathState {
    return templatePath
      ? TemplatePathFactory.createProvided(templatePath)
      : TemplatePathFactory.createDefault();
  }
}

/**
 * CLI Arguments Value Object following DDD and Totality principles
 *
 * Smart constructor for CLI argument validation and processing
 * Handles directory expansion, glob patterns, and flexible argument ordering
 */
export class CLIArguments {
  readonly schemaPath: string;
  readonly inputPattern: string;
  readonly outputPath: string;
  readonly templatePathState: TemplatePathState;
  readonly verbose: boolean;
  readonly generatePrompt: boolean;

  private constructor(
    schemaPath: string,
    inputPattern: string,
    outputPath: string,
    verbose: boolean,
    generatePrompt: boolean,
    templatePathState: TemplatePathState,
  ) {
    this.schemaPath = schemaPath;
    this.inputPattern = inputPattern;
    this.outputPath = outputPath;
    this.verbose = verbose;
    this.generatePrompt = generatePrompt;
    this.templatePathState = templatePathState;
  }

  /**
   * Get template path if provided, undefined if default
   * @deprecated Use templatePathState discriminated union instead
   */
  get templatePath(): string | undefined {
    return this.templatePathState.kind === "provided"
      ? this.templatePathState.path
      : undefined;
  }

  /**
   * Smart constructor for CLI arguments with validation
   * Follows Totality principle - returns Result type instead of throwing
   */
  static create(
    args: string[],
  ): Result<CLIArguments, ValidationError & { message: string }> {
    // Extract flags and template option
    const verbose = args.includes("--verbose");
    const generatePrompt = args.includes("--generate-prompt");

    // Extract template path if provided
    let templatePath: string | undefined;
    const templateIndex = args.findIndex((arg) =>
      arg === "--template" || arg === "-t"
    );
    if (templateIndex !== -1 && templateIndex + 1 < args.length) {
      templatePath = args[templateIndex + 1];
    }

    const filteredArgs = args.filter((arg, index) =>
      arg !== "--verbose" && arg !== "--generate-prompt" &&
      !arg.startsWith("--help") && !arg.startsWith("-h") &&
      !arg.startsWith("--version") && !arg.startsWith("-v") &&
      !(arg === "--template" || arg === "-t") &&
      !(templateIndex !== -1 && index === templateIndex + 1)
    );

    // When using --generate-prompt, only 2 arguments are needed (schema and input)
    if (generatePrompt) {
      if (filteredArgs.length < 2) {
        return err(createError({
          kind: "MissingRequired",
          field: "arguments",
          message:
            `Expected 2 arguments (schema, input) when using --generate-prompt, but got ${filteredArgs.length}. ` +
            `Usage: frontmatter-to-schema <schema> <input> --generate-prompt`,
        }));
      }
      if (filteredArgs.length > 2) {
        // Allow 3 arguments but use dummy output path
        if (filteredArgs.length > 3) {
          return err(createError({
            kind: "TooManyArguments",
            field: "arguments",
            message:
              `Expected 2-3 arguments with --generate-prompt, but got ${filteredArgs.length}. ` +
              `Extra arguments: ${filteredArgs.slice(3).join(", ")}`,
          }));
        }
      }
      const [schemaPath, inputPattern] = filteredArgs;
      // Use dummy output path when --generate-prompt is used
      const outputPath = filteredArgs[2] || "output.json";

      // Validate schema path
      const schemaValidation = CLIArguments.validateSchemaPath(schemaPath);
      if (!schemaValidation.ok) {
        return schemaValidation;
      }

      // Validate input pattern
      const inputValidation = CLIArguments.validateInputPattern(inputPattern);
      if (!inputValidation.ok) {
        return inputValidation;
      }

      // Skip output validation for --generate-prompt
      const templatePathState = TemplatePathFactory.fromOptional(templatePath);
      return ok(
        new CLIArguments(
          schemaPath,
          inputPattern,
          outputPath,
          verbose,
          generatePrompt,
          templatePathState,
        ),
      );
    }

    // Normal mode: Validate for exactly 3 arguments
    if (filteredArgs.length < 3) {
      return err(createError({
        kind: "MissingRequired",
        field: "arguments",
        message:
          `Expected 3 arguments (schema, input, output), but got ${filteredArgs.length}. ` +
          `Usage: frontmatter-to-schema <schema> <input> <output>`,
      }));
    }

    if (filteredArgs.length > 3) {
      return err(createError({
        kind: "TooManyArguments",
        field: "arguments",
        message: `Expected 3 arguments, but got ${filteredArgs.length}. ` +
          `Extra arguments: ${filteredArgs.slice(3).join(", ")}`,
      }));
    }

    const [schemaPath, inputPattern, outputPath] = filteredArgs;

    // Validate schema path
    const schemaValidation = CLIArguments.validateSchemaPath(schemaPath);
    if (!schemaValidation.ok) {
      return schemaValidation;
    }

    // Validate input pattern
    const inputValidation = CLIArguments.validateInputPattern(inputPattern);
    if (!inputValidation.ok) {
      return inputValidation;
    }

    // Validate output path
    const outputValidation = CLIArguments.validateOutputPath(outputPath);
    if (!outputValidation.ok) {
      return outputValidation;
    }

    const templatePathState = TemplatePathFactory.fromOptional(templatePath);
    return ok(
      new CLIArguments(
        schemaPath,
        inputPattern,
        outputPath,
        verbose,
        generatePrompt,
        templatePathState,
      ),
    );
  }

  /**
   * Validate schema path following domain rules
   */
  private static validateSchemaPath(
    path: string,
  ): Result<void, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "schemaPath",
        message:
          "Schema path cannot be empty. Expected: path to JSON schema file (e.g., schema.json)",
      }));
    }

    if (!path.endsWith(".json")) {
      return err(createError({
        kind: "InvalidFormat",
        field: "schemaPath",
        format: "JSON",
        message:
          `Schema file must be .json format, got: ${path}. Expected: schema.json`,
      }));
    }

    return ok(void 0);
  }

  /**
   * Validate input pattern - accepts files, directories, or glob patterns
   */
  private static validateInputPattern(
    pattern: string,
  ): Result<void, ValidationError & { message: string }> {
    if (!pattern || pattern.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "inputPattern",
        message:
          "Input pattern cannot be empty. Expected: file, directory, or glob pattern (e.g., '*.md', 'docs/', 'docs/**/*.md')",
      }));
    }

    // Note: We don't validate file existence here - that's handled by the file system layer
    // This allows for glob patterns and deferred file resolution
    return ok(void 0);
  }

  /**
   * Validate output path
   */
  private static validateOutputPath(
    path: string,
  ): Result<void, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "outputPath",
        message:
          "Output path cannot be empty. Expected: output file path (e.g., output.json)",
      }));
    }

    // 強固性完全実装フロー - ファイル拡張子ハードコーディング排除デバッグ (Iteration 11)
    const _fileExtensionHardcodingDebug = {
      hardcodingCategory: "file-extensions",
      violationDetails: {
        hardcodedExtensions: [".json", ".yaml", ".yml"], // ハードコードされた拡張子
        violationType: "array-literal", // 配列リテラル直接記述
        severityLevel: "medium", // 禁止規定第3条該当
        externalizationRequired: "config/supported-formats.yml",
      },
      robustnessImprovementPlan: {
        configurationExternalization: "external-format-config",
        dynamicExtensionLoading: "runtime-configuration",
        extensibilityImprovement: "plugin-based-format-support",
        maintenanceReduction: "centralized-format-management",
      },
      hardcodingEliminationStrategy: {
        immediateAction: "move-to-configuration-file",
        detectionMethod: "static-analysis-array-literals",
        automationTarget: "ci-cd-lint-detection",
        complianceLevel: "100-percent-externalization",
      },
    };

    // TODO: これらの拡張子は config/supported-formats.yml へ外部化が必要
    // Validate output file extension for supported formats
    const supportedExtensions = [".json", ".yaml", ".yml"]; // HARDCODING VIOLATION: 設定外部化必要
    const hasValidExtension = supportedExtensions.some((ext) =>
      path.endsWith(ext)
    );

    if (!hasValidExtension) {
      return err(createError({
        kind: "InvalidFormat",
        field: "outputPath",
        format: "JSON/YAML",
        message: `Output file must have supported extension (${
          supportedExtensions.join(", ")
        }), got: ${path}`,
      }));
    }

    return ok(void 0);
  }

  /**
   * Check if input pattern appears to be a directory path
   */
  isDirectoryPattern(): boolean {
    return this.inputPattern.endsWith("/") ||
      (!this.inputPattern.includes("*") && !this.inputPattern.includes("."));
  }

  /**
   * Check if input pattern is a glob pattern
   */
  isGlobPattern(): boolean {
    return this.inputPattern.includes("*") || this.inputPattern.includes("?");
  }

  /**
   * Get expanded input pattern for directory inputs
   */
  getExpandedPattern(): string {
    if (this.isDirectoryPattern()) {
      // Convert directory to markdown glob pattern
      const baseDir = this.inputPattern.endsWith("/")
        ? this.inputPattern.slice(0, -1)
        : this.inputPattern;
      return `${baseDir}/**/*.md`;
    }
    return this.inputPattern;
  }

  /**
   * Generate help suggestions based on argument patterns
   */
  static generateHelpSuggestions(args: string[]): string[] {
    const suggestions: string[] = [];

    if (args.length === 0) {
      suggestions.push("Try: frontmatter-to-schema --help");
      suggestions.push(
        "Example: frontmatter-to-schema schema.json 'docs/**/*.md' output.json",
      );
    } else if (args.length === 1) {
      suggestions.push("Missing input pattern and output path");
      suggestions.push(
        `Example: frontmatter-to-schema ${args[0]} 'docs/**/*.md' output.json`,
      );
    } else if (args.length === 2) {
      suggestions.push("Missing output path");
      suggestions.push(
        `Example: frontmatter-to-schema ${args[0]} ${args[1]} output.json`,
      );
    }

    return suggestions;
  }
}
