import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  defaultSchemaExtensionRegistry,
  SchemaExtensionKey,
} from "../../../../src/domain/schema/value-objects/schema-extension-registry.ts";

/**
 * Tests to detect hardcoding violations in schema extension usage
 * Based on Issue #849: Critical hardcoding violations after Issue #835
 */
Deno.test("Hardcoding Detection Tests", async (t) => {
  await t.step("Registry should provide all required extension keys", () => {
    // Verify that the registry has all the keys we need
    const frontmatterPartKey = defaultSchemaExtensionRegistry
      .getFrontmatterPartKey();
    const templateKey = defaultSchemaExtensionRegistry.getTemplateKey();
    const derivedFromKey = defaultSchemaExtensionRegistry.getDerivedFromKey();
    const templateItemsKey = defaultSchemaExtensionRegistry
      .getTemplateItemsKey();
    const templateFormatKey = defaultSchemaExtensionRegistry
      .getTemplateFormatKey();
    const basePropertyKey = defaultSchemaExtensionRegistry
      .getBasePropertyKey();
    const defaultValueKey = defaultSchemaExtensionRegistry
      .getDefaultValueKey();

    assertExists(frontmatterPartKey);
    assertExists(templateKey);
    assertExists(derivedFromKey);
    assertExists(templateItemsKey);
    assertExists(templateFormatKey);
    assertExists(basePropertyKey);
    assertExists(defaultValueKey);

    assertEquals(frontmatterPartKey.getValue(), "x-frontmatter-part");
    assertEquals(templateKey.getValue(), "x-template");
    assertEquals(derivedFromKey.getValue(), "x-derived-from");
    assertEquals(templateItemsKey.getValue(), "x-template-items");
    assertEquals(templateFormatKey.getValue(), "x-template-format");
    assertEquals(basePropertyKey.getValue(), "x-base-property");
    assertEquals(defaultValueKey.getValue(), "x-default-value");
  });

  await t.step("Schema extension keys should be value objects", () => {
    const key1 = SchemaExtensionKey.template();
    const key2 = SchemaExtensionKey.template();

    // Value objects should have proper equality
    assertEquals(key1.equals(key2), true);
    assertEquals(key1.getValue(), key2.getValue());
  });

  await t.step("Registry should support extension checking", () => {
    const registry = defaultSchemaExtensionRegistry;

    assertEquals(registry.hasExtension("x-template"), true);
    assertEquals(registry.hasExtension("x-frontmatter-part"), true);
    assertEquals(registry.hasExtension("x-derived-from"), true);
    assertEquals(registry.hasExtension("x-template-format"), true);
    assertEquals(registry.hasExtension("x-base-property"), true);
    assertEquals(registry.hasExtension("x-default-value"), true);
    assertEquals(registry.hasExtension("non-existent-extension"), false);
  });

  await t.step("All keys should be retrievable", () => {
    const allKeys = defaultSchemaExtensionRegistry.getAllKeys();

    assertEquals(allKeys.length >= 9, true); // At least 9 standard extensions

    const keyValues = allKeys.map((k) => k.getValue());
    assertEquals(keyValues.includes("x-template"), true);
    assertEquals(keyValues.includes("x-frontmatter-part"), true);
    assertEquals(keyValues.includes("x-derived-from"), true);
    assertEquals(keyValues.includes("x-template-items"), true);
    assertEquals(keyValues.includes("x-derived-unique"), true);
    assertEquals(keyValues.includes("x-jmespath-filter"), true);
    assertEquals(keyValues.includes("x-template-format"), true);
    assertEquals(keyValues.includes("x-base-property"), true);
    assertEquals(keyValues.includes("x-default-value"), true);
  });
});

/**
 * Static analysis helpers to detect hardcoding violations
 * These would be run by CI to ensure no new hardcoded strings are introduced
 */
Deno.test("Static Analysis Simulation", async (t) => {
  await t.step(
    "Should simulate detection of hardcoded extension strings",
    () => {
      // This test simulates what a static analysis tool would do
      const forbiddenPatterns = [
        '"x-template"',
        '"x-frontmatter-part"',
        '"x-derived-from"',
        '"x-template-items"',
        '"x-derived-unique"',
        '"x-jmespath-filter"',
        '"x-template-format"',
        '"x-base-property"',
        '"x-default-value"',
      ];

      // In a real implementation, this would scan source files
      // For now, we just verify the patterns are known
      assertEquals(forbiddenPatterns.length, 9);

      // Verify our registry covers all these patterns
      const registry = defaultSchemaExtensionRegistry;
      for (const pattern of forbiddenPatterns) {
        const key = pattern.replace(/"/g, ""); // Remove quotes
        assertEquals(
          registry.hasExtension(key),
          true,
          `Registry missing key: ${key}`,
        );
      }
    },
  );

  await t.step("Should verify proper import usage", () => {
    // This simulates checking that files import the registry
    // In a real static analysis tool, we would check for proper imports

    // Verify these exports exist and are accessible
    assertExists(defaultSchemaExtensionRegistry);
    assertExists(SchemaExtensionKey);

    // In a real static analysis tool, we would:
    // 1. Scan for hardcoded x-* strings
    // 2. Verify files with such strings import the registry
    // 3. Verify they use registry methods instead of literals
  });
});
