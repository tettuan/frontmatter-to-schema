/**
 * Tests for JsonTemplateProcessorImpl
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { JsonTemplateProcessorImpl } from "../src/template-processor.ts";
import {
  InvalidJsonError,
  TemplateNotFoundError,
} from "../src/errors.ts";

// Helper to create temporary test files
async function createTempFile(content: string): Promise<string> {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  await Deno.writeTextFile(tempFile, content);
  return tempFile;
}

async function cleanup(filePath: string) {
  try {
    await Deno.remove(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

Deno.test("JsonTemplateProcessorImpl - basic variable substitution", async () => {
  const template = '{"name": "{name}", "version": "{version}"}';
  const data = { name: "test-app", version: "1.0.0" };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      name: "test-app",
      version: "1.0.0",
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - dot notation substitution", async () => {
  const template =
    '{"userName": "{user.profile.name}", "userAge": "{user.profile.age}"}';
  const data = {
    user: {
      profile: {
        name: "John Doe",
        age: 30,
      },
    },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      userName: "John Doe",
      userAge: 30,
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - array access substitution", async () => {
  const template =
    '{"firstItem": "{items[0]}", "secondUser": "{users[1].name}"}';
  const data = {
    items: ["apple", "banana"],
    users: [
      { name: "Alice" },
      { name: "Bob" },
    ],
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      firstItem: "apple",
      secondUser: "Bob",
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - complex template", async () => {
  const template = `{
    "version": "{version}",
    "description": "{description}",
    "tools": {
      "availableConfigs": "{tools.availableConfigs}",
      "firstCommand": "{tools.commands[0].title}"
    }
  }`;

  const data = {
    version: "1.0.0",
    description: "Test application",
    tools: {
      availableConfigs: ["git", "test"],
      commands: [
        { title: "Git Command", c1: "git" },
      ],
    },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      version: "1.0.0",
      description: "Test application",
      tools: {
        availableConfigs: ["git", "test"],
        firstCommand: "Git Command",
      },
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - handles different value types", async () => {
  const template = `{
    "stringVal": "{stringVal}",
    "numberVal": "{numberVal}",
    "booleanVal": "{booleanVal}",
    "nullVal": "{nullVal}",
    "arrayVal": "{arrayVal}",
    "objectVal": "{objectVal}"
  }`;

  const data = {
    stringVal: "hello",
    numberVal: 42,
    booleanVal: true,
    nullVal: null,
    arrayVal: [1, 2, 3],
    objectVal: { nested: "value" },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      stringVal: "hello",
      numberVal: 42,
      booleanVal: true,
      nullVal: null,
      arrayVal: [1, 2, 3],
      objectVal: { nested: "value" },
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - throws TemplateNotFoundError for missing file", async () => {
  const processor = new JsonTemplateProcessorImpl();

  await assertRejects(
    () => processor.process({}, "/non/existent/file.json"),
    TemplateNotFoundError,
  );
});

Deno.test("JsonTemplateProcessorImpl - handles missing variables with empty string", async () => {
  const template = '{"value": "{missing.variable}", "existing": "{existing}"}';
  const data = { existing: "value" };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();

    // Should NOT throw, instead returns empty string for missing variable
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      value: "", // Missing variable replaced with empty string
      existing: "value",
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - throws InvalidJsonError for malformed result", async () => {
  const template = '{"invalid": "{value}"'; // Missing closing brace
  const data = { value: "test" };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();

    await assertRejects(
      () => processor.process(data, tempFile),
      InvalidJsonError,
    );
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - validateTemplate method", () => {
  const processor = new JsonTemplateProcessorImpl();
  const template = '{"name": "{user.name}", "count": "{items[0]}"}';

  const variables = processor.validateTemplate(template);
  assertEquals(variables.sort(), ["items[0]", "user.name"]);
});

Deno.test("JsonTemplateProcessorImpl - validateVariables method", () => {
  const processor = new JsonTemplateProcessorImpl();
  const template =
    '{"name": "{user.name}", "missing": "{missing.var}", "count": "{count}"}';
  const data = {
    user: { name: "John" },
    count: 5,
  };

  const result = processor.validateVariables(template, data);

  assertEquals(result.valid, false);
  assertEquals(result.availableVariables.sort(), ["count", "user.name"]);
  assertEquals(result.missingVariables, ["missing.var"]);
});

Deno.test("JsonTemplateProcessorImpl - validateVariables with all variables available", () => {
  const processor = new JsonTemplateProcessorImpl();
  const template = '{"name": "{user.name}", "count": "{count}"}';
  const data = {
    user: { name: "John" },
    count: 5,
  };

  const result = processor.validateVariables(template, data);

  assertEquals(result.valid, true);
  assertEquals(result.availableVariables.sort(), ["count", "user.name"]);
  assertEquals(result.missingVariables, []);
});

Deno.test("JsonTemplateProcessorImpl - handles whitespace in variable names", async () => {
  const template = '{"value": "{ user.name }", "count": "{  count  }"}';
  const data = {
    user: { name: "John" },
    count: 5,
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      value: "John",
      count: 5,
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - handles empty template", async () => {
  const template = "{}";
  const data = { anything: "value" };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {});
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - property name mismatch handling with optional variables", async () => {
  // Demonstrates issue #1293/#1294/#1295 - template now handles missing properties gracefully
  const template = `{
    "options": "{options}",
    "options_each": {
      "input": "{options.input}",
      "input_file": "{options.input_file}"
    }
  }`;

  // Data with "file" property instead of "input_file"
  const dataWithFile = {
    options: {
      input: ["value"],
      file: true,  // Property name is "file", not "input_file"
    },
  };

  // Data with correct "input_file" property
  const dataWithInputFile = {
    options: {
      input: ["value"],
      input_file: true,  // Correct property name
    },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();

    // Should now succeed with empty string for missing property
    const resultWithMissing = await processor.process(dataWithFile, tempFile);
    assertEquals(resultWithMissing, {
      options: {
        input: ["value"],
        file: true,
      },
      options_each: {
        input: ["value"],
        input_file: "", // Missing property replaced with empty string
      },
    });

    // Should succeed with correct property name
    const result = await processor.process(dataWithInputFile, tempFile);
    assertEquals(result, {
      options: {
        input: ["value"],
        input_file: true,
      },
      options_each: {
        input: ["value"],
        input_file: true,
      },
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("JsonTemplateProcessorImpl - missing optional property now succeeds with empty string", async () => {
  // json-template now supports optional variables
  const template = `{
    "required": "{required}",
    "optional": "{optional}"
  }`;

  const dataWithoutOptional = {
    required: "value",
    // optional is missing
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = new JsonTemplateProcessorImpl();

    // Should now succeed with empty string for missing "optional" property
    const result = await processor.process(dataWithoutOptional, tempFile);
    assertEquals(result, {
      required: "value",
      optional: "", // Missing property replaced with empty string
    });
  } finally {
    await cleanup(tempFile);
  }
});
