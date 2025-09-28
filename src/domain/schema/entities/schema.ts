import { SchemaPath } from "../value-objects/schema-path.ts";

/**
 * Schema identifier value object.
 */
export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(name: string): SchemaId {
    return new SchemaId(name);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Schema state representing the lifecycle of schema loading and processing.
 */
export type SchemaState =
  | { kind: "Unloaded"; path: SchemaPath }
  | { kind: "Loading"; path: SchemaPath }
  | { kind: "Resolved"; path: SchemaPath; schema: SchemaData }
  | { kind: "Failed"; path: SchemaPath; error: Error };

/**
 * Schema data structure representing the parsed JSON schema.
 */
export interface SchemaData {
  readonly type: string;
  readonly properties?: Record<string, unknown>;
  readonly "x-template"?: string;
  readonly "x-template-items"?: string;
  readonly "x-template-format"?: string;
  [key: string]: unknown;
}

/**
 * Schema entity - aggregate root for schema management.
 * Manages schema lifecycle, validation, and directive extraction.
 */
export class Schema {
  private constructor(
    private readonly id: SchemaId,
    private readonly state: SchemaState
  ) {}

  /**
   * Creates a new Schema with unloaded state.
   */
  static create(id: SchemaId, path: SchemaPath): Schema {
    return new Schema(id, { kind: "Unloaded", path });
  }

  /**
   * Returns the schema identifier.
   */
  getId(): SchemaId {
    return this.id;
  }

  /**
   * Returns the current schema state.
   */
  getState(): SchemaState {
    return this.state;
  }

  /**
   * Returns true if the schema is loaded and resolved.
   */
  isLoaded(): boolean {
    return this.state.kind === "Resolved";
  }

  /**
   * Marks the schema as loading.
   */
  markAsLoading(): Schema {
    return new Schema(this.id, { kind: "Loading", path: this.state.path });
  }

  /**
   * Marks the schema as resolved with schema data.
   */
  markAsResolved(schemaData: SchemaData): Schema {
    return new Schema(this.id, {
      kind: "Resolved",
      path: this.state.path,
      schema: schemaData
    });
  }

  /**
   * Marks the schema as failed with an error.
   */
  markAsFailed(error: Error): Schema {
    return new Schema(this.id, {
      kind: "Failed",
      path: this.state.path,
      error
    });
  }

  /**
   * Returns true if the schema has x-frontmatter-part directives.
   * This indicates that the schema contains extract-from directives.
   */
  hasExtractFromDirectives(): boolean {
    if (this.state.kind !== "Resolved") {
      return false;
    }

    const { schema } = this.state;
    return this.hasXFrontmatterPartInProperties(schema.properties);
  }

  /**
   * Recursively checks for x-frontmatter-part directives in properties.
   */
  private hasXFrontmatterPartInProperties(
    properties: Record<string, unknown> | undefined
  ): boolean {
    if (!properties) {
      return false;
    }

    for (const property of Object.values(properties)) {
      if (this.isPropertyWithDirective(property)) {
        return true;
      }

      // Check nested properties
      if (typeof property === "object" && property !== null) {
        const propObj = property as Record<string, unknown>;
        if (propObj.properties && this.hasXFrontmatterPartInProperties(propObj.properties as Record<string, unknown>)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a property object has x-frontmatter-part directive.
   */
  private isPropertyWithDirective(property: unknown): boolean {
    if (typeof property !== "object" || property === null) {
      return false;
    }

    const propObj = property as Record<string, unknown>;
    return propObj["x-frontmatter-part"] === true;
  }
}