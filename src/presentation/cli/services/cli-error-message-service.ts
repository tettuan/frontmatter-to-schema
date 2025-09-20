import { DomainError } from "../../../domain/shared/types/errors.ts";
import { ok, Result } from "../../../domain/shared/types/result.ts";
import { PathExpansionService } from "./path-expansion-service.ts";

/**
 * CLI Error Message Service
 *
 * Generates actionable error messages following DDD principles
 * Provides users with specific guidance on how to fix issues
 */
export class CLIErrorMessageService {
  private pathExpansionService: PathExpansionService;

  private constructor(pathExpansionService: PathExpansionService) {
    this.pathExpansionService = pathExpansionService;
  }

  /**
   * Smart constructor following Totality principles
   */
  static create(): Result<CLIErrorMessageService, never> {
    const pathExpansionResult = PathExpansionService.create();
    if (!pathExpansionResult.ok) {
      // This should never happen as PathExpansionService.create() returns Result<T, never>
      throw new Error("Failed to create PathExpansionService");
    }

    return ok(new CLIErrorMessageService(pathExpansionResult.data));
  }

  /**
   * Generate comprehensive error message with solutions
   */
  generateErrorMessage(error: DomainError): string {
    const baseMessage = this.getBaseErrorMessage(error);
    const suggestions = this.generateSuggestions(error);
    const examples = this.getRelevantExamples(error);

    let message = `❌ ${baseMessage}`;

    if (suggestions.length > 0) {
      message += "\n\n💡 Suggestions:";
      suggestions.forEach((suggestion) => {
        message += `\n  • ${suggestion}`;
      });
    }

    if (examples.length > 0) {
      message += "\n\n📝 Examples:";
      examples.forEach((example) => {
        message += `\n  ${example}`;
      });
    }

    message += "\n\n🔗 For more help: frontmatter-to-schema --help";

    return message;
  }

  /**
   * Generate permission error message with exact command
   */
  generatePermissionErrorMessage(missingPermissions: string[]): string {
    return `❌ Permission Error: Missing required Deno permissions

💡 Required permissions:
  ${missingPermissions.map((p) => `• ${p}`).join("\n  ")}

🔧 Fix: Run with required permissions:
  deno run --allow-read --allow-write cli.ts [arguments]

📝 Complete example:
  deno run --allow-read --allow-write cli.ts schema.json "docs/**/*.md" output.json

ℹ️  Why these permissions are needed:
  • --allow-read: Read schema files and markdown documents
  • --allow-write: Write output files

💡 Optional: Add --allow-env for advanced debug logging:
  deno run --allow-read --allow-write --allow-env cli.ts [arguments]

🔗 For more help: frontmatter-to-schema --help`;
  }

  /**
   * Generate file not found suggestions with near matches
   */
  generateFileNotFoundSuggestions(filePath: string): string[] {
    const suggestions: string[] = [];

    // Check if it looks like a schema file
    if (filePath.includes("schema") || filePath.endsWith(".json")) {
      suggestions.push("Verify schema file exists and path is correct");
      suggestions.push("Try: ls schema*.json");
      suggestions.push("Example: ./examples/2.climpt/registry_schema.json");
    }

    // Check if it looks like an input pattern
    if (filePath.includes("*") || filePath.includes("/")) {
      const pathSuggestions = this.pathExpansionService.generatePathSuggestions(
        filePath,
        { kind: "FileNotFound", path: filePath },
      );
      suggestions.push(...pathSuggestions);
    }

    // General suggestions
    suggestions.push("Check file path spelling and case sensitivity");
    suggestions.push("Use absolute path if relative path fails");

    return suggestions;
  }

  /**
   * Get base error message without formatting
   * Following Totality principles - exhaustive switch without default clause
   */
  private getBaseErrorMessage(error: DomainError): string {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    // Exhaustive switch following Totality principles - no default clause
    switch (error.kind) {
      // ValidationError cases
      case "OutOfRange":
        return `Value ${error.value} is out of range ${error.min ?? "?"}-${
          error.max ?? "?"
        }`;
      case "InvalidRegex":
        return `Invalid regex pattern: ${error.pattern}`;
      case "PatternMismatch":
        return `Value "${error.value}" does not match pattern ${error.pattern}`;
      case "ParseError":
        return `Cannot parse "${error.input}"`;
      case "EmptyInput":
        return "Input cannot be empty";
      case "TooLong":
        return `Value "${error.value}" exceeds maximum length of ${error.maxLength}`;
      case "InvalidType":
        return `Expected type ${error.expected}, got ${error.actual}`;
      case "MissingRequired":
        return `Missing required ${error.field}`;
      case "TooManyArguments":
        return `Too many arguments provided`;
      case "InvalidFormat":
        return `Invalid format for ${
          "field" in error && error.field ? error.field : "input"
        }`;
      case "FieldNotFound":
        return `Field not found: ${error.path}`;
      case "ValidationRuleNotFound":
        return `Validation rule not found for path: ${error.path}`;
      case "DuplicateValue":
        return `Duplicate value found in field: ${error.field}`;
      case "ConfigNotFound":
        return `Configuration not found: ${error.path}`;
      case "ConfigReadError":
        return `Configuration read error in field: ${error.field}`;
      case "InvalidStructure":
        return `Invalid structure in field: ${error.field}`;
      case "UnknownError":
        return `Unknown error in field: ${error.field}`;

      // SchemaError cases
      case "SchemaNotFound":
        return `Schema not found: ${error.path}`;
      case "InvalidSchema":
        return `Invalid schema: ${error.message}`;
      case "RefResolutionFailed":
        return `Failed to resolve $ref "${error.ref}": ${error.message}`;
      case "CircularReference":
        return `Circular reference detected: ${error.refs.join(" -> ")}`;
      case "InvalidTemplate":
        return `Invalid template: ${
          "template" in error ? error.template : error.message
        }`;
      case "TemplateNotDefined":
        return "Schema does not define a template path";
      case "TemplateItemsNotDefined":
        return "Schema does not define template items directive";
      case "TemplateFormatNotDefined":
        return "Schema does not define template format directive";
      case "InvalidTemplateFormat":
        return "Invalid template format specified";
      case "JMESPathFilterNotDefined":
        return "Schema does not define JMESPath filter directive";
      case "JMESPathCompilationFailed":
        return `JMESPath expression compilation failed: ${error.expression} - ${error.message}`;
      case "JMESPathExecutionFailed":
        return `JMESPath expression execution failed: ${error.expression} - ${error.message}`;
      case "InvalidJMESPathResult":
        return `Invalid JMESPath result for expression: ${error.expression}`;
      case "FrontmatterPartNotFound":
        return "No frontmatter-part directive found in schema";
      case "SchemaNotResolved":
        return "Schema references have not been resolved";
      case "TypeNotDefined":
        return "Schema does not define a type";
      case "PropertiesNotDefined":
        return "Schema does not define properties";
      case "RefNotDefined":
        return "Schema does not define a $ref";
      case "DerivedFromNotDefined":
        return "Schema does not define derived-from directive";
      case "ExtractFromNotDefined":
        return "Schema does not define x-extract-from directive";
      case "ItemsNotDefined":
        return "Schema does not define items";
      case "EnumNotDefined":
        return "Schema is not an enum type";
      case "PropertyNotFound":
        return `Property not found at path: ${error.path}`;

      // FrontmatterError cases
      case "ExtractionFailed":
        return `Frontmatter extraction failed: ${error.message}`;
      case "InvalidYaml":
        return `Invalid YAML: ${error.message}`;
      case "NoFrontmatter":
        return "No frontmatter found in document";
      case "MalformedFrontmatter":
        return `Malformed frontmatter: ${error.content}`;

      // TemplateError cases
      case "TemplateNotFound":
        return `Template not found: ${error.path}`;
      case "VariableNotFound":
        return `Variable not found: ${error.variable}`;
      case "RenderFailed":
        return `Template render failed: ${error.message}`;
      case "TemplateStructureInvalid":
        return `Invalid template structure in ${error.template}: ${error.issue}`;
      case "VariableResolutionFailed":
        return `Failed to resolve variable ${error.variable}: ${error.reason}`;
      case "DataCompositionFailed":
        return `Data composition failed: ${error.reason}`;

      // AggregationError cases
      case "InvalidExpression":
        return `Invalid expression: ${error.expression}`;
      case "PathNotFound":
        return `Path not found in data: ${error.path}`;
      case "AggregationFailed":
        return `Aggregation failed: ${error.message}`;
      case "MergeFailed":
        return `Merge failed: ${error.message}`;

      // FileSystemError cases
      case "FileNotFound":
        return `File not found: ${error.path}`;
      case "ReadFailed":
        return `Failed to read file ${error.path}: ${error.message}`;
      case "WriteFailed":
        return `Failed to write file ${error.path}: ${error.message}`;
      case "InvalidPath":
        return `Invalid path: ${error.path}`;
      case "PermissionDenied":
        return `Permission denied: ${error.path}`;

      // SystemError cases
      case "InitializationError":
        return `Initialization error: ${error.message}`;
      case "ConfigurationError":
        return `Configuration error: ${error.message}`;

      // PerformanceError cases
      case "BenchmarkError":
        return `Benchmark error: ${error.content}`;
      case "PerformanceViolation":
        return `Performance violation: ${error.content}`;
      case "MemoryMonitorError":
        return `Memory monitor error: ${error.content}`;
      case "InvalidMemoryComparison":
        return `Invalid memory comparison: ${error.content}`;
      case "MemoryBoundsViolation":
        return `Memory bounds violation: ${error.content}`;
      case "InsufficientData":
        return `Insufficient data: ${error.content}`;
      case "TestScenarioError":
        return `Test scenario error: ${error.content}`;
      case "PipelineExecutionError":
        return `Pipeline execution error: ${error.content}`;
      case "DirectoryCreationError":
        return `Directory creation error: ${error.content}`;
      case "FileWriteError":
        return `File write error: ${error.content}`;
      case "SchemaWriteError":
        return `Schema write error: ${error.content}`;
      case "TemplateWriteError":
        return `Template write error: ${error.content}`;
      case "CleanupError":
        return `Cleanup error: ${error.content}`;
      case "CircuitBreakerError":
        return `Circuit breaker error: ${error.content}`;
      case "ComplexityThresholdExceeded":
        return `Complexity threshold exceeded: ${error.content}`;
      case "CircuitBreakerOpen":
        return `Circuit breaker open: ${error.content}`;
      case "StreamingTimeout":
        return `Streaming timeout: ${error.content}`;
      case "StreamingError":
        return `Streaming error: ${error.content}`;
      case "MemoryBoundsExceeded":
        return `Memory bounds exceeded: ${error.content}`;
    }
  }

  /**
   * Generate specific suggestions based on error type
   */
  private generateSuggestions(error: DomainError): string[] {
    const suggestions: string[] = [];

    switch (error.kind) {
      case "MissingRequired":
        if ("field" in error && error.field === "arguments") {
          suggestions.push(
            "Provide schema path, input pattern, and output path",
          );
          suggestions.push(
            "Usage: frontmatter-to-schema <schema> <input> <output>",
          );
        }
        break;

      case "TooManyArguments":
        suggestions.push("Remove extra arguments");
        suggestions.push(
          "Only 3 arguments expected: schema, input pattern, output",
        );
        break;

      case "InvalidFormat":
        if ("field" in error && error.field === "schemaPath") {
          suggestions.push("Schema file must be .json format");
          suggestions.push("Example: schema.json, ./config/schema.json");
        } else if ("field" in error && error.field === "outputPath") {
          suggestions.push("Output file must be .json or .yaml format");
          suggestions.push("Example: output.json, result.yaml");
        }
        break;

      case "FileNotFound":
        if ("path" in error) {
          suggestions.push(...this.generateFileNotFoundSuggestions(error.path));
        }
        break;

      case "ConfigurationError":
        suggestions.push("Check system configuration and permissions");
        suggestions.push("Try running with --verbose for more details");
        break;
    }

    return suggestions;
  }

  /**
   * Get relevant examples based on error context
   */
  private getRelevantExamples(error: DomainError): string[] {
    const examples: string[] = [];

    switch (error.kind) {
      case "MissingRequired":
      case "TooManyArguments":
        examples.push(
          'frontmatter-to-schema schema.json "docs/**/*.md" output.json',
        );
        examples.push(
          "frontmatter-to-schema ./config/schema.json docs/ result.yaml",
        );
        examples.push("frontmatter-to-schema schema.json file.md output.json");
        break;

      case "InvalidFormat":
        if ("field" in error && error.field === "schemaPath") {
          examples.push(
            "frontmatter-to-schema schema.json input.md output.json",
          );
          examples.push(
            "frontmatter-to-schema ./schemas/registry.json docs/ output.json",
          );
        }
        break;

      case "FileNotFound":
        examples.push("ls *.json  # List available schema files");
        examples.push('find . -name "*.md" | head -5  # Find markdown files');
        break;
    }

    return examples;
  }
}
