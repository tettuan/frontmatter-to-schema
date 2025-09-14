import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError,
  FrontmatterError,
  ValidationError,
} from "../../shared/types/errors.ts";

export type FrontmatterContent = Record<string, unknown>;

export class FrontmatterData {
  private constructor(private readonly data: FrontmatterContent) {}

  static create(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (!data) {
      return err(createError({ kind: "NoFrontmatter" }));
    }

    if (typeof data !== "object" || Array.isArray(data)) {
      return err(createError({
        kind: "MalformedFrontmatter",
        content: JSON.stringify(data).substring(0, 100),
      }));
    }

    return ok(new FrontmatterData(data as FrontmatterContent));
  }

  static empty(): FrontmatterData {
    return new FrontmatterData({});
  }

  getData(): FrontmatterContent {
    return { ...this.data };
  }

  get(
    path: string,
  ): Result<unknown, ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError({
        kind: "EmptyInput",
      }, "Path cannot be empty"));
    }

    const parts = path.split(".");
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return err(createError({
          kind: "FieldNotFound",
          path,
        }, `Field not found: ${path}`));
      }

      if (typeof current !== "object") {
        return err(createError({
          kind: "InvalidType",
          expected: "object",
          actual: typeof current,
        }, `Expected object at path: ${path}`));
      }

      if (part === "[]" && Array.isArray(current)) {
        return ok(current);
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
      return err(createError({
        kind: "FieldNotFound",
        path,
      }, `Value not found at path: ${path}`));
    }

    return ok(current);
  }

  // Legacy method for backward compatibility - prefer get() with Result type
  getLegacy(path: string): unknown {
    const result = this.get(path);
    return result.ok ? result.data : undefined;
  }

  has(path: string): boolean {
    const result = this.get(path);
    return result.ok;
  }

  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  merge(other: FrontmatterData): FrontmatterData {
    return new FrontmatterData({
      ...this.data,
      ...other.data,
    });
  }

  withField(path: string, value: unknown): FrontmatterData {
    const parts = path.split(".");
    const newData = JSON.parse(JSON.stringify(this.data));

    let current: any = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return new FrontmatterData(newData);
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
