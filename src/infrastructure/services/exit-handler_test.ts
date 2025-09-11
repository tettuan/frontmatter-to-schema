import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  ConfigurableExitHandler,
  type ExitConfiguration,
  type ExitContext,
  ExitHandlerFactory,
  TESTING_EXIT_CONFIG,
} from "./exit-handler.ts";

Deno.test("ExitHandler - Smart Constructor", () => {
  const result = ConfigurableExitHandler.create();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("ExitHandler - Custom Configuration", () => {
  const customConfig: ExitConfiguration = {
    mode: "testing",
    errorCode: 2,
    successCode: 0,
    reportErrors: false,
  };

  const result = ConfigurableExitHandler.create(customConfig);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.willExit(), false);
  }
});

Deno.test("ExitHandler - Testing Mode Does Not Exit", () => {
  const result = ConfigurableExitHandler.create(TESTING_EXIT_CONFIG);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const handler = result.data;

  const context: ExitContext = {
    operation: "test-operation",
    error: { kind: "ParseError", input: "test", details: "test error" },
  };

  const exitResult = handler.handleError(context);
  assertEquals(exitResult.ok, true);
  assertEquals(handler.willExit(), false);
});

Deno.test("ExitHandler - Success Handling", () => {
  const result = ConfigurableExitHandler.create(TESTING_EXIT_CONFIG);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const handler = result.data;

  const context: ExitContext = {
    operation: "successful-operation",
    additionalInfo: { count: 5 },
  };

  const exitResult = handler.handleSuccess(context);
  assertEquals(exitResult.ok, true);
});

Deno.test("ExitHandler - With Logger", () => {
  let _loggedError = false;
  let loggedSuccess = false;

  const mockLogger = {
    error: () => {
      _loggedError = true;
    },
    info: () => {
      loggedSuccess = true;
    },
  };

  const result = ConfigurableExitHandler.create(
    TESTING_EXIT_CONFIG,
    mockLogger,
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const handler = result.data;

  // Test error logging
  const errorContext: ExitContext = {
    operation: "test-error",
    error: { kind: "ParseError", input: "test", details: "test" },
  };
  handler.handleError(errorContext);

  // Test success logging
  const successContext: ExitContext = {
    operation: "test-success",
  };
  handler.handleSuccess(successContext);

  assertEquals(loggedSuccess, true);
});

Deno.test("ExitHandlerFactory - Production", () => {
  const result = ExitHandlerFactory.createProduction();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.willExit(), true);
  }
});

Deno.test("ExitHandlerFactory - Testing", () => {
  const result = ExitHandlerFactory.createTesting();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.willExit(), false);
  }
});

Deno.test("ExitHandlerFactory - Custom", () => {
  const customConfig: ExitConfiguration = {
    mode: "graceful",
    errorCode: 3,
    successCode: 0,
    reportErrors: true,
  };

  const result = ExitHandlerFactory.createCustom(customConfig);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.willExit(), true);
  }
});
