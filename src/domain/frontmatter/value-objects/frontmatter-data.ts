import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, FrontmatterError } from "../../shared/types/errors.ts";

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

  get(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current !== "object") {
        return undefined;
      }

      if (part === "[]" && Array.isArray(current)) {
        return current;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
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
