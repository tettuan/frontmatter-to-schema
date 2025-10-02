import { assertEquals, assertExists } from "@std/assert";
import { TemplateSchemaCoordinator } from "../../../../src/application/services/template-schema-coordinator.ts";
import { SchemaTemplateResolver } from "../../../../src/domain/schema/services/schema-template-resolver.ts";
import { TemplateRenderer } from "../../../../src/domain/template/services/template-renderer.ts";
import {
  Schema,
  SchemaId,
} from "../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../src/domain/schema/value-objects/schema-path.ts";
import { FrontmatterData } from "../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Result } from "../../../../src/domain/shared/types/result.ts";
import { FileSystemPort } from "../../../../src/infrastructure/ports/file-system-port.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../../../src/domain/shared/types/file-errors.ts";

// Mock FileSystemPort
class MockFileSystem implements FileSystemPort {
  private files: Map<string, string> = new Map();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  readTextFile(path: string): Promise<Result<string, FileError>> {
    const content = this.files.get(path);
    if (!content) {
      return Promise.resolve(Result.error({
        kind: "FileNotFound",
        path,
      }));
    }
    return Promise.resolve(Result.ok(content));
  }

  writeTextFile(
    _path: string,
    _content: string,
  ): Promise<Result<void, FileError>> {
    return Promise.resolve(Result.ok(undefined));
  }

  stat(_path: string): Promise<Result<FileInfo, FileError>> {
    return Promise.resolve(Result.ok({
      isFile: true,
      isDirectory: false,
      size: 0,
      mtime: null,
    }));
  }

  exists(_path: string): Promise<Result<boolean, FileError>> {
    return Promise.resolve(Result.ok(true));
  }

  readDir(_path: string): Promise<Result<DirectoryEntry[], FileError>> {
    return Promise.resolve(Result.ok([]));
  }
}

Deno.test("TemplateSchemaCoordinator - processes with schema templates successfully", async () => {
  const mockFileSystem = new MockFileSystem();

  // Create real template file for json-template
  const templatePath =
    `${Deno.cwd()}/tmp/test-templates/coordinator-container.json`;
  try {
    Deno.mkdirSync("tmp/test-templates", { recursive: true });
  } catch {
    // Directory may already exist
  }
  Deno.writeTextFileSync(
    templatePath,
    JSON.stringify(
      {
        type: "template",
        content: "Title: {title}",
      },
      null,
      2,
    ),
  );

  // Setup mock template files
  mockFileSystem.setFile(
    templatePath,
    JSON.stringify({
      type: "template",
      content: "Title: {title}",
    }),
  );

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  // Create schema with x-template (use a schema path with directory)
  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("schemas/test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
    "x-template": templatePath, // Use absolute path
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  // Create frontmatter data
  const frontmatterDataResult = FrontmatterData.create({ title: "Test Title" });
  const frontmatterData = frontmatterDataResult.unwrap();

  // Process
  const result = await coordinator.processWithSchemaTemplates(schema, [
    frontmatterData,
  ]);

  assertEquals(result.isOk(), true);
  const output = result.unwrap();
  assertExists(output.content);
  assertEquals(output.metadata.templateUsed, templatePath);
  assertEquals(output.metadata.itemCount, 1);
});

Deno.test("TemplateSchemaCoordinator - handles missing container template", async () => {
  const mockFileSystem = new MockFileSystem();

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  // Create schema with x-template pointing to non-existent file
  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
    "x-template": "missing.json",
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  const frontmatterDataResult = FrontmatterData.create({ title: "Test" });
  const frontmatterData = frontmatterDataResult.unwrap();

  const result = await coordinator.processWithSchemaTemplates(schema, [
    frontmatterData,
  ]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "CONTAINER_TEMPLATE_LOAD_ERROR");
});

Deno.test("TemplateSchemaCoordinator - handles invalid template JSON", async () => {
  const mockFileSystem = new MockFileSystem();

  // Setup invalid JSON template
  mockFileSystem.setFile("invalid.json", "{ invalid json }");

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
    "x-template": "invalid.json",
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  const frontmatterDataResult = FrontmatterData.create({ title: "Test" });
  const frontmatterData = frontmatterDataResult.unwrap();

  const result = await coordinator.processWithSchemaTemplates(schema, [
    frontmatterData,
  ]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "CONTAINER_TEMPLATE_LOAD_ERROR");
});

Deno.test("TemplateSchemaCoordinator - processes with items template", async () => {
  const mockFileSystem = new MockFileSystem();

  // Create real template files for json-template
  const containerPath =
    `${Deno.cwd()}/tmp/test-templates/coordinator-container-items.json`;
  const itemsPath = `${Deno.cwd()}/tmp/test-templates/coordinator-items.json`;

  try {
    Deno.mkdirSync("tmp/test-templates", { recursive: true });
  } catch {
    // Directory may already exist
  }

  Deno.writeTextFileSync(
    containerPath,
    JSON.stringify(
      {
        type: "template",
        content: "Documents: {@items}",
      },
      null,
      2,
    ),
  );

  Deno.writeTextFileSync(
    itemsPath,
    JSON.stringify(
      {
        type: "template",
        content: "- {title}",
      },
      null,
      2,
    ),
  );

  mockFileSystem.setFile(
    containerPath,
    JSON.stringify({
      type: "template",
      content: "Documents: {@items}",
    }),
  );
  mockFileSystem.setFile(
    itemsPath,
    JSON.stringify({
      type: "template",
      content: "- {title}",
    }),
  );

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("schemas/test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
    "x-template": containerPath, // Use absolute path
    "x-template-items": itemsPath, // Use absolute path
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  const data1 = FrontmatterData.create({ title: "Item 1" }).unwrap();
  const data2 = FrontmatterData.create({ title: "Item 2" }).unwrap();

  const result = await coordinator.processWithSchemaTemplates(schema, [
    data1,
    data2,
  ]);

  assertEquals(result.isOk(), true);
  const output = result.unwrap();
  assertEquals(output.metadata.templateUsed, containerPath);
  assertEquals(output.metadata.itemsTemplateUsed, itemsPath);
  assertEquals(output.metadata.itemCount, 2);
});

Deno.test("TemplateSchemaCoordinator - handles missing items template", async () => {
  const mockFileSystem = new MockFileSystem();

  // Create real container template file
  const containerPath =
    `${Deno.cwd()}/tmp/test-templates/coordinator-container-missing-items.json`;
  try {
    Deno.mkdirSync("tmp/test-templates", { recursive: true });
  } catch {
    // Directory may already exist
  }

  Deno.writeTextFileSync(
    containerPath,
    JSON.stringify(
      {
        type: "template",
        content: "Documents",
      },
      null,
      2,
    ),
  );

  mockFileSystem.setFile(
    containerPath,
    JSON.stringify({
      type: "template",
      content: "Documents",
    }),
  );

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("schemas/test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
    "x-template": containerPath, // Use absolute path
    "x-template-items": "missing_items.json", // This should fail
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  const data1 = FrontmatterData.create({ title: "Item 1" }).unwrap();

  const result = await coordinator.processWithSchemaTemplates(schema, [data1]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "ITEMS_TEMPLATE_LOAD_ERROR");
});

Deno.test("TemplateSchemaCoordinator - handles schema without x-template", async () => {
  const mockFileSystem = new MockFileSystem();

  const resolver = new SchemaTemplateResolver();
  const renderer = TemplateRenderer.create().unwrap();
  const coordinator = new TemplateSchemaCoordinator(
    renderer,
    resolver,
    mockFileSystem,
  );

  const schemaId = SchemaId.create("test_schema").unwrap();
  const schemaPath = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { title: { type: "string" } },
  };
  const schema = Schema.create(schemaId, schemaPath).markAsResolved(schemaData);

  const data = FrontmatterData.create({ title: "Test" }).unwrap();

  const result = await coordinator.processWithSchemaTemplates(schema, [data]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "TEMPLATE_CONTEXT_RESOLUTION_ERROR");
});
