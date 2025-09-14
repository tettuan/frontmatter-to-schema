import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
import {
  SchemaDefinition,
  SchemaProperty,
} from "../value-objects/schema-definition.ts";
import { ResolvedSchema } from "../entities/schema.ts";

export interface SchemaLoader {
  load(ref: string): Result<SchemaProperty, SchemaError & { message: string }>;
}

export class RefResolver {
  private readonly visitedRefs = new Set<string>();

  constructor(private readonly loader: SchemaLoader) {}

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
    if (schema.$ref) {
      return this.resolveRef(schema.$ref, referencedSchemas);
    }

    const resolved: any = { ...schema };

    if (schema.properties) {
      const resolvedProperties: Record<string, SchemaProperty> = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        const resolvedProp = this.resolveRecursive(prop, referencedSchemas);
        if (!resolvedProp.ok) {
          return resolvedProp;
        }
        resolvedProperties[key] = resolvedProp.data;
      }
      resolved.properties = resolvedProperties;
    }

    if (schema.items) {
      if (typeof schema.items === "object") {
        if ("$ref" in schema.items && schema.items.$ref) {
          const resolvedItems = this.resolveRef(
            schema.items.$ref,
            referencedSchemas,
          );
          if (!resolvedItems.ok) {
            return resolvedItems;
          }
          resolved.items = resolvedItems.data;
        } else {
          const resolvedItems = this.resolveRecursive(
            schema.items as SchemaProperty,
            referencedSchemas,
          );
          if (!resolvedItems.ok) {
            return resolvedItems;
          }
          resolved.items = resolvedItems.data;
        }
      }
    }

    return ok(resolved);
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
