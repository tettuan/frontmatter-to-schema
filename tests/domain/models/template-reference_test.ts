/**
 * Comprehensive tests for TemplateReference
 * Target coverage: >80%
 */

import { assertEquals } from "@std/assert";
import {
  isTemplateReference,
  TemplateReference,
} from "../../../src/domain/models/template-reference.ts";

Deno.test("TemplateReference - Smart Constructor Validation", async (t) => {
  await t.step("creates placeholder reference successfully", () => {
    const result = TemplateReference.create("{{user.name}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isPlaceholder(), true);
      assertEquals(result.data.getOriginalValue(), "{{user.name}}");
    }
  });

  await t.step("creates file reference successfully", () => {
    const result = TemplateReference.create('{"": "template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isFileReference(), true);
      assertEquals(result.data.getOriginalValue(), '{"": "template.json"}');
    }
  });

  await t.step("creates array item reference successfully", () => {
    const result = TemplateReference.create('{"": "command-array.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isArrayItem(), true);
    }
  });

  await t.step("creates literal reference successfully", () => {
    const result = TemplateReference.create("plain text value");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isLiteral(), true);
      assertEquals(result.data.getOriginalValue(), "plain text value");
    }
  });

  await t.step("fails with non-string input", () => {
    const result = TemplateReference.create(123 as unknown as string);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("fails with empty string", () => {
    const result = TemplateReference.create("");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("fails with whitespace-only string", () => {
    const result = TemplateReference.create("   ");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });
});

Deno.test("TemplateReference - Placeholder Type", async (t) => {
  await t.step("parses simple placeholder", () => {
    const result = TemplateReference.create("{{name}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const ref = result.data;
      assertEquals(ref.isPlaceholder(), true);
      assertEquals(ref.isFileReference(), false);
      assertEquals(ref.isArrayItem(), false);
      assertEquals(ref.isLiteral(), false);

      const pathResult = ref.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "name");
      }
    }
  });

  await t.step("parses nested path placeholder", () => {
    const result = TemplateReference.create("{{user.profile.email}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "user.profile.email");
      }
    }
  });

  await t.step("handles placeholder with spaces", () => {
    const result = TemplateReference.create("{{ name }}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "name");
      }
    }
  });

  await t.step("fails with empty placeholder path", () => {
    const result = TemplateReference.create("{{}}");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("fails with empty placeholder path (spaces only)", () => {
    const result = TemplateReference.create("{{  }}");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });
});

Deno.test("TemplateReference - File Reference Type", async (t) => {
  await t.step("parses simple file reference", () => {
    const result = TemplateReference.create('{"": "template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const ref = result.data;
      assertEquals(ref.isFileReference(), true);
      assertEquals(ref.isPlaceholder(), false);

      const pathResult = ref.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "template.json");
      }
    }
  });

  await t.step("parses file reference with path", () => {
    const result = TemplateReference.create('{"": "configs/template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "configs/template.json");
      }
    }
  });

  await t.step("detects array item template by name", () => {
    const result = TemplateReference.create(
      '{"": "command-array-template.json"}',
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isArrayItem(), true);
      assertEquals(result.data.isFileReference(), false);
    }
  });

  await t.step("detects array item template with 'item' in name", () => {
    const result = TemplateReference.create('{"": "item-template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isArrayItem(), true);
    }
  });

  await t.step("detects command template as array item", () => {
    const result = TemplateReference.create(
      '{"": "registry-command-template.json"}',
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isArrayItem(), true);
    }
  });

  await t.step("fails with empty file path", () => {
    const result = TemplateReference.create('{"": ""}');
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("fails with whitespace-only file path", () => {
    const result = TemplateReference.create('{"": "  "}');
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("treats invalid JSON as literal", () => {
    const result = TemplateReference.create('{"": template.json}'); // Missing quotes
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isLiteral(), true);
    }
  });

  await t.step("treats object without empty key as literal", () => {
    const result = TemplateReference.create('{"key": "value"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isLiteral(), true);
    }
  });
});

Deno.test("TemplateReference - Literal Type", async (t) => {
  await t.step("creates literal for plain text", () => {
    const result = TemplateReference.create("Just some text");
    assertEquals(result.ok, true);
    if (result.ok) {
      const ref = result.data;
      assertEquals(ref.isLiteral(), true);
      assertEquals(ref.isPlaceholder(), false);
      assertEquals(ref.isFileReference(), false);
      assertEquals(ref.isArrayItem(), false);

      const literalResult = ref.getLiteralValue();
      assertEquals(literalResult.ok, true);
      if (literalResult.ok) {
        assertEquals(literalResult.data, "Just some text");
      }
    }
  });

  await t.step("creates literal for incomplete placeholder", () => {
    const result = TemplateReference.create("{{incomplete");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isLiteral(), true);
    }
  });

  await t.step("creates literal for incomplete JSON", () => {
    const result = TemplateReference.create('{"incomplete');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isLiteral(), true);
    }
  });

  await t.step("trims literal values", () => {
    const result = TemplateReference.create("  text with spaces  ");
    assertEquals(result.ok, true);
    if (result.ok) {
      const literalResult = result.data.getLiteralValue();
      assertEquals(literalResult.ok, true);
      if (literalResult.ok) {
        assertEquals(literalResult.data, "text with spaces");
      }
    }
  });
});

Deno.test("TemplateReference - Accessor Methods", async (t) => {
  await t.step("getPath() works for placeholder", () => {
    const result = TemplateReference.create("{{path.to.value}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "path.to.value");
      }
    }
  });

  await t.step("getPath() works for file reference", () => {
    const result = TemplateReference.create('{"": "file.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "file.json");
      }
    }
  });

  await t.step("getPath() works for array item", () => {
    const result = TemplateReference.create('{"": "array-template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "array-template.json");
      }
    }
  });

  await t.step("getPath() fails for literal", () => {
    const result = TemplateReference.create("literal text");
    assertEquals(result.ok, true);
    if (result.ok) {
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, false);
      if (!pathResult.ok) {
        assertEquals(pathResult.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("getLiteralValue() works for literal", () => {
    const result = TemplateReference.create("literal value");
    assertEquals(result.ok, true);
    if (result.ok) {
      const literalResult = result.data.getLiteralValue();
      assertEquals(literalResult.ok, true);
      if (literalResult.ok) {
        assertEquals(literalResult.data, "literal value");
      }
    }
  });

  await t.step("getLiteralValue() fails for placeholder", () => {
    const result = TemplateReference.create("{{placeholder}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const literalResult = result.data.getLiteralValue();
      assertEquals(literalResult.ok, false);
      if (!literalResult.ok) {
        assertEquals(literalResult.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("getLiteralValue() fails for file reference", () => {
    const result = TemplateReference.create('{"": "file.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const literalResult = result.data.getLiteralValue();
      assertEquals(literalResult.ok, false);
      if (!literalResult.ok) {
        assertEquals(literalResult.error.kind, "InvalidFormat");
      }
    }
  });

  await t.step("getType() returns correct type", () => {
    const placeholder = TemplateReference.create("{{test}}");
    if (placeholder.ok) {
      const type = placeholder.data.getType();
      assertEquals(type.kind, "placeholder");
      if (type.kind === "placeholder") {
        assertEquals(type.path, "test");
      }
    }

    const fileRef = TemplateReference.create('{"": "test.json"}');
    if (fileRef.ok) {
      const type = fileRef.data.getType();
      assertEquals(type.kind, "file_reference");
      if (type.kind === "file_reference") {
        assertEquals(type.path, "test.json");
      }
    }

    const literal = TemplateReference.create("test");
    if (literal.ok) {
      const type = literal.data.getType();
      assertEquals(type.kind, "literal");
      if (type.kind === "literal") {
        assertEquals(type.value, "test");
      }
    }
  });
});

Deno.test("TemplateReference - toString() Method", async (t) => {
  await t.step("formats placeholder correctly", () => {
    const result = TemplateReference.create("{{test.path}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      const str = result.data.toString();
      assertEquals(str, "TemplateReference(placeholder: test.path)");
    }
  });

  await t.step("formats file reference correctly", () => {
    const result = TemplateReference.create('{"": "template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const str = result.data.toString();
      assertEquals(str, "TemplateReference(file: template.json)");
    }
  });

  await t.step("formats array item correctly", () => {
    const result = TemplateReference.create('{"": "array-template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      const str = result.data.toString();
      assertEquals(str, "TemplateReference(array_item: array-template.json)");
    }
  });

  await t.step("formats literal correctly", () => {
    const result = TemplateReference.create("literal text");
    assertEquals(result.ok, true);
    if (result.ok) {
      const str = result.data.toString();
      assertEquals(str, "TemplateReference(literal: literal text)");
    }
  });
});

Deno.test("TemplateReference - Type Guard", async (t) => {
  await t.step("identifies TemplateReference instances", () => {
    const result = TemplateReference.create("{{test}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(isTemplateReference(result.data), true);
    }
  });

  await t.step("rejects non-TemplateReference values", () => {
    assertEquals(isTemplateReference(null), false);
    assertEquals(isTemplateReference(undefined), false);
    assertEquals(isTemplateReference({}), false);
    assertEquals(isTemplateReference("string"), false);
    assertEquals(isTemplateReference(123), false);
  });
});

Deno.test("TemplateReference - Registry Command Scenarios", async (t) => {
  await t.step("handles registry command template", () => {
    const result = TemplateReference.create(
      '{"": "registry_command_template.json"}',
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isArrayItem(), true);
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "registry_command_template.json");
      }
    }
  });

  await t.step("handles registry template", () => {
    const result = TemplateReference.create('{"": "registry_template.json"}');
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isFileReference(), true);
      assertEquals(result.data.isArrayItem(), false);
    }
  });

  await t.step("handles c1/c2/c3 placeholders", () => {
    const c1 = TemplateReference.create("{{c1}}");
    const c2 = TemplateReference.create("{{c2}}");
    const c3 = TemplateReference.create("{{c3}}");

    assertEquals(c1.ok, true);
    assertEquals(c2.ok, true);
    assertEquals(c3.ok, true);

    if (c1.ok && c2.ok && c3.ok) {
      assertEquals(c1.data.isPlaceholder(), true);
      assertEquals(c2.data.isPlaceholder(), true);
      assertEquals(c3.data.isPlaceholder(), true);

      const p1 = c1.data.getPath();
      const p2 = c2.data.getPath();
      const p3 = c3.data.getPath();

      if (p1.ok && p2.ok && p3.ok) {
        assertEquals(p1.data, "c1");
        assertEquals(p2.data, "c2");
        assertEquals(p3.data, "c3");
      }
    }
  });

  await t.step("handles options placeholders", () => {
    const result = TemplateReference.create("{{options.input}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.isPlaceholder(), true);
      const pathResult = result.data.getPath();
      assertEquals(pathResult.ok, true);
      if (pathResult.ok) {
        assertEquals(pathResult.data, "options.input");
      }
    }
  });
});
