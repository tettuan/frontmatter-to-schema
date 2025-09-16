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
   * Smart Constructor for template-format extension key
   */
  static templateFormat(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-template-format");
  }

  /**
   * Smart Constructor for base-property extension key
   */
  static baseProperty(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-base-property");
  }

  /**
   * Smart Constructor for default-value extension key
   */
  static defaultValue(): SchemaExtensionKey {
    return new SchemaExtensionKey("x-default-value");
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
 * Following Totality principles - uses direct property access instead of Map lookups.
 */
export class SchemaExtensionRegistry {
  private constructor(
    private readonly frontmatterPartKey: SchemaExtensionKey,
    private readonly templateKey: SchemaExtensionKey,
    private readonly templateItemsKey: SchemaExtensionKey,
    private readonly derivedFromKey: SchemaExtensionKey,
    private readonly derivedUniqueKey: SchemaExtensionKey,
    private readonly jmespathFilterKey: SchemaExtensionKey,
    private readonly templateFormatKey: SchemaExtensionKey,
    private readonly basePropertyKey: SchemaExtensionKey,
    private readonly defaultValueKey: SchemaExtensionKey,
  ) {}

  /**
   * Smart Constructor for Schema Extension Registry
   * Following Totality principle - creates registry with all standard extensions
   */
  static create(): SchemaExtensionRegistry {
    return new SchemaExtensionRegistry(
      SchemaExtensionKey.frontmatterPart(),
      SchemaExtensionKey.template(),
      SchemaExtensionKey.templateItems(),
      SchemaExtensionKey.derivedFrom(),
      SchemaExtensionKey.derivedUnique(),
      SchemaExtensionKey.jmespathFilter(),
      SchemaExtensionKey.templateFormat(),
      SchemaExtensionKey.baseProperty(),
      SchemaExtensionKey.defaultValue(),
    );
  }

  /**
   * Get frontmatter-part extension key
   */
  getFrontmatterPartKey(): SchemaExtensionKey {
    return this.frontmatterPartKey;
  }

  /**
   * Get template extension key
   */
  getTemplateKey(): SchemaExtensionKey {
    return this.templateKey;
  }

  /**
   * Get template-items extension key
   */
  getTemplateItemsKey(): SchemaExtensionKey {
    return this.templateItemsKey;
  }

  /**
   * Get derived-from extension key
   */
  getDerivedFromKey(): SchemaExtensionKey {
    return this.derivedFromKey;
  }

  /**
   * Get derived-unique extension key
   */
  getDerivedUniqueKey(): SchemaExtensionKey {
    return this.derivedUniqueKey;
  }

  /**
   * Get jmespath-filter extension key
   */
  getJmespathFilterKey(): SchemaExtensionKey {
    return this.jmespathFilterKey;
  }

  /**
   * Get template-format extension key
   */
  getTemplateFormatKey(): SchemaExtensionKey {
    return this.templateFormatKey;
  }

  /**
   * Get base-property extension key
   */
  getBasePropertyKey(): SchemaExtensionKey {
    return this.basePropertyKey;
  }

  /**
   * Get default-value extension key
   */
  getDefaultValueKey(): SchemaExtensionKey {
    return this.defaultValueKey;
  }

  /**
   * Get all registered extension keys
   */
  getAllKeys(): SchemaExtensionKey[] {
    return [
      this.frontmatterPartKey,
      this.templateKey,
      this.templateItemsKey,
      this.derivedFromKey,
      this.derivedUniqueKey,
      this.jmespathFilterKey,
      this.templateFormatKey,
      this.basePropertyKey,
      this.defaultValueKey,
    ];
  }

  /**
   * Check if an extension key is registered
   */
  hasExtension(key: string): boolean {
    return this.getAllKeys().some((ext) => ext.getValue() === key);
  }
}

/**
 * Default registry instance for use across the application.
 * Follows the pattern of having a shared registry for consistency.
 */
export const defaultSchemaExtensionRegistry: SchemaExtensionRegistry =
  SchemaExtensionRegistry.create();
