/**
 * @fileoverview Schema Extension Registry - DDD Value Objects for Schema Extensions
 * @description Eliminates hardcoded schema extension strings following DDD and Totality principles
 *
 * This implements the solution for Issue #835: Hardcoding violation: x-frontmatter-part string literals
 * across codebase. Following totality.ja.md principles, this creates Smart Constructors and Value Objects
 * to replace hardcoded string literals with proper domain abstractions.
 */

/**
 * Value Object representing a schema extension key.
 * Following Totality principle - immutable value object with private constructor.
 */
export class SchemaExtensionKey {
  private constructor(private readonly value: string) {}

  /**
   * Smart Constructor for frontmatter-part extension key
   */
  static frontmatterPart(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-frontmatter-part");
  }

  /**
   * Smart Constructor for template extension key
   */
  static template(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-template");
  }

  /**
   * Smart Constructor for template-items extension key
   */
  static templateItems(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-template-items");
  }

  /**
   * Smart Constructor for derived-from extension key
   */
  static derivedFrom(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-derived-from");
  }

  /**
   * Smart Constructor for derived-unique extension key
   */
  static derivedUnique(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-derived-unique");
  }

  /**
   * Smart Constructor for jmespath-filter extension key
   */
  static jmespathFilter(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-jmespath-filter");
  }

  /**
   * Get the string value of the extension key
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Value equality check
   */
  equals(other: SchemaExtensionKey): boolean {
    return this.value === other.value;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return this.value;
  }
}

/**
 * Registry for schema extension keys following DDD patterns.
 * Provides a single source of truth for all schema extension definitions.
 */
export class SchemaExtensionRegistry {
  private constructor(
    private readonly extensions: Map<string, SchemaExtensionKey>,
  ) {}

  /**
   * Smart Constructor for Schema Extension Registry
   * Following Totality principle - creates registry with all standard extensions
   */
  static create(): SchemaExtensionRegistry {
    const extensions = new Map([
      ["frontmatter-part", SchemaExtensionKey.frontmatterPart()],
      ["template", SchemaExtensionKey.template()],
      ["template-items", SchemaExtensionKey.templateItems()],
      ["derived-from", SchemaExtensionKey.derivedFrom()],
      ["derived-unique", SchemaExtensionKey.derivedUnique()],
      ["jmespath-filter", SchemaExtensionKey.jmespathFilter()],
    ]);
    return new SchemaExtensionRegistry(extensions);
  }

  /**
   * Get frontmatter-part extension key
   */
  getFrontmatterPartKey(): SchemaExtensionKey {
    return this.extensions.get("frontmatter-part")!;
  }

  /**
   * Get template extension key
   */
  getTemplateKey(): SchemaExtensionKey {
    return this.extensions.get("template")!;
  }

  /**
   * Get template-items extension key
   */
  getTemplateItemsKey(): SchemaExtensionKey {
    return this.extensions.get("template-items")!;
  }

  /**
   * Get derived-from extension key
   */
  getDerivedFromKey(): SchemaExtensionKey {
    return this.extensions.get("derived-from")!;
  }

  /**
   * Get derived-unique extension key
   */
  getDerivedUniqueKey(): SchemaExtensionKey {
    return this.extensions.get("derived-unique")!;
  }

  /**
   * Get jmespath-filter extension key
   */
  getJmespathFilterKey(): SchemaExtensionKey {
    return this.extensions.get("jmespath-filter")!;
  }

  /**
   * Get all registered extension keys
   */
  getAllKeys(): SchemaExtensionKey[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Check if an extension key is registered
   */
  hasExtension(key: string): boolean {
    return Array.from(this.extensions.values()).some((ext) =>
      ext.getValue() === key
    );
  }
}

/**
 * Default registry instance for use across the application.
 * Follows the pattern of having a shared registry for consistency.
 */
export const defaultSchemaExtensionRegistry: SchemaExtensionRegistry =
  SchemaExtensionRegistry.create();
