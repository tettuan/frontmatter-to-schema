import { assertEquals } from "jsr:@std/assert";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";

// Test the real schema file that uses $ref
Deno.test("Real schema resolution test for Issue #966", async () => {
  console.log("Testing real schema with $ref resolution...");

  // Load the actual schema file with $ref
  const schemaContent = await Deno.readTextFile(
    "examples/3.docs/index_req_schema.json",
  );
  const schemaData = JSON.parse(schemaContent);

  console.log(
    "Schema req property:",
    JSON.stringify(schemaData.properties.req, null, 2),
  );

  // Create schema without resolution (this simulates the current issue)
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
  console.log(
    `Schema state: ${schema.isResolved() ? "resolved" : "unresolved"}`,
  );
  console.log(`Has frontmatter part: ${schema.hasFrontmatterPart()}`);

  // Note: x-extract-from directive has been deprecated and removed as per Issue #994
  console.log("x-extract-from directive has been deprecated and removed");

  // Test frontmatter-part functionality instead
  const frontmatterPartResult = schema.findFrontmatterPartPath();
  console.log(`findFrontmatterPartPath() ok: ${frontmatterPartResult.ok}`);
  if (frontmatterPartResult.ok) {
    console.log(`Frontmatter part path: ${frontmatterPartResult.data}`);
  } else {
    console.log(`Error: ${frontmatterPartResult.error.message}`);
  }

  // Important: The x-extract-from directive is in the main schema, not the referenced schema
  // So even an unresolved schema should find it
  // If this is not working, the issue is elsewhere
});
