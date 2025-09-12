import { assertEquals, assertExists } from "jsr:@std/assert";
import { CLI } from "./cli.ts";
import { ExitHandlerFactory } from "../infrastructure/services/exit-handler.ts";
import { FormatDetectorFactory } from "../domain/services/file-format-detector.ts";

Deno.test("CLI - Construction with default services", () => {
  const cliResult = CLI.create();
  assertEquals(cliResult.ok, true);
  if (!cliResult.ok) return;
  assertExists(cliResult.data);
});

Deno.test("CLI - Construction with injected services", () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cliResult = CLI.create(
    exitHandlerResult.data,
    formatDetectorResult.data,
  );
  assertEquals(cliResult.ok, true);
  if (!cliResult.ok) return;
  assertExists(cliResult.data);
});

Deno.test("CLI - Help flag returns success", async () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cliResult = CLI.create(
    exitHandlerResult.data,
    formatDetectorResult.data,
  );
  assertEquals(cliResult.ok, true);
  if (!cliResult.ok) return;

  const result = await cliResult.data.run(["--help"]);
  assertEquals(result.ok, true);
});

Deno.test("CLI - Invalid arguments return error", async () => {
  const exitHandlerResult = ExitHandlerFactory.createTesting();
  assertEquals(exitHandlerResult.ok, true);
  if (!exitHandlerResult.ok) return;

  const formatDetectorResult = FormatDetectorFactory.createDefault();
  assertEquals(formatDetectorResult.ok, true);
  if (!formatDetectorResult.ok) return;

  const cliResult = CLI.create(
    exitHandlerResult.data,
    formatDetectorResult.data,
  );
  assertEquals(cliResult.ok, true);
  if (!cliResult.ok) return;

  // Should fail with invalid arguments
  const result = await cliResult.data.run([]);
  assertEquals(result.ok, false);
});
