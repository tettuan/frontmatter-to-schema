import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { ErrorContextFactory } from "../../../../src/application/services/error-context-factory.ts";

/**
 * Error Context Factory Tests
 * Comprehensive testing of the error context factory patterns
 * Following DDD principles and standardized error context creation
 */
Deno.test("ErrorContextFactory", async (t) => {
  await t.step(
    "should create schema error context with recovery guidance",
    () => {
      const context = ErrorContextFactory.createSchemaError(
        "validation",
        "SchemaValidator.validate",
        "/path/to/schema.json",
        "invalid JSON syntax",
      );

      assertEquals(context.operation, "Schema: validation");
      assertEquals(context.location, "SchemaValidator.validate");
      assertEquals(
        context.inputs,
        'schemaPath="/path/to/schema.json", errorType=invalid JSON syntax',
      );
      assertEquals(context.errorType, "SchemaValidationError");
      assertEquals(context.decisions?.length, 1);
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(
        context.recoveryGuidance![0],
        "Verify schema file exists",
      );
      assertStringIncludes(
        context.recoveryGuidance![1],
        "Validate JSON syntax",
      );
      assertStringIncludes(
        context.recoveryGuidance![2],
        "JSON Schema draft-07",
      );
      assertStringIncludes(context.recoveryGuidance![3], "required properties");
    },
  );

  await t.step(
    "should create template error context with resolution guidance",
    () => {
      const context = ErrorContextFactory.createTemplateError(
        "resolution",
        "TemplateResolver.resolve",
        "/path/to/template.json",
        "/path/to/schema.json",
      );

      assertEquals(context.operation, "Template: resolution");
      assertEquals(context.location, "TemplateResolver.resolve");
      assertEquals(
        context.inputs,
        'templatePath="/path/to/template.json", schemaPath="/path/to/schema.json"',
      );
      assertEquals(context.errorType, "TemplateResolutionError");
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(
        context.recoveryGuidance![0],
        "Verify template file exists",
      );
      assertStringIncludes(context.recoveryGuidance![1], "file permissions");
      assertStringIncludes(context.recoveryGuidance![2], "x-template");
      assertStringIncludes(
        context.recoveryGuidance![3],
        "valid JSON structure",
      );
    },
  );

  await t.step(
    "should create frontmatter error context with parsing guidance",
    () => {
      const context = ErrorContextFactory.createFrontmatterError(
        "parsing",
        "FrontmatterParser.parse",
        "/path/to/document.md",
        15,
      );

      assertEquals(context.operation, "Frontmatter: parsing");
      assertEquals(context.location, "FrontmatterParser.parse");
      assertEquals(context.inputs, 'filePath="/path/to/document.md", line=15');
      assertEquals(context.errorType, "FrontmatterParsingError");
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(context.recoveryGuidance![0], "valid YAML syntax");
      assertStringIncludes(context.recoveryGuidance![1], "--- delimiters");
      assertStringIncludes(context.recoveryGuidance![2], "no tabs are used");
      assertStringIncludes(context.recoveryGuidance![3], "special characters");
    },
  );

  await t.step(
    "should create performance error context with optimization guidance",
    () => {
      const metrics = {
        filesPerSecond: 5,
        memoryPeakMB: 512,
        recommendedBatchSize: 100,
        currentBatchSize: 500,
        duration: 30000,
      };

      const context = ErrorContextFactory.createPerformanceError(
        "batch processing",
        "BatchProcessor.process",
        metrics,
      );

      assertEquals(context.operation, "Performance: batch processing");
      assertEquals(context.location, "BatchProcessor.process");
      assertEquals(context.inputs, "fileCount=500, duration=30000ms");
      assertEquals(context.errorType, "PerformanceError");
      assertEquals(context.recoveryGuidance?.length, 4);
      assertEquals(context.additionalData?.performanceMetrics, metrics);

      assertStringIncludes(
        context.recoveryGuidance![0],
        "Reduce batch size to 100",
      );
      assertStringIncludes(context.recoveryGuidance![1], "streaming mode");
      assertStringIncludes(context.recoveryGuidance![2], "parallel processing");
      assertStringIncludes(context.recoveryGuidance![3], "memory usage");
    },
  );

  await t.step(
    "should create file system error context with access guidance",
    () => {
      const context = ErrorContextFactory.createFileSystemError(
        "read",
        "FileReader.read",
        "/protected/file.json",
        "EACCES: permission denied",
      );

      assertEquals(context.operation, "FileSystem: read");
      assertEquals(context.location, "FileReader.read");
      assertEquals(
        context.inputs,
        'filePath="/protected/file.json", systemError="EACCES: permission denied"',
      );
      assertEquals(context.errorType, "FileSystemError");
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(context.recoveryGuidance![0], "file path exists");
      assertStringIncludes(context.recoveryGuidance![1], "file permissions");
      assertStringIncludes(context.recoveryGuidance![2], "parent directory");
      assertStringIncludes(context.recoveryGuidance![3], "disk space");
    },
  );

  await t.step(
    "should create pipeline error context with stage guidance",
    () => {
      const context = ErrorContextFactory.createPipelineError(
        "execution",
        "PipelineOrchestrator.execute",
        "template-rendering",
        "3/5 stages completed",
      );

      assertEquals(context.operation, "Pipeline: execution");
      assertEquals(context.location, "PipelineOrchestrator.execute");
      assertEquals(
        context.inputs,
        'stage="template-rendering", progress="3/5 stages completed"',
      );
      assertEquals(
        context.progress,
        "Pipeline Processing: template-rendering (3/5 stages completed)",
      );
      assertEquals(context.errorType, "PipelineExecutionError");
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(
        context.recoveryGuidance![0],
        "previous pipeline stages",
      );
      assertStringIncludes(context.recoveryGuidance![1], "input data validity");
      assertStringIncludes(
        context.recoveryGuidance![2],
        "required dependencies",
      );
      assertStringIncludes(context.recoveryGuidance![3], "verbose logging");
    },
  );

  await t.step(
    "should create validation error context with detailed guidance",
    () => {
      const validationRules = ["required:title", "type:string", "minLength:1"];
      const failedRules = ["required:title", "minLength:1"];

      const context = ErrorContextFactory.createValidationError(
        "schema validation",
        "SchemaValidator.validateData",
        "user input data",
        validationRules,
        failedRules,
      );

      assertEquals(context.operation, "Validation: schema validation");
      assertEquals(context.location, "SchemaValidator.validateData");
      assertEquals(context.inputs, 'target="user input data", rulesCount=3');
      assertEquals(context.errorType, "ValidationError");
      assertEquals(context.additionalData?.validationRules, validationRules);
      assertEquals(context.additionalData?.failedRules, failedRules);
      assertEquals(context.recoveryGuidance?.length, 4);

      assertStringIncludes(context.decisions![0], "2 validation rules failed");
      assertStringIncludes(
        context.recoveryGuidance![0],
        "Review failed validation rules",
      );
      assertStringIncludes(context.recoveryGuidance![1], "data types match");
      assertStringIncludes(context.recoveryGuidance![2], "required fields");
      assertStringIncludes(context.recoveryGuidance![3], "data format matches");
    },
  );

  await t.step("should create child context with parent reference", () => {
    const parentContext = ErrorContextFactory.createSchemaError(
      "validation",
      "SchemaValidator.validate",
      "/path/to/schema.json",
    );

    const childContext = ErrorContextFactory.createChildContext(
      parentContext,
      "property validation",
      "PropertyValidator.validate",
      'property="title", value="test"',
    );

    assertEquals(childContext.operation, "property validation");
    assertEquals(childContext.location, "PropertyValidator.validate");
    assertEquals(childContext.inputs, 'property="title", value="test"');
    assertEquals(childContext.contextDepth, 1);
    assertEquals(childContext.parentContext, parentContext);
    assertEquals(childContext.recoveryGuidance?.length, 3);

    assertStringIncludes(
      childContext.recoveryGuidance![0],
      "parent operation context",
    );
    assertStringIncludes(
      childContext.recoveryGuidance![1],
      "child operation inputs",
    );
    assertStringIncludes(
      childContext.recoveryGuidance![2],
      "cascading failures",
    );
  });

  await t.step(
    "should create custom error context with provided guidance",
    () => {
      const customGuidance = [
        "Check custom configuration settings",
        "Verify custom dependencies are installed",
        "Review custom error logs for details",
      ];

      const additionalData = {
        customField: "custom value",
        customNumber: 42,
      };

      const context = ErrorContextFactory.createCustomError(
        "custom operation",
        "CustomHandler.handle",
        "CustomError",
        customGuidance,
        additionalData,
      );

      assertEquals(context.operation, "custom operation");
      assertEquals(context.location, "CustomHandler.handle");
      assertEquals(context.errorType, "CustomError");
      assertEquals(context.recoveryGuidance, customGuidance);
      assertEquals(context.additionalData, additionalData);
      assertEquals(context.decisions?.length, 1);

      assertStringIncludes(
        context.decisions![0],
        "Custom error handling strategy",
      );
    },
  );

  await t.step("should format context into readable string", () => {
    const context = ErrorContextFactory.createSchemaError(
      "validation",
      "SchemaValidator.validate",
      "/path/to/schema.json",
      "invalid JSON syntax",
    );

    const formatted = ErrorContextFactory.formatContext(context);

    assertStringIncludes(formatted, "Operation: Schema: validation");
    assertStringIncludes(formatted, "Location: SchemaValidator.validate");
    assertStringIncludes(formatted, "Error Type: SchemaValidationError");
    assertStringIncludes(formatted, "Recovery Guidance:");
    assertStringIncludes(formatted, "1. Verify schema file exists");
    assertStringIncludes(formatted, "2. Validate JSON syntax");
    assertStringIncludes(formatted, "3. Check schema follows");
    assertStringIncludes(formatted, "4. Ensure all required");
  });

  await t.step("should format context with hierarchical structure", () => {
    const parentContext = ErrorContextFactory.createPipelineError(
      "execution",
      "PipelineOrchestrator.execute",
      "template-rendering",
      "3/5 stages completed",
    );

    const childContext = ErrorContextFactory.createChildContext(
      parentContext,
      "template validation",
      "TemplateValidator.validate",
      'templatePath="/path/to/template.json"',
    );

    const formatted = ErrorContextFactory.formatContext(childContext);

    assertStringIncludes(formatted, "Operation: template validation");
    assertStringIncludes(formatted, "Context Depth: 1");
    assertStringIncludes(formatted, "Parent Context: Pipeline: execution");
  });

  await t.step("should handle missing optional fields gracefully", () => {
    const context = ErrorContextFactory.createCustomError(
      "minimal operation",
      "MinimalHandler.handle",
      "MinimalError",
      [],
    );

    const formatted = ErrorContextFactory.formatContext(context);

    assertStringIncludes(formatted, "Operation: minimal operation");
    assertStringIncludes(formatted, "Location: MinimalHandler.handle");
    assertStringIncludes(formatted, "Error Type: MinimalError");
    // Should not crash with empty recovery guidance
  });
});
