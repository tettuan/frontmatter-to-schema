import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  FrontmatterExtractor,
  FrontmatterParser,
  FrontmatterProcessor,
} from "../../../../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import {
  ValidationRuleFactory,
  ValidationRules,
} from "../../../../../src/domain/schema/value-objects/validation-rules.ts";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import {
  createError,
  FrontmatterError,
  ValidationError as _ValidationError,
} from "../../../../../src/domain/shared/types/errors.ts";

describe("FrontmatterProcessor", () => {
  // Mock implementations
  class MockFrontmatterExtractor implements FrontmatterExtractor {
    private shouldFail = false;
    private errorToReturn?: FrontmatterError & { message: string };
    private dataToReturn = { frontmatter: "title: Test", body: "Body content" };

    setShouldFail(
      fail: boolean,
      error?: FrontmatterError & { message: string },
    ) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    setDataToReturn(data: { frontmatter: string; body: string }) {
      this.dataToReturn = data;
    }

    extract(_content: string): Result<{
      frontmatter: string;
      body: string;
    }, FrontmatterError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      return ok(this.dataToReturn);
    }
  }

  class MockFrontmatterParser implements FrontmatterParser {
    private shouldFail = false;
    private errorToReturn?: FrontmatterError & { message: string };
    private dataToReturn: unknown = { title: "Test" };

    setShouldFail(
      fail: boolean,
      error?: FrontmatterError & { message: string },
    ) {
      this.shouldFail = fail;
      this.errorToReturn = error;
    }

    setDataToReturn(data: unknown) {
      this.dataToReturn = data;
    }

    parse(
      _yaml: string,
    ): Result<unknown, FrontmatterError & { message: string }> {
      if (this.shouldFail && this.errorToReturn) {
        return err(this.errorToReturn);
      }
      return ok(this.dataToReturn);
    }
  }

  describe("extract", () => {
    it("should extract frontmatter and body successfully", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      parser.setDataToReturn({ title: "Test Document", author: "John" });

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content =
        "---\ntitle: Test Document\nauthor: John\n---\nBody content";
      const result = processor.extract(content);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        assertEquals(result.data.body, "Body content");

        const titleResult = result.data.frontmatter.get("title");
        if (titleResult.ok) {
          assertEquals(titleResult.data, "Test Document");
        }
      }
    });

    it("should handle empty frontmatter", () => {
      const extractor = new MockFrontmatterExtractor();
      extractor.setDataToReturn({ frontmatter: "", body: "Just body content" });
      const parser = new MockFrontmatterParser();

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "Just body content";
      const result = processor.extract(content);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.frontmatter.isEmpty(), true);
        assertEquals(result.data.body, "Just body content");
      }
    });

    it("should handle whitespace-only frontmatter", () => {
      const extractor = new MockFrontmatterExtractor();
      extractor.setDataToReturn({ frontmatter: "   \n  ", body: "Body" });
      const parser = new MockFrontmatterParser();

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "---\n   \n  \n---\nBody";
      const result = processor.extract(content);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.frontmatter.isEmpty(), true);
        assertEquals(result.data.body, "Body");
      }
    });

    it("should handle extraction failure", () => {
      const extractor = new MockFrontmatterExtractor();
      extractor.setShouldFail(
        true,
        createError({
          kind: "ExtractionFailed",
          message: "Failed to extract frontmatter",
        }),
      );
      const parser = new MockFrontmatterParser();

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "Invalid content";
      const result = processor.extract(content);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionFailed");
      }
    });

    it("should handle parsing failure", () => {
      const extractor = new MockFrontmatterExtractor();
      extractor.setDataToReturn({
        frontmatter: "invalid: yaml: content:",
        body: "Body",
      });
      const parser = new MockFrontmatterParser();
      parser.setShouldFail(
        true,
        createError({
          kind: "InvalidYaml",
          message: "Failed to parse YAML",
        }),
      );

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "---\ninvalid: yaml: content:\n---\nBody";
      const result = processor.extract(content);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidYaml");
      }
    });

    it("should handle invalid parsed data", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      // Set parser to return null, which should cause FrontmatterDataFactory to fail
      parser.setDataToReturn(null);

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "---\ntitle: Test\n---\nBody";
      const result = processor.extract(content);

      assertEquals(result.ok, false);
    });

    it("should handle complex nested frontmatter", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      parser.setDataToReturn({
        title: "Complex Document",
        metadata: {
          author: "Jane Doe",
          tags: ["test", "example"],
          published: true,
        },
        config: {
          version: "1.0.0",
          settings: {
            enabled: true,
          },
        },
      });

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const content = "---\ncomplex frontmatter\n---\nBody";
      const result = processor.extract(content);

      assertEquals(result.ok, true);
      if (result.ok) {
        const metadataResult = result.data.frontmatter.get("metadata.author");
        if (metadataResult.ok) {
          assertEquals(metadataResult.data, "Jane Doe");
        }

        const tagsResult = result.data.frontmatter.get("metadata.tags");
        if (tagsResult.ok) {
          assertEquals(Array.isArray(tagsResult.data), true);
          assertEquals((tagsResult.data as string[]).length, 2);
        }
      }
    });
  });

  describe("validate", () => {
    it("should validate frontmatter data successfully", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({ title: "Test", count: 5 });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const rules = ValidationRules.create([
        ValidationRuleFactory.createStringRule("title", false),
        ValidationRuleFactory.createNumberRule("count", false),
      ]);

      const result = processor.validate(dataResult.data, rules);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should currently always return success (validation not implemented)", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({ title: 123 }); // Wrong type
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const rules = ValidationRules.create([
        ValidationRuleFactory.createStringRule("title", false),
      ]);

      const result = processor.validate(dataResult.data, rules);

      // TODO: When validation is implemented, this should return false
      assertEquals(result.ok, true);
    });

    it("should currently always return success for required fields (validation not implemented)", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({}); // Missing required field
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const rules = ValidationRules.create([
        ValidationRuleFactory.createStringRule("title", true),
      ]);

      const result = processor.validate(dataResult.data, rules);

      // TODO: When validation is implemented, this should return false
      assertEquals(result.ok, true);
    });

    it("should validate complex nested structures", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        title: "Test",
        metadata: {
          author: "John",
          tags: ["test", "example"],
        },
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const rules = ValidationRules.create([
        ValidationRuleFactory.createStringRule("title", false),
        ValidationRuleFactory.createObjectRule("metadata", false),
        ValidationRuleFactory.createStringRule("metadata.author", false),
        ValidationRuleFactory.createArrayRule("metadata.tags", false),
      ]);

      const result = processor.validate(dataResult.data, rules);

      assertEquals(result.ok, true);
    });
  });

  describe("extractFromPart", () => {
    it("should extract array data from specified path", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        items: [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
          { id: 3, name: "Item 3" },
        ],
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(dataResult.data, "items");

      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Expected successful extraction");
      assertEquals(Array.isArray(result.data), true);
      assertEquals(result.data.length, 3);

      const firstItem = result.data[0];
      const idResult = firstItem.get("id");
      if (idResult.ok) {
        assertEquals(idResult.data, 1);
      }
    });

    it("should return error for non-array data", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        items: "not an array",
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(dataResult.data, "items");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "MalformedFrontmatter");
        assertEquals(result.error.message.includes("not an array"), true);
      }
    });

    it("should return empty array for non-existent path", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        other: "data",
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(dataResult.data, "items");

      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Expected successful extraction");
      assertEquals(Array.isArray(result.data), true);
      assertEquals(result.data.length, 0);
    });

    it("should handle nested path extraction", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        data: {
          nested: {
            items: [
              { value: "A" },
              { value: "B" },
            ],
          },
        },
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(
        dataResult.data,
        "data.nested.items",
      );

      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Expected successful extraction");
      assertEquals(Array.isArray(result.data), true);
      assertEquals(result.data.length, 2);

      const firstValue = result.data[0].get("value");
      if (firstValue.ok) {
        assertEquals(firstValue.data, "A");
      }
    });

    it("should handle empty array", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        items: [],
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(dataResult.data, "items");

      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Expected successful extraction");
      assertEquals(Array.isArray(result.data), true);
      assertEquals(result.data.length, 0);
    });

    it("should handle array with invalid items", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      const dataResult = FrontmatterData.create({
        items: [
          { valid: "object" },
          null, // This should be filtered out
          { another: "object" },
          undefined, // This should be filtered out
          { third: "object" },
        ],
      });
      if (!dataResult.ok) throw new Error("Failed to create test data");

      const result = processor.extractFromPart(dataResult.data, "items");

      // The actual implementation now returns Result with successfully parsed items
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Expected successful extraction");
      assertEquals(Array.isArray(result.data), true);
      assertEquals(result.data.length, 3); // Only valid objects are included
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete extraction and validation flow", () => {
      const extractor = new MockFrontmatterExtractor();
      extractor.setDataToReturn({
        frontmatter: "title: Test\ncount: 5",
        body: "Document body",
      });

      const parser = new MockFrontmatterParser();
      parser.setDataToReturn({ title: "Test", count: 5 });

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      // Extract
      const extractResult = processor.extract(
        "---\ntitle: Test\ncount: 5\n---\nDocument body",
      );
      assertEquals(extractResult.ok, true);

      if (extractResult.ok) {
        // Validate
        const rules = ValidationRules.create([
          ValidationRuleFactory.createStringRule("title", false),
          ValidationRuleFactory.createNumberRule("count", false, {
            minimum: 0,
            maximum: 10,
          }),
        ]);

        const validateResult = processor.validate(
          extractResult.data.frontmatter,
          rules,
        );

        assertEquals(validateResult.ok, true);
      }
    });

    it("should handle extraction with part extraction", () => {
      const extractor = new MockFrontmatterExtractor();
      const parser = new MockFrontmatterParser();
      parser.setDataToReturn({
        metadata: {
          title: "Document",
        },
        items: [
          { id: 1, name: "First" },
          { id: 2, name: "Second" },
        ],
      });

      const processorResult = FrontmatterProcessor.create(extractor, parser);
      if (!processorResult.ok) throw new Error("Failed to create processor");
      const processor = processorResult.data;

      // Extract
      const extractResult = processor.extract("---\nfrontmatter\n---\nBody");
      assertEquals(extractResult.ok, true);

      if (extractResult.ok) {
        // Extract from part
        const itemsResult = processor.extractFromPart(
          extractResult.data.frontmatter,
          "items",
        );

        assertEquals(itemsResult.ok, true);
        if (!itemsResult.ok) throw new Error("Expected successful extraction");
        assertEquals(itemsResult.data.length, 2);

        const firstNameResult = itemsResult.data[0].get("name");
        if (firstNameResult.ok) {
          assertEquals(firstNameResult.data, "First");
        }
      }
    });
  });
});
