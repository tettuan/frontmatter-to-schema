import { assertEquals } from "@std/assert";
import { ItemsDetector } from "../../../../../src/domain/template/services/items-detector.ts";

Deno.test("ItemsDetector - create instance", () => {
  const detector = ItemsDetector.create();

  assertEquals(typeof detector, "object");
  assertEquals(detector.constructor.name, "ItemsDetector");
});

Deno.test("ItemsDetector - detect no items in simple template", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    title: "Simple Template",
    description: "No items here",
    metadata: {
      version: "1.0",
    },
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, false);
  assertEquals(detection.patterns.length, 0);
  assertEquals(detection.isExpandable, false);
});

Deno.test("ItemsDetector - detect single {@items} in string property", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    title: "Template with Items",
    content: "{@items}",
    metadata: {
      version: "1.0",
    },
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1);
  assertEquals(detection.isExpandable, true);

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["content"]);
  assertEquals(pattern.position, 0);
  assertEquals(pattern.isValid, true);
});

Deno.test("ItemsDetector - detect multiple {@items} in different properties", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    commands: "{@items}",
    output: {
      data: "{@items}",
    },
    footer: "No items here",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);
  assertEquals(detection.isExpandable, true);

  const paths = detection.patterns.map((p) => p.path.join("."));
  assertEquals(paths.includes("commands"), true);
  assertEquals(paths.includes("output.data"), true);
});

Deno.test("ItemsDetector - detect {@items} in array elements", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    sections: [
      "{@items}",
      "static content",
      "{@items}",
    ],
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  const firstPattern = detection.patterns.find((p) =>
    p.path.join(".") === "sections.0"
  );
  const thirdPattern = detection.patterns.find((p) =>
    p.path.join(".") === "sections.2"
  );

  assertEquals(firstPattern !== undefined, true);
  assertEquals(thirdPattern !== undefined, true);
});

Deno.test("ItemsDetector - detect {@items} in complex nested structure", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    metadata: {
      title: "Complex Template",
      sections: {
        commands: "{@items}",
        nested: {
          items: [
            {
              data: "{@items}",
            },
          ],
        },
      },
    },
    footer: "End",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  const paths = detection.patterns.map((p) => p.path.join("."));
  assertEquals(paths.includes("metadata.sections.commands"), true);
  assertEquals(paths.includes("metadata.sections.nested.items.0.data"), true);
});

Deno.test("ItemsDetector - validate {@items} patterns", () => {
  const detector = ItemsDetector.create();
  const patterns = [
    {
      path: ["commands"],
      position: 0,
      context: "{@items}",
      isValid: true,
    },
    {
      path: ["output", "data"],
      position: 0,
      context: "{@items}",
      isValid: true,
    },
  ];

  const result = detector.validateItemsPatterns(patterns);

  assertEquals(result.isOk(), true);
});

Deno.test("ItemsDetector - detect multiple {@items} in same context (invalid)", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    content: "{@items} and another {@items}",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  // Both patterns are in the same path
  const validation = detector.validateItemsPatterns(detection.patterns);
  assertEquals(validation.isError(), true);
  assertEquals(
    validation.unwrapError().code,
    "INVALID_ITEMS_PATTERNS",
  );
});

Deno.test("ItemsDetector - handle partial {@items} patterns in text", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    content: "Process items: {@items} for all users",
    description: "Use {@items} expansion",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  detection.patterns.forEach((pattern) => {
    assertEquals(pattern.isValid, true);
    assertEquals(pattern.context.includes("{@items}"), true);
  });
});

Deno.test("ItemsDetector - handle empty and null values", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    empty: "",
    nullValue: null,
    undefined: undefined,
    content: "{@items}",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1);

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["content"]);
});

Deno.test("ItemsDetector - detect {@items} with proper context extraction", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    template: "Before text {@items} after text",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1);

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["template"]);
  assertEquals(pattern.position, 12); // Position in "Before text {@items}"
  assertEquals(pattern.context.includes("Before text"), true);
  assertEquals(pattern.context.includes("after text"), true);
});

Deno.test("ItemsDetector - handle malformed patterns", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    malformed: "{@items", // Missing closing brace
    correct: "{@items}",
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 1); // Only the correct one

  const pattern = detection.patterns[0];
  assertEquals(pattern.path, ["correct"]);
});

Deno.test("ItemsDetector - validate nested paths detection", () => {
  const detector = ItemsDetector.create();
  const patterns = [
    {
      path: ["metadata"],
      position: 0,
      context: "{@items}",
      isValid: true,
    },
    {
      path: ["metadata", "commands"], // Nested under metadata
      position: 0,
      context: "{@items}",
      isValid: true,
    },
  ];

  const result = detector.validateItemsPatterns(patterns);

  assertEquals(result.isError(), true);
  assertEquals(
    result.unwrapError().code,
    "INVALID_ITEMS_PATTERNS",
  );
  assertEquals(
    result.unwrapError().message.includes("Nested {@items}"),
    true,
  );
});

Deno.test("ItemsDetector - handle complex array structures", () => {
  const detector = ItemsDetector.create();
  const templateContent = {
    matrix: [
      ["{@items}", "static"],
      ["content", "{@items}"],
    ],
  };

  const result = detector.detectItems(templateContent);

  assertEquals(result.isOk(), true);
  const detection = result.unwrap();
  assertEquals(detection.hasItems, true);
  assertEquals(detection.patterns.length, 2);

  const paths = detection.patterns.map((p) => p.path.join("."));
  assertEquals(paths.includes("matrix.0.0"), true);
  assertEquals(paths.includes("matrix.1.1"), true);
});

Deno.test("ItemsDetector - handle invalid template content", () => {
  const detector = ItemsDetector.create();
  const invalidContent = "not an object" as any;

  const result = detector.detectItems(invalidContent);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "ITEMS_DETECTION_ERROR");
});
