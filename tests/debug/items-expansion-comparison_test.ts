import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { assertEquals } from "@std/assert";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";

const logger = new BreakdownLogger("items-expansion-comparison");

/**
 * Comparison Test: Test items expansion with different example directories
 * to identify if the issue is specific to certain schemas or general
 */
Deno.test("items expansion comparison - multiple examples", async () => {
  logger.info("Starting comparison test across multiple examples");

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  // ========================================
  // Pattern 1: examples/1.articles (has {@items} directives)
  // ========================================
  logger.info("=== Pattern 1: examples/1.articles ===");

  const config1 = {
    schemaPath: "examples/1.articles/articles_schema.json",
    templatePath: "examples/1.articles/articles_template.json",
    inputPath: "examples/1.articles/docs",
    outputPath: "/tmp/test-articles-output.json",
    outputFormat: "json" as const,
  };

  logger.debug("Pattern 1 configuration", config1);

  const result1 = await orchestrator.execute(config1);

  logger.debug("Pattern 1 execution result", {
    isOk: result1.isOk(),
    isError: result1.isError(),
  });

  if (result1.isError()) {
    logger.error("Pattern 1 failed", {
      message: result1.unwrapError().message,
      code: result1.unwrapError().code,
    });
  }

  const output1 = result1.isOk()
    ? JSON.parse(await Deno.readTextFile(config1.outputPath))
    : {};

  logger.info("Pattern 1 output", {
    hasArticles: Array.isArray(output1.articles),
    articlesCount: output1.articles?.length ?? 0,
    hasTopics: Array.isArray(output1.topics),
    topicsCount: output1.topics?.length ?? 0,
    hasTypes: Array.isArray(output1.types),
    typesCount: output1.types?.length ?? 0,
    sampleArticle: output1.articles?.[0],
  });

  // ========================================
  // Pattern 2: Check if documents are being loaded
  // ========================================
  logger.info("=== Pattern 2: Document Loading Check ===");

  const { expandGlob } = await import("@std/fs");

  const docFiles: string[] = [];
  for await (
    const entry of expandGlob("**/*.md", { root: config1.inputPath })
  ) {
    if (entry.isFile) {
      docFiles.push(entry.path);
    }
  }

  logger.info("Pattern 2 document files", {
    foundFiles: docFiles.length,
    files: docFiles,
  });

  // Read first document to check frontmatter
  if (docFiles.length > 0) {
    const firstDoc = await Deno.readTextFile(docFiles[0]);
    const hasFrontmatter = firstDoc.startsWith("---");
    const frontmatterMatch = firstDoc.match(/^---\n([\s\S]*?)\n---/);

    logger.info("Pattern 2 first document analysis", {
      filePath: docFiles[0],
      hasFrontmatter,
      frontmatterContent: frontmatterMatch ? frontmatterMatch[1] : null,
      contentLength: firstDoc.length,
    });
  }

  // ========================================
  // Pattern 3: Check schema structure
  // ========================================
  logger.info("=== Pattern 3: Schema Structure Check ===");

  const schemaContent = await Deno.readTextFile(config1.schemaPath);
  const schema = JSON.parse(schemaContent);

  logger.info("Pattern 3 schema structure", {
    hasProperties: !!schema.properties,
    propertyKeys: Object.keys(schema.properties || {}),
    articlesProperty: schema.properties?.articles,
    hasXTemplateItems: !!schema.properties?.articles?.["x-template-items"],
  });

  // ========================================
  // Pattern 4: Check template structure
  // ========================================
  logger.info("=== Pattern 4: Template Structure Check ===");

  const templateContent = await Deno.readTextFile(config1.templatePath);
  const template = JSON.parse(templateContent);

  logger.info("Pattern 4 template structure", {
    templateKeys: Object.keys(template),
    hasArticles: !!template.articles,
    articlesValue: template.articles,
    hasTopics: !!template.topics,
    topicsValue: template.topics,
  });

  // ========================================
  // Pattern 5: Check SchemaTemplateResolver
  // ========================================
  logger.info("=== Pattern 5: SchemaTemplateResolver Check ===");

  const { Schema, SchemaId } = await import(
    "../../src/domain/schema/entities/schema.ts"
  );
  const { SchemaPath } = await import(
    "../../src/domain/schema/value-objects/schema-path.ts"
  );
  const { SchemaTemplateResolver } = await import(
    "../../src/domain/schema/services/schema-template-resolver.ts"
  );

  const schemaIdResult = SchemaId.create("articles_schema");
  const schemaPathResult = SchemaPath.create(config1.schemaPath);

  if (schemaIdResult.isOk() && schemaPathResult.isOk()) {
    const schemaEntity = Schema.create(
      schemaIdResult.unwrap(),
      schemaPathResult.unwrap(),
    );

    // Load schema data
    const schemaWithData = schemaEntity.markAsResolved(schema);

    const resolver = new SchemaTemplateResolver();
    const templateContextResult = resolver.resolveTemplateContext(
      schemaWithData,
    );

    if (templateContextResult.isOk()) {
      const templateContext = templateContextResult.unwrap();
      logger.info("Pattern 5 template context", {
        hasContainerTemplate: !!templateContext.containerTemplate,
        containerTemplatePath: templateContext.containerTemplate?.path,
        hasItemsTemplate: !!templateContext.itemsTemplate,
        itemsTemplatePath: templateContext.itemsTemplate?.path,
        frontmatterPartProperty:
          templateContext.schemaContext.frontmatterPartProperty,
      });
    } else {
      logger.error("Pattern 5 template context resolution failed", {
        error: templateContextResult.unwrapError().message,
      });
    }
  }

  // ========================================
  // Comparison Summary
  // ========================================
  logger.info("=== Comparison Summary ===", {
    execution: {
      success: result1.isOk(),
      error: result1.isError() ? result1.unwrapError().message : null,
    },
    documents: {
      filesFound: docFiles.length,
      hasFrontmatter: docFiles.length > 0,
    },
    schema: {
      hasItemsDirective: !!schema.properties?.articles?.["x-template-items"],
      articlesConfig: schema.properties?.articles,
    },
    template: {
      articlesTemplate: template.articles,
      topicsTemplate: template.topics,
    },
    output: {
      articlesCount: output1.articles?.length ?? 0,
      topicsCount: output1.topics?.length ?? 0,
      typesCount: output1.types?.length ?? 0,
      expectedNonZero: docFiles.length > 0,
      actuallyNonZero: (output1.articles?.length ?? 0) > 0,
    },
  });

  // Assertions
  assertEquals(result1.isOk(), true, "Should execute successfully");
  assertEquals(docFiles.length > 0, true, "Should find document files");

  // This is the actual bug we're investigating
  logger.warn("BUG DETECTION", {
    expected: "articles array should have items",
    actual: `articles.length = ${output1.articles?.length ?? 0}`,
    bug: (output1.articles?.length ?? 0) === 0 && docFiles.length > 0,
  });
});
