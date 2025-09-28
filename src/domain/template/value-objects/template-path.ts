import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";

/**
 * Value object representing a template file path.
 * Ensures the path points to a valid template file (JSON or YAML).
 */
export class TemplatePath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a TemplatePath from a string path.
   * Validates that the path has a valid template extension and is not empty.
   */
  static create(path: string): Result<TemplatePath, TemplateError> {
    const trimmedPath = path.trim();

    if (trimmedPath.length === 0) {
      return Result.error(
        new TemplateError("Template path cannot be empty", "EMPTY_PATH", {
          path,
        }),
      );
    }

    const validExtensions = [".json", ".yml", ".yaml"];
    const hasValidExtension = validExtensions.some((ext) =>
      trimmedPath.endsWith(ext)
    );

    if (!hasValidExtension) {
      return Result.error(
        new TemplateError(
          "Template path must have .json, .yml, or .yaml extension",
          "INVALID_EXTENSION",
          { path, validExtensions },
        ),
      );
    }

    return Result.ok(new TemplatePath(trimmedPath));
  }

  /**
   * Returns the string representation of the template path.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Returns the filename including extension.
   */
  getBasename(): string {
    const lastSlashIndex = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\"),
    );

    if (lastSlashIndex >= 0) {
      return this.value.substring(lastSlashIndex + 1);
    }
    return this.value;
  }

  /**
   * Returns the template name without the extension.
   */
  getTemplateName(): string {
    const basename = this.getBasename();
    // Remove extension (.json, .yml, or .yaml)
    const lastDotIndex = basename.lastIndexOf(".");
    if (lastDotIndex > 0) {
      return basename.substring(0, lastDotIndex);
    }
    return basename;
  }

  /**
   * Returns the directory path without the filename.
   */
  getDirectory(): string {
    const lastSlashIndex = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\"),
    );

    if (lastSlashIndex > 0) {
      return this.value.substring(0, lastSlashIndex);
    }
    if (lastSlashIndex === 0) {
      return "/";
    }
    return ".";
  }

  /**
   * Compares this template path with another TemplatePath for equality.
   */
  equals(other: TemplatePath): boolean {
    return this.value === other.value;
  }

  /**
   * Returns true if this appears to be an items template (for {@items} expansion).
   * This is a heuristic based on common naming patterns.
   */
  isItemsTemplate(): boolean {
    const templateName = this.getTemplateName();

    // Common patterns for items templates
    return templateName.includes("_command_") ||
      templateName.includes("_item") ||
      templateName.endsWith("_item") ||
      templateName.startsWith("item_");
  }
}
