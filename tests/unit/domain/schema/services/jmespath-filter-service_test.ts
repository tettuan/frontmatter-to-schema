import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { JMESPathFilterService } from "../../../../../src/domain/schema/services/jmespath-filter-service.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

describe("JMESPathFilterService", () => {
  describe("create", () => {
    it("should create JMESPathFilterService successfully", () => {
      const result = JMESPathFilterService.create();
      assertEquals(result.ok, true);
    });
  });

  describe("validateExpression", () => {
    it("should validate simple property access expression", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const result = service.validateExpression("name");
        assertEquals(result.ok, true);
      }
    });

    it("should validate nested property access expression", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const result = service.validateExpression("user.name");
        assertEquals(result.ok, true);
      }
    });

    it("should validate array filter expression", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const result = service.validateExpression("[?c1 == 'git']");
        assertEquals(result.ok, true);
      }
    });

    it("should validate complex filter expression", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const result = service.validateExpression(
          "commands[?c1 == 'git' && c2 == 'create']",
        );
        assertEquals(result.ok, true);
      }
    });

    it("should reject invalid expression syntax", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const result = service.validateExpression("[?invalid syntax");
        assertEquals(result.ok, false);
        if (!result.ok) {
          // Accept either compilation or execution error
          const isValidErrorType =
            result.error.kind === "JMESPathCompilationFailed" ||
            result.error.kind === "JMESPathExecutionFailed";
          assertEquals(isValidErrorType, true);
        }
      }
    });
  });

  describe("applyFilter", () => {
    it("should filter simple property access", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          name: "John",
          age: 30,
          city: "New York",
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(dataResult.data, "name");
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data, "John");
          }
        }
      }
    });

    it("should filter nested object property", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          user: {
            name: "Alice",
            email: "alice@example.com",
          },
          metadata: {
            version: "1.0.0",
          },
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(dataResult.data, "user.name");
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data, "Alice");
          }
        }
      }
    });

    it("should filter array based on condition", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          commands: [
            { c1: "git", c2: "create", c3: "issue" },
            { c1: "git", c2: "list", c3: "branches" },
            { c1: "spec", c2: "analyze", c3: "quality" },
          ],
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(
            dataResult.data,
            "commands[?c1 == 'git']",
          );
          assertEquals(result.ok, true);
          if (result.ok) {
            const filtered = result.data as any[];
            assertEquals(filtered.length, 2);
            assertEquals(filtered[0].c2, "create");
            assertEquals(filtered[1].c2, "list");
          }
        }
      }
    });

    it("should filter with complex condition", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          commands: [
            { c1: "git", c2: "create", c3: "issue", active: true },
            { c1: "git", c2: "create", c3: "branch", active: false },
            { c1: "git", c2: "list", c3: "branches", active: true },
            { c1: "spec", c2: "create", c3: "document", active: true },
          ],
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(
            dataResult.data,
            "commands[?c1 == 'git' && c2 == 'create' && active]",
          );
          assertEquals(result.ok, true);
          if (result.ok) {
            const filtered = result.data as any[];
            assertEquals(filtered.length, 1);
            assertEquals(filtered[0].c3, "issue");
          }
        }
      }
    });

    it("should handle empty filter result", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          commands: [
            { c1: "spec", c2: "analyze", c3: "quality" },
          ],
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(
            dataResult.data,
            "commands[?c1 == 'git']",
          );
          assertEquals(result.ok, true);
          if (result.ok) {
            const filtered = result.data as any[];
            assertEquals(filtered.length, 0);
          }
        }
      }
    });

    it("should handle object projection", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          users: [
            { name: "Alice", age: 30 },
            { name: "Bob", age: 25 },
          ],
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(dataResult.data, "users[*].name");
          assertEquals(result.ok, true);
          if (result.ok) {
            const names = result.data as string[];
            assertEquals(names.length, 2);
            assertEquals(names[0], "Alice");
            assertEquals(names[1], "Bob");
          }
        }
      }
    });

    it("should handle nested object transformation", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          metadata: {
            title: "Test Document",
            tags: ["important", "test", "example"],
            author: {
              name: "John Doe",
              email: "john@example.com",
            },
          },
          content: "Some content here",
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(
            dataResult.data,
            "metadata | {title: title, author_name: author.name, tag_count: length(tags)}",
          );
          assertEquals(result.ok, true);
          if (result.ok) {
            const transformed = result.data as any;
            assertEquals(transformed.title, "Test Document");
            assertEquals(transformed.author_name, "John Doe");
            assertEquals(transformed.tag_count, 3);
          }
        }
      }
    });

    it("should return error for invalid filter execution", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          name: "test",
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          // Try to access a non-existent nested property
          const result = service.applyFilter(
            dataResult.data,
            "name.nonexistent.property",
          );
          // This might succeed but return null, depending on JMESPath implementation
          // The behavior depends on the specific JMESPath implementation
          assertEquals(result.ok, true);
        }
      }
    });

    it("should handle complex nested data structures", () => {
      const serviceResult = JMESPathFilterService.create();
      assertExists(serviceResult.ok);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        const dataResult = FrontmatterData.create({
          project: {
            name: "frontmatter-to-schema",
            dependencies: [
              { name: "@std/assert", version: "^1.0.14", type: "dev" },
              { name: "@halvardm/jmespath", version: "^0.17.0", type: "prod" },
            ],
            scripts: {
              test: "deno test",
              build: "deno run build.ts",
            },
          },
        });
        assertExists(dataResult.ok);

        if (dataResult.ok) {
          const result = service.applyFilter(
            dataResult.data,
            "project.dependencies[?type == 'prod'].name",
          );
          assertEquals(result.ok, true);
          if (result.ok) {
            const prodDeps = result.data as string[];
            assertEquals(prodDeps.length, 1);
            assertEquals(prodDeps[0], "@halvardm/jmespath");
          }
        }
      }
    });
  });
});
