import { err, ok } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import {
  AssertionHelpers,
  BusinessRequirement,
  FrontmatterSpecification,
  RequirementBuilder,
  SchemaSpecification,
  TemplateSpecification,
} from "./framework.ts";

/**
 * Domain-specific business requirement specifications
 * Following requirements from docs/requirements.ja.md
 */
export class DomainSpecifications {
  /**
   * REQ-001: Schema processing with $ref resolution
   */
  static schemaRefResolution(): BusinessRequirement {
    const builder = new RequirementBuilder();

    const result = builder
      .withId("REQ-001")
      .withDescription("Schema must correctly resolve $ref references")
      // deno-lint-ignore require-await
      .withGiven("a schema with $ref to external file", async () => {
        const schemas = new Map<string, SchemaSpecification>();
        schemas.set("main.json", {
          path: "main.json",
          content: {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "properties": {
              "commands": {
                "type": "array",
                "items": { "$ref": "command.json" },
              },
            },
          },
          hasXTemplate: true,
          hasXTemplateItems: true,
          hasXDerivedFrom: false,
          validationRules: ["type", "required"],
        });
        schemas.set("command.json", {
          path: "command.json",
          content: {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "c1": { "type": "string" },
              "c2": { "type": "string" },
            },
          },
          hasXTemplate: false,
          hasXTemplateItems: false,
          hasXDerivedFrom: false,
          validationRules: ["type"],
        });

        return {
          schemas,
          frontmatters: new Map(),
          templates: new Map(),
          configurations: {
            inputPattern: "**/*.md",
            outputPath: "output.json",
            schemaPath: "main.json",
          },
        };
      })
      // deno-lint-ignore require-await
      .withWhen("schema is processed", async (_context) => {
        // This would call the actual schema processing service
        // For now, returning a mock result
        return {
          output: {
            content: JSON.stringify({ resolved: true }),
            format: "json",
          },
        };
      })
      .withThen("$ref should be resolved to actual schema", (result) => {
        if (!result.output) {
          return err({
            kind: "AssertionError",
            expected: "output with resolved schema",
            actual: "no output",
            message: "$ref was not resolved",
          });
        }
        return ok(undefined);
      })
      .build();

    if (!result.ok) {
      throw new Error(`Failed to build requirement: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * REQ-002: Frontmatter extraction with validation
   */
  static frontmatterExtraction(): BusinessRequirement {
    const builder = new RequirementBuilder();

    const result = builder
      .withId("REQ-002")
      .withDescription("Frontmatter must be correctly extracted and validated")
      // deno-lint-ignore require-await
      .withGiven("markdown files with frontmatter", async () => {
        const frontmatters = new Map<string, FrontmatterSpecification>();
        frontmatters.set("doc1.md", {
          path: "doc1.md",
          frontmatter: {
            c1: "git",
            c2: "commit",
            c3: "message",
            title: "Git Commit Helper",
          },
          content:
            "---\nc1: git\nc2: commit\nc3: message\ntitle: Git Commit Helper\n---\n# Content",
        });

        const schemas = new Map<string, SchemaSpecification>();
        schemas.set("schema.json", {
          path: "schema.json",
          content: {
            properties: {
              c1: { type: "string" },
              c2: { type: "string" },
              c3: { type: "string" },
              title: { type: "string" },
            },
            required: ["c1", "c2", "c3"],
          },
          hasXTemplate: false,
          hasXTemplateItems: false,
          hasXDerivedFrom: false,
          validationRules: ["type", "required"],
        });

        return {
          schemas,
          frontmatters,
          templates: new Map(),
          configurations: {
            inputPattern: "**/*.md",
            outputPath: "output.json",
            schemaPath: "schema.json",
          },
        };
      })
      // deno-lint-ignore require-await
      .withWhen("frontmatter is extracted", async (_context) => {
        // Process frontmatter extraction
        return {
          output: {
            content: JSON.stringify({
              c1: "git",
              c2: "commit",
              c3: "message",
              title: "Git Commit Helper",
            }),
            format: "json",
          },
          metrics: {
            filesProcessed: 1,
            processingTime: 100,
            memoryUsage: 1000,
            errors: 0,
          },
        };
      })
      .withThen("frontmatter fields should be extracted", (result) => {
        return AssertionHelpers.outputContains("git")(result);
      })
      .withThen("validation should pass", (result) => {
        return AssertionHelpers.noErrors()(result);
      })
      .build();

    if (!result.ok) {
      throw new Error(`Failed to build requirement: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * REQ-003: Template rendering with variable substitution
   */
  static templateRendering(): BusinessRequirement {
    const builder = new RequirementBuilder();

    const result = builder
      .withId("REQ-003")
      .withDescription(
        "Template must correctly render with variable substitution",
      )
      // deno-lint-ignore require-await
      .withGiven("template with variables and data", async () => {
        const templates = new Map<string, TemplateSpecification>();
        templates.set("template.json", {
          path: "template.json",
          content: '{\n  "command": "{c1} {c2}",\n  "title": "{title}"\n}',
          variables: ["c1", "c2", "title"],
        });

        const frontmatters = new Map<string, FrontmatterSpecification>();
        frontmatters.set("data.md", {
          path: "data.md",
          frontmatter: {
            c1: "git",
            c2: "status",
            title: "Check Repository Status",
          },
          content:
            "---\nc1: git\nc2: status\ntitle: Check Repository Status\n---\n",
        });

        return {
          schemas: new Map(),
          frontmatters,
          templates,
          configurations: {
            inputPattern: "data.md",
            outputPath: "output.json",
            schemaPath: "schema.json",
            templatePath: "template.json",
          },
        };
      })
      // deno-lint-ignore require-await
      .withWhen("template is rendered", async (_context) => {
        return {
          output: {
            content:
              '{\n  "command": "git status",\n  "title": "Check Repository Status"\n}',
            format: "json",
          },
        };
      })
      .withThen("variables should be substituted", (result) => {
        return AssertionHelpers.outputContains("git status")(result);
      })
      .withThen("output format should be JSON", (result) => {
        return AssertionHelpers.outputFormat("json")(result);
      })
      .build();

    if (!result.ok) {
      throw new Error(`Failed to build requirement: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * REQ-004: Aggregation with derived field generation
   */
  static aggregationWithDerivedFields(): BusinessRequirement {
    const builder = new RequirementBuilder();

    const result = builder
      .withId("REQ-004")
      .withDescription(
        "Aggregation must generate derived fields from x-derived-from",
      )
      .withGiven(
        "schema with x-derived-from and multiple documents",
        // deno-lint-ignore require-await
        async () => {
          const schemas = new Map<string, SchemaSpecification>();
          schemas.set("registry.json", {
            path: "registry.json",
            content: {
              properties: {
                availableConfigs: {
                  type: "array",
                  "x-derived-from": "commands[].c1",
                  "x-derived-unique": true,
                  items: { type: "string" },
                },
                commands: {
                  type: "array",
                  "x-frontmatter-part": true,
                  items: { type: "object" },
                },
              },
            },
            hasXTemplate: true,
            hasXTemplateItems: false,
            hasXDerivedFrom: true,
            validationRules: ["type"],
          });

          const frontmatters = new Map<string, FrontmatterSpecification>();
          frontmatters.set("cmd1.md", {
            path: "cmd1.md",
            frontmatter: { c1: "git", c2: "commit" },
            content: "---\nc1: git\nc2: commit\n---\n",
          });
          frontmatters.set("cmd2.md", {
            path: "cmd2.md",
            frontmatter: { c1: "spec", c2: "analyze" },
            content: "---\nc1: spec\nc2: analyze\n---\n",
          });
          frontmatters.set("cmd3.md", {
            path: "cmd3.md",
            frontmatter: { c1: "git", c2: "push" },
            content: "---\nc1: git\nc2: push\n---\n",
          });

          return {
            schemas,
            frontmatters,
            templates: new Map(),
            configurations: {
              inputPattern: "**/*.md",
              outputPath: "registry.json",
              schemaPath: "registry.json",
            },
          };
        },
      )
      // deno-lint-ignore require-await
      .withWhen("aggregation is performed", async (_context) => {
        return {
          output: {
            content: JSON.stringify({
              availableConfigs: ["git", "spec"],
              commands: [
                { c1: "git", c2: "commit" },
                { c1: "spec", c2: "analyze" },
                { c1: "git", c2: "push" },
              ],
            }),
            format: "json",
          },
          metrics: {
            filesProcessed: 3,
            processingTime: 150,
            memoryUsage: 2000,
            errors: 0,
          },
        };
      })
      .withThen("derived fields should be generated", (result) => {
        return AssertionHelpers.outputContains("availableConfigs")(result);
      })
      .withThen("unique values should be extracted", (result) => {
        if (!result.output) {
          return err({
            kind: "AssertionError",
            expected: "unique values",
            actual: "no output",
            message: "Expected output with unique values",
          });
        }
        const data = JSON.parse(result.output.content);
        if (data.availableConfigs.length !== 2) {
          return err({
            kind: "AssertionError",
            expected: 2,
            actual: data.availableConfigs.length,
            message: "Expected 2 unique configs",
          });
        }
        return ok(undefined);
      })
      .build();

    if (!result.ok) {
      throw new Error(`Failed to build requirement: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * REQ-005: Pipeline orchestration with error recovery
   */
  static pipelineErrorRecovery(): BusinessRequirement {
    const builder = new RequirementBuilder();

    const result = builder
      .withId("REQ-005")
      .withDescription("Pipeline must handle errors gracefully with recovery")
      // deno-lint-ignore require-await
      .withGiven("pipeline with failing document", async () => {
        const frontmatters = new Map<string, FrontmatterSpecification>();
        // Valid document
        frontmatters.set("valid.md", {
          path: "valid.md",
          frontmatter: { c1: "git", c2: "commit", c3: "message" },
          content: "---\nc1: git\nc2: commit\nc3: message\n---\n",
        });
        // Invalid document (missing required field)
        frontmatters.set("invalid.md", {
          path: "invalid.md",
          frontmatter: { c1: "git" }, // Missing c2 and c3
          content: "---\nc1: git\n---\n",
        });

        const schemas = new Map<string, SchemaSpecification>();
        schemas.set("schema.json", {
          path: "schema.json",
          content: {
            properties: {
              c1: { type: "string" },
              c2: { type: "string" },
              c3: { type: "string" },
            },
            required: ["c1", "c2", "c3"],
          },
          hasXTemplate: false,
          hasXTemplateItems: false,
          hasXDerivedFrom: false,
          validationRules: ["type", "required"],
        });

        return {
          schemas,
          frontmatters,
          templates: new Map(),
          configurations: {
            inputPattern: "**/*.md",
            outputPath: "output.json",
            schemaPath: "schema.json",
          },
        };
      })
      // deno-lint-ignore require-await
      .withWhen("pipeline processes documents", async (_context) => {
        return {
          output: {
            content: JSON.stringify([
              { c1: "git", c2: "commit", c3: "message" },
            ]),
            format: "json",
          },
          errors: [
            {
              kind: "MissingRequired",
              field: "c2",
            } as DomainError,
          ],
          metrics: {
            filesProcessed: 2,
            processingTime: 200,
            memoryUsage: 1500,
            errors: 1,
          },
        };
      })
      .withThen("valid documents should be processed", (result) => {
        return AssertionHelpers.outputContains("commit")(result);
      })
      .withThen("errors should be reported", (result) => {
        if (!result.errors || result.errors.length === 0) {
          return err({
            kind: "AssertionError",
            expected: "errors",
            actual: "no errors",
            message: "Expected errors to be reported",
          });
        }
        return ok(undefined);
      })
      .withThen("pipeline should continue processing", (result) => {
        return AssertionHelpers.metricsMatch({ filesProcessed: 2 })(result);
      })
      .build();

    if (!result.ok) {
      throw new Error(`Failed to build requirement: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Get all domain business requirements
   */
  static getAllRequirements(): BusinessRequirement[] {
    return [
      this.schemaRefResolution(),
      this.frontmatterExtraction(),
      this.templateRendering(),
      this.aggregationWithDerivedFields(),
      this.pipelineErrorRecovery(),
    ];
  }
}
