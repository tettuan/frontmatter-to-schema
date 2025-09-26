/**
 * @fileoverview Unit tests for Template Intermediate Representation
 *
 * Tests IR creation, validation, and builder pattern implementation
 * aligned with DDD, TDD, and Totality principles.
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  TemplateIntermediateRepresentation,
  TemplateIRBuilder,
} from "../../../../../src/domain/template/value-objects/template-intermediate-representation.ts";
import { TemplateConfiguration } from "../../../../../src/domain/template/value-objects/template-configuration.ts";
import { VariableMapping } from "../../../../../src/domain/template/value-objects/variable-mapping.ts";

Deno.test("TemplateIRBuilder - creates valid IR with required fields", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setTemplateConfig(templateConfig)
    .setMetadata({
      stage: "initialization",
      schemaPath: "schema.yaml",
      sourceFiles: ["data.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    assertEquals(ir.mainTemplatePath, "templates/main.njk");
    assertEquals(ir.outputFormat, "json");
    assertEquals(ir.templateConfig, templateConfig);
    assertEquals(ir.metadata.stage, "initialization");
    assertEquals(ir.metadata.schemaPath, "schema.yaml");
    assertEquals(ir.metadata.sourceFiles, ["data.md"]);
  }
});

Deno.test("TemplateIRBuilder - handles optional fields correctly", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.njk",
    itemsPath: "templates/items.njk",
  };

  const itemsArray = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  const variableMappings: VariableMapping[] = [
    VariableMapping.empty(),
  ];

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setItemsTemplatePath("templates/items.njk")
    .setOutputFormat("yaml")
    .setMainContext({ title: "Test Title", count: 42 })
    .setItemsArray(itemsArray)
    .setTemplateConfig(templateConfig)
    .setVariableMappings(variableMappings)
    .setMetadata({
      stage: "processing",
      schemaPath: "schema.yaml",
      sourceFiles: ["data1.md", "data2.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    assertEquals(ir.mainTemplatePath, "templates/main.njk");
    assertEquals(ir.itemsTemplatePath, "templates/items.njk");
    assertEquals(ir.outputFormat, "yaml");
    assertEquals(ir.mainContext, { title: "Test Title", count: 42 });
    assertEquals(ir.itemsArray, itemsArray);
    assertEquals(ir.variableMappings.length, 1);
    assertEquals(ir.metadata.sourceFiles.length, 2);
  }
});

Deno.test("TemplateIRBuilder - returns error when main template path missing", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  builder
    .setOutputFormat("json")
    .setTemplateConfig(templateConfig);

  const result = builder.build();

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "IRBuilderValidationFailed");
    if (result.error.kind === "IRBuilderValidationFailed") {
      assertEquals(
        result.error.errors.includes("mainTemplatePath is required"),
        true,
      );
    }
  }
});

Deno.test("TemplateIRBuilder - returns error when output format missing", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  builder
    .setMainTemplatePath("templates/main.njk")
    .setTemplateConfig(templateConfig);

  const result = builder.build();

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "IRBuilderValidationFailed");
    if (result.error.kind === "IRBuilderValidationFailed") {
      assertEquals(
        result.error.errors.includes("outputFormat is required"),
        true,
      );
    }
  }
});

Deno.test("TemplateIRBuilder - returns error when template config missing", () => {
  const builder = new TemplateIRBuilder();
  builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json");

  const result = builder.build();

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "IRBuilderValidationFailed");
    if (result.error.kind === "IRBuilderValidationFailed") {
      assertEquals(
        result.error.errors.includes("templateConfig is required"),
        true,
      );
    }
  }
});

Deno.test("TemplateIRBuilder - ensures immutability of built IR", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const mutableContext = { title: "Original" };
  const mutableItems = [{ id: 1 }];
  const mutableMappings = [VariableMapping.empty()];
  const mutableSourceFiles = ["file1.md"];

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext(mutableContext)
    .setItemsArray(mutableItems)
    .setTemplateConfig(templateConfig)
    .setVariableMappings(mutableMappings)
    .setMetadata({
      stage: "test",
      schemaPath: "schema.yaml",
      sourceFiles: mutableSourceFiles,
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;

    // Mutate original data
    mutableContext.title = "Modified";
    mutableItems.push({ id: 2 });
    mutableMappings.push(VariableMapping.empty());
    mutableSourceFiles.push("file2.md");

    // IR should remain unchanged
    assertEquals(ir.mainContext.title, "Original");
    assertEquals(ir.itemsArray?.length, 1);
    assertEquals(ir.variableMappings.length, 1);
    assertEquals(ir.metadata.sourceFiles.length, 1);
  }
});

Deno.test("TemplateIRBuilder - handles undefined items array", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setItemsArray(undefined)
    .setTemplateConfig(templateConfig)
    .setMetadata({
      stage: "test",
      schemaPath: "schema.yaml",
      sourceFiles: [],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.itemsArray, undefined);
  }
});

Deno.test("TemplateIRBuilder - empty arrays are preserved", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setItemsArray([])
    .setVariableMappings([])
    .setTemplateConfig(templateConfig)
    .setMetadata({
      stage: "test",
      schemaPath: "schema.yaml",
      sourceFiles: [],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    assertExists(ir.itemsArray);
    assertEquals(ir.itemsArray?.length, 0);
    assertEquals(ir.variableMappings.length, 0);
    assertEquals(ir.metadata.sourceFiles.length, 0);
  }
});

Deno.test("TemplateIRBuilder - method chaining works correctly", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();

  // Test each method returns 'this' for chaining
  const result1 = builder.setMainTemplatePath("test");
  assertEquals(result1, builder);

  const result2 = result1.setItemsTemplatePath(undefined);
  assertEquals(result2, builder);

  const result3 = result2.setOutputFormat("json");
  assertEquals(result3, builder);

  const result4 = result3.setMainContext({});
  assertEquals(result4, builder);

  const result5 = result4.setItemsArray([]);
  assertEquals(result5, builder);

  const result6 = result5.setTemplateConfig(templateConfig);
  assertEquals(result6, builder);

  const result7 = result6.setVariableMappings([]);
  assertEquals(result7, builder);

  const result8 = result7.setMetadata({
    stage: "test",
    schemaPath: "schema.yaml",
    sourceFiles: [],
  });
  assertEquals(result8, builder);

  // Should build successfully
  const buildResult = result8.build();
  assertEquals(buildResult.ok, true);
});

Deno.test("TemplateIRBuilder - validates output format values", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const validFormats = ["json", "yaml", "markdown", "xml"];

  for (const format of validFormats) {
    const builder = new TemplateIRBuilder();
    const result = builder
      .setMainTemplatePath("templates/main.njk")
      .setOutputFormat(format)
      .setTemplateConfig(templateConfig)
      .setMetadata({
        stage: "test",
        schemaPath: "schema.yaml",
        sourceFiles: [],
      })
      .build();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.outputFormat, format);
    }
  }
});

Deno.test("TemplateIntermediateRepresentation - interface structure validation", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const builder = new TemplateIRBuilder();
  const result = builder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext({ key: "value" })
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "test",
      schemaPath: "schema.yaml",
      sourceFiles: [],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir: TemplateIntermediateRepresentation = result.data;

    // Verify all required interface properties exist
    assertExists(ir.mainTemplatePath);
    assertExists(ir.outputFormat);
    assertExists(ir.mainContext);
    assertExists(ir.templateConfig);
    assertExists(ir.variableMappings);
    assertExists(ir.metadata);
    assertExists(ir.metadata.stage);
    assertExists(ir.metadata.schemaPath);
    assertExists(ir.metadata.sourceFiles);

    // Optional fields can be undefined
    assertEquals(typeof ir.itemsTemplatePath, "undefined");
    assertEquals(typeof ir.itemsArray, "undefined");
  }
});
