import { assertEquals } from "@std/assert";
import { ItemsExpander } from "../../../../../src/domain/template/services/items-expander.ts";
import { Template } from "../../../../../src/domain/template/entities/template.ts";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

// Helper function to create test templates
function createTestTemplate(
  content: Record<string, unknown>,
  format: "json" | "yaml" = "json",
) {
  const pathResult = TemplatePath.create("test-template.json");
  if (pathResult.isError()) {
    throw new Error("Failed to create test template path");
  }

  const templateResult = Template.create(pathResult.unwrap(), {
    content,
    format,
  });
  if (templateResult.isError()) {
    throw new Error("Failed to create test template");
  }

  return templateResult.unwrap();
}

Deno.test("ItemsExpander - create instance", () => {
  const expander = ItemsExpander.create();

  assertEquals(typeof expander, "object");
  assertEquals(expander.constructor.name, "ItemsExpander");
});

Deno.test("ItemsExpander - expand simple {@items} with array data", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    title: "Commands List",
    commands: "{@items}",
    footer: "End of list",
  });

  const itemsTemplate = createTestTemplate({
    id: "${id}",
    name: "${name}",
  });

  const arrayData = [
    { id: "cmd1", name: "First Command" },
    { id: "cmd2", name: "Second Command" },
  ];

  const context = {
    arrayData,
    itemsTemplate,
    containerTemplate,
    globalVariables: { version: "1.0" },
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();
  assertEquals(expansion.expandedItemCount, 2);

  const expandedContent = expansion.expandedContent;
  assertEquals(expandedContent.title, "Commands List");
  assertEquals(expandedContent.footer, "End of list");

  const commands = expandedContent.commands as any[];
  assertEquals(Array.isArray(commands), true);
  assertEquals(commands.length, 2);
  assertEquals(commands[0].id, "cmd1");
  assertEquals(commands[0].name, "First Command");
  assertEquals(commands[1].id, "cmd2");
  assertEquals(commands[1].name, "Second Command");
});

Deno.test("ItemsExpander - expand with array context variables", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    items: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    index: "${$index}",
    isFirst: "${$first}",
    isLast: "${$last}",
    value: "${value}",
  });

  const arrayData = ["apple", "banana", "cherry"];

  const context = {
    arrayData,
    itemsTemplate,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();

  const items = expansion.expandedContent.items as any[];
  assertEquals(items.length, 3);

  // Check first item
  assertEquals(items[0].index, "0");
  assertEquals(items[0].isFirst, "true");
  assertEquals(items[0].isLast, "false");
  assertEquals(items[0].value, "apple");

  // Check middle item
  assertEquals(items[1].index, "1");
  assertEquals(items[1].isFirst, "false");
  assertEquals(items[1].isLast, "false");
  assertEquals(items[1].value, "banana");

  // Check last item
  assertEquals(items[2].index, "2");
  assertEquals(items[2].isFirst, "false");
  assertEquals(items[2].isLast, "true");
  assertEquals(items[2].value, "cherry");
});

Deno.test("ItemsExpander - expand with object array data", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    users: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    userName: "${name}",
    userEmail: "${email}",
    globalVersion: "${version}",
  });

  const arrayData = [
    { name: "John", email: "john@example.com" },
    { name: "Jane", email: "jane@example.com" },
  ];

  const context = {
    arrayData,
    itemsTemplate,
    containerTemplate,
    globalVariables: { version: "2.0" },
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();

  const users = expansion.expandedContent.users as any[];
  assertEquals(users.length, 2);

  assertEquals(users[0].userName, "John");
  assertEquals(users[0].userEmail, "john@example.com");
  assertEquals(users[0].globalVersion, "2.0");

  assertEquals(users[1].userName, "Jane");
  assertEquals(users[1].userEmail, "jane@example.com");
  assertEquals(users[1].globalVersion, "2.0");
});

Deno.test("ItemsExpander - expand with nested {@items} patterns", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    section: {
      title: "Commands",
      content: "{@items}",
    },
    metadata: {
      count: 3,
    },
  });

  const itemsTemplate = createTestTemplate({
    command: "${cmd}",
    description: "${desc}",
  });

  const arrayData = [
    { cmd: "ls", desc: "List files" },
    { cmd: "cd", desc: "Change directory" },
  ];

  const context = {
    arrayData,
    itemsTemplate,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();

  const expandedContent = expansion.expandedContent;
  assertEquals(expandedContent.metadata, { count: 3 });

  const section = expandedContent.section as any;
  assertEquals(section.title, "Commands");

  const content = section.content as any[];
  assertEquals(content.length, 2);
  assertEquals(content[0].command, "ls");
  assertEquals(content[1].command, "cd");
});

Deno.test("ItemsExpander - expand without template (leaves unexpanded)", () => {
  const expander = ItemsExpander.create();

  const templateContent = {
    title: "Template",
    content: "{@items}",
    footer: "End",
  };

  const result = expander.expandItemsWithoutTemplate(templateContent);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();
  assertEquals(expansion.expandedItemCount, 0);
  assertEquals(expansion.expandedContent, templateContent);
});

Deno.test("ItemsExpander - create item context with object data", () => {
  const expander = ItemsExpander.create();

  const arrayItem = { id: "item1", name: "Test Item" };
  const itemIndex = 1;
  const globalVariables = { version: "1.0", debug: true };

  const context = expander.createItemContext(
    arrayItem,
    itemIndex,
    globalVariables,
  );

  assertEquals(context.id, "item1");
  assertEquals(context.name, "Test Item");
  assertEquals(context.version, "1.0");
  assertEquals(context.debug, true);
  assertEquals(context.$index, 1);
  assertEquals(context.$first, false);
  assertEquals(context.$last, false);
});

Deno.test("ItemsExpander - create item context with primitive data", () => {
  const expander = ItemsExpander.create();

  const arrayItem = "simple string";
  const itemIndex = 0;
  const globalVariables = { prefix: "item" };

  const context = expander.createItemContext(
    arrayItem,
    itemIndex,
    globalVariables,
  );

  assertEquals(context.value, "simple string");
  assertEquals(context.prefix, "item");
  assertEquals(context.$index, 0);
  assertEquals(context.$first, true);
  assertEquals(context.$last, false);
});

Deno.test("ItemsExpander - handle empty array data", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    items: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    value: "${value}",
  });

  const context = {
    arrayData: [],
    itemsTemplate,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();
  assertEquals(expansion.expandedItemCount, 0);

  const items = expansion.expandedContent.items as any[];
  assertEquals(Array.isArray(items), true);
  assertEquals(items.length, 0);
});

Deno.test("ItemsExpander - handle invalid array data", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    items: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    value: "${value}",
  });

  const context = {
    arrayData: "not an array" as any,
    itemsTemplate,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_ARRAY_DATA");
});

Deno.test("ItemsExpander - handle template without {@items}", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    title: "No Items Template",
    content: "Static content",
  });

  const itemsTemplate = createTestTemplate({
    value: "${value}",
  });

  const context = {
    arrayData: ["test"],
    itemsTemplate,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EXPANSION_CONTEXT_ERROR");
});

Deno.test("ItemsExpander - handle missing items template", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    items: "{@items}",
  });

  const context = {
    arrayData: ["test"],
    itemsTemplate: null as any,
    containerTemplate,
    globalVariables: {},
  };

  const result = expander.expandItems(context);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EXPANSION_CONTEXT_ERROR");
});

Deno.test("ItemsExpander - handle complex nested object data", () => {
  const expander = ItemsExpander.create();

  const containerTemplate = createTestTemplate({
    configurations: "{@items}",
  });

  const itemsTemplate = createTestTemplate({
    service: "${service.name}",
    port: "${service.port}",
    environment: "${env}",
    tags: "${metadata.tags}",
  });

  const arrayData = [
    {
      service: { name: "web", port: 8080 },
      env: "production",
      metadata: { tags: ["frontend", "api"] },
    },
    {
      service: { name: "db", port: 5432 },
      env: "production",
      metadata: { tags: ["database"] },
    },
  ];

  const context = {
    arrayData,
    itemsTemplate,
    containerTemplate,
    globalVariables: { cluster: "prod-1" },
  };

  const result = expander.expandItems(context);

  assertEquals(result.isOk(), true);
  const expansion = result.unwrap();

  const configurations = expansion.expandedContent.configurations as any[];
  assertEquals(configurations.length, 2);

  assertEquals(configurations[0].service, "web");
  assertEquals(configurations[0].port, "8080");
  assertEquals(configurations[0].environment, "production");
  assertEquals(configurations[0].tags, "frontend,api");

  assertEquals(configurations[1].service, "db");
  assertEquals(configurations[1].port, "5432");
});
