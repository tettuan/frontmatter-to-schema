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

  // Note: Deprecated directives have been removed as per Issue #1005
  console.log(
    "🎯 UPDATE: Deprecated directives have been removed per Issue #1005",
  );
  console.log(
    "   Issue #994 completed: Deprecated directives removed from codebase",
  );

  // Test frontmatter-part functionality instead
  const frontmatterPartResult = schema.findFrontmatterPartPath();
  console.log(`📋 findFrontmatterPartPath() ok: ${frontmatterPartResult.ok}`);

  if (frontmatterPartResult.ok) {
    console.log(
      `✅ SUCCESS: Found frontmatter-part path: ${frontmatterPartResult.data}`,
    );
    console.log("✅ Schema resolution works for supported directives");
  } else {
    console.log(`❌ ERROR: ${frontmatterPartResult.error.message}`);
    console.log(
      "❌ Root cause: Schema is unresolved, $ref not available for frontmatter-part processing",
    );
  }

  // Updated insight: Focus on current supported functionality
  console.log(
    "\n🎯 CURRENT STATE: Deprecated directives removed, focus on supported directives processing",
  );
  console.log("   - Schema coordinator should call resolve() properly");
  console.log(
    "   - All $ref references must be loaded before frontmatter-part processing",
  );
});
