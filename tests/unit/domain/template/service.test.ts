/**
 * Domain-based tests for Template Processing Service
 * Testing the unified service entry point with DDD principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplateProcessingService } from "../../../../src/domain/template/service.ts";
import { FileTemplateRepository } from "../../../../src/infrastructure/template/file-template-repository.ts";
import {
  Template,
  TemplateDefinition,
} from "../../../../src/domain/models/template.ts";
import type { TemplateRepository } from "../../../../src/domain/template/repository.ts";

Deno.test("TemplateProcessingService - Service Layer Tests", async (t) => {
  const testDir = await Deno.makeTempDir();
  const repo = new FileTemplateRepository(testDir);
  const service = new TemplateProcessingService({ repository: repo });

  await t.step("should process templates end-to-end", async () => {
    // Setup template
    const templateDef = TemplateDefinition.create(
      JSON.stringify({
        title: "{{document.title}}",
        author: "{{document.author}}",
        tags: ["{{tag1}}", "{{tag2}}"],
      }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "e2e-test",
        templateDef.data,
        "E2E test",
      );
      if (template.ok) {
        await repo.save(template.data);

        const data = {
          document: {
            title: "Test Document",
            author: "Test Author",
          },
          tag1: "typescript",
          tag2: "testing",
        };
        const schema = {
          type: "object",
          properties: {
            document: { type: "object" },
            tag1: { type: "string" },
            tag2: { type: "string" },
          },
        };

        const result = await service.processTemplate(
          "e2e-test",
          data,
          schema,
          "json",
        );
        assertEquals(result.ok, true, "Should process template successfully");
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.title, "Test Document");
          assertEquals(parsed.author, "Test Author");
          assertEquals(parsed.tags, ["typescript", "testing"]);
        }
      }
    }
  });

  await t.step("should handle template not found", async () => {
    const result = await service.processTemplate(
      "non-existent",
      {},
      {},
      "json",
    );
    assertEquals(result.ok, false, "Should fail for non-existent template");
    if (!result.ok) {
      assertEquals(result.error.message.includes("not found"), true);
    }
  });

  await t.step("should validate processing context", async () => {
    // Test empty template ID
    const result1 = await service.processTemplate("", {}, {}, "json");
    assertEquals(result1.ok, false, "Should reject empty template ID");

    // Test null data
    const result2 = await service.processTemplate(
      "test",
      null as unknown,
      {},
      "json",
    );
    assertEquals(result2.ok, false, "Should reject null data");

    // Test invalid format
    const result3 = await service.processTemplate(
      "test",
      {},
      {},
      "invalid" as unknown as "json",
    );
    assertEquals(result3.ok, false, "Should reject invalid format");
  });

  await t.step("should support multiple template processing", async () => {
    // Setup multiple templates
    const templates = [
      { id: "batch1", content: JSON.stringify({ v1: "{{value1}}" }) },
      { id: "batch2", content: JSON.stringify({ v2: "{{value2}}" }) },
      { id: "batch3", content: JSON.stringify({ v3: "{{value3}}" }) },
    ];

    for (const { id, content } of templates) {
      const def = TemplateDefinition.create(content, "json");
      if (def.ok) {
        const template = Template.create(id, def.data, `Batch ${id}`);
        if (template.ok) {
          await repo.save(template.data);
        }
      }
    }

    const results = await Promise.all([
      service.processTemplate("batch1", { value1: "result1" }, {}, "json"),
      service.processTemplate("batch2", { value2: "result2" }, {}, "json"),
      service.processTemplate("batch3", { value3: "result3" }, {}, "json"),
    ]);
    assertEquals(results.length, 3, "Should process all templates");

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      assertEquals(result.ok, true, `Batch item ${i} should succeed`);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertExists(parsed[`v${i + 1}`], `Should have v${i + 1} property`);
      }
    }
  });

  await t.step("should cache processed templates", async () => {
    const def = TemplateDefinition.create(
      JSON.stringify({ cached: "{{value}}" }),
      "json",
    );

    if (def.ok) {
      const template = Template.create("cache-test", def.data, "Cache test");
      if (template.ok) {
        await repo.save(template.data);

        // First processing
        const result1 = await service.processTemplate(
          "cache-test",
          { value: "cached-value" },
          {},
          "json",
        );
        assertEquals(result1.ok, true);

        // Second processing (should use cached template)
        const result2 = await service.processTemplate(
          "cache-test",
          { value: "cached-value" },
          {},
          "json",
        );
        assertEquals(result2.ok, true);

        if (result1.ok && result2.ok) {
          assertEquals(
            result1.data,
            result2.data,
            "Results should be identical",
          );
        }
      }
    }
  });

  // Cleanup
  await t.step("cleanup", async () => {
    await Deno.remove(testDir, { recursive: true });
  });
});

Deno.test("TemplateProcessingService - Integration Tests", async (t) => {
  const testDir = await Deno.makeTempDir();
  const repo = new FileTemplateRepository(testDir);
  const service = new TemplateProcessingService({ repository: repo });

  await t.step("should handle complex nested data structures", async () => {
    const templateDef = TemplateDefinition.create(
      JSON.stringify({
        project: {
          name: "{{project.name}}",
          version: "{{project.version}}",
          dependencies: {
            runtime: ["{{deps.runtime.0}}", "{{deps.runtime.1}}"],
            dev: ["{{deps.dev.0}}", "{{deps.dev.1}}"],
          },
        },
        metadata: {
          created: "{{metadata.timestamp}}",
          author: {
            name: "{{author.name}}",
            email: "{{author.email}}",
          },
        },
      }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "complex-test",
        templateDef.data,
        "Complex test",
      );
      if (template.ok) {
        await repo.save(template.data);

        const data = {
          project: {
            name: "TestProject",
            version: "1.0.0",
          },
          deps: {
            runtime: ["deno", "typescript"],
            dev: ["prettier", "eslint"],
          },
          metadata: {
            timestamp: "2024-01-01T00:00:00Z",
          },
          author: {
            name: "Test Author",
            email: "test@example.com",
          },
        };

        const result = await service.processTemplate(
          "complex-test",
          data,
          {},
          "json",
        );
        assertEquals(result.ok, true);
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.project.name, "TestProject");
          assertEquals(parsed.project.dependencies.runtime, [
            "deno",
            "typescript",
          ]);
          assertEquals(parsed.metadata.author.email, "test@example.com");
        }
      }
    }
  });

  await t.step("should support different output formats", async () => {
    const def = TemplateDefinition.create("", "yaml");
    if (def.ok) {
      const template = Template.create("format-test", def.data, "Format test");
      if (template.ok) {
        await repo.save(template.data);

        const data = {
          name: "YAML Test",
          settings: {
            enabled: true,
            count: 42,
          },
          items: ["one", "two", "three"],
        };

        // Test YAML output
        const yamlResult = await service.processTemplate(
          "format-test",
          data,
          {},
          "yaml",
        );
        assertEquals(yamlResult.ok, true);
        if (yamlResult.ok) {
          assertEquals(yamlResult.data.includes("name: YAML Test"), true);
          assertEquals(yamlResult.data.includes("enabled: true"), true);
          assertEquals(yamlResult.data.includes("- one"), true);
        }

        // Test JSON output
        const jsonResult = await service.processTemplate(
          "format-test",
          data,
          {},
          "json",
        );
        assertEquals(jsonResult.ok, true);
        if (jsonResult.ok) {
          const parsed = JSON.parse(jsonResult.data);
          assertEquals(parsed.name, "YAML Test");
          assertEquals(parsed.settings.enabled, true);
        }
      }
    }
  });

  await t.step("should handle partial data gracefully", async () => {
    const def = TemplateDefinition.create(
      JSON.stringify({
        required: "{{required}}",
        optional: "{{optional}}",
        nested: {
          value: "{{nested.value}}",
        },
      }),
      "json",
    );

    if (def.ok) {
      const template = Template.create(
        "partial-test",
        def.data,
        "Partial test",
      );
      if (template.ok) {
        await repo.save(template.data);

        const result = await service.processTemplate(
          "partial-test",
          {
            required: "present",
            // optional and nested.value are missing
          },
          {},
          "json",
        );
        // Should succeed with partial data (new behavior with PlaceholderProcessor)
        assertEquals(result.ok, true);
        if (result.ok) {
          // Verify the output contains placeholders for missing data
          const output = JSON.parse(result.data);
          assertEquals(output.required, "present");
          assertEquals(output.optional, "{{optional}}"); // Placeholder preserved
          assertEquals(output.nested.value, "{{nested.value}}"); // Placeholder preserved
        }
      }
    }
  });

  // Cleanup
  await t.step("cleanup", async () => {
    await Deno.remove(testDir, { recursive: true });
  });
});

Deno.test("TemplateProcessingService - Concurrency Tests", async (t) => {
  const testDir = await Deno.makeTempDir();
  const repo = new FileTemplateRepository(testDir);
  const service = new TemplateProcessingService({ repository: repo });

  await t.step("should handle concurrent template processing", async () => {
    // Setup template
    const def = TemplateDefinition.create(
      JSON.stringify({ id: "{{id}}", value: "{{value}}" }),
      "json",
    );

    if (def.ok) {
      const template = Template.create(
        "concurrent",
        def.data,
        "Concurrent test",
      );
      if (template.ok) {
        await repo.save(template.data);

        // Create multiple concurrent requests
        const requests = [];
        for (let i = 0; i < 20; i++) {
          requests.push(service.processTemplate(
            "concurrent",
            {
              id: `request-${i}`,
              value: `value-${i}`,
            },
            {},
            "json",
          ));
        }

        const results = await Promise.all(requests);

        // All should succeed
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          assertEquals(result.ok, true, `Request ${i} should succeed`);
          if (result.ok) {
            const parsed = JSON.parse(result.data);
            assertEquals(parsed.id, `request-${i}`);
            assertEquals(parsed.value, `value-${i}`);
          }
        }
      }
    }
  });

  await t.step("should handle mixed operations concurrently", async () => {
    const operations = [];

    // Mix of saves and processes
    for (let i = 0; i < 10; i++) {
      const def = TemplateDefinition.create(`template ${i}`, "custom");
      if (def.ok) {
        const template = Template.create(`mixed-${i}`, def.data, `Mixed ${i}`);
        if (template.ok) {
          operations.push(repo.save(template.data));

          operations.push(service.processTemplate(
            `mixed-${i}`,
            { value: i },
            {},
            "json",
          ));
        }
      }
    }

    const results = await Promise.allSettled(operations);

    // Check all operations completed
    for (const result of results) {
      assertEquals(
        result.status,
        "fulfilled",
        "All operations should complete",
      );
    }
  });

  // Cleanup
  await t.step("cleanup", async () => {
    await Deno.remove(testDir, { recursive: true });
  });
});

Deno.test("TemplateProcessingService - Error Recovery Tests", async (t) => {
  const testDir = await Deno.makeTempDir();
  const repo = new FileTemplateRepository(testDir);
  const _service = new TemplateProcessingService({ repository: repo });

  await t.step("should handle strategy errors gracefully", async () => {
    // Create a service without AI analyzer (will use native strategy)
    const basicService = new TemplateProcessingService({ repository: repo });

    const def = TemplateDefinition.create("test", "json");
    if (def.ok) {
      // Create a template with invalid JSON content that will fail
      const invalidDef = TemplateDefinition.create("{invalid json}", "json");
      const template = Template.create(
        "recovery-test",
        invalidDef.ok ? invalidDef.data : def.data,
        "Recovery test",
      );
      if (template.ok) {
        await repo.save(template.data);

        // Should process with native strategy
        const result = await basicService.processTemplate(
          "recovery-test",
          { value: "test" },
          {},
          "json",
        );
        // Since "test" is not valid JSON, native strategy should fail
        assertEquals(result.ok, false);
      }
    }
  });

  await t.step("should handle repository failures gracefully", async () => {
    const failingRepo = {
      load(_id: string) {
        return Promise.resolve({
          ok: false,
          error: { kind: "ValidationError", message: "Repository error" },
        });
      },
      save(_template: unknown) {
        return Promise.resolve({
          ok: false,
          error: { kind: "ValidationError", message: "Save failed" },
        });
      },
      exists(_id: string) {
        return Promise.resolve(false);
      },
      list() {
        return Promise.resolve({
          ok: false,
          error: { kind: "ValidationError", message: "List failed" },
        });
      },
    };

    const failingService = new TemplateProcessingService({
      repository: failingRepo as unknown as TemplateRepository,
    });

    const result = await failingService.processTemplate("test", {}, {}, "json");
    assertEquals(result.ok, false, "Should handle repository failure");
    if (!result.ok) {
      assertEquals(result.error.message.includes("Repository error"), true);
    }
  });

  // Cleanup
  await t.step("cleanup", async () => {
    await Deno.remove(testDir, { recursive: true });
  });
});
