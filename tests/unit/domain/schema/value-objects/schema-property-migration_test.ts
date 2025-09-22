import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assert, assertEquals } from "jsr:@std/assert@^1.0.7";
import {
  LegacySchemaProperty,
  SchemaPropertyMigration,
  SchemaPropertyLegacyAdapter,
} from "../../../../../src/domain/schema/value-objects/schema-property-migration.ts";
import { defaultSchemaExtensionRegistry } from "../../../../../src/domain/schema/value-objects/schema-extension-registry.ts";
import {
  SchemaPropertyFactory,
  SchemaPropertyUtils,
} from "../../../../../src/domain/schema/value-objects/schema-property-types.ts";

describe("SchemaPropertyMigration", () => {
  it("preserves x-extract-from and x-merge-arrays extensions", () => {
    const legacy: LegacySchemaProperty = {
      type: "array",
      items: { type: "string" },
      "x-extract-from": "traceability[]",
      "x-merge-arrays": true,
    };

    const migrationResult = SchemaPropertyMigration.migrate(legacy);
    assert(migrationResult.ok, migrationResult.ok ? undefined : migrationResult.error.message);
    if (!migrationResult.ok) return;

    const migrated = migrationResult.data;
    const registry = defaultSchemaExtensionRegistry;
    const extractKey = registry.getExtractFromKey().getValue();
    const mergeKey = registry.getMergeArraysKey().getValue();

    assertEquals(migrated.extensions?.[extractKey], "traceability[]");
    assertEquals(migrated.extensions?.[mergeKey], true);

    assert(SchemaPropertyUtils.hasExtractFrom(migrated));
    const extractValue = SchemaPropertyUtils.getExtractFrom(migrated);
    assert(extractValue.ok, extractValue.ok ? undefined : extractValue.error.message);
    if (extractValue.ok) {
      assertEquals(extractValue.data, "traceability[]");
    }

    assert(SchemaPropertyUtils.hasMergeArrays(migrated));
    const mergeValue = SchemaPropertyUtils.getMergeArrays(migrated);
    assert(mergeValue.ok, mergeValue.ok ? undefined : mergeValue.error.message);
    if (mergeValue.ok) {
      assertEquals(mergeValue.data, true);
    }
  });
});

describe("SchemaPropertyLegacyAdapter", () => {
  it("round-trips extract and merge directives", () => {
    const registry = defaultSchemaExtensionRegistry;
    const extractKey = registry.getExtractFromKey().getValue();
    const mergeKey = registry.getMergeArraysKey().getValue();

    const property = SchemaPropertyFactory.createArray(
      SchemaPropertyFactory.createString(),
      undefined,
      {
        [extractKey]: "source.path",
        [mergeKey]: true,
      },
    );

    const legacy = SchemaPropertyLegacyAdapter.toLegacy(property);

    assertEquals(legacy["x-extract-from"], "source.path");
    assertEquals(legacy["x-merge-arrays"], true);
  });
});
