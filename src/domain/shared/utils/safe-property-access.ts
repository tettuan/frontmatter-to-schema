import { err, ok, Result } from "../types/result.ts";
import { createError, ValidationError } from "../types/errors.ts";

/**
 * Safe property access utilities following Totality principles
 * Eliminates unsafe type assertions in favor of Result<T,E> patterns
 * Shared across all domain services to ensure consistent type safety
 */
export class SafePropertyAccess {
  /**
   * Safely convert unknown data to Record<string, unknown>
   * Replaces `data as Record<string, unknown>` type assertions
   */
  static asRecord(
    data: unknown,
  ): Result<Record<string, unknown>, ValidationError & { message: string }> {
    if (data === null || data === undefined) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: "null/undefined",
      }, "Cannot convert null or undefined to object"));
    }

    if (typeof data !== "object") {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof data,
      }, `Cannot convert ${typeof data} to object`));
    }

    if (Array.isArray(data)) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: "array",
      }, "Cannot convert array to object"));
    }

    // At this point TypeScript knows data is Record<string, unknown>
    // This type assertion is safe and necessary at the system boundary
    // after comprehensive validation (Totality principle: acceptable at boundaries)
    return ok(data as Record<string, unknown>);
  }

  /**
   * Safely get property from object
   * Replaces `(obj as Record<string, unknown>)[key]` patterns
   */
  static getProperty(
    obj: unknown,
    key: string,
  ): Result<unknown, ValidationError & { message: string }> {
    const recordResult = this.asRecord(obj);
    if (!recordResult.ok) {
      return recordResult;
    }

    const record = recordResult.data;
    return ok(record[key]);
  }

  /**
   * Safely check if property exists in object
   * Replaces `key in (obj as Record<string, unknown>)` patterns
   */
  static hasProperty(
    obj: unknown,
    key: string,
  ): Result<boolean, ValidationError & { message: string }> {
    const recordResult = this.asRecord(obj);
    if (!recordResult.ok) {
      return err(recordResult.error);
    }

    const record = recordResult.data;
    return ok(key in record);
  }

  /**
   * Safely set property in object
   * Provides type-safe object property assignment
   */
  static setProperty(
    obj: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    obj[key] = value;
  }

  /**
   * Navigate through nested object path safely
   * Replaces chains of `current = current[part] as Record<string, unknown>`
   */
  static navigatePath(
    obj: unknown,
    path: string[],
  ): Result<unknown, ValidationError & { message: string }> {
    let current = obj;

    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      const propertyResult = this.getProperty(current, part);

      if (!propertyResult.ok) {
        return err(createError({
          kind: "FieldNotFound",
          path: path.slice(0, i + 1).join("."),
        }, `Path navigation failed at step ${i}: ${part}`));
      }

      current = propertyResult.data;
    }

    return ok(current);
  }

  /**
   * Safely merge two objects
   * Replaces manual property copying with type assertions
   */
  static mergeObjects(
    target: Record<string, unknown>,
    source: unknown,
  ): Result<void, ValidationError & { message: string }> {
    const sourceRecordResult = this.asRecord(source);
    if (!sourceRecordResult.ok) {
      return sourceRecordResult;
    }

    const sourceRecord = sourceRecordResult.data;
    for (const [key, value] of Object.entries(sourceRecord)) {
      target[key] = value;
    }

    return ok(void 0);
  }
}
