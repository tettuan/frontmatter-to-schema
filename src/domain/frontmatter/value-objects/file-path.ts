import { ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { ValidationErrorBuilder } from "../../shared/services/unified-error-handler.ts";
import { FileExtension } from "../../shared/value-objects/file-extension.ts";
import { SupportedFormats } from "../../shared/value-objects/supported-formats.ts";

export class FilePath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<FilePath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return new ValidationErrorBuilder().emptyInput();
    }

    const trimmed = path.trim();

    if (trimmed.includes("\0")) {
      return new ValidationErrorBuilder().invalidFormat(
        "file path",
        trimmed,
        undefined,
        "File path cannot contain null characters",
      );
    }

    return ok(new FilePath(trimmed));
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

  getExtension(): string {
    const ext = FileExtension.fromPath(this.value);
    if (ext.ok) {
      return ext.data.getValue().substring(1); // Remove leading dot
    }
    return "";
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash === -1 ? "." : this.value.substring(0, lastSlash);
  }

  isMarkdown(): boolean {
    const ext = FileExtension.fromPath(this.value);
    if (ext.ok) {
      return SupportedFormats.isSupported(ext.data, "markdown");
    }
    return false;
  }

  resolve(basePath: string): FilePath {
    if (this.isAbsolute()) {
      return this;
    }
    const resolved = basePath.endsWith("/")
      ? basePath + this.value
      : `${basePath}/${this.value}`;
    return new FilePath(resolved);
  }

  toString(): string {
    return this.value;
  }
}
