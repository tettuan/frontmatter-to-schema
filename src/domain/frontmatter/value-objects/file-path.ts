import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

export class FilePath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<FilePath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({ kind: "EmptyInput" }));
    }

    const trimmed = path.trim();

    if (trimmed.includes("\0")) {
      return err(createError({
        kind: "InvalidFormat",
        format: "file path",
        value: trimmed,
      }, "File path cannot contain null characters"));
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
    const fileName = this.getFileName();
    const lastDot = fileName.lastIndexOf(".");
    return lastDot === -1 ? "" : fileName.substring(lastDot + 1);
  }

  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash === -1 ? "." : this.value.substring(0, lastSlash);
  }

  isMarkdown(): boolean {
    const ext = this.getExtension().toLowerCase();
    return ext === "md" || ext === "markdown";
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
