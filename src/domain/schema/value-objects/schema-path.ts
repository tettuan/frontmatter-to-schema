import { ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { ValidationErrorBuilder } from "../../shared/services/unified-error-handler.ts";
import { FileExtension } from "../../shared/value-objects/file-extension.ts";
import { SupportedFormats } from "../../shared/value-objects/supported-formats.ts";

export class SchemaPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<SchemaPath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return new ValidationErrorBuilder().emptyInput();
    }

    const trimmed = path.trim();
    const validationResult = SupportedFormats.validatePath(trimmed, "schema");
    if (!validationResult.ok) {
      return new ValidationErrorBuilder().invalidFormat(
        "schema path",
        trimmed,
        undefined,
        validationResult.error.message,
      );
    }

    return ok(new SchemaPath(trimmed));
  }

  getValue(): string {
    return this.value;
  }

  isAbsolute(): boolean {
    return this.value.startsWith("/");
  }

  isRelative(): boolean {
    return !this.isAbsolute();
  }

  getFileName(): string {
    const parts = this.value.split("/");
    return parts[parts.length - 1];
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash === -1 ? "." : this.value.substring(0, lastSlash);
  }

  resolve(basePath: string): SchemaPath {
    if (this.isAbsolute()) {
      return this;
    }
    const resolved = basePath.endsWith("/")
      ? basePath + this.value
      : `${basePath}/${this.value}`;
    return new SchemaPath(resolved);
  }

  getFormat(): "json" | "yaml" {
    const ext = FileExtension.fromPath(this.value);
    if (ext.ok) {
      return ext.data.getValue() === ".json" ? "json" : "yaml";
    }
    // Fallback for safety, though this should not happen due to validation
    return this.value.endsWith(".json") ? "json" : "yaml";
  }

  toString(): string {
    return this.value;
  }
}
