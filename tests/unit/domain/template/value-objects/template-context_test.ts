/**
 * @fileoverview Unit tests for Template Context
 *
 * Tests context creation from IR, item context generation, and
 * variable context management aligned with DDD, TDD, and Totality.
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  TemplateContext,
  TemplateContextBuilder,
} from "../../../../../src/domain/template/value-objects/template-context.ts";
import {
  TemplateIntermediateRepresentation as _TemplateIntermediateRepresentation,
  TemplateIRBuilder,
} from "../../../../../src/domain/template/value-objects/template-intermediate-representation.ts";
import { TemplateConfiguration } from "../../../../../src/domain/template/value-objects/template-configuration.ts";

Deno.test("TemplateContextBuilder.fromIR - creates valid context from IR", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext({ title: "Test", count: 42 })
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "processing",
      schemaPath: "schema.yaml",
      sourceFiles: ["data.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    const context = TemplateContextBuilder.fromIR(ir);

    assertEquals(context.mainVariables, { title: "Test", count: 42 });
    assertEquals(context.itemsData, undefined);
    assertEquals(context.variableContext, { title: "Test", count: 42 });
    assertEquals(context.renderingOptions.format, "json");
    assertEquals(context.renderingOptions.expandItems, false);
    assertEquals(
      context.renderingOptions.templatePaths.main,
      "templates/main.njk",
    );
    assertEquals(context.renderingOptions.templatePaths.items, undefined);
    assertEquals(context.metadata.stage, "processing");
    assertEquals(context.metadata.schemaPath, "schema.yaml");
    assertEquals(context.metadata.mappingsCount, 0);
  }
});

Deno.test("TemplateContextBuilder.fromIR - handles items array correctly", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.njk",
    itemsPath: "templates/items.njk",
  };

  const itemsArray = [
    { id: 1, name: "Item 1" },
    { id: 2, name: "Item 2" },
  ];

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setItemsTemplatePath("templates/items.njk")
    .setOutputFormat("yaml")
    .setMainContext({ header: "Main Header" })
    .setItemsArray(itemsArray)
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "rendering",
      schemaPath: "schema.yaml",
      sourceFiles: ["data1.md", "data2.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    const context = TemplateContextBuilder.fromIR(ir);

    assertEquals(context.mainVariables, { header: "Main Header" });
    assertEquals(context.itemsData, itemsArray);
    assertEquals(context.variableContext["@items"], itemsArray);
    assertEquals(context.variableContext["header"], "Main Header");
    assertEquals(context.renderingOptions.format, "yaml");
    assertEquals(context.renderingOptions.expandItems, true);
    assertEquals(
      context.renderingOptions.templatePaths.main,
      "templates/main.njk",
    );
    assertEquals(
      context.renderingOptions.templatePaths.items,
      "templates/items.njk",
    );
    assertEquals(context.metadata.mappingsCount, 0);
  }
});

Deno.test("TemplateContextBuilder.forItem - creates item-specific context", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.njk",
    itemsPath: "templates/items.njk",
  };

  const itemsArray = [
    { id: 1, name: "Item 1", price: 100 },
    { id: 2, name: "Item 2", price: 200 },
  ];

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setItemsTemplatePath("templates/items.njk")
    .setOutputFormat("json")
    .setMainContext({ title: "Products" })
    .setItemsArray(itemsArray)
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
    const ir = result.data;
    const baseContext = TemplateContextBuilder.fromIR(ir);
    const itemContext = TemplateContextBuilder.forItem(
      baseContext,
      itemsArray[0],
      0,
    );

    assertEquals(itemContext.mainVariables, {
      id: 1,
      name: "Item 1",
      price: 100,
    });
    assertEquals(itemContext.itemsData, undefined);
    assertEquals(itemContext.variableContext["@index"], 0);
    assertEquals(itemContext.variableContext["@item"], itemsArray[0]);
    assertEquals(itemContext.variableContext["@items"], itemsArray);
    assertEquals(itemContext.variableContext["title"], "Products");
    assertEquals(itemContext.renderingOptions.expandItems, false);
    assertEquals(itemContext.metadata.stage, "item-rendering");
  }
});

Deno.test("TemplateContextBuilder.forItem - preserves base context properties", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.njk",
    itemsPath: "templates/items.njk",
  };

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setItemsTemplatePath("templates/items.njk")
    .setOutputFormat("markdown")
    .setMainContext({ globalConfig: "value" })
    .setItemsArray([])
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "test",
      schemaPath: "test-schema.yaml",
      sourceFiles: ["test.md"],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    const baseContext = TemplateContextBuilder.fromIR(ir);
    const itemData = { itemProp: "itemValue" };
    const itemContext = TemplateContextBuilder.forItem(
      baseContext,
      itemData,
      5,
    );

    // Should preserve base rendering options
    assertEquals(itemContext.renderingOptions.format, "markdown");
    assertEquals(
      itemContext.renderingOptions.templatePaths.main,
      "templates/main.njk",
    );
    assertEquals(
      itemContext.renderingOptions.templatePaths.items,
      "templates/items.njk",
    );

    // Should preserve base metadata except stage
    assertEquals(itemContext.metadata.schemaPath, "test-schema.yaml");
    assertEquals(itemContext.metadata.mappingsCount, 0);

    // Should have item-specific stage
    assertEquals(itemContext.metadata.stage, "item-rendering");

    // Should have correct item index
    assertEquals(itemContext.variableContext["@index"], 5);
  }
});

Deno.test("TemplateContextBuilder - creates immutable context", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const mutableMainContext = { title: "Original" };
  const mutableItems = [{ id: 1 }];

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext(mutableMainContext)
    .setItemsArray(mutableItems)
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
    const ir = result.data;
    const context = TemplateContextBuilder.fromIR(ir);

    // Mutate original data
    mutableMainContext.title = "Modified";
    mutableItems.push({ id: 2 });

    // Context should remain unchanged
    assertEquals(context.mainVariables.title, "Original");
    assertEquals(context.itemsData?.length, 1);
    assertEquals((context.variableContext["@items"] as unknown[])?.length, 1);
  }
});

Deno.test("TemplateContext - interface structure validation", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext({})
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
    const ir = result.data;
    const context: TemplateContext = TemplateContextBuilder.fromIR(ir);

    // Verify all required interface properties exist
    assertExists(context.mainVariables);
    assertExists(context.variableContext);
    assertExists(context.renderingOptions);
    assertExists(context.renderingOptions.format);
    assertExists(context.renderingOptions.expandItems);
    assertExists(context.renderingOptions.templatePaths);
    assertExists(context.renderingOptions.templatePaths.main);
    assertExists(context.metadata);
    assertExists(context.metadata.stage);
    assertExists(context.metadata.schemaPath);
    assertExists(context.metadata.mappingsCount);

    // Optional field can be undefined
    assertEquals(context.itemsData, undefined);
  }
});

Deno.test("TemplateContextBuilder.fromIR - handles empty IR correctly", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "SingleTemplate",
    path: "templates/main.njk",
  };

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setOutputFormat("json")
    .setMainContext({})
    .setItemsArray(undefined)
    .setTemplateConfig(templateConfig)
    .setVariableMappings([])
    .setMetadata({
      stage: "empty",
      schemaPath: "",
      sourceFiles: [],
    })
    .build();

  assertEquals(result.ok, true);
  if (result.ok) {
    const ir = result.data;
    const context = TemplateContextBuilder.fromIR(ir);

    assertEquals(context.mainVariables, {});
    assertEquals(context.itemsData, undefined);
    assertEquals(context.variableContext, {});
    assertEquals(context.renderingOptions.expandItems, false);
    assertEquals(context.metadata.stage, "empty");
    assertEquals(context.metadata.schemaPath, "");
    assertEquals(context.metadata.mappingsCount, 0);
  }
});

Deno.test("TemplateContextBuilder.forItem - handles different item types", () => {
  const templateConfig: TemplateConfiguration = {
    kind: "DualTemplate",
    mainPath: "templates/main.njk",
    itemsPath: "templates/items.njk",
  };

  const irBuilder = new TemplateIRBuilder();
  const result = irBuilder
    .setMainTemplatePath("templates/main.njk")
    .setItemsTemplatePath("templates/items.njk")
    .setOutputFormat("json")
    .setMainContext({})
    .setItemsArray([])
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
    const ir = result.data;
    const baseContext = TemplateContextBuilder.fromIR(ir);

    // Test with object item
    const objectItem = { key: "value", nested: { prop: "data" } };
    const objectContext = TemplateContextBuilder.forItem(
      baseContext,
      objectItem,
      0,
    );
    assertEquals(objectContext.mainVariables, objectItem);
    assertEquals(objectContext.variableContext["@item"], objectItem);

    // Test with string item
    const stringItem = "simple string";
    const stringContext = TemplateContextBuilder.forItem(
      baseContext,
      stringItem,
      1,
    );
    assertEquals(stringContext.mainVariables, stringItem as any);
    assertEquals(stringContext.variableContext["@item"], stringItem);

    // Test with number item
    const numberItem = 42;
    const numberContext = TemplateContextBuilder.forItem(
      baseContext,
      numberItem,
      2,
    );
    assertEquals(numberContext.mainVariables, numberItem as any);
    assertEquals(numberContext.variableContext["@item"], numberItem);

    // Test with null item
    const nullItem = null;
    const nullContext = TemplateContextBuilder.forItem(
      baseContext,
      nullItem,
      3,
    );
    assertEquals(nullContext.mainVariables, nullItem as any);
    assertEquals(nullContext.variableContext["@item"], nullItem);
  }
});
