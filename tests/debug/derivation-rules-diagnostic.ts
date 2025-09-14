/**
 * Diagnostic test for derivation rules processing
 */

import { FileSystemSchemaRepository } from "../../src/infrastructure/index.ts";

Deno.test({
  name: "DIAGNOSTIC - Derivation Rules Analysis",
  fn: () => {
    const schemaRepository = new FileSystemSchemaRepository();

    // Load production schema
    const schemaPath = {
      toString: () => "./examples/climpt-registry/schema.json",
    } as any;

    const schemaResult = schemaRepository.load(schemaPath);

    if (schemaResult.ok) {
      const schema = schemaResult.data;
      console.log("=== DERIVATION RULES DIAGNOSTIC ===");

      // Check derivation rules
      const derivationRules = schema.getDerivedRules();
      console.log("Derivation rules count:", derivationRules.length);

      if (derivationRules.length > 0) {
        console.log("Derivation rules details:");
        derivationRules.forEach((rule, index) => {
          console.log(`  Rule ${index}:`, {
            sourcePath: rule.sourcePath,
            targetField: rule.targetField,
            unique: rule.unique,
          });
        });
      }

      // Check frontmatter part schema
      const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
      console.log(
        "\\nFrontmatter part schema:",
        frontmatterPartSchemaResult.ok ? "FOUND" : "NOT FOUND",
      );

      if (frontmatterPartSchemaResult.ok) {
        console.log("Frontmatter part schema details:");
        const rawSchema = frontmatterPartSchemaResult.data.getRawSchema();
        console.log("  Raw schema:", JSON.stringify(rawSchema, null, 2));
        console.log(
          "  Has frontmatter part:",
          frontmatterPartSchemaResult.data.hasFrontmatterPart(),
        );
      }

      // Check raw schema structure
      const rawSchema = schema.getDefinition().getRawSchema();
      console.log("\\n=== RAW SCHEMA ANALYSIS ===");
      console.log("Root properties:");

      if (rawSchema.kind === "object") {
        for (const [key, value] of Object.entries(rawSchema.properties)) {
          console.log(`  ${key}: ${typeof value}`);
          if (typeof value === "object" && value !== null) {
            if ("x-derived-from" in value) {
              console.log(
                `    -> Has x-derived-from: ${value["x-derived-from"]}`,
              );
            }
            if ("x-frontmatter-part" in value) {
              console.log(
                `    -> Has x-frontmatter-part: ${value["x-frontmatter-part"]}`,
              );
            }
            // Check nested properties
            if ("properties" in value && value.properties) {
              console.log(`    -> Nested properties:`);
              for (
                const [nestedKey, nestedValue] of Object.entries(
                  value.properties as Record<string, unknown>,
                )
              ) {
                console.log(`      ${nestedKey}: ${typeof nestedValue}`);
                if (typeof nestedValue === "object" && nestedValue !== null) {
                  if ("x-derived-from" in nestedValue) {
                    console.log(
                      `        -> Has x-derived-from: ${
                        nestedValue["x-derived-from"]
                      }`,
                    );
                  }
                  if ("x-frontmatter-part" in nestedValue) {
                    console.log(
                      `        -> Has x-frontmatter-part: ${
                        nestedValue["x-frontmatter-part"]
                      }`,
                    );
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log("Failed to load schema:", schemaResult.error);
    }
  },
});
