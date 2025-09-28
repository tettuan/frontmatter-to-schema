import { ensureDir } from "jsr:@std/fs";
import { join } from "@std/path";

/**
 * Test utilities and helpers for consistent test setup and teardown
 * Provides reusable functions for file system operations and test data creation
 */

export interface TestEnvironment {
  testDir: string;
  fixturesDir: string;
}

export interface TestSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

export interface TestTemplate {
  output: Record<string, unknown>;
}

export interface TestDocument {
  frontmatter: Record<string, unknown>;
  content: string;
}

/**
 * Creates a test environment with temporary directories
 */
export async function createTestEnvironment(
  testName: string,
): Promise<TestEnvironment> {
  const testDir = `./tmp/test-${testName}`;
  const fixturesDir = join(testDir, "fixtures");

  await ensureDir(testDir);
  await ensureDir(fixturesDir);

  return { testDir, fixturesDir };
}

/**
 * Cleans up a test environment by removing directories
 */
export async function cleanupTestEnvironment(
  env: TestEnvironment,
): Promise<void> {
  try {
    await Deno.remove(env.testDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Creates a default test schema
 */
export function createDefaultSchema(): TestSchema {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      published: { type: "boolean" },
      date: { type: "string", format: "date" },
      category: { type: "string" },
    },
    required: ["title", "author"],
  };
}

/**
 * Creates a default test template
 */
export function createDefaultTemplate(): TestTemplate {
  return {
    output: {
      title: "${title}",
      author: "${author}",
      metadata: {
        tags: "${tags}",
        published: "${published}",
        category: "${category}",
      },
      timestamp: "${date}",
    },
  };
}

/**
 * Creates a test document with frontmatter and content
 */
export function createTestDocument(
  frontmatter: Record<string, unknown>,
  content: string = "# Test Content\n\nThis is test content.",
): string {
  const frontmatterYaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}: "${value}"`;
      } else if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
      } else {
        return `${key}: ${value}`;
      }
    })
    .join("\n");

  return `---\n${frontmatterYaml}\n---\n\n${content}`;
}

/**
 * Writes a schema file to the specified path
 */
export async function writeSchemaFile(
  path: string,
  schema: TestSchema,
): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(schema, null, 2));
}

/**
 * Writes a template file to the specified path
 */
export async function writeTemplateFile(
  path: string,
  template: TestTemplate,
): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(template, null, 2));
}

/**
 * Writes a markdown document to the specified path
 */
export async function writeDocumentFile(
  path: string,
  document: string,
): Promise<void> {
  await Deno.writeTextFile(path, document);
}

/**
 * Creates a complete test setup with schema, template, and document files
 */
export async function setupCompleteTestEnvironment(
  env: TestEnvironment,
  options: {
    schema?: TestSchema;
    template?: TestTemplate;
    documents?: Array<{ name: string; content: string }>;
  } = {},
): Promise<{
  schemaPath: string;
  templatePath: string;
  documentPaths: string[];
}> {
  const schema = options.schema || createDefaultSchema();
  const template = options.template || createDefaultTemplate();
  const documents = options.documents || [
    {
      name: "test-document.md",
      content: createTestDocument({
        title: "Test Document",
        author: "Test Author",
        tags: ["test", "document"],
        published: true,
        date: "2023-01-01",
        category: "test",
      }),
    },
  ];

  // Write schema and template files
  const schemaPath = join(env.fixturesDir, "schema.json");
  const templatePath = join(env.fixturesDir, "template.json");

  await writeSchemaFile(schemaPath, schema);
  await writeTemplateFile(templatePath, template);

  // Write document files
  const documentPaths: string[] = [];
  for (const doc of documents) {
    const docPath = join(env.fixturesDir, doc.name);
    await writeDocumentFile(docPath, doc.content);
    documentPaths.push(docPath);
  }

  return { schemaPath, templatePath, documentPaths };
}

/**
 * Creates test documents with various frontmatter scenarios
 */
export function createTestDocumentVariations(): Array<
  { name: string; content: string }
> {
  return [
    {
      name: "simple-document.md",
      content: createTestDocument({
        title: "Simple Document",
        author: "Simple Author",
      }),
    },
    {
      name: "complex-document.md",
      content: createTestDocument(
        {
          title: "Complex Document",
          author: "Complex Author",
          tags: ["complex", "test", "frontmatter"],
          published: true,
          date: "2023-06-15",
          category: "technical",
        },
        "# Complex Document\n\nThis document has complex frontmatter.\n\n## Features\n\n- Multiple properties\n- Array values\n- Boolean values",
      ),
    },
    {
      name: "minimal-document.md",
      content: createTestDocument({
        title: "Minimal Document",
        author: "Minimal Author",
      }, "# Minimal\n\nMinimal content."),
    },
    {
      name: "no-frontmatter.md",
      content: "# No Frontmatter\n\nThis document has no frontmatter block.",
    },
  ];
}

/**
 * Creates an invalid schema for error testing
 */
export function createInvalidSchema(): string {
  return "{ invalid json syntax";
}

/**
 * Creates an invalid template for error testing
 */
export function createInvalidTemplate(): string {
  return "{ invalid template json";
}

/**
 * Reads and parses a JSON output file
 */
export async function readOutputFile(path: string): Promise<unknown> {
  const content = await Deno.readTextFile(path);
  return JSON.parse(content);
}

/**
 * Checks if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory with multiple test documents
 */
export async function createDocumentDirectory(
  env: TestEnvironment,
  directoryName: string,
  documents: Array<{ name: string; content: string }>,
): Promise<string> {
  const dirPath = join(env.fixturesDir, directoryName);
  await ensureDir(dirPath);

  for (const doc of documents) {
    const docPath = join(dirPath, doc.name);
    await writeDocumentFile(docPath, doc.content);
  }

  return dirPath;
}

/**
 * Performance measurement utility for test timing
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; executionTime: number }> {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();
  const executionTime = endTime - startTime;

  return { result, executionTime };
}

/**
 * Validates that a result follows the totality principle (Result<T, E> pattern)
 */
export function validateTotalityResult(result: unknown): boolean {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const resultObj = result as Record<string, unknown>;
  return (
    typeof resultObj.isOk === "function" &&
    typeof resultObj.isError === "function" &&
    typeof resultObj.unwrap === "function" &&
    typeof resultObj.unwrapError === "function"
  );
}

/**
 * Creates a test environment for concurrent operations
 */
export async function createConcurrentTestEnvironment(
  testName: string,
  instanceCount: number,
): Promise<TestEnvironment[]> {
  const environments: TestEnvironment[] = [];

  for (let i = 0; i < instanceCount; i++) {
    const env = await createTestEnvironment(`${testName}-${i}`);
    environments.push(env);
  }

  return environments;
}

/**
 * Cleans up multiple test environments
 */
export async function cleanupConcurrentTestEnvironments(
  environments: TestEnvironment[],
): Promise<void> {
  await Promise.all(
    environments.map((env) => cleanupTestEnvironment(env)),
  );
}
