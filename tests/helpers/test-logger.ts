/**
 * Test debugging utility inspired by breakdownlogger
 * Provides LENGTH, KEY analysis and structured test logging
 */

export interface TestDebugContext {
  testName: string;
  phase: "arrange" | "act" | "assert" | "cleanup";
  startTime: number;
}

export class TestBreakdownLogger {
  private static contexts: Map<string, TestDebugContext> = new Map();
  private static enabled = Deno.env.get("DEBUG_LEVEL") !== undefined;

  static start(
    testName: string,
    phase: TestDebugContext["phase"] = "arrange",
  ): void {
    if (!this.enabled) return;

    const context: TestDebugContext = {
      testName,
      phase,
      startTime: Date.now(),
    };

    this.contexts.set(testName, context);
    console.log(`🧪 [${testName}] ${phase.toUpperCase()} phase started`);
  }

  static phase(testName: string, phase: TestDebugContext["phase"]): void {
    if (!this.enabled) return;

    const context = this.contexts.get(testName);
    if (context) {
      const duration = Date.now() - context.startTime;
      console.log(
        `🧪 [${testName}] ${context.phase.toUpperCase()} → ${phase.toUpperCase()} (${duration}ms)`,
      );
      context.phase = phase;
      context.startTime = Date.now();
    }
  }

  static end(testName: string, success: boolean = true): void {
    if (!this.enabled) return;

    const context = this.contexts.get(testName);
    if (context) {
      const duration = Date.now() - context.startTime;
      const status = success ? "✅ PASS" : "❌ FAIL";
      console.log(`🧪 [${testName}] ${status} (total: ${duration}ms)`);
      this.contexts.delete(testName);
    }
  }

  /**
   * LENGTH analysis: Log array/object lengths for debugging
   */
  static LENGTH(label: string, data: unknown): void {
    if (!this.enabled) return;

    if (Array.isArray(data)) {
      console.log(`📏 LENGTH [${label}]: Array[${data.length}]`);
      if (data.length > 0 && data.length <= 5) {
        console.log(`   Items: [${data.map((_, i) => `${i}`).join(", ")}]`);
      }
    } else if (data && typeof data === "object") {
      const keys = Object.keys(data);
      console.log(`📏 LENGTH [${label}]: Object{${keys.length} keys}`);
      if (keys.length <= 5) {
        console.log(`   Keys: [${keys.join(", ")}]`);
      }
    } else if (typeof data === "string") {
      console.log(`📏 LENGTH [${label}]: String(${data.length} chars)`);
    } else {
      console.log(
        `📏 LENGTH [${label}]: ${typeof data} (${String(data).length} chars)`,
      );
    }
  }

  /**
   * KEY analysis: Log object keys and their types
   */
  static KEY(label: string, obj: Record<string, unknown>): void {
    if (!this.enabled) return;

    console.log(`🔑 KEY [${label}]:`);
    for (const [key, value] of Object.entries(obj)) {
      const type = Array.isArray(value)
        ? `Array[${value.length}]`
        : value === null
        ? "null"
        : typeof value === "object"
        ? `Object{${Object.keys(value).length}}`
        : typeof value;
      console.log(`   ${key}: ${type}`);
    }
  }

  /**
   * RESULT analysis: Log Result type success/failure
   */
  static RESULT<T, E>(
    label: string,
    result: { ok?: boolean; data?: T; error?: E },
  ): void {
    if (!this.enabled) return;

    const status = result.ok ? "✅ OK" : "❌ ERR";
    console.log(`🎯 RESULT [${label}]: ${status}`);

    if (result.ok && result.data !== undefined) {
      this.LENGTH(`${label}.data`, result.data);
    } else if (!result.ok && result.error !== undefined) {
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
    }
  }

  /**
   * FLOW analysis: Track execution flow with context
   */
  static FLOW(step: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`🌊 FLOW [${timestamp}]: ${step}`);
    if (data) {
      this.KEY(`${step}.context`, data);
    }
  }

  /**
   * ERROR analysis: Enhanced error logging with context
   */
  static ERROR(
    label: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;

    console.log(`💥 ERROR [${label}]:`);
    if (error instanceof Error) {
      console.log(`   Message: ${error.message}`);
      console.log(
        `   Stack: ${error.stack?.split("\n").slice(0, 3).join("\n")}`,
      );
    } else {
      console.log(`   Value: ${JSON.stringify(error, null, 2)}`);
    }

    if (context) {
      this.KEY(`${label}.context`, context);
    }
  }

  /**
   * SCHEMA analysis: Specialized logging for schema debugging
   */
  static SCHEMA(label: string, schema: {
    hasFrontmatterPart?: () => boolean;
    getProperties?: () => { ok: boolean; data?: Record<string, unknown> };
    path?: { toString: () => string };
  }): void {
    if (!this.enabled) return;

    console.log(`🔧 SCHEMA [${label}]:`);
    console.log(`   Path: ${schema.path?.toString() || "unknown"}`);
    console.log(
      `   HasFrontmatterPart: ${schema.hasFrontmatterPart?.() || false}`,
    );

    const props = schema.getProperties?.();
    if (props?.ok && props.data) {
      this.KEY(`${label}.properties`, props.data);
    } else {
      console.log(`   Properties: ${props?.ok ? "empty" : "failed"}`);
    }
  }
}
