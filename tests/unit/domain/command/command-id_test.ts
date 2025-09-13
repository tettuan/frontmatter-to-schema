import { assertEquals } from "@std/assert";
import { CommandId } from "../../../../src/domain/command/value-objects/command-id.ts";
import { isErr, isOk } from "../../../../src/domain/shared/types/result.ts";

Deno.test("CommandId - creates valid command ID", () => {
  const result = CommandId.create("git", "commit", "refinement-issue");
  assertEquals(isOk(result), true);

  if (isOk(result)) {
    assertEquals(result.data.toFullId(), "git:commit:refinement-issue");
    assertEquals(result.data.getC1(), "git");
    assertEquals(result.data.getC2(), "commit");
    assertEquals(result.data.getC3(), "refinement-issue");
  }
});

Deno.test("CommandId - rejects empty c1", () => {
  const result = CommandId.create("", "commit", "refinement-issue");
  assertEquals(isErr(result), true);

  if (isErr(result)) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("CommandId - rejects empty c2", () => {
  const result = CommandId.create("git", "", "refinement-issue");
  assertEquals(isErr(result), true);
});

Deno.test("CommandId - rejects empty c3", () => {
  const result = CommandId.create("git", "commit", "");
  assertEquals(isErr(result), true);
});

Deno.test("CommandId - rejects invalid characters", () => {
  const result = CommandId.create("git", "commit:", "refinement-issue");
  assertEquals(isErr(result), true);

  if (isErr(result)) {
    assertEquals(result.error.kind, "PatternMismatch");
  }
});

Deno.test("CommandId - normalizes case", () => {
  const result = CommandId.create("GIT", "COMMIT", "REFINEMENT-ISSUE");
  assertEquals(isOk(result), true);

  if (isOk(result)) {
    assertEquals(result.data.toFullId(), "git:commit:refinement-issue");
  }
});

Deno.test("CommandId - creates from valid frontmatter", () => {
  const frontmatter = {
    c1: "build",
    c2: "analyze",
    c3: "quality-metrics",
  };

  const result = CommandId.fromFrontmatter(frontmatter);
  assertEquals(isOk(result), true);

  if (isOk(result)) {
    assertEquals(result.data.toFullId(), "build:analyze:quality-metrics");
  }
});

Deno.test("CommandId - rejects frontmatter missing c1", () => {
  const frontmatter = {
    c2: "analyze",
    c3: "quality-metrics",
  };

  const result = CommandId.fromFrontmatter(frontmatter);
  assertEquals(isErr(result), true);

  if (isErr(result)) {
    assertEquals(result.error.kind, "MissingRequired");
    if (result.error.kind === "MissingRequired") {
      assertEquals(result.error.field, "c1");
    }
  }
});

Deno.test("CommandId - rejects frontmatter with non-string values", () => {
  const frontmatter = {
    c1: "build",
    c2: 123,
    c3: "quality-metrics",
  };

  const result = CommandId.fromFrontmatter(frontmatter);
  assertEquals(isErr(result), true);

  if (isErr(result)) {
    assertEquals(result.error.kind, "MissingRequired");
    if (result.error.kind === "MissingRequired") {
      assertEquals(result.error.field, "c2");
    }
  }
});

Deno.test("CommandId - equals comparison works correctly", () => {
  const id1Result = CommandId.create("git", "commit", "issue");
  const id2Result = CommandId.create("git", "commit", "issue");
  const id3Result = CommandId.create("git", "push", "issue");

  assertEquals(isOk(id1Result), true);
  assertEquals(isOk(id2Result), true);
  assertEquals(isOk(id3Result), true);

  if (isOk(id1Result) && isOk(id2Result) && isOk(id3Result)) {
    assertEquals(id1Result.data.equals(id2Result.data), true);
    assertEquals(id1Result.data.equals(id3Result.data), false);
  }
});

Deno.test("CommandId - toString returns full ID", () => {
  const result = CommandId.create("spec", "analyze", "metrics");
  assertEquals(isOk(result), true);

  if (isOk(result)) {
    assertEquals(result.data.toString(), "spec:analyze:metrics");
  }
});
