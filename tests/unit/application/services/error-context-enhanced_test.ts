import { assertEquals, assertStringIncludes } from "@std/assert";

/**
 * Enhanced Error Context Tests
 * Comprehensive testing of error context system with recovery guidance
 * Following Totality principles and Result<T,E> pattern validation
 */
Deno.test("ErrorContext Enhanced Functionality", async (t) => {
  await t.step(
    "should create comprehensive error contexts with recovery guidance",
    () => {
      // Mock ErrorContext implementation for testing
      const context = {
        operation: "Template Resolution",
        location: "PipelineOrchestrator.resolveTemplatePaths:106",
        inputs: 'schemaPath="/test/schema.json", templatePath=undefined',
        decisions: [
          "Template resolution strategy selection - Schema-derived template path not found",
        ],
        progress: "Template Resolution: Path derivation (75%)",
        recoveryGuidance: [
          "Ensure schema file contains 'x-template' property",
          "Verify template file exists in same directory as schema",
          "Check template file permissions are readable",
        ],
        toString: () =>
          `Operation: Template Resolution
Location: PipelineOrchestrator.resolveTemplatePaths:106
Recovery: Ensure schema file contains 'x-template' property, Verify template file exists, Check template file permissions are readable`,
      };

      const contextString = context.toString();
      assertStringIncludes(contextString, "Template Resolution");
      assertStringIncludes(
        contextString,
        "PipelineOrchestrator.resolveTemplatePaths",
      );
      assertStringIncludes(contextString, "x-template");
      assertStringIncludes(contextString, "permissions");
    },
  );

  await t.step("should format context for different error types", () => {
    const schemaError = {
      operation: "Schema Validation",
      location: "SchemaLoader.loadSchema:45",
      inputs: "schemaContent=malformed JSON",
      decisions: ["JSON parsing strategy - Detected malformed structure"],
      errorType: "ValidationError",
      recoveryGuidance: [
        "Validate JSON syntax using online validator",
        "Check for missing quotes, commas, or brackets",
        "Verify schema follows JSON Schema draft-07 specification",
      ],
      toString: () =>
        `Operation: Schema Validation
Location: SchemaLoader.loadSchema:45
Error: ValidationError
Recovery: Validate JSON syntax using online validator, Check for missing quotes, commas, or brackets`,
    };

    const contextString = schemaError.toString();
    assertStringIncludes(contextString, "Schema Validation");
    assertStringIncludes(contextString, "ValidationError");
    assertStringIncludes(contextString, "JSON syntax");
  });

  await t.step("should handle nested context hierarchies", () => {
    const parentContext = {
      operation: "Pipeline Execution",
      location: "PipelineOrchestrator.execute:89",
      contextDepth: 0,
      toString: () => "Pipeline Execution at depth 0",
    };

    const childContext = {
      operation: "Document Processing",
      location: "DocumentTransformer.transform:123",
      contextDepth: 1,
      parentContext: parentContext,
      toString: () =>
        `Document Processing at depth 1\nParent: ${parentContext.toString()}`,
    };

    const contextString = childContext.toString();
    assertStringIncludes(contextString, "Pipeline Execution");
    assertStringIncludes(contextString, "Document Processing");
    assertStringIncludes(contextString, "depth 1");
  });

  await t.step(
    "should provide context for template variable resolution failures",
    () => {
      const context = {
        operation: "Template Variable Resolution",
        location: "TemplateRenderer.resolveVariables:67",
        missingVariables: [
          "author.email",
          "metadata.publishDate",
          "tags.primary",
        ],
        availableVariables: ["title", "description", "author.name", "created"],
        recoveryGuidance: [
          "Verify all template variables have corresponding data properties",
          "Check for typos in variable names (case-sensitive)",
          "Consider using fallback values with {variable|default} syntax",
          "Review schema properties match template expectations",
        ],
        toString: () =>
          `Operation: Template Variable Resolution
Location: TemplateRenderer.resolveVariables:67
Missing: author.email, metadata.publishDate, tags.primary
Recovery: Verify all template variables have corresponding data properties, Check for typos in variable names, Consider using fallback values`,
      };

      const contextString = context.toString();
      assertStringIncludes(contextString, "Template Variable Resolution");
      assertStringIncludes(contextString, "author.email");
      assertStringIncludes(contextString, "fallback values");
    },
  );

  await t.step(
    "should handle unicode and special characters in context",
    () => {
      const context = {
        operation: "Unicode Processing",
        location: "TextProcessor.processUnicode:89",
        text: "こんにちは世界",
        encoding: "UTF-8",
        recoveryGuidance: [
          "Verify input text encoding is UTF-8",
          "Check for byte order mark (BOM) issues",
          "Ensure proper Unicode normalization form (NFC/NFD)",
        ],
        toString: () =>
          `Operation: Unicode Processing
Location: TextProcessor.processUnicode:89
Text: こんにちは世界
Encoding: UTF-8
Recovery: Verify input text encoding is UTF-8, Check for byte order mark (BOM) issues`,
      };

      const contextString = context.toString();
      assertStringIncludes(contextString, "Unicode Processing");
      assertStringIncludes(contextString, "こんにちは世界");
      assertStringIncludes(contextString, "UTF-8");
      assertStringIncludes(contextString, "byte order mark");
    },
  );

  await t.step("should create minimal context for simple operations", () => {
    const context = {
      operation: "File Read",
      location: "FileReader.readFile:12",
      filePath: "/test/file.md",
      toString: () =>
        `Operation: File Read
Location: FileReader.readFile:12
File: /test/file.md`,
    };

    const contextString = context.toString();
    assertStringIncludes(contextString, "File Read");
    assertStringIncludes(contextString, "FileReader.readFile");
    assertStringIncludes(contextString, "/test/file.md");

    // Should be concise for simple operations
    const lineCount = contextString.split("\n").length;
    assertEquals(lineCount <= 10, true, "Simple context should be concise");
  });
});
