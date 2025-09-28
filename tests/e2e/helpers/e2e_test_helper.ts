import { err, ok, Result } from "../../../src/domain/shared/types/result.ts";

/**
 * E2E Test Error Types following Totality principles
 */
export type E2ETestError =
  | {
    readonly kind: "CLIExecutionFailed";
    readonly exitCode: number;
    readonly stderr: string;
    readonly stdout: string;
  }
  | {
    readonly kind: "FileOperationFailed";
    readonly operation: string;
    readonly path: string;
  }
  | {
    readonly kind: "OutputValidationFailed";
    readonly expected: unknown;
    readonly actual: unknown;
  }
  | { readonly kind: "SetupFailed"; readonly reason: string }
  | { readonly kind: "TempDirCreationFailed"; readonly path: string }
  | { readonly kind: "FileNotFound"; readonly path: string }
  | { readonly kind: "InvalidJSON"; readonly content: string }
  | {
    readonly kind: "TimeoutError";
    readonly command: string;
    readonly timeoutMs: number;
  };

export const createE2EError = <T extends E2ETestError>(
  error: T,
  customMessage?: string,
): T & { message: string } => ({
  ...error,
  message: customMessage || getDefaultE2EMessage(error),
});

const getDefaultE2EMessage = (error: E2ETestError): string => {
  switch (error.kind) {
    case "CLIExecutionFailed":
      return `CLI execution failed with exit code ${error.exitCode}. stderr: ${error.stderr}`;
    case "FileOperationFailed":
      return `File operation '${error.operation}' failed on path: ${error.path}`;
    case "OutputValidationFailed":
      return `Output validation failed. Expected: ${
        JSON.stringify(error.expected)
      }, Actual: ${JSON.stringify(error.actual)}`;
    case "SetupFailed":
      return `Test setup failed: ${error.reason}`;
    case "TempDirCreationFailed":
      return `Failed to create temporary directory: ${error.path}`;
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "InvalidJSON":
      return `Invalid JSON content: ${error.content.substring(0, 100)}...`;
    case "TimeoutError":
      return `Command '${error.command}' timed out after ${error.timeoutMs}ms`;
    default: {
      const _exhaustive: never = error;
      return `Unknown E2E error: ${JSON.stringify(_exhaustive)}`;
    }
  }
};

/**
 * Test Environment Management
 */
export interface TestEnvironment {
  readonly tempDir: string;
  readonly cleanup: () => Promise<void>;
}

export async function createTestEnvironment(): Promise<
  Result<TestEnvironment, E2ETestError & { message: string }>
> {
  try {
    const tempDir = await Deno.makeTempDir({ prefix: "e2e_test_" });

    const cleanup = async () => {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp dir ${tempDir}:`, error);
      }
    };

    return ok({ tempDir, cleanup });
  } catch (error) {
    return err(createE2EError({
      kind: "TempDirCreationFailed",
      path: "unknown",
    }, `Failed to create temp directory: ${error}`));
  }
}

/**
 * CLI Execution Utilities
 */
export interface CLIExecutionOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly env?: Record<string, string>;
}

export async function executeCliCommand(
  args: string[],
  options: CLIExecutionOptions = {},
): Promise<
  Result<{ stdout: string; stderr: string }, E2ETestError & { message: string }>
> {
  const { cwd = Deno.cwd(), timeoutMs = 30000, env = {} } = options;

  try {
    // Always run CLI from project root, regardless of cwd
    const projectRoot = Deno.cwd(); // This is the project root when tests run
    const cliPath = `${projectRoot}/cli.ts`;

    const command = new Deno.Command("deno", {
      args: ["run", "--allow-all", cliPath, ...args],
      cwd,
      env: { ...Deno.env.toObject(), ...env },
      stdout: "piped",
      stderr: "piped",
    });

    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(createE2EError({
          kind: "TimeoutError",
          command: `deno run --allow-all ./cli.ts ${args.join(" ")}`,
          timeoutMs,
        }));
      }, timeoutMs);
    });

    const child = command.spawn();
    const execPromise = child.output();

    const result = await Promise.race([execPromise, timeoutPromise]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    const textDecoder = new TextDecoder();
    const stdout = textDecoder.decode(result.stdout);
    const stderr = textDecoder.decode(result.stderr);

    if (result.code !== 0) {
      return err(createE2EError({
        kind: "CLIExecutionFailed",
        exitCode: result.code,
        stderr,
        stdout,
      }));
    }

    return ok({ stdout, stderr });
  } catch (error) {
    if (error && typeof error === "object" && "kind" in error) {
      return err(error as E2ETestError & { message: string });
    }
    return err(createE2EError({
      kind: "CLIExecutionFailed",
      exitCode: -1,
      stderr: String(error),
      stdout: "",
    }));
  }
}

/**
 * File System Utilities
 */
export async function writeTestFile(
  path: string,
  content: string,
): Promise<Result<void, E2ETestError & { message: string }>> {
  try {
    // Ensure parent directory exists
    const dir = path.substring(0, path.lastIndexOf("/"));
    if (dir) {
      await Deno.mkdir(dir, { recursive: true });
    }

    await Deno.writeTextFile(path, content);
    return ok(void 0);
  } catch (error) {
    return err(createE2EError({
      kind: "FileOperationFailed",
      operation: "write",
      path,
    }, `Failed to write file: ${error}`));
  }
}

export async function readTestFile(
  path: string,
): Promise<Result<string, E2ETestError & { message: string }>> {
  try {
    const content = await Deno.readTextFile(path);
    return ok(content);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return err(createE2EError({ kind: "FileNotFound", path }));
    }
    return err(createE2EError({
      kind: "FileOperationFailed",
      operation: "read",
      path,
    }, `Failed to read file: ${error}`));
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

export async function parseJsonFile<T>(
  path: string,
): Promise<Result<T, E2ETestError & { message: string }>> {
  const contentResult = await readTestFile(path);
  if (!contentResult.ok) {
    return contentResult;
  }

  try {
    const parsed = JSON.parse(contentResult.data) as T;
    return ok(parsed);
  } catch (error) {
    return err(createE2EError({
      kind: "InvalidJSON",
      content: contentResult.data,
    }, `Failed to parse JSON: ${error}`));
  }
}

/**
 * Assertion Utilities
 */
export function assertFileExists(
  path: string,
  exists: boolean,
  message?: string,
): void {
  if (!exists) {
    throw new Error(message || `Expected file to exist: ${path}`);
  }
}

export function assertValidJson(
  content: string,
  message?: string,
): void {
  try {
    JSON.parse(content);
  } catch {
    throw new Error(message || `Expected valid JSON content`);
  }
}

export function assertDeepEqual<T>(
  actual: T,
  expected: T,
  message?: string,
): void {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  if (actualStr !== expectedStr) {
    throw new Error(
      message ||
        `Objects not equal.\nExpected: ${expectedStr}\nActual: ${actualStr}`,
    );
  }
}
