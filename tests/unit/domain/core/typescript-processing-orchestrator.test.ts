/**
 * Tests for TypeScript Processing Orchestrator
 * Tests the 2-stage processing pipeline as per domain boundary spec
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  ExtractedInfo,
  TypeScriptAnalysisOrchestrator,
} from "../../../../src/domain/core/typescript-processing-orchestrator.ts";
import {
  FrontMatterContent,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "../../../../src/domain/models/value-objects.ts";
import {
  Schema,
  SchemaId,
  Template,
  TemplateId,
} from "../../../../src/domain/models/entities.ts";
import type { AIAnalyzerPort } from "../../../../src/infrastructure/ports/index.ts";

// Mock AI Analyzer for testing
const mockAIAnalyzer: AIAnalyzerPort = {
  analyze: (request) => {
    // Return a simple mock response based on the request
    if (request.content.includes("title")) {
      return Promise.resolve({
        ok: true,
        data: {
          result: JSON.stringify({
            title: "Sample Document",
            category: "test",
            tags: ["typescript", "testing"],
            priority: 1,
            enabled: true,
          }),
        },
      });
    } else {
      return Promise.resolve({
        ok: true,
        data: {
          result:
            "# Sample Document\n\nCategory: test\nTags: typescript,testing",
        },
      });
    }
  },
};

Deno.test("TypeScriptAnalysisOrchestrator - Stage 1: Information Extraction", async () => {
  const orchestrator = new TypeScriptAnalysisOrchestrator(
    mockAIAnalyzer,
    "Extract: {{FRONTMATTER}} using schema: {{SCHEMA}}",
    "Map: {{EXTRACTED_DATA}} to template: {{TEMPLATE}} with schema: {{SCHEMA}}",
  );

  const content = `---
title: "Sample Document"
category: "test"
tags: ["typescript", "testing"]
---

# Content`;

  const schemaDefinition = {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string" },
    },
  };

  const frontMatterResult = FrontMatterContent.create(content);
  assertEquals(frontMatterResult.ok, true);
  if (!frontMatterResult.ok) return;

  const schemaIdResult = SchemaId.create("test-schema");
  assertEquals(schemaIdResult.ok, true);
  if (!schemaIdResult.ok) return;

  const schemaDefinitionResult = SchemaDefinition.create(schemaDefinition);
  assertEquals(schemaDefinitionResult.ok, true);
  if (!schemaDefinitionResult.ok) return;

  const schemaVersionResult = SchemaVersion.create("1.0.0");
  assertEquals(schemaVersionResult.ok, true);
  if (!schemaVersionResult.ok) return;

  const schema = Schema.create(
    schemaIdResult.data,
    schemaDefinitionResult.data,
    schemaVersionResult.data,
  );

  const extractionResult = await orchestrator.extractInformation(
    frontMatterResult.data,
    schema,
  );

  assertEquals(extractionResult.ok, true);
  if (extractionResult.ok) {
    const extractedInfo = extractionResult.data;
    assertExists(extractedInfo);
    assertEquals(extractedInfo.getMetadata().stage, "information_extraction");

    const data = extractedInfo.getData();
    assertEquals(data.title, "Sample Document");
    assertEquals(data.category, "test");
  }
});

Deno.test("TypeScriptAnalysisOrchestrator - Stage 2: Template Mapping", async () => {
  const orchestrator = new TypeScriptAnalysisOrchestrator(
    mockAIAnalyzer,
    "Extract: {{FRONTMATTER}} using schema: {{SCHEMA}}",
    "Map: {{EXTRACTED_DATA}} to template: {{TEMPLATE}} with schema: {{SCHEMA}}",
  );

  const schemaDefinition = {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string" },
    },
  };

  const templateContent = `# {title}\n\nCategory: {category}`;

  // Create extracted info for stage 2
  const extractedInfoResult = ExtractedInfo.create(
    { title: "Test Title", category: "test" },
    {
      extractedAt: new Date(),
      promptUsed: "test",
      schemaVersion: "1.0.0",
      stage: "information_extraction",
    },
  );

  const schemaIdResult = SchemaId.create("test-schema");
  const schemaDefinitionResult = SchemaDefinition.create(schemaDefinition);
  const schemaVersionResult = SchemaVersion.create("1.0.0");
  const templateFormatResult = TemplateFormat.create(
    "handlebars",
    templateContent,
  );

  assertEquals(extractedInfoResult.ok, true);
  assertEquals(schemaIdResult.ok, true);
  assertEquals(schemaDefinitionResult.ok, true);
  assertEquals(schemaVersionResult.ok, true);
  assertEquals(templateFormatResult.ok, true);

  if (
    !extractedInfoResult.ok || !schemaIdResult.ok ||
    !schemaDefinitionResult.ok ||
    !schemaVersionResult.ok || !templateFormatResult.ok
  ) return;

  const schema = Schema.create(
    schemaIdResult.data,
    schemaDefinitionResult.data,
    schemaVersionResult.data,
  );

  const templateIdResult = TemplateId.create("test-template");
  assertEquals(templateIdResult.ok, true);
  if (!templateIdResult.ok) return;

  const template = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    [],
  );

  const mappingResult = await orchestrator.mapToTemplate(
    extractedInfoResult.data,
    schema,
    template,
  );

  assertEquals(mappingResult.ok, true);
  if (mappingResult.ok) {
    const structuredData = mappingResult.data;
    assertExists(structuredData);
    assertEquals(structuredData.getTemplateName(), "test-template");
    assertEquals(structuredData.getMetadata().stage, "template_mapping");
  }
});

Deno.test("TypeScriptAnalysisOrchestrator - Complete Processing Pipeline", async () => {
  const orchestrator = new TypeScriptAnalysisOrchestrator(
    mockAIAnalyzer,
    "Extract: {{FRONTMATTER}} using schema: {{SCHEMA}}",
    "Map: {{EXTRACTED_DATA}} to template: {{TEMPLATE}} with schema: {{SCHEMA}}",
  );

  const content = `---
title: "Complete Test"
category: "integration"
---

# Content`;

  const schemaDefinition = {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string" },
    },
  };

  const templateContent = `# {title}\n\nCategory: {category}`;

  const frontMatterResult = FrontMatterContent.create(content);
  assertEquals(frontMatterResult.ok, true);
  if (!frontMatterResult.ok) return;

  const schemaIdResult = SchemaId.create("test-schema");
  const schemaDefinitionResult = SchemaDefinition.create(schemaDefinition);
  const schemaVersionResult = SchemaVersion.create("1.0.0");
  const templateFormatResult = TemplateFormat.create(
    "handlebars",
    templateContent,
  );

  assertEquals(schemaIdResult.ok, true);
  assertEquals(schemaDefinitionResult.ok, true);
  assertEquals(schemaVersionResult.ok, true);
  assertEquals(templateFormatResult.ok, true);

  if (
    !schemaIdResult.ok || !schemaDefinitionResult.ok ||
    !schemaVersionResult.ok || !templateFormatResult.ok
  ) return;

  const schema = Schema.create(
    schemaIdResult.data,
    schemaDefinitionResult.data,
    schemaVersionResult.data,
  );

  const templateIdResult = TemplateId.create("integration-template");
  assertEquals(templateIdResult.ok, true);
  if (!templateIdResult.ok) return;

  const template = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    [],
  );

  const result = await orchestrator.processComplete(
    frontMatterResult.data,
    schema,
    template,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const structuredData = result.data;
    assertExists(structuredData);
    assertEquals(structuredData.getTemplateName(), "integration-template");

    const content = structuredData.getContent();
    assertExists(content);

    const metadata = structuredData.getMetadata();
    assertExists(metadata);
    assertEquals(metadata.stage, "template_mapping");
    assertEquals(metadata.templateName, "integration-template");
  }
});
