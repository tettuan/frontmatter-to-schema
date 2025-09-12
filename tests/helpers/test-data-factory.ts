/**
 * Test Data Factory - Reusable Test Data Generation
 * 
 * Addresses Issue #666: Standardized test data creation
 * Supports robust testing with consistent data patterns
 * Follows DDD and Totality principles for test reliability
 */

import { SchemaTemplateInfo } from "../../src/domain/models/schema-extensions.ts";
import { DerivationRule, AggregationContext } from "../../src/domain/aggregation/value-objects.ts";

/**
 * Registry command structure for test scenarios
 */
export interface TestCommand {
  c1: string;
  c2: string;
  c3: string;
  title: string;
  description: string;
}

/**
 * Registry test data factory
 */
export class TestDataFactory {
  
  /**
   * Create standard registry test data with commands
   */
  static createRegistryTestData(commandCount: number = 3): Array<{ tools: { commands: TestCommand[] } }> {
    const commands: TestCommand[] = [];
    const configs = ["git", "debug", "refactor", "build", "spec"];
    const actions = ["merge-up", "analyze-deep", "ddd", "robust", "validate"];
    const targets = ["base-branch", "project-issues", "architecture", "testing", "schemas"];

    for (let i = 0; i < commandCount; i++) {
      commands.push({
        c1: configs[i % configs.length],
        c2: actions[i % actions.length],
        c3: targets[i % targets.length],
        title: `${configs[i % configs.length].charAt(0).toUpperCase()}${configs[i % configs.length].slice(1)} Command`,
        description: `${configs[i % configs.length]} ${actions[i % actions.length]} operation`
      });
    }

    return [{
      tools: {
        commands: commands
      }
    }];
  }

  /**
   * Create standard registry schema for x-derived-from testing
   */
  static createRegistrySchema() {
    return {
      type: "object",
      "x-template": "registry_template.json",
      properties: {
        version: { type: "string" },
        description: { type: "string" },
        tools: {
          type: "object",
          properties: {
            availableConfigs: {
              type: "array",
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
              items: { type: "string" }
            },
            commands: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  c1: { type: "string" },
                  c2: { type: "string" },
                  c3: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create complex multi-field schema for testing
   */
  static createComplexSchema() {
    return {
      type: "object",
      properties: {
        tools: {
          type: "object",
          properties: {
            configs: {
              type: "array",
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
              items: { type: "string" }
            },
            actions: {
              type: "array", 
              "x-derived-from": "commands[].c2",
              "x-derived-unique": true,
              items: { type: "string" }
            },
            commands: {
              type: "array",
              "x-frontmatter-part": true,
              items: { type: "object" }
            }
          }
        },
        meta: {
          type: "object",
          properties: {
            totalCommands: {
              type: "number",
              "x-derived-from": "commands[]",
              items: { type: "object" }
            }
          }
        }
      }
    };
  }

  /**
   * Create individual processing schema (no nested structure)
   */
  static createIndividualSchema() {
    return {
      type: "object",
      properties: {
        commands: {
          type: "array",
          "x-frontmatter-part": true,
          items: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          }
        }
      }
    };
  }

  /**
   * Create template definition for testing
   */
  static createTemplateDefinition() {
    return {
      version: "{{version}}",
      description: "Generated configuration",
      tools: {
        availableConfigs: "{{tools.availableConfigs}}",
        commands: "{{tools.commands}}"
      }
    };
  }

  /**
   * Create large dataset for performance testing
   */
  static createLargeTestData(itemCount: number = 1000): Array<{ tools: { commands: TestCommand[] } }> {
    const commands: TestCommand[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      commands.push({
        c1: `type-${i % 10}`, // 10 unique types
        c2: `action-${i % 5}`, // 5 unique actions
        c3: `target-${i}`,
        title: `Command ${i}`,
        description: `Description for command ${i}`
      });
    }

    return [{
      tools: {
        commands: commands
      }
    }];
  }

  /**
   * Create nested test data for deep structure testing
   */
  static createNestedTestData() {
    return {
      projects: [
        {
          modules: [
            { 
              tools: [
                { name: "climpt", type: "cli" }, 
                { name: "totality", type: "principle" }
              ] 
            }
          ]
        }
      ]
    };
  }

  /**
   * Create mixed data types for edge case testing
   */
  static createMixedDataTypes() {
    return {
      mixed: [
        { value: "string" },
        { value: 123 },
        { value: true },
        { value: null }
      ]
    };
  }

  /**
   * Create derivation rule for testing
   */
  static createDerivationRule(targetField: string, sourceExpression: string, options: { unique: boolean; flatten: boolean }) {
    return DerivationRule.create(targetField, sourceExpression, options);
  }

  /**
   * Create aggregation context for testing
   */
  static createAggregationContext(rules: any[], options: { skipNull: boolean; skipUndefined: boolean }) {
    return AggregationContext.create(rules, options);
  }

  /**
   * Create schema template info from schema
   */
  static createSchemaTemplateInfo(schema: any) {
    return SchemaTemplateInfo.extract(schema);
  }
}