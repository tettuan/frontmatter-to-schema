import { assertEquals } from "jsr:@std/assert";
import {
  DataStructure,
  SchemaPathResolver,
} from "../../../../../src/domain/schema/services/schema-path-resolver.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";

// Mock Schema for testing
class MockSchema {
  constructor(private frontmatterPartPath: string | null) {}

  findFrontmatterPartPath() {
    if (this.frontmatterPartPath === null) {
      return err({ kind: "FrontmatterPartNotFound" as const });
    }
    return ok(this.frontmatterPartPath);
  }

  findFrontmatterPartSchema() {
    if (this.frontmatterPartPath === null) {
      return err({ kind: "FrontmatterPartNotFound" as const });
    }
    return ok({});
  }
}

Deno.test("SchemaPathResolver - resolveDataStructure", async (t) => {
  await t.step("should resolve simple path structure", () => {
    const schema = new MockSchema("commands") as unknown as Schema;
    const dataArray = [{ c1: "test", c2: "command" }];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(structure.commands, dataArray);
    }
  });

  await t.step("should resolve nested path structure", () => {
    const schema = new MockSchema("tools.commands") as unknown as Schema;
    const dataArray = [{ c1: "test", c2: "command" }];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals((structure.tools as any).commands, dataArray);
    }
  });

  await t.step("should resolve deeply nested path structure", () => {
    const schema = new MockSchema(
      "registry.tools.commands",
    ) as unknown as Schema;
    const dataArray = [{ c1: "test", c2: "command" }];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(
        ((structure.registry as any).tools as any).commands,
        dataArray,
      );
    }
  });

  await t.step("should handle empty data array", () => {
    const schema = new MockSchema("commands") as unknown as Schema;
    const dataArray: unknown[] = [];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should handle schema without frontmatter-part path", () => {
    const schema = new MockSchema(null) as unknown as Schema;
    const dataArray = [{ c1: "test", c2: "command" }];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "FrontmatterPartNotFound");
    }
  });
});

Deno.test("DataStructure", async (t) => {
  await t.step("should create valid DataStructure", () => {
    const structure = { commands: [{ c1: "test" }] };
    const result = DataStructure.create(structure);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getStructure(), structure);
    }
  });

  await t.step("should reject invalid structure", () => {
    const result = DataStructure.create(null as any);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidType");
      if (result.error.kind === "InvalidType") {
        assertEquals(result.error.expected, "object");
        assertEquals(result.error.actual, "object");
      }
    }
  });

  await t.step("should reject undefined structure", () => {
    const result = DataStructure.create(undefined as any);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidType");
      if (result.error.kind === "InvalidType") {
        assertEquals(result.error.expected, "object");
        assertEquals(result.error.actual, "undefined");
      }
    }
  });

  await t.step("should convert to FrontmatterData", () => {
    const structure = { commands: [{ c1: "test" }] };
    const dataStructure = DataStructure.create(structure);

    assertEquals(dataStructure.ok, true);
    if (dataStructure.ok) {
      const frontmatterResult = dataStructure.data.toFrontmatterData();
      assertEquals(frontmatterResult.ok, true);
    }
  });
});

Deno.test("SchemaPathResolver - createEmptyStructure", async (t) => {
  await t.step("should create empty structure with path", () => {
    const schema = new MockSchema("commands") as unknown as Schema;

    const result = SchemaPathResolver.createEmptyStructure(schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(structure.commands, []);
    }
  });

  await t.step("should create empty structure for nested path", () => {
    const schema = new MockSchema("tools.commands") as unknown as Schema;

    const result = SchemaPathResolver.createEmptyStructure(schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals((structure.tools as any).commands, []);
    }
  });

  await t.step("should handle schema without frontmatter-part path", () => {
    const schema = new MockSchema(null) as unknown as Schema;

    const result = SchemaPathResolver.createEmptyStructure(schema);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(structure, {});
    }
  });
});

// Integration test with real Schema behavior patterns
Deno.test("SchemaPathResolver - Integration patterns", async (t) => {
  await t.step("should handle complex nested registry schema pattern", () => {
    // Simulate the actual registry schema structure
    const schema = new MockSchema("tools.commands") as unknown as Schema;
    const dataArray = [
      { c1: "git", c2: "commit", c3: "message" },
      { c1: "spec", c2: "analyze", c3: "quality" },
      { c1: "test", c2: "run", c3: "unit" },
    ];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();

      // Check nested structure
      assertEquals((structure.tools as any).commands.length, 3);
      assertEquals((structure.tools as any).commands[0].c1, "git");
      assertEquals((structure.tools as any).commands[1].c1, "spec");
      assertEquals((structure.tools as any).commands[2].c1, "test");
    }
  });

  await t.step("should work with single level paths", () => {
    const schema = new MockSchema("commands") as unknown as Schema;
    const dataArray = [{ id: "cmd1" }, { id: "cmd2" }];

    const result = SchemaPathResolver.resolveDataStructure(schema, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      const structure = result.data.getStructure();
      assertEquals(structure.commands, dataArray);
      // Should not duplicate when path is already "commands"
      assertEquals(Object.keys(structure).length, 1);
    }
  });
});
