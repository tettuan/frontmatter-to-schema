import { assertEquals } from "@std/assert";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";
import { ItemsDetector } from "../../../../../src/domain/template/services/items-detector.ts";

// Helper function to create test templates
function createTestTemplate(
  content: Record<string, unknown>,
  path = "test-template.json",
) {
  const pathResult = TemplatePath.create(path);
  if (pathResult.isError()) {
    throw new Error("Failed to create test template path");
  }

  const templateResult = Template.create(pathResult.unwrap(), {
    content,
    format: "json",
  });
  if (templateResult.isError()) {
    throw new Error("Failed to create test template");
  }

  return templateResult.unwrap();
}

Deno.test("Template - getItemsDetectionResult with {@items} patterns", () => {
  const template = createTestTemplate({
    title: "Commands Template",
    commands: "{@items}",
    footer: "End of commands",
  });

  const result = template.getItemsDetectionResult();

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.isExpandable, true);
  assertEquals(detection.patterns.length, 1);

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["commands"]);
  assertEquals(pattern.isValid, true);
});

Deno.test("Template - getItemsDetectionResult without {@items} patterns", () => {
  const template = createTestTemplate({
    title: "Simple Template",
    content: "No items here",
    metadata: {
      version: "1.0",
    },
  });

  const result = template.getItemsDetectionResult();

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, false);
  assertEquals(detection.isExpandable, false);
  assertEquals(detection.patterns.length, 0);
});

Deno.test("Template - getItemsDetectionResult with custom detector", () => {
  const template = createTestTemplate({
    data: "{@items}",
  });

  const customDetector = ItemsDetector.create();
  const result = template.getItemsDetectionResult(customDetector);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1);
});

Deno.test("Template - requiresItemsProcessing returns true for expandable templates", () => {
  const templateWithItems = createTestTemplate({
    commands: "{@items}",
  });

  const templateWithoutItems = createTestTemplate({
    commands: "static content",
  });

  assertEquals(templateWithItems.requiresItemsProcessing(), true);
  assertEquals(templateWithoutItems.requiresItemsProcessing(), false);
});

Deno.test("Template - requiresItemsProcessing with custom detector", () => {
  const template = createTestTemplate({
    nested: {
      items: "{@items}",
    },
  });

  const detector = ItemsDetector.create();
  assertEquals(template.requiresItemsProcessing(detector), true);
});

Deno.test("Template - createItemsContext creates proper context", () => {
  const template = createTestTemplate({
    title: "Test Template",
    commands: "{@items}",
  });

  const arrayData = [
    { id: "cmd1", name: "First Command" },
    { id: "cmd2", name: "Second Command" },
  ];

  const globalVariables = {
    version: "1.0",
    debug: false,
  };

  const context = template.createItemsContext(arrayData, globalVariables);

  assertEquals(context.containerTemplate, template);
  assertEquals(context.arrayData, arrayData);
  assertEquals(context.globalVariables, globalVariables);
});

Deno.test("Template - createItemsContext with default global variables", () => {
  const template = createTestTemplate({
    data: "{@items}",
  });

  const arrayData = ["item1", "item2"];

  const context = template.createItemsContext(arrayData);

  assertEquals(context.containerTemplate, template);
  assertEquals(context.arrayData, arrayData);
  assertEquals(context.globalVariables, {});
});

Deno.test("Template - backward compatibility with hasItemsExpansion", () => {
  const templateWithItems = createTestTemplate({
    content: "{@items}",
  });

  const templateWithoutItems = createTestTemplate({
    content: "static",
  });

  // Original method should still work
  assertEquals(templateWithItems.hasItemsExpansion(), true);
  assertEquals(templateWithoutItems.hasItemsExpansion(), false);

  // Enhanced method should give same results for basic cases
  assertEquals(templateWithItems.requiresItemsProcessing(), true);
  assertEquals(templateWithoutItems.requiresItemsProcessing(), false);
});

Deno.test("Template - backward compatibility with isItemsTemplate", () => {
  const containerTemplate = createTestTemplate({
    commands: "{@items}",
  }, "container-template.json");

  const itemsTemplate = createTestTemplate({
    id: "${id}",
    name: "${name}",
  }, "item-template.json");

  // Container template has {@items} so should be considered items template
  assertEquals(containerTemplate.isItemsTemplate(), true);

  // Item template might not have {@items} but could be detected by path
  assertEquals(itemsTemplate.isItemsTemplate(), false);
});

Deno.test("Template - enhanced detection with complex nested patterns", () => {
  const template = createTestTemplate({
    sections: [
      {
        title: "Commands",
        items: "{@items}",
      },
      {
        title: "Static",
        content: "No items",
      },
      {
        title: "More Commands",
        data: {
          commands: "{@items}",
        },
      },
    ],
  });

  const result = template.getItemsDetectionResult();

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  const paths = detection.patterns.map((p) => p.path.join("."));
  assertEquals(paths.includes("sections.0.items"), true);
  assertEquals(paths.includes("sections.2.data.commands"), true);
});

Deno.test("Template - handle malformed {@items} patterns", () => {
  const template = createTestTemplate({
    incomplete: "{@items", // Missing closing brace
    correct: "{@items}",
    wrong: "items}",
  });

  const result = template.getItemsDetectionResult();

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1); // Only the correct one

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["correct"]);
});

Deno.test("Template - integration with existing variable resolution", () => {
  const template = createTestTemplate({
    title: "${templateTitle}",
    commands: "{@items}",
    version: "${version}",
  });

  const variables = {
    templateTitle: "Dynamic Commands List",
    version: "2.0",
  };

  // Existing variable resolution should still work
  const resolvedResult = template.resolveVariables(variables);
  assertEquals(resolvedResult.isOk(), true);

  const resolvedTemplate = resolvedResult.unwrap();
  const content = resolvedTemplate.getContent();

  assertEquals(content.title, "Dynamic Commands List");
  assertEquals(content.commands, "{@items}"); // {@items} should not be resolved by variable resolution
  assertEquals(content.version, "2.0");

  // Enhanced detection should work on resolved template
  assertEquals(resolvedTemplate.requiresItemsProcessing(), true);
});

Deno.test("Template - comprehensive items context with complex data", () => {
  const template = createTestTemplate({
    metadata: {
      title: "Complex Template",
      commands: "{@items}",
    },
    footer: "Generated template",
  });

  const arrayData = [
    {
      command: "build",
      args: ["--prod", "--verbose"],
      metadata: { type: "build" },
    },
    {
      command: "test",
      args: ["--coverage"],
      metadata: { type: "test" },
    },
  ];

  const globalVariables = {
    environment: "production",
    timestamp: "2024-01-01T00:00:00Z",
    features: {
      caching: true,
      logging: false,
    },
  };

  const context = template.createItemsContext(arrayData, globalVariables);

  assertEquals(context.containerTemplate, template);
  assertEquals(context.arrayData.length, 2);
  assertEquals(context.globalVariables.environment, "production");
  assertEquals((context.globalVariables.features as any).caching, true);

  // Verify array data structure is preserved
  const firstItem = context.arrayData[0] as any;
  assertEquals(firstItem.command, "build");
  assertEquals(Array.isArray(firstItem.args), true);
  assertEquals(firstItem.metadata.type, "build");
});

Deno.test("Template - error handling in items detection", () => {
  // Create a template with potentially problematic content
  const template = createTestTemplate({
    validItems: "{@items}",
    null: null,
    undefined: undefined,
    number: 42,
    array: ["{@items}", null, undefined],
  });

  const result = template.getItemsDetectionResult();

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2); // validItems and array.0

  const paths = detection.patterns.map((p) => p.path.join("."));
  assertEquals(paths.includes("validItems"), true);
  assertEquals(paths.includes("array.0"), true);
});
