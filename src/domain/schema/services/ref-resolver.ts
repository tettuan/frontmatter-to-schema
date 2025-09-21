import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import {
  isRefSchema,
  SchemaProperty,
} from "../value-objects/schema-property-types.ts";
import { ResolvedSchema } from "../entities/schema.ts";

export interface SchemaLoader {
  load(ref: string): Result<SchemaProperty, SchemaError & { message: string }>;
}

export class RefResolver {
  private readonly visitedRefs = new Set<string>();

  private constructor(private readonly loader: SchemaLoader) {}

  /**
   * Smart constructor following Totality principles
   * Ensures valid loader dependency on creation
   */
  static create(
    loader: SchemaLoader,
  ): Result<RefResolver, SchemaError & { message: string }> {
    if (!loader) {
      return err(createError({
        kind: "InvalidSchema",
        message: "SchemaLoader is required",
      }));
    }

    return ok(new RefResolver(loader));
  }

  resolve(
    definition: SchemaDefinition,
  ): Result<ResolvedSchema, SchemaError & { message: string }> {
    this.visitedRefs.clear();
    const referencedSchemas = new Map<string, SchemaDefinition>();

    const resolvedResult = this.resolveRecursive(
      definition.getRawSchema(),
      referencedSchemas,
    );

    if (!resolvedResult.ok) {
      return resolvedResult;
    }

    const resolvedDef = SchemaDefinition.create(resolvedResult.data);
    if (!resolvedDef.ok) {
      return err(createError({
        kind: "InvalidSchema",
        message: "Failed to create resolved schema definition",
      }));
    }

    return ok({
      definition: resolvedDef.data,
      referencedSchemas,
    });
  }

  private resolveRecursive(
    schema: SchemaProperty,
    referencedSchemas: Map<string, SchemaDefinition>,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    // Exhaustive switch on schema kind - no default needed
    switch (schema.kind) {
      case "ref":
        return this.resolveRef(schema.ref, referencedSchemas);

      case "object":
        return this.resolveObjectSchema(schema, referencedSchemas);

      case "array":
        return this.resolveArraySchema(schema, referencedSchemas);

      case "string":
      case "number":
      case "integer":
      case "boolean":
      case "enum":
      case "null":
      case "any":
        // Primitive types don't need resolution
        return ok(schema);
    }
  }

  private resolveObjectSchema(
    schema: SchemaProperty & { kind: "object" },
    referencedSchemas: Map<string, SchemaDefinition>,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    const resolvedProperties: Record<string, SchemaProperty> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const resolvedProp = this.resolveRecursive(prop, referencedSchemas);
      if (!resolvedProp.ok) {
        return resolvedProp;
      }
      resolvedProperties[key] = resolvedProp.data;
    }

    return ok({
      ...schema,
      properties: resolvedProperties,
    });
  }

  private resolveArraySchema(
    schema: SchemaProperty & { kind: "array" },
    referencedSchemas: Map<string, SchemaDefinition>,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    if (isRefSchema(schema.items)) {
      const resolvedItems = this.resolveRef(
        schema.items.$ref,
        referencedSchemas,
      );
      if (!resolvedItems.ok) {
        return resolvedItems;
      }
      return ok({
        ...schema,
        items: resolvedItems.data,
      });
    } else {
      const resolvedItems = this.resolveRecursive(
        schema.items,
        referencedSchemas,
      );
      if (!resolvedItems.ok) {
        return resolvedItems;
      }
      return ok({
        ...schema,
        items: resolvedItems.data,
      });
    }
  }

  private resolveRef(
    ref: string,
    referencedSchemas: Map<string, SchemaDefinition>,
  ): Result<SchemaProperty, SchemaError & { message: string }> {
    if (this.visitedRefs.has(ref)) {
      return err(createError({
        kind: "CircularReference",
        refs: Array.from(this.visitedRefs).concat(ref),
      }));
    }

    this.visitedRefs.add(ref);

    const loadResult = this.loader.load(ref);
    if (!loadResult.ok) {
      return err(createError({
        kind: "RefResolutionFailed",
        ref,
        message: loadResult.error.message,
      }));
    }

    const schemaDef = SchemaDefinition.create(loadResult.data);
    if (!schemaDef.ok) {
      return err(createError({
        kind: "RefResolutionFailed",
        ref,
        message: "Invalid referenced schema",
      }));
    }

    referencedSchemas.set(ref, schemaDef.data);

    const resolved = this.resolveRecursive(loadResult.data, referencedSchemas);
    this.visitedRefs.delete(ref);

    return resolved;
  }
}
