import { assertEquals, assertExists } from "@std/assert";
import { collectByPattern } from "./pattern-collector.ts";
import { WarningCode } from "./types.ts";

Deno.test("pattern-collector - basic pattern matching", () => {
  const data = {
    options: {
      input: ["default"],
      destination: true,
      "uv-scope": "domain architecture",
      "uv-date": "2025-06-08",
      "uv-author": "John",
    },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^uv-.*$" },
    "user_variables",
  );

  assertEquals(result.warnings.length, 0);
  assertEquals(result.data, [
    { key: "uv-author", value: "John" },
    { key: "uv-date", value: "2025-06-08" },
    { key: "uv-scope", value: "domain architecture" },
  ]);
});

Deno.test("pattern-collector - nested path resolution", () => {
  const data = {
    config: {
      advanced: {
        "param_timeout": 30,
        "param_retry": 3,
        "other": "value",
      },
    },
  };

  const result = collectByPattern(
    data,
    { source: "config.advanced", pattern: "^param_.*$" },
    "params",
  );

  assertEquals(result.warnings.length, 0);
  assertEquals(result.data, [
    { key: "param_retry", value: 3 },
    { key: "param_timeout", value: 30 },
  ]);
});

Deno.test("pattern-collector - no matches returns empty array", () => {
  const data = {
    options: {
      input: ["default"],
      destination: true,
    },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^uv-.*$" },
    "user_variables",
  );

  assertEquals(result.warnings.length, 0);
  assertEquals(result.data, []);
});

Deno.test("pattern-collector - source not found warning", () => {
  const data = {
    options: {},
  };

  const result = collectByPattern(
    data,
    { source: "nonexistent", pattern: "^.*$" },
    "test",
  );

  assertEquals(result.data, []);
  assertEquals(result.warnings.length, 1);
  assertEquals(
    result.warnings[0].code,
    WarningCode.COLLECT_PATTERN_SOURCE_NOT_FOUND,
  );
});

Deno.test("pattern-collector - source not object warning", () => {
  const data = {
    options: "string value",
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^.*$" },
    "test",
  );

  assertEquals(result.data, []);
  assertEquals(result.warnings.length, 1);
  assertEquals(
    result.warnings[0].code,
    WarningCode.COLLECT_PATTERN_SOURCE_NOT_OBJECT,
  );
});

Deno.test("pattern-collector - invalid regex error", () => {
  const data = {
    options: { key: "value" },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "[invalid" },
    "test",
  );

  assertEquals(result.data, []);
  assertEquals(result.warnings.length, 1);
  assertEquals(
    result.warnings[0].code,
    WarningCode.COLLECT_PATTERN_INVALID_REGEX,
  );
  assertEquals(result.warnings[0].severity, "error");
});

Deno.test("pattern-collector - format: object", () => {
  const data = {
    options: {
      "uv-a": 1,
      "uv-b": 2,
    },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^uv-.*$", format: "object" },
    "test",
  );

  assertEquals(result.data, { "uv-a": 1, "uv-b": 2 });
});

Deno.test("pattern-collector - format: keys", () => {
  const data = {
    options: {
      "uv-a": 1,
      "uv-b": 2,
    },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^uv-.*$", format: "keys" },
    "test",
  );

  assertEquals(result.data, ["uv-a", "uv-b"]);
});

Deno.test("pattern-collector - format: values", () => {
  const data = {
    options: {
      "uv-a": 1,
      "uv-b": 2,
    },
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^uv-.*$", format: "values" },
    "test",
  );

  assertEquals(result.data, [1, 2]);
});

Deno.test("pattern-collector - complex regex pattern", () => {
  const data = {
    env: {
      "ENV_DB_HOST": "localhost",
      "ENV_DB_PORT": "5432",
      "ENV_API_KEY": "secret",
      "OTHER_VAR": "value",
    },
  };

  const result = collectByPattern(
    data,
    { source: "env", pattern: "^ENV_DB_.*$" },
    "db_config",
  );

  assertEquals(result.warnings.length, 0);
  assertEquals(result.data, [
    { key: "ENV_DB_HOST", value: "localhost" },
    { key: "ENV_DB_PORT", value: "5432" },
  ]);
});

Deno.test("pattern-collector - array source warning", () => {
  const data = {
    options: ["a", "b", "c"],
  };

  const result = collectByPattern(
    data,
    { source: "options", pattern: "^.*$" },
    "test",
  );

  assertEquals(result.data, []);
  assertEquals(result.warnings.length, 1);
  assertEquals(
    result.warnings[0].code,
    WarningCode.COLLECT_PATTERN_SOURCE_NOT_OBJECT,
  );
});
