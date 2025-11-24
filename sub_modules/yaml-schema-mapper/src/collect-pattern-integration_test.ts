import { assertEquals } from "@std/assert";
import { mapYamlToSchema } from "./yaml-mapper.ts";
import { WarningCode } from "./types.ts";

Deno.test("x-collect-pattern - basic integration", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        properties: {
          input: { type: "array" },
          destination: { type: "boolean" },
        },
        additionalProperties: true,
      },
      user_variables: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
          pattern: "^uv-.*$",
        },
      },
    },
  };

  const data = {
    options: {
      input: ["default"],
      destination: true,
      "uv-scope": "domain architecture",
      "uv-date": "2025-06-08",
      "uv-author": "John",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.user_variables, [
    { key: "uv-author", value: "John" },
    { key: "uv-date", value: "2025-06-08" },
    { key: "uv-scope", value: "domain architecture" },
  ]);
  assertEquals(result.data.options, {
    input: ["default"],
    destination: true,
    "uv-scope": "domain architecture",
    "uv-date": "2025-06-08",
    "uv-author": "John",
  });
});

Deno.test("x-collect-pattern - multiple patterns", () => {
  const schema = {
    type: "object",
    properties: {
      config: {
        type: "object",
        additionalProperties: true,
      },
      db_settings: {
        type: "array",
        "x-collect-pattern": {
          source: "config",
          pattern: "^db_.*$",
        },
      },
      api_settings: {
        type: "array",
        "x-collect-pattern": {
          source: "config",
          pattern: "^api_.*$",
        },
      },
    },
  };

  const data = {
    config: {
      "db_host": "localhost",
      "db_port": 5432,
      "api_key": "secret",
      "api_timeout": 30,
      "other": "value",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.db_settings, [
    { key: "db_host", value: "localhost" },
    { key: "db_port", value: 5432 },
  ]);
  assertEquals(result.data.api_settings, [
    { key: "api_key", value: "secret" },
    { key: "api_timeout", value: 30 },
  ]);
});

Deno.test("x-collect-pattern - additionalProperties false warning", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        properties: {
          input: { type: "array" },
        },
        additionalProperties: false,
      },
      collected: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
          pattern: "^uv-.*$",
        },
      },
    },
  };

  const data = {
    options: {
      input: ["default"],
      "uv-test": "value",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  const warningFound = result.warnings.some(
    (w) => w.code === WarningCode.COLLECT_PATTERN_ADDITIONAL_PROPS_FALSE,
  );
  assertEquals(warningFound, true);
});

Deno.test("x-collect-pattern - no matches returns empty array", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        additionalProperties: true,
      },
      collected: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
          pattern: "^nonexistent_.*$",
        },
      },
    },
  };

  const data = {
    options: {
      key1: "value1",
      key2: "value2",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.collected, []);
});

Deno.test("x-collect-pattern - with format option", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        additionalProperties: true,
      },
      collected_keys: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
          pattern: "^uv-.*$",
          format: "keys" as const,
        },
      },
    },
  };

  const data = {
    options: {
      "uv-a": 1,
      "uv-b": 2,
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.collected_keys, ["uv-a", "uv-b"]);
});

Deno.test("x-collect-pattern - coexists with normal properties", () => {
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      options: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
        },
        additionalProperties: true,
      },
      user_vars: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
          pattern: "^uv-.*$",
        },
      },
    },
  };

  const data = {
    title: "Test Document",
    options: {
      enabled: true,
      "uv-custom": "custom value",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.title, "Test Document");
  assertEquals(result.data.options, {
    enabled: true,
    "uv-custom": "custom value",
  });
  assertEquals(result.data.user_vars, [
    { key: "uv-custom", value: "custom value" },
  ]);
});

Deno.test("x-collect-pattern - source not found", () => {
  const schema = {
    type: "object",
    properties: {
      collected: {
        type: "array",
        "x-collect-pattern": {
          source: "nonexistent",
          pattern: "^.*$",
        },
      },
    },
  };

  const data = {};

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.collected, []);
  const warningFound = result.warnings.some(
    (w) => w.code === WarningCode.COLLECT_PATTERN_SOURCE_NOT_FOUND,
  );
  assertEquals(warningFound, true);
});

Deno.test("x-collect-pattern - top-level source (uv pattern)", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        properties: {
          input: { type: "array" },
          destination: { type: "boolean" },
        },
      },
      uv: {
        type: "object",
        additionalProperties: true,
      },
      user_variables: {
        type: "array",
        "x-collect-pattern": {
          source: "uv",
          pattern: "^.*$",
        },
      },
    },
  };

  const data = {
    options: {
      input: ["default"],
      destination: true,
    },
    uv: {
      scope: "domain architecture",
      date: "2025-06-08",
      author: "John",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  assertEquals(result.data.user_variables, [
    { key: "author", value: "John" },
    { key: "date", value: "2025-06-08" },
    { key: "scope", value: "domain architecture" },
  ]);
  assertEquals(result.data.options, {
    input: ["default"],
    destination: true,
  });
  assertEquals(result.data.uv, {
    scope: "domain architecture",
    date: "2025-06-08",
    author: "John",
  });
});

Deno.test("x-collect-pattern - missing source field", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        additionalProperties: true,
      },
      collected: {
        type: "array",
        "x-collect-pattern": {
          pattern: "^uv-.*$",
        },
      },
    },
  };

  const data = {
    options: {
      "uv-test": "value",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  // Should not throw, but produce a warning
  const warningFound = result.warnings.some(
    (w) =>
      w.code === WarningCode.COLLECT_PATTERN_SOURCE_NOT_FOUND &&
      w.message.includes("requires 'source' field"),
  );
  assertEquals(warningFound, true);
  // Result should not have the collected property set to anything useful
  assertEquals(result.data.collected, undefined);
});

Deno.test("x-collect-pattern - missing pattern field", () => {
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "object",
        additionalProperties: true,
      },
      collected: {
        type: "array",
        "x-collect-pattern": {
          source: "options",
        },
      },
    },
  };

  const data = {
    options: {
      "uv-test": "value",
    },
  };

  const result = mapYamlToSchema({ schema, data });

  // Should not throw, but produce a warning
  const warningFound = result.warnings.some(
    (w) =>
      w.code === WarningCode.COLLECT_PATTERN_INVALID_REGEX &&
      w.message.includes("requires 'pattern' field"),
  );
  assertEquals(warningFound, true);
  // Result should not have the collected property set to anything useful
  assertEquals(result.data.collected, undefined);
});
