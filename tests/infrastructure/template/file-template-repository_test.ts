import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import { FileTemplateRepository } from "../../../src/infrastructure/template/file-template-repository.ts";
import { Template, TemplateId } from "../../../src/domain/models/entities.ts";
import {
  TemplateFormat,
  TemplatePath,
} from "../../../src/domain/models/value-objects.ts";

// Helper function to create a test template directory
async function createTestTemplateDir(): Promise<string> {
  const tmpDir = await Deno.makeTempDir({ prefix: "template_test_" });
  return tmpDir;
}

// Helper function to cleanup test directory
async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Helper function to create a test template file
async function createTestTemplateFile(
  dir: string,
  filename: string,
  content: string,
): Promise<string> {
  const filePath = `${dir}/${filename}`;
  await Deno.writeTextFile(filePath, content);
  return filePath;
}

Deno.test("FileTemplateRepository - Constructor and Basic Setup", async (t) => {
  await t.step("creates repository with default base path", () => {
    const repo = new FileTemplateRepository();
    assertExists(repo);
  });

  await t.step("creates repository with custom base path", () => {
    const customPath = "/custom/templates";
    const repo = new FileTemplateRepository(customPath);
    assertExists(repo);
  });
});

Deno.test("FileTemplateRepository - Load Template by ID", async (t) => {
  const testDir = await createTestTemplateDir();

  try {
    const repo = new FileTemplateRepository(testDir);

    await t.step("loads JSON template successfully", async () => {
      const templateContent = JSON.stringify(
        {
          title: "{{title}}",
          description: "{{description}}",
        },
        null,
        2,
      );

      await createTestTemplateFile(testDir, "sample.json", templateContent);

      const result = await repo.load("sample");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "sample");
      }
    });

    await t.step("loads YAML template successfully", async () => {
      const templateContent = `title: "{{title}}"
description: "{{description}}"
tags: "{{tags}}"`;

      await createTestTemplateFile(
        testDir,
        "yaml-template.yaml",
        templateContent,
      );

      const result = await repo.load("yaml-template");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "yaml-template");
      }
    });

    await t.step("loads YML template successfully", async () => {
      const templateContent = `registry:
  version: "{{version}}"
  commands: "{{commands}}"`;

      await createTestTemplateFile(testDir, "registry.yml", templateContent);

      const result = await repo.load("registry");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "registry");
      }
    });

    await t.step("loads Handlebars template successfully", async () => {
      const templateContent = `<div>
  <h1>{{title}}</h1>
  {{#each items}}
    <p>{{this}}</p>
  {{/each}}
</div>`;

      await createTestTemplateFile(testDir, "handlebars.hbs", templateContent);

      const result = await repo.load("handlebars");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "handlebars");
      }
    });

    await t.step("loads custom template file successfully", async () => {
      const templateContent = `# {{title}}

Description: {{description}}

Tags: {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}`;

      await createTestTemplateFile(
        testDir,
        "markdown.template",
        templateContent,
      );

      const result = await repo.load("markdown");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "markdown");
      }
    });

    await t.step("fails when template not found", async () => {
      const result = await repo.load("nonexistent");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    });

    await t.step("uses cache for subsequent loads", async () => {
      const templateContent = JSON.stringify({ cached: "{{value}}" });
      await createTestTemplateFile(testDir, "cached.json", templateContent);

      // First load
      const firstResult = await repo.load("cached");
      assertEquals(firstResult.ok, true);

      // Second load should use cache
      const secondResult = await repo.load("cached");
      assertEquals(secondResult.ok, true);

      if (firstResult.ok && secondResult.ok) {
        // Should be the same object reference from cache
        assertEquals(
          firstResult.data.getId().getValue(),
          secondResult.data.getId().getValue(),
        );
      }
    });
  } finally {
    await cleanupTestDir(testDir);
  }
});

Deno.test("FileTemplateRepository - Load Template from Path", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("loads template from specific path", async () => {
    const templateContent = JSON.stringify({
      registry: {
        commands: "{{commands}}",
        version: "{{version}}",
      },
    });

    const filePath = await createTestTemplateFile(
      testDir,
      "specific.json",
      templateContent,
    );
    const pathResult = TemplatePath.create(filePath);
    assertEquals(pathResult.ok, true);

    if (pathResult.ok) {
      const result = await repo.loadFromPath(pathResult.data);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getId().getValue(), "specific");
      }
    }
  });

  await t.step("fails when path does not exist", async () => {
    const nonexistentPath = `${testDir}/nonexistent.json`;
    const pathResult = TemplatePath.create(nonexistentPath);
    assertEquals(pathResult.ok, true);

    if (pathResult.ok) {
      const result = await repo.loadFromPath(pathResult.data);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    }
  });

  await t.step("handles read permission errors", async () => {
    const templateContent = '{ "test": true }';
    const filePath = await createTestTemplateFile(
      testDir,
      "readonly.json",
      templateContent,
    );

    // Make file unreadable (this might not work on all systems)
    try {
      await Deno.chmod(filePath, 0o000);
    } catch {
      // Skip test if chmod fails
      return;
    }

    const pathResult = TemplatePath.create(filePath);
    assertEquals(pathResult.ok, true);

    if (pathResult.ok) {
      const result = await repo.loadFromPath(pathResult.data);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ReadError");
      }
    }

    // Restore permissions for cleanup
    try {
      await Deno.chmod(filePath, 0o644);
    } catch {
      // Ignore cleanup errors
    }
  });

  await cleanupTestDir(testDir);
});

Deno.test("FileTemplateRepository - Save Template", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("saves JSON template successfully", async () => {
    // Create a template
    const templateIdResult = TemplateId.create("save-test");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = JSON.stringify({ test: "{{value}}" }, null, 2);
      const formatResult = TemplateFormat.create("json", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const template = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [], // Empty mapping rules
          "Test template for save",
        );

        const result = await repo.save(template);

        assertEquals(result.ok, true);

        // Verify file was created
        const expectedPath = `${testDir}/save-test.json`;
        try {
          const content = await Deno.readTextFile(expectedPath);
          assertEquals(content.includes('"test"'), true);
          assertEquals(content.includes('"{{value}}"'), true);
        } catch {
          assertEquals(false, true, "File should have been created");
        }
      }
    }
  });

  await t.step("saves YAML template with .yml extension", async () => {
    const templateIdResult = TemplateId.create("yaml-save-test");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = 'test: "{{value}}"\nversion: "{{version}}"';
      const formatResult = TemplateFormat.create("yaml", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const template = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [],
          "YAML template for save",
        );

        const result = await repo.save(template);

        assertEquals(result.ok, true);

        // Verify file was created with .yml extension
        const expectedPath = `${testDir}/yaml-save-test.yml`;
        try {
          const content = await Deno.readTextFile(expectedPath);
          assertEquals(content.includes("test:"), true);
          assertEquals(content.includes("version:"), true);
        } catch {
          assertEquals(false, true, "YAML file should have been created");
        }
      }
    }
  });

  await t.step("saves Handlebars template with .hbs extension", async () => {
    const templateIdResult = TemplateId.create("handlebars-save-test");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = "<h1>{{title}}</h1>\n<p>{{description}}</p>";
      const formatResult = TemplateFormat.create("handlebars", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const template = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [],
          "Handlebars template for save",
        );

        const result = await repo.save(template);

        assertEquals(result.ok, true);

        // Verify file was created with .hbs extension
        const expectedPath = `${testDir}/handlebars-save-test.hbs`;
        try {
          const content = await Deno.readTextFile(expectedPath);
          assertEquals(content.includes("<h1>{{title}}</h1>"), true);
          assertEquals(content.includes("<p>{{description}}</p>"), true);
        } catch {
          assertEquals(false, true, "Handlebars file should have been created");
        }
      }
    }
  });

  await t.step("handles write permission errors", async () => {
    // Create a read-only directory
    const readOnlyDir = `${testDir}/readonly`;
    await Deno.mkdir(readOnlyDir);

    try {
      await Deno.chmod(readOnlyDir, 0o444);
    } catch {
      // Skip test if chmod fails
      return;
    }

    const readOnlyRepo = new FileTemplateRepository(readOnlyDir);
    const templateIdResult = TemplateId.create("readonly-test");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = '{"readonly": true}';
      const formatResult = TemplateFormat.create("json", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const template = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [],
          "Read-only test template",
        );

        const result = await readOnlyRepo.save(template);

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "WriteError");
        }
      }
    }

    // Restore permissions for cleanup
    try {
      await Deno.chmod(readOnlyDir, 0o755);
    } catch {
      // Ignore cleanup errors
    }
  });

  await t.step("updates cache after save", async () => {
    const templateIdResult = TemplateId.create("cache-update-test");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = '{"cached": "{{after_save}}"}';
      const formatResult = TemplateFormat.create("json", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const template = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [],
          "Cache update test template",
        );

        // Save should update cache
        const saveResult = await repo.save(template);
        assertEquals(saveResult.ok, true);

        // Load should use cache
        const loadResult = await repo.load("cache-update-test");
        assertEquals(loadResult.ok, true);
        if (loadResult.ok) {
          assertEquals(loadResult.data.getId().getValue(), "cache-update-test");
        }
      }
    }
  });

  await cleanupTestDir(testDir);
});

Deno.test("FileTemplateRepository - Template Existence Check", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("returns true for existing template", async () => {
    const templateContent = '{"exists": "{{value}}"}';
    await createTestTemplateFile(testDir, "exists.json", templateContent);

    const exists = await repo.exists("exists");
    assertEquals(exists, true);
  });

  await t.step("returns false for non-existent template", async () => {
    const exists = await repo.exists("does-not-exist");
    assertEquals(exists, false);
  });

  await t.step("returns true for cached template", async () => {
    const templateContent = '{"cached": "{{value}}"}';
    await createTestTemplateFile(
      testDir,
      "cached-exists.json",
      templateContent,
    );

    // Load to cache it
    await repo.load("cached-exists");

    // Should return true from cache
    const exists = await repo.exists("cached-exists");
    assertEquals(exists, true);
  });

  await cleanupTestDir(testDir);
});

Deno.test("FileTemplateRepository - List Templates", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("lists all template files", async () => {
    // Create various template files
    await createTestTemplateFile(testDir, "template1.json", '{"json": true}');
    await createTestTemplateFile(testDir, "template2.yaml", "yaml: true");
    await createTestTemplateFile(testDir, "template3.yml", "yml: true");
    await createTestTemplateFile(
      testDir,
      "template4.hbs",
      "<div>{{content}}</div>",
    );
    await createTestTemplateFile(
      testDir,
      "template5.template",
      "Custom: {{data}}",
    );

    // Create non-template file that should be ignored
    await createTestTemplateFile(
      testDir,
      "readme.txt",
      "This is not a template",
    );

    const result = await repo.list();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.length, 5);
      assertEquals(result.data.includes("template1"), true);
      assertEquals(result.data.includes("template2"), true);
      assertEquals(result.data.includes("template3"), true);
      assertEquals(result.data.includes("template4"), true);
      assertEquals(result.data.includes("template5"), true);
      assertEquals(result.data.includes("readme"), false);
    }
  });

  await t.step("returns empty array for empty directory", async () => {
    const emptyDir = await createTestTemplateDir();
    const emptyRepo = new FileTemplateRepository(emptyDir);

    const result = await emptyRepo.list();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.length, 0);
    }

    await cleanupTestDir(emptyDir);
  });

  await t.step("handles directory access errors", async () => {
    const nonexistentRepo = new FileTemplateRepository("/nonexistent/path");

    const result = await nonexistentRepo.list();

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ReadError");
    }
  });

  await cleanupTestDir(testDir);
});

Deno.test("FileTemplateRepository - Supported Extensions", async (t) => {
  await t.step("identifies supported extensions correctly", () => {
    // Test supported extensions
    assertEquals(FileTemplateRepository.isSupportedExtension("json"), true);
    assertEquals(FileTemplateRepository.isSupportedExtension("yaml"), true);
    assertEquals(FileTemplateRepository.isSupportedExtension("yml"), true);
    assertEquals(FileTemplateRepository.isSupportedExtension("hbs"), true);
    assertEquals(FileTemplateRepository.isSupportedExtension("template"), true);

    // Test unsupported extensions
    assertEquals(FileTemplateRepository.isSupportedExtension("txt"), false);
    assertEquals(FileTemplateRepository.isSupportedExtension("md"), false);
    assertEquals(FileTemplateRepository.isSupportedExtension("js"), false);
    assertEquals(FileTemplateRepository.isSupportedExtension(""), false);
  });
});

Deno.test("FileTemplateRepository - Registry Command Template Scenarios", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("loads climpt registry command template", async () => {
    const registryTemplate = JSON.stringify(
      {
        version: "{{version}}",
        tools: {
          availableConfigs: "{{configs}}",
          commands: [
            {
              c1: "{{c1}}",
              c2: "{{c2}}",
              c3: "{{c3}}",
              description: "{{description}}",
              options: "{{options}}",
            },
          ],
        },
      },
      null,
      2,
    );

    await createTestTemplateFile(
      testDir,
      "registry_command_template.json",
      registryTemplate,
    );

    const result = await repo.load("registry_command_template");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(result.data.getId().getValue(), "registry_command_template");
    }
  });

  await t.step("loads C3L (Climpt 3-word Language) template", async () => {
    const c3lTemplate = `# {{c1}} {{c2}} {{c3}}

## Description
{{description}}

## Usage
climpt-{{c1}} {{c2}} {{c3}} {{#if options}}--option={{options}}{{/if}}

## Parameters
- c1: {{c1}}
- c2: {{c2}} 
- c3: {{c3}}`;

    await createTestTemplateFile(
      testDir,
      "c3l_documentation.template",
      c3lTemplate,
    );

    const result = await repo.load("c3l_documentation");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      assertEquals(result.data.getId().getValue(), "c3l_documentation");
    }
  });

  await t.step("saves and loads registry output format", async () => {
    const templateIdResult = TemplateId.create("registry-output");
    assertEquals(templateIdResult.ok, true);

    if (templateIdResult.ok) {
      const templateContent = `# Generated Registry
version: "{{version}}"
generated: "{{timestamp}}"
commands:
{{#each commands}}
  - c1: "{{c1}}"
    c2: "{{c2}}"
    c3: "{{c3}}"
    description: "{{description}}"
{{/each}}`;
      const formatResult = TemplateFormat.create("yaml", templateContent);
      assertEquals(formatResult.ok, true);

      if (formatResult.ok) {
        const registryOutputTemplate = Template.createLegacy(
          templateIdResult.data,
          formatResult.data,
          [],
          "Registry output template",
        );

        const saveResult = await repo.save(registryOutputTemplate);
        assertEquals(saveResult.ok, true);

        const loadResult = await repo.load("registry-output");
        assertEquals(loadResult.ok, true);
        if (loadResult.ok) {
          assertEquals(loadResult.data.getId().getValue(), "registry-output");
        }
      }
    }
  });

  await cleanupTestDir(testDir);
});

Deno.test("FileTemplateRepository - Error Recovery and Resilience", async (t) => {
  const testDir = await createTestTemplateDir();
  const repo = new FileTemplateRepository(testDir);

  await t.step("handles malformed JSON gracefully", async () => {
    const malformedJson = '{"incomplete": "json" missing closing brace';
    await createTestTemplateFile(testDir, "malformed.json", malformedJson);

    const result = await repo.load("malformed");
    // The repository should still load but the JSON parsing would happen at the domain level
    assertEquals(result.ok, true);
  });

  await t.step("handles very large template files", async () => {
    const largeTemplate = {
      description: "Large template test",
      data: "x".repeat(10000), // 10KB string
      placeholders: Array(100).fill(0).map((_, i) => `{{value${i}}}`),
    };

    await createTestTemplateFile(
      testDir,
      "large.json",
      JSON.stringify(largeTemplate),
    );

    const result = await repo.load("large");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getId().getValue(), "large");
    }
  });

  await t.step("maintains cache consistency under errors", async () => {
    // Create a valid template first
    await createTestTemplateFile(testDir, "consistent.json", '{"valid": true}');

    // Load it to cache
    const firstLoad = await repo.load("consistent");
    assertEquals(firstLoad.ok, true);

    // Replace with invalid content (simulate corruption)
    await createTestTemplateFile(
      testDir,
      "consistent.json",
      "invalid json content",
    );

    // Should still return cached version
    const secondLoad = await repo.load("consistent");
    assertEquals(secondLoad.ok, true);
  });

  await cleanupTestDir(testDir);
});
