import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import { XmlFormatter } from "../../../../../src/domain/template/formatters/xml-formatter.ts";

Deno.test("XmlFormatter", async (t) => {
  let formatter: XmlFormatter;

  await t.step("should create instance successfully", () => {
    const result = XmlFormatter.create();
    assertEquals(result.ok, true);
    if (result.ok) {
      formatter = result.data;
    }
  });

  await t.step("should return xml format type", () => {
    assertStrictEquals(formatter.getFormat(), "xml");
  });

  await t.step("should format simple string data", () => {
    const result = formatter.format("hello world");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data,
        '<?xml version="1.0" encoding="UTF-8"?>\n<root>hello world</root>',
      );
    }
  });

  await t.step("should format simple object data", () => {
    const data = { name: "test", value: 42 };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <name>test</name>
  <value>42</value>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should format array data", () => {
    const data = ["item1", "item2", "item3"];
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item_0>item1</item_0>
  <item_1>item2</item_1>
  <item_2>item3</item_2>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should format nested object data", () => {
    const data = {
      user: {
        name: "John",
        age: 30,
        tags: ["developer", "javascript"],
      },
    };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <user>
    <name>John</name>
    <age>30</age>
    <tags>
      <item_0>developer</item_0>
      <item_1>javascript</item_1>
    </tags>
  </user>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should escape special XML characters", () => {
    const data = {
      text: "Text with <tags> & \"quotes\" and 'apostrophes'",
    };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <text>Text with &lt;tags&gt; &amp; &quot;quotes&quot; and &apos;apostrophes&apos;</text>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should handle null and undefined values", () => {
    const data = { nullValue: null, undefinedValue: undefined };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <nullValue></nullValue>
  <undefinedValue></undefinedValue>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should handle boolean and number values", () => {
    const data = {
      isActive: true,
      count: 42,
      percentage: 85.5,
      isDisabled: false,
    };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      const expected = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <isActive>true</isActive>
  <count>42</count>
  <percentage>85.5</percentage>
  <isDisabled>false</isDisabled>
</root>`;
      assertEquals(result.data, expected);
    }
  });

  await t.step("should sanitize invalid element names", () => {
    const data = {
      "invalid-name": "value1",
      "123-number-start": "value2",
      "special@chars#name": "value3",
    };
    const result = formatter.format(data);
    assertEquals(result.ok, true);
    if (result.ok) {
      // Should convert invalid characters to underscores
      // The hyphen is valid in XML element names, so invalid-name should remain as is
      // Numbers at start require prefixing with underscore
      // Special chars get replaced with underscores
      const shouldContain = [
        "<invalid-name>value1</invalid-name>", // hyphen is valid
        "<_123-number-start>value2</_123-number-start>", // prefix with underscore for number start
        "<special_chars_name>value3</special_chars_name>", // special chars replaced
      ];
      shouldContain.forEach((content) => {
        assertEquals(
          result.data.includes(content),
          true,
          `Should contain: ${content}`,
        );
      });
    }
  });

  await t.step("should handle empty object", () => {
    const result = formatter.format({});
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data,
        '<?xml version="1.0" encoding="UTF-8"?>\n<root></root>',
      );
    }
  });

  await t.step("should handle empty array", () => {
    const result = formatter.format([]);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(
        result.data,
        '<?xml version="1.0" encoding="UTF-8"?>\n<root></root>',
      );
    }
  });

  await t.step("should reject circular references", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj; // Create circular reference

    const result = formatter.format(obj);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidTemplate");
      assertEquals(
        result.error.message.includes(
          "Data contains circular references or non-serializable values",
        ),
        true,
      );
    }
  });

  await t.step("should create singleton instance", () => {
    const result1 = XmlFormatter.create();
    const result2 = XmlFormatter.create();

    assertEquals(result1.ok, true);
    assertEquals(result2.ok, true);

    if (result1.ok && result2.ok) {
      assertStrictEquals(result1.data, result2.data);
    }
  });
});
