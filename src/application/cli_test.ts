import { assertEquals, assertExists } from "jsr:@std/assert";
import { CLI } from "./cli.ts";
import { ExitHandlerFactory } from "../infrastructure/services/exit-handler.ts";
import { FormatDetectorFactory } from "../domain/services/file-format-detector.ts";

Deno.test("CLI - Construction with default services", () => {
  const cli = new CLI();
  assertExists(cli);
});

Deno.test("CLI - Construction with injected services", () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cli = new CLI(exitHandlerResult.data, formatDetectorResult.data);
  assertExists(cli);
});

Deno.test("CLI - Help flag returns success", async () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cli = new CLI(exitHandlerResult.data, formatDetectorResult.data);

  const result = await cli.run(["--help"]);
  assertEquals(result.ok, true);
});

Deno.test("CLI - Invalid arguments return error", async () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cli = new CLI(exitHandlerResult.data, formatDetectorResult.data);

  // Should fail with invalid arguments
  const result = await cli.run([]);
  assertEquals(result.ok, false);
});
