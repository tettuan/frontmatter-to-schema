import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaData } from "../entities/schema.ts";

/**
 * Reference resolution context tracking resolved references to prevent circular dependencies.
 */
export interface ResolutionContext {
  readonly resolvedRefs: Set<string>;
  readonly maxDepth: number;
  readonly currentDepth: number;
}

/**
 * Schema reference information extracted from $ref properties.
 */
export interface SchemaReference {
  readonly refPath: string;
  readonly fragment?: string;
  readonly baseContext: string;
}

/**
 * Result of reference resolution containing the resolved schema and updated context.
 */
export interface ResolvedReference {
  readonly schema: SchemaData;
  readonly context: ResolutionContext;
}

/**
 * Port interface for external schema loading operations.
 * This allows dependency injection and testing.
 */
export interface SchemaLoader {
  loadSchema(path: SchemaPath): Promise<Result<SchemaData, SchemaError>>;
}

/**
 * Reference resolution errors following totality principle.
 */
export type RefResolutionError =
  | { kind: "CircularReference"; refPath: string; chain: string[] }
  | { kind: "MaxDepthExceeded"; maxDepth: number; refPath: string }
  | { kind: "InvalidReference"; refPath: string; reason: string }
  | { kind: "SchemaNotFound"; refPath: string }
  | { kind: "FragmentNotFound"; fragment: string; schema: string };

/**
 * Service for resolving JSON Schema $ref references.
 * Implements totality principle with comprehensive error handling.
 */
export class RefResolver {
  private constructor(
    private readonly schemaLoader: SchemaLoader,
    private readonly defaultMaxDepth: number = 10,
  ) {}

  /**
   * Creates a RefResolver with the given schema loader.
   */
  static create(
    schemaLoader: SchemaLoader,
    maxDepth: number = 10,
  ): RefResolver {
    return new RefResolver(schemaLoader, maxDepth);
  }

  /**
   * Resolves all $ref references in a schema recursively.
   * Returns a Result with resolved schema or error.
   */
  async resolveReferences(
    schema: SchemaData,
    basePath: SchemaPath,
    context?: ResolutionContext,
  ): Promise<Result<SchemaData, SchemaError>> {
    const resolutionContext = context ?? this.createInitialContext();

    try {
      const result = await this.resolveSchemaReferences(
        schema,
        basePath.toString(),
        resolutionContext,
      );

      if (result.isError()) {
        return Result.error(
          this.convertRefErrorToSchemaError(result.unwrapError()),
        );
      }

      return Result.ok(result.unwrap().schema);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new SchemaError(
          `Reference resolution failed: ${errorMessage}`,
          "REF_RESOLUTION_ERROR",
          { basePath: basePath.toString(), error },
        ),
      );
    }
  }

  /**
   * Extracts reference information from a $ref string.
   */
  parseReference(
    refString: string,
    baseContext: string,
  ): Result<SchemaReference, SchemaError> {
    if (!refString || typeof refString !== "string") {
      return Result.error(
        new SchemaError(
          "Invalid reference: must be a non-empty string",
          "INVALID_REF_FORMAT",
          { ref: refString },
        ),
      );
    }

    const fragmentIndex = refString.indexOf("#");
    if (fragmentIndex === -1) {
      // Simple file reference
      return Result.ok({
        refPath: this.resolveRelativePath(refString, baseContext),
        baseContext,
      });
    }

    const path = refString.substring(0, fragmentIndex);
    const fragment = refString.substring(fragmentIndex + 1);

    return Result.ok({
      refPath: path ? this.resolveRelativePath(path, baseContext) : baseContext,
      fragment: fragment || undefined,
      baseContext,
    });
  }

  /**
   * Creates initial resolution context.
   */
  private createInitialContext(): ResolutionContext {
    return {
      resolvedRefs: new Set<string>(),
      maxDepth: this.defaultMaxDepth,
      currentDepth: 0,
    };
  }

  /**
   * Recursively resolves references in a schema object.
   */
  private async resolveSchemaReferences(
    schema: unknown,
    baseContext: string,
    context: ResolutionContext,
  ): Promise<Result<ResolvedReference, RefResolutionError>> {
    // Check depth limit
    if (context.currentDepth >= context.maxDepth) {
      return Result.error({
        kind: "MaxDepthExceeded",
        maxDepth: context.maxDepth,
        refPath: baseContext,
      });
    }

    // Handle $ref resolution
    if (this.hasReference(schema)) {
      return await this.resolveReference(
        schema as Record<string, unknown>,
        baseContext,
        context,
      );
    }

    // Handle object properties
    if (this.isObject(schema)) {
      return await this.resolveObjectReferences(
        schema as Record<string, unknown>,
        baseContext,
        context,
      );
    }

    // Handle arrays
    if (Array.isArray(schema)) {
      return await this.resolveArrayReferences(schema, baseContext, context);
    }

    // Primitive values - return as is
    return Result.ok({
      schema: schema as SchemaData,
      context,
    });
  }

  /**
   * Resolves a specific $ref reference.
   */
  private async resolveReference(
    schemaObj: Record<string, unknown>,
    baseContext: string,
    context: ResolutionContext,
  ): Promise<Result<ResolvedReference, RefResolutionError>> {
    const refValue = schemaObj["$ref"] as string;

    const parseResult = this.parseReference(refValue, baseContext);
    if (parseResult.isError()) {
      return Result.error({
        kind: "InvalidReference",
        refPath: refValue,
        reason: parseResult.unwrapError().message,
      });
    }

    const reference = parseResult.unwrap();
    const refKey = `${reference.refPath}${
      reference.fragment ? `#${reference.fragment}` : ""
    }`;

    // Check for circular reference
    if (context.resolvedRefs.has(refKey)) {
      return Result.error({
        kind: "CircularReference",
        refPath: refKey,
        chain: Array.from(context.resolvedRefs),
      });
    }

    // Load the referenced schema
    const pathResult = SchemaPath.create(reference.refPath);
    if (pathResult.isError()) {
      return Result.error({
        kind: "InvalidReference",
        refPath: reference.refPath,
        reason: pathResult.unwrapError().message,
      });
    }

    const loadResult = await this.schemaLoader.loadSchema(pathResult.unwrap());
    if (loadResult.isError()) {
      return Result.error({
        kind: "SchemaNotFound",
        refPath: reference.refPath,
      });
    }

    let referencedSchema = loadResult.unwrap();

    // Handle fragment resolution
    if (reference.fragment) {
      const fragmentResult = this.resolveFragment(
        referencedSchema,
        reference.fragment,
      );
      if (fragmentResult.isError()) {
        return Result.error(fragmentResult.unwrapError());
      }
      referencedSchema = fragmentResult.unwrap();
    }

    // Update context for recursive resolution
    const newContext = {
      ...context,
      resolvedRefs: new Set([...context.resolvedRefs, refKey]),
      currentDepth: context.currentDepth + 1,
    };

    // Recursively resolve references in the loaded schema
    return await this.resolveSchemaReferences(
      referencedSchema,
      reference.refPath,
      newContext,
    );
  }

  /**
   * Resolves references in object properties.
   */
  private async resolveObjectReferences(
    obj: Record<string, unknown>,
    baseContext: string,
    context: ResolutionContext,
  ): Promise<Result<ResolvedReference, RefResolutionError>> {
    const resolved: Record<string, unknown> = {};
    let currentContext = context;

    for (const [key, value] of Object.entries(obj)) {
      const valueResult = await this.resolveSchemaReferences(
        value,
        baseContext,
        currentContext,
      );

      if (valueResult.isError()) {
        return valueResult;
      }

      const resolvedValue = valueResult.unwrap();
      resolved[key] = resolvedValue.schema;
      currentContext = resolvedValue.context;
    }

    return Result.ok({
      schema: resolved as SchemaData,
      context: currentContext,
    });
  }

  /**
   * Resolves references in array items.
   */
  private async resolveArrayReferences(
    arr: unknown[],
    baseContext: string,
    context: ResolutionContext,
  ): Promise<Result<ResolvedReference, RefResolutionError>> {
    const resolved: unknown[] = [];
    let currentContext = context;

    for (const item of arr) {
      const itemResult = await this.resolveSchemaReferences(
        item,
        baseContext,
        currentContext,
      );

      if (itemResult.isError()) {
        return itemResult;
      }

      const resolvedItem = itemResult.unwrap();
      resolved.push(resolvedItem.schema);
      currentContext = resolvedItem.context;
    }

    return Result.ok({
      schema: resolved as unknown as SchemaData,
      context: currentContext,
    });
  }

  /**
   * Resolves a JSON Pointer fragment within a schema.
   */
  private resolveFragment(
    schema: SchemaData,
    fragment: string,
  ): Result<SchemaData, RefResolutionError> {
    if (!fragment) {
      return Result.ok(schema);
    }

    const path = fragment.split("/").filter((part) => part !== "");
    let current: unknown = schema;

    for (const part of path) {
      if (current === null || current === undefined) {
        return Result.error({
          kind: "FragmentNotFound",
          fragment,
          schema: "null/undefined",
        });
      }

      if (typeof current === "object" && !Array.isArray(current)) {
        const obj = current as Record<string, unknown>;
        const decodedPart = this.decodeJsonPointer(part);
        if (!(decodedPart in obj)) {
          return Result.error({
            kind: "FragmentNotFound",
            fragment,
            schema: `property '${decodedPart}' not found`,
          });
        }
        current = obj[decodedPart];
      } else if (Array.isArray(current)) {
        const index = parseInt(part, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return Result.error({
            kind: "FragmentNotFound",
            fragment,
            schema: "array index out of bounds",
          });
        }
        current = current[index];
      } else {
        return Result.error({
          kind: "FragmentNotFound",
          fragment,
          schema: "path leads to primitive",
        });
      }
    }

    return Result.ok(current as SchemaData);
  }

  /**
   * Decodes JSON Pointer special characters.
   */
  private decodeJsonPointer(part: string): string {
    return part.replace(/~1/g, "/").replace(/~0/g, "~");
  }

  /**
   * Resolves relative path against base context.
   */
  private resolveRelativePath(
    relativePath: string,
    baseContext: string,
  ): string {
    if (relativePath.startsWith("/") || relativePath.includes("://")) {
      return relativePath;
    }

    const baseParts = baseContext.split("/");
    baseParts.pop(); // Remove filename
    const relativeParts = relativePath.split("/");

    for (const part of relativeParts) {
      if (part === "..") {
        baseParts.pop();
      } else if (part !== "." && part !== "") {
        baseParts.push(part);
      }
    }

    return baseParts.join("/");
  }

  /**
   * Checks if an object has a $ref property.
   */
  private hasReference(obj: unknown): boolean {
    return this.isObject(obj) &&
      typeof (obj as Record<string, unknown>)["$ref"] === "string";
  }

  /**
   * Type guard for objects.
   */
  private isObject(value: unknown): boolean {
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value);
  }

  /**
   * Converts RefResolutionError to SchemaError.
   */
  private convertRefErrorToSchemaError(error: RefResolutionError): SchemaError {
    switch (error.kind) {
      case "CircularReference":
        return new SchemaError(
          `Circular reference detected: ${error.refPath}`,
          "CIRCULAR_REFERENCE",
          { refPath: error.refPath, chain: error.chain },
        );
      case "MaxDepthExceeded":
        return new SchemaError(
          `Maximum resolution depth exceeded (${error.maxDepth}): ${error.refPath}`,
          "MAX_DEPTH_EXCEEDED",
          { maxDepth: error.maxDepth, refPath: error.refPath },
        );
      case "InvalidReference":
        return new SchemaError(
          `Invalid reference: ${error.refPath} - ${error.reason}`,
          "INVALID_REFERENCE",
          { refPath: error.refPath, reason: error.reason },
        );
      case "SchemaNotFound":
        return new SchemaError(
          `Referenced schema not found: ${error.refPath}`,
          "SCHEMA_NOT_FOUND",
          { refPath: error.refPath },
        );
      case "FragmentNotFound":
        return new SchemaError(
          `Fragment not found: ${error.fragment} in schema ${error.schema}`,
          "FRAGMENT_NOT_FOUND",
          { fragment: error.fragment, schema: error.schema },
        );
    }
  }
}
