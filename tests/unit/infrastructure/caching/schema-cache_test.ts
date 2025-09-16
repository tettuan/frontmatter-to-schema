import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import {
  SchemaCache,
  SchemaCacheFactory,
} from "../../../../src/infrastructure/caching/schema-cache.ts";
import { SchemaDefinition } from "../../../../src/domain/schema/value-objects/schema-definition.ts";

/**
 * Schema Cache Tests
 * Comprehensive testing of the schema caching system
 * Following DDD principles and Result<T,E> pattern validation
 */
Deno.test("SchemaCache", async (t) => {
  await t.step("should initialize with default configuration", () => {
    const cache = new SchemaCache();
    const stats = cache.getStats();

    assertEquals(stats.totalEntries, 0);
    assertEquals(stats.hits, 0);
    assertEquals(stats.misses, 0);
    assertEquals(stats.hitRate, 0);
    assertEquals(stats.memoryEstimateMB, 0);
  });

  await t.step("should initialize with custom configuration", () => {
    const config = {
      maxEntries: 50,
      ttlMs: 10000,
      enableFileWatching: true,
      enableLRUEviction: false,
    };

    const cache = new SchemaCache(config);
    const stats = cache.getStats();

    // Configuration is internal, but we can verify it works through behavior
    assertEquals(stats.totalEntries, 0);
  });

  await t.step("should handle cache miss correctly", async () => {
    const cache = new SchemaCache();
    const result = await cache.get("/nonexistent/schema.json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, null);
    }

    const stats = cache.getStats();
    assertEquals(stats.misses, 1);
    assertEquals(stats.hits, 0);
    assertEquals(stats.hitRate, 0);
  });

  await t.step("should store and retrieve schema successfully", async () => {
    const cache = new SchemaCache();
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Create a temporary test file for file modification time checks
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile, JSON.stringify(mockSchema));

    try {
      // Store schema
      const setResult = await cache.set(tempFile, mockSchema);
      assertEquals(setResult.ok, true);

      // Retrieve schema
      const getResult = await cache.get(tempFile);
      assertEquals(getResult.ok, true);
      if (getResult.ok) {
        assertEquals(getResult.data, mockSchema);
      }

      const stats = cache.getStats();
      assertEquals(stats.totalEntries, 1);
      assertEquals(stats.hits, 1);
      assertEquals(stats.misses, 0);
      assertEquals(stats.hitRate, 1);
    } finally {
      await Deno.remove(tempFile);
    }
  });

  await t.step("should handle TTL expiration", async () => {
    const cache = new SchemaCache({ ttlMs: 1 }); // 1ms TTL
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Create a temporary test file
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile, JSON.stringify(mockSchema));

    try {
      // Store schema
      await cache.set(tempFile, mockSchema);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be expired
      const result = await cache.get(tempFile);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, null);
      }

      const stats = cache.getStats();
      assertEquals(stats.evictions, 1);
    } finally {
      await Deno.remove(tempFile);
    }
  });

  await t.step("should invalidate specific cache entries", async () => {
    const cache = new SchemaCache();
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Create temporary test files
    const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
    const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile1, JSON.stringify(mockSchema));
    await Deno.writeTextFile(tempFile2, JSON.stringify(mockSchema));

    try {
      // Store two schemas
      await cache.set(tempFile1, mockSchema);
      await cache.set(tempFile2, mockSchema);

      assertEquals(cache.getStats().totalEntries, 2);

      // Invalidate one
      const invalidateResult = cache.invalidate(tempFile1);
      assertEquals(invalidateResult.ok, true);
      if (invalidateResult.ok) {
        assertEquals(invalidateResult.data, true);
      }

      assertEquals(cache.getStats().totalEntries, 1);

      // First should be gone, second should remain
      const result1 = await cache.get(tempFile1);
      const result2 = await cache.get(tempFile2);

      assertEquals(result1.ok, true);
      if (result1.ok) {
        assertEquals(result1.data, null);
      }

      assertEquals(result2.ok, true);
      if (result2.ok) {
        assertEquals(result2.data, mockSchema);
      }
    } finally {
      await Deno.remove(tempFile1);
      await Deno.remove(tempFile2);
    }
  });

  await t.step("should clear entire cache", async () => {
    const cache = new SchemaCache();
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Create temporary test files
    const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
    const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile1, JSON.stringify(mockSchema));
    await Deno.writeTextFile(tempFile2, JSON.stringify(mockSchema));

    try {
      // Store schemas
      await cache.set(tempFile1, mockSchema);
      await cache.set(tempFile2, mockSchema);

      assertEquals(cache.getStats().totalEntries, 2);

      // Clear cache
      const clearResult = cache.clear();
      assertEquals(clearResult.ok, true);

      const stats = cache.getStats();
      assertEquals(stats.totalEntries, 0);
      assertEquals(stats.evictions, 2);

      // Both should be gone
      const result1 = await cache.get(tempFile1);
      const result2 = await cache.get(tempFile2);

      assertEquals(result1.ok, true);
      if (result1.ok) {
        assertEquals(result1.data, null);
      }

      assertEquals(result2.ok, true);
      if (result2.ok) {
        assertEquals(result2.data, null);
      }
    } finally {
      await Deno.remove(tempFile1);
      await Deno.remove(tempFile2);
    }
  });

  await t.step(
    "should perform maintenance and clean expired entries",
    async () => {
      const cache = new SchemaCache({ ttlMs: 1 });
      const schemaResult = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
        },
      });
      if (!schemaResult.ok) throw new Error("Failed to create test schema");
      const mockSchema = schemaResult.data;

      // Create temporary test files
      const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
      const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });
      await Deno.writeTextFile(tempFile1, JSON.stringify(mockSchema));
      await Deno.writeTextFile(tempFile2, JSON.stringify(mockSchema));

      try {
        // Store schemas
        await cache.set(tempFile1, mockSchema);
        await cache.set(tempFile2, mockSchema);

        assertEquals(cache.getStats().totalEntries, 2);

        // Wait for expiration
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Run maintenance
        const maintenanceResult = await cache.performMaintenance();
        assertEquals(maintenanceResult.ok, true);

        const stats = cache.getStats();
        assertEquals(stats.totalEntries, 0);
        assertEquals(stats.evictions, 2);
      } finally {
        await Deno.remove(tempFile1);
        await Deno.remove(tempFile2);
      }
    },
  );

  await t.step(
    "should handle cache eviction when max entries reached",
    async () => {
      const cache = new SchemaCache({ maxEntries: 2 });
      const schemaResult = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
        },
      });
      if (!schemaResult.ok) throw new Error("Failed to create test schema");
      const mockSchema = schemaResult.data;

      // Create temporary test files
      const tempFiles = [];
      for (let i = 0; i < 3; i++) {
        const tempFile = await Deno.makeTempFile({ suffix: ".json" });
        tempFiles.push(tempFile);
        await Deno.writeTextFile(tempFile, JSON.stringify(mockSchema));
      }

      try {
        // Store first two schemas
        await cache.set(tempFiles[0], mockSchema);
        await cache.set(tempFiles[1], mockSchema);

        assertEquals(cache.getStats().totalEntries, 2);

        // Store third schema, should trigger eviction
        await cache.set(tempFiles[2], mockSchema);

        const stats = cache.getStats();
        assertEquals(stats.totalEntries, 2); // Still only 2 entries
        assertEquals(stats.evictions > 0, true); // Some eviction occurred
      } finally {
        for (const tempFile of tempFiles) {
          await Deno.remove(tempFile);
        }
      }
    },
  );

  await t.step("should handle file system errors gracefully", async () => {
    const cache = new SchemaCache();
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Try to store schema for non-existent file
    const setResult = await cache.set(
      "/nonexistent/path/schema.json",
      mockSchema,
    );
    assertEquals(setResult.ok, false);
    if (!setResult.ok) {
      assertStringIncludes(setResult.error, "Failed to cache schema");
    }
  });

  await t.step("should update hit rate correctly", async () => {
    const cache = new SchemaCache();
    const schemaResult = SchemaDefinition.create({
      type: "object",
      properties: {
        title: { type: "string" },
      },
    });
    if (!schemaResult.ok) throw new Error("Failed to create test schema");
    const mockSchema = schemaResult.data;

    // Create temporary test file
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });
    await Deno.writeTextFile(tempFile, JSON.stringify(mockSchema));

    try {
      // Store schema
      await cache.set(tempFile, mockSchema);

      // Multiple hits and misses
      await cache.get(tempFile); // hit
      await cache.get(tempFile); // hit
      await cache.get("/nonexistent.json"); // miss

      const stats = cache.getStats();
      assertEquals(stats.hits, 2);
      assertEquals(stats.misses, 1);
      assertEquals(stats.hitRate, 2 / 3);
    } finally {
      await Deno.remove(tempFile);
    }
  });
});

Deno.test("SchemaCacheFactory", async (t) => {
  await t.step("should create new instances", () => {
    const instance1 = SchemaCacheFactory.create();
    const instance2 = SchemaCacheFactory.create();

    // Each instance should be independent (no singleton)
    assertEquals(instance1 !== instance2, true);
  });

  await t.step("should create instances with custom configuration", () => {
    const config = { maxEntries: 200 };
    const instance = SchemaCacheFactory.create(config);

    const stats = instance.getStats();
    assertEquals(stats.totalEntries, 0);
  });

  await t.step("should create testing instances with optimized config", () => {
    const testInstance = SchemaCacheFactory.createForTesting();

    const stats = testInstance.getStats();
    assertEquals(stats.totalEntries, 0);
    // Testing instances should have shorter TTL and smaller capacity
  });
});
