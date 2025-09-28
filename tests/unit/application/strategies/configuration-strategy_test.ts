import { assertEquals } from "jsr:@std/assert";
import {
  ConfigurationManager,
  StandardConfigurationStrategy,
  CustomConfigurationStrategy,
  CustomConfigurationBuilder,
} from "../../../../src/application/strategies/configuration-strategy.ts";
import { ProcessingError } from "../../../../src/domain/shared/types/errors.ts";

/**
 * Unit tests for configuration strategy patterns
 */

Deno.test("StandardConfigurationStrategy - create instance", () => {
  const strategy = new StandardConfigurationStrategy();
  assertEquals(strategy.strategyName, "standard");
});

Deno.test("StandardConfigurationStrategy - getDefaultValue string success", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<string>("outputFormat", "string");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "json");
});

Deno.test("StandardConfigurationStrategy - getDefaultValue array success", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<string[]>("inputExtensions", "array");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), [".md", ".markdown"]);
});

Deno.test("StandardConfigurationStrategy - getDefaultValue number success", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<number>("maxDepth", "number");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), 10);
});

Deno.test("StandardConfigurationStrategy - getDefaultValue boolean success", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<boolean>("includeMetadata", "boolean");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true);
});

Deno.test("StandardConfigurationStrategy - getDefaultValue object success", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<Record<string, string>>("errorMessages", "object");

  assertEquals(result.isOk(), true);
  const errorMessages = result.unwrap();
  assertEquals(typeof errorMessages, "object");
  assertEquals(typeof errorMessages["SCHEMA_READ_ERROR"], "string");
});

Deno.test("StandardConfigurationStrategy - getDefaultValue unknown key", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<string>("unknownKey", "string");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "DEFAULT_VALUE_NOT_FOUND");
});

Deno.test("StandardConfigurationStrategy - getDefaultValue type mismatch", () => {
  const strategy = new StandardConfigurationStrategy();
  const result = strategy.getDefaultValue<number>("outputFormat", "number");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "DEFAULT_VALUE_TYPE_MISMATCH");
});

Deno.test("StandardConfigurationStrategy - hasDefault checks existence", () => {
  const strategy = new StandardConfigurationStrategy();

  assertEquals(strategy.hasDefault("outputFormat"), true);
  assertEquals(strategy.hasDefault("inputExtensions"), true);
  assertEquals(strategy.hasDefault("unknownKey"), false);
});

Deno.test("CustomConfigurationStrategy - create with custom defaults", () => {
  const customDefaults = new Map([
    ["customKey", { value: "customValue", type: "string" }],
    ["customNumber", { value: 42, type: "number" }],
  ]);

  const strategy = new CustomConfigurationStrategy(customDefaults);
  assertEquals(strategy.strategyName, "custom");
});

Deno.test("CustomConfigurationStrategy - getDefaultValue success", () => {
  const customDefaults = new Map([
    ["customKey", { value: "customValue", type: "string" }],
  ]);

  const strategy = new CustomConfigurationStrategy(customDefaults);
  const result = strategy.getDefaultValue<string>("customKey", "string");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "customValue");
});

Deno.test("CustomConfigurationStrategy - getDefaultValue unknown key", () => {
  const customDefaults = new Map();
  const strategy = new CustomConfigurationStrategy(customDefaults);
  const result = strategy.getDefaultValue<string>("unknownKey", "string");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "CUSTOM_DEFAULT_VALUE_NOT_FOUND");
});

Deno.test("CustomConfigurationStrategy - getDefaultValue type mismatch", () => {
  const customDefaults = new Map([
    ["customKey", { value: "customValue", type: "string" }],
  ]);

  const strategy = new CustomConfigurationStrategy(customDefaults);
  const result = strategy.getDefaultValue<number>("customKey", "number");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "CUSTOM_DEFAULT_VALUE_TYPE_MISMATCH");
});

Deno.test("CustomConfigurationStrategy - hasDefault checks existence", () => {
  const customDefaults = new Map([
    ["customKey", { value: "customValue", type: "string" }],
  ]);

  const strategy = new CustomConfigurationStrategy(customDefaults);
  assertEquals(strategy.hasDefault("customKey"), true);
  assertEquals(strategy.hasDefault("unknownKey"), false);
});

Deno.test("CustomConfigurationBuilder - builder pattern", () => {
  const builder = CustomConfigurationStrategy.builder();
  const strategy = builder
    .withStringDefault("stringKey", "stringValue")
    .withNumberDefault("numberKey", 123)
    .withBooleanDefault("booleanKey", true)
    .withArrayDefault("arrayKey", ["item1", "item2"])
    .withObjectDefault("objectKey", { nested: "value" })
    .build();

  assertEquals(strategy.strategyName, "custom");
  assertEquals(strategy.hasDefault("stringKey"), true);
  assertEquals(strategy.hasDefault("numberKey"), true);
  assertEquals(strategy.hasDefault("booleanKey"), true);
  assertEquals(strategy.hasDefault("arrayKey"), true);
  assertEquals(strategy.hasDefault("objectKey"), true);
});

Deno.test("CustomConfigurationBuilder - withDefault generic method", () => {
  const builder = new CustomConfigurationBuilder();
  const strategy = builder
    .withDefault("genericKey", "genericValue", "string")
    .build();

  const result = strategy.getDefaultValue<string>("genericKey", "string");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "genericValue");
});

Deno.test("ConfigurationManager - create with default strategy", () => {
  const manager = new ConfigurationManager();

  // Should use StandardConfigurationStrategy by default
  const result = manager.getStringDefault("outputFormat");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "json");
});

Deno.test("ConfigurationManager - create with custom primary strategy", () => {
  const customStrategy = CustomConfigurationStrategy.builder()
    .withStringDefault("customFormat", "yaml")
    .build();

  const manager = new ConfigurationManager(customStrategy);

  const result = manager.getStringDefault("customFormat");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "yaml");
});

Deno.test("ConfigurationManager - fallback strategy precedence", () => {
  const primaryStrategy = CustomConfigurationStrategy.builder()
    .withStringDefault("sharedKey", "primaryValue")
    .build();

  const fallbackStrategy = CustomConfigurationStrategy.builder()
    .withStringDefault("sharedKey", "fallbackValue")
    .withStringDefault("fallbackOnly", "fallbackValue")
    .build();

  const manager = new ConfigurationManager(primaryStrategy);
  manager.addFallbackStrategy(fallbackStrategy);

  // Primary strategy takes precedence
  const primaryResult = manager.getStringDefault("sharedKey");
  assertEquals(primaryResult.isOk(), true);
  assertEquals(primaryResult.unwrap(), "primaryValue");

  // Falls back for keys not in primary
  const fallbackResult = manager.getStringDefault("fallbackOnly");
  assertEquals(fallbackResult.isOk(), true);
  assertEquals(fallbackResult.unwrap(), "fallbackValue");
});

Deno.test("ConfigurationManager - getDefaultValue not found", () => {
  const manager = new ConfigurationManager();
  const result = manager.getDefaultValue<string>("unknownKey", "string");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "NO_DEFAULT_VALUE_FOUND");
});

Deno.test("ConfigurationManager - typed getter methods", () => {
  const manager = new ConfigurationManager();

  const stringResult = manager.getStringDefault("outputFormat");
  assertEquals(stringResult.isOk(), true);
  assertEquals(stringResult.unwrap(), "json");

  const numberResult = manager.getNumberDefault("maxDepth");
  assertEquals(numberResult.isOk(), true);
  assertEquals(numberResult.unwrap(), 10);

  const booleanResult = manager.getBooleanDefault("includeMetadata");
  assertEquals(booleanResult.isOk(), true);
  assertEquals(booleanResult.unwrap(), true);

  const arrayResult = manager.getArrayDefault<string>("inputExtensions");
  assertEquals(arrayResult.isOk(), true);
  assertEquals(arrayResult.unwrap(), [".md", ".markdown"]);

  const objectResult = manager.getObjectDefault("errorMessages");
  assertEquals(objectResult.isOk(), true);
  assertEquals(typeof objectResult.unwrap(), "object");
});

Deno.test("ConfigurationManager - typed getter methods with unknown keys", () => {
  const manager = new ConfigurationManager();

  const stringResult = manager.getStringDefault("unknownString");
  assertEquals(stringResult.isError(), true);

  const numberResult = manager.getNumberDefault("unknownNumber");
  assertEquals(numberResult.isError(), true);

  const booleanResult = manager.getBooleanDefault("unknownBoolean");
  assertEquals(booleanResult.isError(), true);

  const arrayResult = manager.getArrayDefault<string>("unknownArray");
  assertEquals(arrayResult.isError(), true);

  const objectResult = manager.getObjectDefault("unknownObject");
  assertEquals(objectResult.isError(), true);
});

Deno.test("ConfigurationManager - multiple fallback strategies", () => {
  const primary = CustomConfigurationStrategy.builder()
    .withStringDefault("primaryKey", "primaryValue")
    .build();

  const fallback1 = CustomConfigurationStrategy.builder()
    .withStringDefault("fallback1Key", "fallback1Value")
    .build();

  const fallback2 = CustomConfigurationStrategy.builder()
    .withStringDefault("fallback2Key", "fallback2Value")
    .build();

  const manager = new ConfigurationManager(primary);
  manager.addFallbackStrategy(fallback1);
  manager.addFallbackStrategy(fallback2);

  // Primary key
  assertEquals(manager.getStringDefault("primaryKey").unwrap(), "primaryValue");

  // Fallback 1 key
  assertEquals(manager.getStringDefault("fallback1Key").unwrap(), "fallback1Value");

  // Fallback 2 key
  assertEquals(manager.getStringDefault("fallback2Key").unwrap(), "fallback2Value");

  // Unknown key
  assertEquals(manager.getStringDefault("unknownKey").isError(), true);
});