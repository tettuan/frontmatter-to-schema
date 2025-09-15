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
   */
  private getBaseErrorMessage(error: DomainError): string {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    switch (error.kind) {
      case "MissingRequired":
        return `Missing required ${error.field}`;
      case "TooManyArguments":
        return `Too many arguments provided`;
      case "InvalidFormat":
        return `Invalid format for ${
          "field" in error && error.field ? error.field : "input"
        }`;
      case "EmptyInput":
        return "Input cannot be empty";
      case "FileNotFound":
        return `File not found: ${("path" in error) ? error.path : "unknown"}`;
      case "ConfigurationError":
        return "Configuration error occurred";
      default:
        return `Error: ${error.kind}`;
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
