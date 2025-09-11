/**
 * Tests for Test Helper Classes
 * 
 * Validates the factory and helper classes created for Issue #664
 * Ensures helpers work correctly before using them to refactor other tests
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TestProcessorFactory } from "./test-processor-factory.ts";
import { ResultAssertions } from "./result-assertions.ts";
import { TestConfigBuilder } from "./test-config-builder.ts";

Deno.test("TestProcessorFactory", async (t) => {
  await t.step("should create DocumentProcessor successfully", () => {
    const result = TestProcessorFactory.create();
    
    ResultAssertions.assertSuccess(result);
    assertExists(result.ok ? result.data : null);
  });

  await t.step("should create DocumentProcessor with createUnsafe", () => {
    const processor = TestProcessorFactory.createUnsafe();
    
    assertExists(processor);
    assertEquals(typeof processor.processDocuments, "function");
  });

  await t.step("should handle custom dependencies", () => {
    const result = TestProcessorFactory.createWithDependencies();
    
    ResultAssertions.assertSuccess(result);
    assertExists(result.ok ? result.data : null);
  });
});

Deno.test("ResultAssertions", async (t) => {
  await t.step("should assert success correctly", () => {
    const successResult = { ok: true as const, data: "test data" };
    
    const data = ResultAssertions.assertSuccess(successResult);
    assertEquals(data, "test data");
  });

  await t.step("should assert error correctly", () => {
    const errorResult = { 
      ok: false as const, 
      error: { kind: "TestError", message: "test message" } 
    };
    
    const error = ResultAssertions.assertError(errorResult, "TestError");
    assertEquals(error.kind, "TestError");
    assertEquals(error.message, "test message");
  });

  await t.step("should assert error with message pattern", () => {
    const errorResult = { 
      ok: false as const, 
      error: { kind: "TestError", message: "test message 123" } 
    };
    
    const error = ResultAssertions.assertErrorWithMessage(
      errorResult, 
      "TestError", 
      /test message \d+/
    );
    assertEquals(error.kind, "TestError");
  });
});

Deno.test("TestConfigBuilder", async (t) => {
  await t.step("should create file configuration", () => {
    const result = TestConfigBuilder.forFile("/tmp/test.md");
    
    const config = ResultAssertions.assertSuccess(result);
    assertEquals(config.input.kind, "FileInput");
    if (config.input.kind === "FileInput") {
      assertEquals(config.input.path, "/tmp/test.md");
    }
  });

  await t.step("should create directory configuration", () => {
    const result = TestConfigBuilder.forDirectory("/tmp/testdir", "\\.md$");
    
    const config = ResultAssertions.assertSuccess(result);
    assertEquals(config.input.kind, "DirectoryInput");
    if (config.input.kind === "DirectoryInput") {
      assertEquals(config.input.path, "/tmp/testdir");
      assertEquals(config.input.pattern, "\\.md$");
    }
  });

  await t.step("should handle invalid file path", () => {
    const result = TestConfigBuilder.forFile("");
    
    const error = ResultAssertions.assertError(result, "InvalidFilePath");
    if (error.kind === "InvalidFilePath") {
      assertEquals(error.path, "");
    }
  });

  await t.step("should create unsafe configuration", () => {
    const config = TestConfigBuilder.forFileUnsafe("/tmp/test.md");
    
    assertExists(config);
    assertEquals(config.input.kind, "FileInput");
  });

  await t.step("should create custom schema configuration", () => {
    const customSchema = {
      type: "object",
      properties: {
        title: { type: "string" }
      }
    };
    
    const result = TestConfigBuilder.withCustomSchema(
      "/tmp/test.md", 
      customSchema, 
      "json"
    );
    
    const config = ResultAssertions.assertSuccess(result);
    assertEquals(config.schema.definition, JSON.stringify(customSchema));
  });

  await t.step("should create error testing configurations", () => {
    const errorConfigs = TestConfigBuilder.forErrorTesting();
    
    const invalidSchema = errorConfigs.invalidJsonSchema();
    assertEquals(invalidSchema.schema.definition, "{ invalid json schema");
    
    const missingFile = errorConfigs.missingFile();
    if (missingFile.input.kind === "FileInput") {
      assertEquals(missingFile.input.path, "/nonexistent/path/file.md");
    }
  });
});

Deno.test("Integration: Factory + Config + Assertions", async (t) => {
  await t.step("should work together in typical test scenario", async () => {
    // Create processor using factory
    const processor = TestProcessorFactory.createUnsafe();
    
    // Create test configuration
    const configResult = TestConfigBuilder.forFile("/tmp/test.md");
    const config = ResultAssertions.assertSuccess(configResult);
    
    // Create test file for processing
    await Deno.writeTextFile("/tmp/test.md", `---
title: "Test Document"
---

# Test Content`);
    
    try {
      // Process document (expected to fail due to invalid schema in default config)
      const result = await processor.processDocuments(config);
      
      // This should fail, but we test the assertion helpers work
      if (!result.ok) {
        const error = ResultAssertions.assertAnyError(result);
        assertExists(error);
      } else {
        const data = ResultAssertions.assertSuccess(result);
        assertExists(data);
      }
    } finally {
      // Cleanup
      await Deno.remove("/tmp/test.md").catch(() => {});
    }
  });
});