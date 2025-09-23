import { assertEquals } from "jsr:@std/assert";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";

// Simple test to verify schema resolution issue vs fix
Deno.test("Schema Resolution Test - Issue #966 Verification", async () => {
  console.log("🔍 Testing schema resolution for Issue #966...");

  // Load the actual schema file with $ref
  const schemaContent = await Deno.readTextFile(
    "examples/3.docs/index_req_schema.json",
  );
  const schemaData = JSON.parse(schemaContent);

  console.log(
    "📋 Schema has $ref in req.items:",
    JSON.stringify(schemaData.properties.req.items, null, 2),
  );

  // Create schema WITHOUT resolution (this is the current problem)
  const pathResult = SchemaPath.create("examples/3.docs/index_req_schema.json");
  assertEquals(pathResult.ok, true);
  if (!pathResult.ok) return;

  const definitionResult = SchemaDefinition.create(schemaData);
  assertEquals(definitionResult.ok, true);
  if (!definitionResult.ok) return;

  const schemaResult = Schema.create(pathResult.data, definitionResult.data);
  assertEquals(schemaResult.ok, true);
  if (!schemaResult.ok) return;

  const schema = schemaResult.data;

  console.log(`📊 Schema isResolved(): ${schema.isResolved()}`);
  console.log(
    `🎯 Schema hasExtractFromDirectives(): ${schema.hasExtractFromDirectives()}`,
  );

  // This demonstrates the Issue #966 problem
  const directivesResult = schema.getExtractFromDirectives();
  console.log(`📋 getExtractFromDirectives() ok: ${directivesResult.ok}`);

  if (directivesResult.ok) {
    console.log(`✅ SUCCESS: Found ${directivesResult.data.length} directives`);
    console.log("✅ Issue #966 would be FIXED if schema was properly resolved");
  } else {
    console.log(`❌ ISSUE #966 CONFIRMED: ${directivesResult.error.message}`);
    console.log(
      "❌ Root cause: Schema is unresolved, $ref not available for directive traversal",
    );
  }

  // Key insight: The x-extract-from is in the main schema (req property)
  // but getExtractFromDirectives() fails when it tries to traverse the $ref
  console.log(
    "\n🎯 SOLUTION: Ensure schema is resolved before directive processing",
  );
  console.log("   - Schema coordinator should call resolve() properly");
  console.log(
    "   - All $ref references must be loaded before hasExtractFromDirectives()",
  );
});
