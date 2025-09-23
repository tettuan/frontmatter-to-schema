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
      const hasDirectives = schema.hasExtractFromDirectives();
      console.log(`🎯 Has extract-from directives: ${hasDirectives}`);

      if (hasDirectives) {
        const directivesResult = schema.getExtractFromDirectives();
        console.log(`📋 getExtractFromDirectives() ok: ${directivesResult.ok}`);
        if (directivesResult.ok) {
          console.log(`📈 Directives count: ${directivesResult.data.length}`);
          directivesResult.data.forEach((directive, i) => {
            console.log(
              `   ${
                i + 1
              }. ${directive.getTargetPath()} <- ${directive.getSourcePath()}`,
            );
          });
          console.log(
            "✅ Issue #966 FIX VERIFIED: Schema resolution and directive processing working!",
          );
        } else {
          console.log(
            `❌ getExtractFromDirectives() error: ${directivesResult.error.message}`,
          );
          console.log("❌ Issue #966 still exists: Schema resolution failed");
        }
      } else {
        console.log(
          "❌ Issue #966 still exists: No extract-from directives detected",
        );
      }
    } catch (error) {
      console.error(
        "❌ Error during directive processing:",
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
