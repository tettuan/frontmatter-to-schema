/**
 * TemplateRepository Domain Service Tests
 *
 * Tests for TemplateRepository following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { TemplateRepository } from "../../../../../src/domain/template/services/template-repository.ts";
import { TemplatePath } from "../../../../../src/domain/value-objects/template-path.ts";

Deno.test("TemplateRepository - should create valid repository", () => {
  const result = TemplateRepository.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("TemplateRepository - should load template successfully", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResult = TemplatePath.create("templates/example.html");
  if (!pathResult.ok) throw new Error("Failed to create template path");

  const result = await repository.data.loadTemplate(pathResult.data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data.template);
    assertEquals(result.data.path, pathResult.data);
    assertExists(result.data.lastModified);
  }
});

Deno.test("TemplateRepository - should cache loaded templates", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResult = TemplatePath.create("templates/cached.hbs");
  if (!pathResult.ok) throw new Error("Failed to create template path");

  // First load
  const firstLoad = await repository.data.loadTemplate(pathResult.data);
  assertEquals(firstLoad.ok, true);

  // Second load should use cache
  const secondLoad = await repository.data.loadTemplate(pathResult.data);
  assertEquals(secondLoad.ok, true);

  // Check cached template
  const cached = repository.data.getCachedTemplate(pathResult.data);
  assertEquals(cached.ok, true);
  if (cached.ok) {
    assertExists(cached.data);
  }
});

Deno.test("TemplateRepository - should bypass cache when requested", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResult = TemplatePath.create("templates/nocache.txt");
  if (!pathResult.ok) throw new Error("Failed to create template path");

  // Load without cache
  const result = await repository.data.loadTemplate(pathResult.data, false);
  assertEquals(result.ok, true);

  // Cache should be empty
  const cached = repository.data.getCachedTemplate(pathResult.data);
  assertEquals(cached.ok, true);
  if (cached.ok) {
    assertEquals(cached.data, null);
  }
});

Deno.test("TemplateRepository - should check template existence", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const validPathResult = TemplatePath.create("templates/exists.html");
  if (!validPathResult.ok) {
    throw new Error("Failed to create valid template path");
  }

  const invalidPathResult = TemplatePath.create("templates/nonexistent.xyz");
  // This should fail due to unsupported extension
  assertEquals(invalidPathResult.ok, false);

  // Valid template should exist
  const existsResult = await repository.data.templateExists(
    validPathResult.data,
  );
  assertEquals(existsResult.ok, true);
  if (existsResult.ok) {
    assertEquals(existsResult.data, true);
  }

  // Since invalid path creation failed, we can't test templateExists with it
  // Test should focus on the path creation failure instead
});

Deno.test("TemplateRepository - should clear cache correctly", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResult1 = TemplatePath.create("templates/cache1.html");
  const pathResult2 = TemplatePath.create("templates/cache2.hbs");
  if (!pathResult1.ok || !pathResult2.ok) {
    throw new Error("Failed to create template paths");
  }

  // Load templates to populate cache
  await repository.data.loadTemplate(pathResult1.data);
  await repository.data.loadTemplate(pathResult2.data);

  // Check cache stats
  let stats = repository.data.getCacheStats();
  assertEquals(stats.size, 2);

  // Clear specific template
  const clearResult = repository.data.clearCache(pathResult1.data);
  assertEquals(clearResult.ok, true);

  stats = repository.data.getCacheStats();
  assertEquals(stats.size, 1);

  // Clear all cache
  const clearAllResult = repository.data.clearCache();
  assertEquals(clearAllResult.ok, true);

  stats = repository.data.getCacheStats();
  assertEquals(stats.size, 0);
});

Deno.test("TemplateRepository - should preload multiple templates", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResults = [
    TemplatePath.create("templates/preload1.html"),
    TemplatePath.create("templates/preload2.hbs"),
    TemplatePath.create("templates/preload3.txt"),
  ];

  const validPaths = pathResults.filter((r) => r.ok).map((r) => r.data!);

  const result = await repository.data.preloadTemplates(validPaths);
  assertEquals(result.ok, true);

  if (result.ok) {
    assertEquals(result.data.loaded.length, 3);
    assertEquals(result.data.errors.length, 0);

    // Check all templates are cached
    for (const path of validPaths) {
      const cached = repository.data.getCachedTemplate(path);
      assertEquals(cached.ok, true);
      if (cached.ok) {
        assertExists(cached.data);
      }
    }
  }
});

Deno.test("TemplateRepository - should handle invalid path formats", () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  // Path with dangerous traversal should fail at TemplatePath creation level
  const dangerousPathResult = TemplatePath.create(
    "templates/../../../etc/passwd.html",
  );
  assertEquals(dangerousPathResult.ok, false);
  if (!dangerousPathResult.ok) {
    assertEquals(dangerousPathResult.error.kind, "InvalidFormat");
  }
});

Deno.test("TemplateRepository - should handle unsupported extensions", () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const unsupportedPathResult = TemplatePath.create(
    "templates/unsupported.xyz",
  );
  // This should fail at TemplatePath creation due to unsupported extension
  assertEquals(unsupportedPathResult.ok, false);
  if (!unsupportedPathResult.ok) {
    assertEquals(unsupportedPathResult.error.kind, "FileExtensionMismatch");
  }

  // Since path creation failed, we can't call loadTemplate
  // The test already validates the extension rejection at path creation level
});

Deno.test("TemplateRepository - should provide cache statistics", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  // Initially empty
  let stats = repository.data.getCacheStats();
  assertEquals(stats.size, 0);
  assertEquals(stats.entries.length, 0);

  // Load some templates
  const paths = [
    TemplatePath.create("templates/stats1.html"),
    TemplatePath.create("templates/stats2.hbs"),
  ].filter((r) => r.ok).map((r) => r.data!);

  for (const path of paths) {
    await repository.data.loadTemplate(path);
  }

  // Check stats
  stats = repository.data.getCacheStats();
  assertEquals(stats.size, 2);
  assertEquals(stats.entries.length, 2);

  // Each entry should have path and loadedAt
  for (const entry of stats.entries) {
    assertExists(entry.path);
    assertExists(entry.loadedAt);
    assertEquals(typeof entry.path, "string");
    assertEquals(entry.loadedAt instanceof Date, true);
  }
});

Deno.test("TemplateRepository - should handle concurrent loading", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  const pathResult = TemplatePath.create("templates/concurrent.html");
  if (!pathResult.ok) throw new Error("Failed to create template path");

  // Load same template concurrently
  const promises = [
    repository.data.loadTemplate(pathResult.data),
    repository.data.loadTemplate(pathResult.data),
    repository.data.loadTemplate(pathResult.data),
  ];

  const results = await Promise.all(promises);

  // All loads should succeed
  for (const result of results) {
    assertEquals(result.ok, true);
  }

  // Should only have one cached entry
  const stats = repository.data.getCacheStats();
  assertEquals(stats.size, 1);
});

Deno.test("TemplateRepository - should generate appropriate mock content", async () => {
  const repository = TemplateRepository.create();
  if (!repository.ok) throw new Error("Failed to create repository");

  // Test different formats
  const testCases = [
    { path: "templates/test.html", expectedContent: "{{title}}" },
    { path: "templates/test.hbs", expectedContent: "{{title}}" },
    { path: "templates/test.txt", expectedContent: "{{title}}" },
  ];

  for (const testCase of testCases) {
    const pathResult = TemplatePath.create(testCase.path);
    if (!pathResult.ok) continue;

    const result = await repository.data.loadTemplate(pathResult.data);
    assertEquals(result.ok, true);

    if (result.ok) {
      const content = result.data.template.getContent();
      assertEquals(content.includes(testCase.expectedContent), true);
    }
  }
});
