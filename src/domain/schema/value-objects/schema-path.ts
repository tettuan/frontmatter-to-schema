import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Schema path value object - simplified
 */
export class SchemaPath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<SchemaPath, SchemaError & { message: string }> {
    if (!path || typeof path !== "string") {
      return err({
        kind: "InvalidSchema",
        message: "Schema path must be a non-empty string",
      });
    }

    return ok(new SchemaPath(path));
  }

  toString(): string {
    return this.value;
  }

  equals(other: SchemaPath): boolean {
    return this.value === other.value;
  }

  getExtension(): string {
    const lastDot = this.value.lastIndexOf(".");
    return lastDot > 0 ? this.value.slice(lastDot) : "";
  }
}
