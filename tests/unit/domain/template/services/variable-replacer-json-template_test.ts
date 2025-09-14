import { assertEquals, assertExists } from "@std/assert";
import { VariableReplacer } from "../../../../../src/domain/template/services/variable-replacer.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { isOk } from "../../../../../src/domain/shared/types/result.ts";

/**
 * 包括的なJSONテンプレート処理テスト
 * JSONテンプレートと値を渡して、出力がテンプレート構造通りになることを担保
 */
Deno.test("VariableReplacer - JSON Template Structure Preservation", async (t) => {
  const replacerResult = VariableReplacer.create();
  if (!replacerResult.ok) {
    throw new Error("Failed to create VariableReplacer");
  }
  const replacer = replacerResult.data;

  await t.step("should preserve exact JSON template structure", () => {
    const jsonTemplate = {
      "$schema": "http://example.com/schema.json",
      "name": "{project.name}",
      "version": "{project.version}",
      "metadata": {
        "author": "{author}",
        "created": "{timestamp}",
        "tags": "{tags}",
      },
      "config": {
        "input": "{paths.input}",
        "output": "{paths.output}",
        "options": {
          "debug": "{debug}",
          "verbose": "{verbose}",
        },
      },
      "staticValue": "This should not change",
      "items": [],
    };

    const dataResult = FrontmatterData.create({
      project: {
        name: "frontmatter-to-schema",
        version: "2.0.0",
      },
      author: "Test Author",
      timestamp: "2024-01-01T00:00:00Z",
      tags: ["template", "json", "test"],
      paths: {
        input: "./src",
        output: "./dist",
      },
      debug: false,
      verbose: true,
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(jsonTemplate, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;

      // 構造が完全に保持されていることを確認
      assertEquals(output.$schema, "http://example.com/schema.json");
      assertEquals(output.name, "frontmatter-to-schema");
      assertEquals(output.version, "2.0.0");
      assertEquals(output.metadata.author, "Test Author");
      assertEquals(output.metadata.created, "2024-01-01T00:00:00Z");
      // JSON templates now preserve arrays as actual arrays (correct behavior)
      assertEquals(output.metadata.tags, ["template", "json", "test"]);
      assertEquals(output.config.input, "./src");
      assertEquals(output.config.output, "./dist");
      // JSON templates now preserve booleans as actual booleans (correct behavior)
      assertEquals(output.config.options.debug, false);
      assertEquals(output.config.options.verbose, true);
      assertEquals(output.staticValue, "This should not change");
      assertEquals(Array.isArray(output.items), true);
      assertEquals(output.items.length, 0);

      // オブジェクトのキーが追加・削除されていないことを確認
      assertEquals(Object.keys(output).sort(), [
        "$schema",
        "config",
        "items",
        "metadata",
        "name",
        "staticValue",
        "version",
      ]);
      assertEquals(Object.keys(output.metadata).sort(), [
        "author",
        "created",
        "tags",
      ]);
      assertEquals(Object.keys(output.config).sort(), [
        "input",
        "options",
        "output",
      ]);
    }
  });

  await t.step("should handle nested object templates correctly", () => {
    const nestedTemplate = {
      "level1": {
        "level2": {
          "level3": {
            "value": "{deep.nested.value}",
            "array": "{deep.nested.array}",
          },
        },
        "sibling": "{sibling.value}",
      },
    };

    const dataResult = FrontmatterData.create({
      deep: {
        nested: {
          value: "Deep Value",
          array: [1, 2, 3],
        },
      },
      sibling: {
        value: "Sibling Value",
      },
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(nestedTemplate, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(output.level1.level2.level3.value, "Deep Value");
      // JSON templates now preserve arrays as actual arrays (correct behavior)
      assertEquals(output.level1.level2.level3.array, [1, 2, 3]);
      assertEquals(output.level1.sibling, "Sibling Value");
    }
  });

  await t.step("should handle mixed static and dynamic values", () => {
    const mixedTemplate = {
      "static": "This is static",
      "dynamic": "{dynamic}",
      "mixed": "Static prefix: {value}",
      "number": 42,
      "boolean": true,
      "null": null,
      "array": [
        "static",
        "{item1}",
        "{item2}",
        100,
      ],
    };

    const dataResult = FrontmatterData.create({
      dynamic: "Dynamic Value",
      value: "Injected Value",
      item1: "First Item",
      item2: "Second Item",
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(mixedTemplate, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(output.static, "This is static");
      assertEquals(output.dynamic, "Dynamic Value");
      assertEquals(output.mixed, "Static prefix: Injected Value");
      assertEquals(output.number, 42);
      assertEquals(output.boolean, true);
      assertEquals(output.null, null);
      assertEquals(output.array[0], "static");
      assertEquals(output.array[1], "First Item");
      assertEquals(output.array[2], "Second Item");
      assertEquals(output.array[3], 100);
    }
  });
});

Deno.test("VariableReplacer - Array Expansion with {@items}", async (t) => {
  const replacerResult = VariableReplacer.create();
  if (!replacerResult.ok) {
    throw new Error("Failed to create VariableReplacer");
  }
  const replacer = replacerResult.data;

  await t.step("should expand {@items} in object template", () => {
    const template = {
      "registry": {
        "name": "climpt",
        "version": "1.0.0",
        "commands": "{@items}",
      },
    };

    const dataArray = [
      { id: "build", name: "Build Command", args: ["--config"] },
      { id: "test", name: "Test Command", args: ["--coverage"] },
      { id: "deploy", name: "Deploy Command", args: ["--env"] },
    ];

    const result = replacer.processArrayExpansion(template, dataArray);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(output.registry.name, "climpt");
      assertEquals(output.registry.version, "1.0.0");
      // ✅ Fixed: {@items} now properly expands to actual array instead of stringified JSON
      // This ensures proper JSON structure in output files
      assertEquals(output.registry.commands, dataArray);
    }
  });

  await t.step("should handle {@items} in array template", () => {
    const template = [
      "header",
      "{@items}",
      "footer",
    ];

    const dataArray = ["item1", "item2", "item3"];

    const result = replacer.processArrayExpansion(template, dataArray);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any[];
      assertEquals(Array.isArray(output), true);
      assertEquals(output.length, 5);
      assertEquals(output[0], "header");
      assertEquals(output[1], "item1");
      assertEquals(output[2], "item2");
      assertEquals(output[3], "item3");
      assertEquals(output[4], "footer");
    }
  });
});

Deno.test("VariableReplacer - Real-world climpt registry template", async (t) => {
  const replacerResult = VariableReplacer.create();
  if (!replacerResult.ok) {
    throw new Error("Failed to create VariableReplacer");
  }
  const replacer = replacerResult.data;

  await t.step("should process climpt registry template correctly", () => {
    // 実際のプロジェクトで使用されるテンプレート構造
    const registryTemplate = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "name": "{name}",
      "version": "{version}",
      "description": "{description}",
      "commands": "{@items}",
      "metadata": {
        "generated": "{timestamp}",
        "source": "{source}",
      },
    };

    // 単一コマンドデータ
    const commandData = FrontmatterData.create({
      name: "climpt",
      version: "1.0.0",
      description: "Command Line Prompt Tool",
      timestamp: "2024-01-01T00:00:00Z",
      source: "prompts directory",
    });

    if (!commandData.ok) {
      throw new Error("Failed to create command data");
    }

    // まず通常の変数置換をテスト
    const singleResult = replacer.processValue(
      registryTemplate,
      commandData.data,
    );

    assertEquals(isOk(singleResult), true);
    if (isOk(singleResult)) {
      const output = singleResult.data as any;
      assertEquals(output.$schema, "http://json-schema.org/draft-07/schema#");
      assertEquals(output.name, "climpt");
      assertEquals(output.version, "1.0.0");
      assertEquals(output.description, "Command Line Prompt Tool");
      assertEquals(output.metadata.generated, "2024-01-01T00:00:00Z");
      assertEquals(output.metadata.source, "prompts directory");
    }

    // 次に配列展開をテスト
    const commands = [
      {
        id: "build",
        name: "build",
        description: "Build the project",
        config: "build",
        args: ["--config", "--output"],
      },
      {
        id: "test",
        name: "test",
        description: "Run tests",
        config: "test",
        args: ["--coverage", "--watch"],
      },
      {
        id: "deploy",
        name: "deploy",
        description: "Deploy application",
        config: "deploy",
        args: ["--env", "--region"],
      },
    ];

    const arrayResult = replacer.processArrayExpansion(
      registryTemplate,
      commands,
    );

    assertEquals(isOk(arrayResult), true);
    if (isOk(arrayResult)) {
      const output = arrayResult.data as any;
      assertExists(output.commands);
      // ✅ Fixed: {@items} now properly expands to actual array instead of stringified JSON
      assertEquals(output.commands, commands);
    }
  });
});

Deno.test("VariableReplacer - Error handling and edge cases", async (t) => {
  const replacerResult = VariableReplacer.create();
  if (!replacerResult.ok) {
    throw new Error("Failed to create VariableReplacer");
  }
  const replacer = replacerResult.data;

  await t.step("should handle missing variables gracefully", () => {
    const template = {
      "existing": "{existing}",
      "missing": "{missing}",
      "nested": "{nested.missing.value}",
    };

    const dataResult = FrontmatterData.create({
      existing: "I exist",
      nested: {
        present: "I am here",
      },
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(template, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(output.existing, "I exist");
      // 見つからない変数はプレースホルダーのまま残る
      assertEquals(output.missing, "{missing}");
      assertEquals(output.nested, "{nested.missing.value}");
    }
  });

  await t.step("should handle empty template", () => {
    const emptyTemplate = {};
    const dataResult = FrontmatterData.create({
      some: "data",
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(emptyTemplate, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(Object.keys(output).length, 0);
    }
  });

  await t.step("should handle template with no placeholders", () => {
    const staticTemplate = {
      "static1": "No placeholders here",
      "static2": 123,
      "static3": true,
      "static4": ["a", "b", "c"],
    };

    const dataResult = FrontmatterData.create({
      unused: "This data is not used",
    });

    if (!dataResult.ok) {
      throw new Error("Failed to create FrontmatterData");
    }

    const result = replacer.processValue(staticTemplate, dataResult.data);

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      const output = result.data as any;
      assertEquals(output.static1, "No placeholders here");
      assertEquals(output.static2, 123);
      assertEquals(output.static3, true);
      assertEquals(output.static4, ["a", "b", "c"]);
    }
  });
});
