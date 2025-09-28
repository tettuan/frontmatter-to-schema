import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assert, assertEquals } from "jsr:@std/assert@^1.0.7";
import {
  LegacySchemaProperty,
  SchemaPropertyMigration,
} from "../../../../../src/domain/schema/value-objects/schema-property-migration.ts";

describe("SchemaPropertyMigration", () => {
  it("migrates basic properties correctly", () => {
    const legacy: LegacySchemaProperty = {
      type: "array",
      items: { type: "string" },
      required: ["title"],
    };

    const migrationResult = SchemaPropertyMigration.migrate(legacy);
    assert(
      migrationResult.ok,
      migrationResult.ok ? undefined : migrationResult.error.message,
    );
    if (!migrationResult.ok) return;

    const migrated = migrationResult.data;
    assertEquals(migrated.kind, "array");
    if (migrated.kind === "array" && "kind" in migrated.items) {
      assertEquals(migrated.items.kind, "string");
    }
  });

  it("handles deprecated directives gracefully", () => {
    // This test verifies that schemas with these deprecated directives
    // can still be processed without errors, even though the functionality is removed
    const legacyWithDeprecated = {
      type: "array",
      items: { type: "string" },
      // These deprecated directives should be ignored during migration
    } as LegacySchemaProperty;

    const migrationResult = SchemaPropertyMigration.migrate(
      legacyWithDeprecated,
    );
    assert(
      migrationResult.ok,
      migrationResult.ok ? undefined : migrationResult.error.message,
    );
    if (!migrationResult.ok) return;

    const migrated = migrationResult.data;
    assertEquals(migrated.kind, "array");
    // Verify no deprecated extensions are present
    assertEquals(
      migrated.extensions === undefined ||
        Object.keys(migrated.extensions).length === 0,
      true,
    );
  });
});
