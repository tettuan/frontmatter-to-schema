import { assertEquals } from "@std/assert";
import {
  DirectiveOrderingStrategy,
  DirectiveType,
} from "../../../../../src/domain/schema/value-objects/directive-ordering-strategy.ts";

Deno.test("DirectiveOrderingStrategy - create default strategy", () => {
  const strategy = DirectiveOrderingStrategy.createDefault();
  const directives = strategy.getOrderedDirectives();

  assertEquals(directives.length, 9);
  assertEquals(directives[0], "x-frontmatter-part");
  assertEquals(directives[1], "x-collect-pattern");
  assertEquals(directives[2], "x-flatten-arrays");
  assertEquals(directives[3], "x-derived-from");
  assertEquals(directives[4], "x-derived-unique");
  assertEquals(directives[5], "x-jmespath-filter");
});

Deno.test("DirectiveOrderingStrategy - getPriority returns correct order", () => {
  const strategy = DirectiveOrderingStrategy.createDefault();

  assertEquals(strategy.getPriority("x-frontmatter-part"), 0);
  assertEquals(strategy.getPriority("x-collect-pattern"), 1);
  assertEquals(strategy.getPriority("x-flatten-arrays"), 2);
  assertEquals(strategy.getPriority("x-derived-from"), 3);
  assertEquals(strategy.getPriority("x-template"), 8);
});

Deno.test("DirectiveOrderingStrategy - shouldProcessBefore works correctly", () => {
  const strategy = DirectiveOrderingStrategy.createDefault();

  assertEquals(
    strategy.shouldProcessBefore("x-frontmatter-part", "x-flatten-arrays"),
    true,
  );
  assertEquals(
    strategy.shouldProcessBefore("x-flatten-arrays", "x-frontmatter-part"),
    false,
  );
  assertEquals(
    strategy.shouldProcessBefore("x-derived-from", "x-derived-unique"),
    true,
  );
});

Deno.test("DirectiveOrderingStrategy - sort directives correctly", () => {
  const strategy = DirectiveOrderingStrategy.createDefault();
  const unsorted: DirectiveType[] = [
    "x-template",
    "x-frontmatter-part",
    "x-derived-unique",
    "x-flatten-arrays",
  ];

  const sorted = strategy.sort(unsorted);

  assertEquals(sorted[0], "x-frontmatter-part");
  assertEquals(sorted[1], "x-flatten-arrays");
  assertEquals(sorted[2], "x-derived-unique");
  assertEquals(sorted[3], "x-template");
});

Deno.test("DirectiveOrderingStrategy - createCustom with valid order", () => {
  const customOrder: DirectiveType[] = [
    "x-template",
    "x-frontmatter-part",
    "x-collect-pattern",
    "x-flatten-arrays",
    "x-derived-from",
    "x-derived-unique",
    "x-jmespath-filter",
    "x-template-format",
    "x-template-items",
  ];

  const result = DirectiveOrderingStrategy.createCustom(customOrder);

  assertEquals(result.isOk(), true);
  const strategy = result.unwrap();
  assertEquals(strategy.getPriority("x-template"), 0);
  assertEquals(strategy.getPriority("x-frontmatter-part"), 1);
});

Deno.test("DirectiveOrderingStrategy - createCustom rejects missing directives", () => {
  const incompleteOrder: DirectiveType[] = [
    "x-frontmatter-part",
    "x-flatten-arrays",
    // Missing other directives
  ];

  const result = DirectiveOrderingStrategy.createCustom(incompleteOrder);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "MISSING_DIRECTIVES");
});

Deno.test("DirectiveOrderingStrategy - createCustom rejects unknown directives", () => {
  const invalidOrder = [
    "x-frontmatter-part",
    "x-collect-pattern",
    "x-flatten-arrays",
    "x-derived-from",
    "x-derived-unique",
    "x-jmespath-filter",
    "x-template-format",
    "x-template-items",
    "x-template",
    "x-unknown-directive", // Unknown directive
  ];

  const result = DirectiveOrderingStrategy.createCustom(invalidOrder as any);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "UNKNOWN_DIRECTIVES");
});

Deno.test("DirectiveOrderingStrategy - createCustom rejects duplicates", () => {
  const duplicateOrder: DirectiveType[] = [
    "x-frontmatter-part",
    "x-collect-pattern",
    "x-flatten-arrays",
    "x-derived-from",
    "x-derived-unique",
    "x-jmespath-filter",
    "x-template-format",
    "x-template-items",
    "x-template",
    "x-template", // Duplicate
  ];

  const result = DirectiveOrderingStrategy.createCustom(duplicateOrder);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "DUPLICATE_DIRECTIVES");
});

Deno.test("DirectiveOrderingStrategy - createFrontmatterFirst strategy", () => {
  const strategy = DirectiveOrderingStrategy.createFrontmatterFirst();
  const directives = strategy.getOrderedDirectives();

  assertEquals(directives[0], "x-frontmatter-part");
  assertEquals(directives[1], "x-collect-pattern");
  assertEquals(directives[2], "x-flatten-arrays");
  assertEquals(
    strategy.shouldProcessBefore("x-frontmatter-part", "x-template"),
    true,
  );
});

Deno.test("DirectiveOrderingStrategy - createTemplateFirst strategy", () => {
  const strategy = DirectiveOrderingStrategy.createTemplateFirst();
  const directives = strategy.getOrderedDirectives();

  assertEquals(directives[0], "x-template-format");
  assertEquals(directives[1], "x-template-items");
  assertEquals(directives[2], "x-template");
  assertEquals(
    strategy.shouldProcessBefore("x-template", "x-frontmatter-part"),
    true,
  );
});

Deno.test("DirectiveOrderingStrategy - getSupportedDirectives returns all types", () => {
  const strategy = DirectiveOrderingStrategy.createDefault();
  const supported = strategy.getSupportedDirectives();

  assertEquals(supported.length, 9);
  assertEquals(supported.includes("x-frontmatter-part"), true);
  assertEquals(supported.includes("x-collect-pattern"), true);
  assertEquals(supported.includes("x-flatten-arrays"), true);
  assertEquals(supported.includes("x-derived-from"), true);
  assertEquals(supported.includes("x-derived-unique"), true);
  assertEquals(supported.includes("x-jmespath-filter"), true);
  assertEquals(supported.includes("x-template-format"), true);
  assertEquals(supported.includes("x-template-items"), true);
  assertEquals(supported.includes("x-template"), true);
});
