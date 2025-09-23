import { SchemaCoordinator } from "../../src/application/coordinators/schema-coordinator.ts";
import { FileSystemSchemaRepository } from "../../src/infrastructure/adapters/schema-loader.ts";
import { DenoFileReader } from "../../src/infrastructure/file-system/file-reader.ts";
import { SchemaCache } from "../../src/infrastructure/caching/schema-cache.ts";

// Test to verify schema resolution fix for Issue #966
async function testSchemaResolutionFix() {
  console.log("Testing schema resolution fix for Issue #966...");

  try {
    // Create dependencies
    const fileReader = new DenoFileReader();
    const schemaRepository = new FileSystemSchemaRepository(fileReader);
    const schemaCache = new SchemaCache();

    const coordinator = new SchemaCoordinator(schemaRepository, schemaCache);

    // Load the actual problematic schema that uses $ref
    const schemaPath = "examples/3.docs/index_req_schema.json";
    console.log(`Loading schema: ${schemaPath}`);

    const result = await coordinator.loadSchema(schemaPath);
    if (!result.ok) {
      console.error("❌ Failed to load schema:", result.error.message);
      return;
    }

    const schema = result.data;
    console.log(`✅ Schema loaded successfully`);
    console.log(
      `📊 Schema state: ${schema.isResolved() ? "resolved" : "unresolved"}`,
    );
    console.log(`🔍 Has frontmatter part: ${schema.hasFrontmatterPart()}`);

    try {
      // Note: x-extract-from directive has been deprecated and removed as per Issue #994
      console.log(
        "🎯 UPDATE: x-extract-from directive has been deprecated and removed",
      );
      console.log(
        "   Issue #994 completed: Deprecated directives removed from codebase",
      );

      // Test frontmatter-part functionality instead
      const frontmatterPartResult = schema.findFrontmatterPartPath();
      console.log(
        `📋 findFrontmatterPartPath() ok: ${frontmatterPartResult.ok}`,
      );

      if (frontmatterPartResult.ok) {
        console.log(`📈 Frontmatter-part path: ${frontmatterPartResult.data}`);
        console.log(
          "✅ Schema resolution and frontmatter-part processing working!",
        );
      } else {
        console.log(
          `❌ findFrontmatterPartPath() error: ${frontmatterPartResult.error.message}`,
        );
        console.log("❌ Schema resolution failed for frontmatter-part");
      }
    } catch (error) {
      console.error(
        "❌ Error during schema processing:",
        error instanceof Error ? error.message : String(error),
      );
    }
  } catch (error) {
    console.error(
      "❌ Critical error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (import.meta.main) {
  testSchemaResolutionFix();
}
