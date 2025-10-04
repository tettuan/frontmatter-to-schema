/**
 * Integration tests for the entire JSON template processing system
 */

import {
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createTemplateProcessor } from "../src/mod.ts";

// Helper to create temporary test files
async function createTempFile(
  content: string,
  suffix = ".json",
): Promise<string> {
  const tempFile = await Deno.makeTempFile({ suffix });
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

Deno.test("Integration - Complete workflow with complex data", async () => {
  const template = `{
    "meta": {
      "version": "{version}",
      "description": "{description}",
      "author": "{author.name}"
    },
    "config": {
      "tools": "{tools.availableConfigs}",
      "primaryTool": "{tools.availableConfigs[0]}",
      "commandCount": "{tools.commands.length}",
      "firstCommand": {
        "category": "{tools.commands[0].c1}",
        "action": "{tools.commands[0].c2}",
        "title": "{tools.commands[0].title}",
        "hasFileInput": "{tools.commands[0].options.input_file[0]}"
      }
    },
    "statistics": {
      "totalConfigs": "{tools.availableConfigs.length}",
      "configTypes": "{tools.availableConfigs}"
    }
  }`;

  const data = {
    version: "2.1.0",
    description: "Advanced CLI tool registry",
    author: {
      name: "John Smith",
      email: "john@example.com",
    },
    tools: {
      availableConfigs: ["git", "test", "spec"],
      commands: [
        {
          c1: "git",
          c2: "create",
          c3: "issue",
          title: "Create Git Issue",
          description: "Creates a new git issue",
          options: {
            input: ["file", "stdin"],
            input_file: [true, false],
            output: ["console", "file"],
          },
        },
        {
          c1: "test",
          c2: "run",
          c3: "unit",
          title: "Run Unit Tests",
          description: "Execute unit test suite",
        },
      ],
    },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      meta: {
        version: "2.1.0",
        description: "Advanced CLI tool registry",
        author: "John Smith",
      },
      config: {
        tools: ["git", "test", "spec"],
        primaryTool: "git",
        commandCount: 2,
        firstCommand: {
          category: "git",
          action: "create",
          title: "Create Git Issue",
          hasFileInput: true,
        },
      },
      statistics: {
        totalConfigs: 3,
        configTypes: ["git", "test", "spec"],
      },
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Integration - Real-world registry template", async () => {
  const registryTemplate = `{
    "version": "{version}",
    "description": "{description}",
    "tools": {
      "availableConfigs": "{tools.availableConfigs}",
      "commands": [
        {
          "c1": "{tools.commands[0].c1}",
          "c2": "{tools.commands[0].c2}",
          "c3": "{tools.commands[0].c3}",
          "title": "{tools.commands[0].title}",
          "description": "{tools.commands[0].description}",
          "usage": "{tools.commands[0].usage}",
          "options": {
            "input": "{tools.commands[0].options.input}",
            "adaptation": "{tools.commands[0].options.adaptation}",
            "input_file": "{tools.commands[0].options.input_file}",
            "stdin": "{tools.commands[0].options.stdin}",
            "destination": "{tools.commands[0].options.destination}"
          }
        }
      ]
    }
  }`;

  const registryData = {
    version: "1.0.0",
    description: "CLI Tool Registry",
    tools: {
      availableConfigs: ["git", "spec", "test"],
      commands: [
        {
          c1: "git",
          c2: "create",
          c3: "refinement-issue",
          title: "Create Refinement Issue",
          description: "Create a new refinement issue in git",
          usage: "climpt-git create refinement-issue [options]",
          options: {
            input: ["text", "file"],
            adaptation: ["standard", "detailed"],
            input_file: [true],
            stdin: [false],
            destination: [true],
          },
        },
      ],
    },
  };

  const tempFile = await createTempFile(registryTemplate);

  try {
    const processor = createTemplateProcessor();
    const result = await processor.process(registryData, tempFile);

    assertEquals(result, {
      version: "1.0.0",
      description: "CLI Tool Registry",
      tools: {
        availableConfigs: ["git", "spec", "test"],
        commands: [
          {
            c1: "git",
            c2: "create",
            c3: "refinement-issue",
            title: "Create Refinement Issue",
            description: "Create a new refinement issue in git",
            usage: "climpt-git create refinement-issue [options]",
            options: {
              input: ["text", "file"],
              adaptation: ["standard", "detailed"],
              input_file: [true],
              stdin: [false],
              destination: [true],
            },
          },
        ],
      },
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Integration - Optional variable handling with warning", async () => {
  const template = `{
    "valid": "{existing.value}",
    "optional": "{missing.deeply.nested.value}"
  }`;

  const data = {
    existing: { value: "test" },
  };

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();

    // Should now succeed with warning logged and empty string for missing variable
    const result = await processor.process(data, tempFile);

    assertEquals(result, {
      valid: "test",
      optional: "", // Missing variable replaced with empty string
    });
  } finally {
    await cleanup(tempFile);
  }
});

Deno.test("Integration - Template validation workflow", () => {
  const template = `{
    "user": "{profile.name}",
    "settings": "{config.theme}",
    "missing": "{not.found}",
    "array": "{items[0]}"
  }`;

  const data = {
    profile: { name: "Alice" },
    config: { theme: "dark" },
    items: ["first", "second"],
  };

  const processor = createTemplateProcessor();

  // Test template variable extraction
  const variables = processor.validateTemplate(template);
  assertEquals(variables.sort(), [
    "config.theme",
    "items[0]",
    "not.found",
    "profile.name",
  ]);

  // Test variable validation
  const validation = processor.validateVariables(template, data);
  assertEquals(validation.valid, false);
  assertEquals(validation.availableVariables.sort(), [
    "config.theme",
    "items[0]",
    "profile.name",
  ]);
  assertEquals(validation.missingVariables, ["not.found"]);
});

Deno.test("Integration - Performance with large data structures", async () => {
  // Create large data structure
  const commands = [];
  for (let i = 0; i < 100; i++) {
    commands.push({
      c1: `domain${i}`,
      c2: `action${i}`,
      c3: `target${i}`,
      title: `Command ${i}`,
      description: `Description for command ${i}`,
      data: Array(50).fill(null).map((_, j) => ({ id: j, value: `value${j}` })),
    });
  }

  const largeData = {
    version: "1.0.0",
    description: "Large registry",
    commands,
    metadata: {
      totalCommands: commands.length,
      categories: commands.map((c) => c.c1),
      firstCommand: commands[0],
      lastCommand: commands[commands.length - 1],
    },
  };

  const template = `{
    "version": "{version}",
    "description": "{description}",
    "summary": {
      "total": "{metadata.totalCommands}",
      "first": "{metadata.firstCommand.title}",
      "last": "{metadata.lastCommand.title}",
      "sampleData": "{commands[50].data[25].value}"
    }
  }`;

  const tempFile = await createTempFile(template);

  try {
    const processor = createTemplateProcessor();
    const startTime = performance.now();
    const result = await processor.process(largeData, tempFile);
    const endTime = performance.now();

    // Verify result
    assertEquals(result, {
      version: "1.0.0",
      description: "Large registry",
      summary: {
        total: 100,
        first: "Command 0",
        last: "Command 99",
        sampleData: "value25",
      },
    });

    // Performance should be reasonable (less than 100ms for this size)
    const processingTime = endTime - startTime;
    console.log(
      `Processing time for large data: ${processingTime.toFixed(2)}ms`,
    );

    // This is a soft assertion - adjust threshold based on actual performance needs
    if (processingTime > 1000) {
      console.warn(
        `Performance warning: Processing took ${processingTime.toFixed(2)}ms`,
      );
    }
  } finally {
    await cleanup(tempFile);
  }
});
