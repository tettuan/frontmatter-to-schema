import { assertEquals } from "@std/assert";
import { ProcessCoordinator } from "../../../../src/application/coordinators/process-coordinator.ts";
import { ok } from "../../../../src/domain/shared/types/result.ts";

// Simple mocks focusing on successful cases
class SimpleMockSchemaRepository {
  load() { return ok({} as any); }
  resolve(schema: any) { return ok(schema); }
}

class SimpleMockFrontmatterProcessor {
  process() { return ok({}); }
}

class SimpleMockTemplateRenderer {
  render() { return ok('{"test": true}'); }
  renderWithArray() { return ok('[]'); }
}

class SimpleMockAggregator {
  aggregate() { return ok([]); }
}

class SimpleMockFileReader {
  read() { return ok("template content"); }
}

class SimpleMockFileWriter {
  write() { return ok(undefined); }
}

class SimpleMockFileLister {
  list() { return ok(["test.md"]); }
}

Deno.test("ProcessCoordinator - should create and delegate successfully", () => {
  // Arrange: Create simple mocks that always succeed
  const schemaRepo = new SimpleMockSchemaRepository() as any;
  const frontmatterProcessor = new SimpleMockFrontmatterProcessor() as any;
  const templateRenderer = new SimpleMockTemplateRenderer() as any;
  const aggregator = new SimpleMockAggregator() as any;
  const fileReader = new SimpleMockFileReader() as any;
  const fileWriter = new SimpleMockFileWriter() as any;
  const fileLister = new SimpleMockFileLister() as any;

  const coordinator = new ProcessCoordinator(
    schemaRepo,
    frontmatterProcessor,
    templateRenderer,
    aggregator,
    fileReader,
    fileWriter,
    fileLister,
  );

  // Act: Call processDocuments
  const result = coordinator.processDocuments(
    "schema.json",
    "output.json",
    "**/*.md"
  );

  // Assert: Should delegate successfully
  assertEquals(result.ok, true);
});

Deno.test("ProcessCoordinator - should have processDocuments method", () => {
  // Arrange: Create coordinator with simple mocks
  const coordinator = new ProcessCoordinator(
    new SimpleMockSchemaRepository() as any,
    new SimpleMockFrontmatterProcessor() as any,
    new SimpleMockTemplateRenderer() as any,
    new SimpleMockAggregator() as any,
    new SimpleMockFileReader() as any,
    new SimpleMockFileWriter() as any,
    new SimpleMockFileLister() as any,
  );

  // Assert: Should have the expected method
  assertEquals(typeof coordinator.processDocuments, "function");
});

Deno.test("ProcessCoordinator - should accept correct parameter types", () => {
  // This test just verifies that the constructor accepts the right types
  // and doesn't crash during instantiation

  // Arrange & Act
  const coordinator = new ProcessCoordinator(
    new SimpleMockSchemaRepository() as any,
    new SimpleMockFrontmatterProcessor() as any,
    new SimpleMockTemplateRenderer() as any,
    new SimpleMockAggregator() as any,
    new SimpleMockFileReader() as any,
    new SimpleMockFileWriter() as any,
    new SimpleMockFileLister() as any,
  );

  // Assert
  assertEquals(typeof coordinator, "object");
  assertEquals(coordinator.constructor.name, "ProcessCoordinator");
});