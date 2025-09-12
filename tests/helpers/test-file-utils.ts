/**
 * Test File Utilities
 *
 * Provides helper functions for creating and cleaning up test files
 * in integration tests.
 */

export interface TestFileSpec {
  path: string;
  content: string;
}

export interface TestFilesConfig {
  schema: TestFileSpec;
  frontmatter: TestFileSpec[];
  template: TestFileSpec;
}

export interface CreatedTestFiles {
  schema: { fullPath: string };
  frontmatter: { fullPath: string }[];
  template: { fullPath: string };
}

/**
 * Create test files in the specified directory
 */
export async function createTestFiles(
  testDir: string,
  config: TestFilesConfig,
): Promise<CreatedTestFiles> {
  // Ensure test directory exists
  try {
    await Deno.mkdir(testDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  // Create schema file
  const schemaPath = `${testDir}/${config.schema.path}`;
  await Deno.writeTextFile(schemaPath, config.schema.content);

  // Create frontmatter files
  const frontmatterPaths: { fullPath: string }[] = [];
  for (const fm of config.frontmatter) {
    const fmPath = `${testDir}/${fm.path}`;
    await Deno.writeTextFile(fmPath, fm.content);
    frontmatterPaths.push({ fullPath: fmPath });
  }

  // Create template file
  const templatePath = `${testDir}/${config.template.path}`;
  await Deno.writeTextFile(templatePath, config.template.content);

  return {
    schema: { fullPath: schemaPath },
    frontmatter: frontmatterPaths,
    template: { fullPath: templatePath },
  };
}

/**
 * Clean up test files and directory
 */
export async function cleanupTestFiles(testDir: string): Promise<void> {
  try {
    await Deno.remove(testDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`Failed to cleanup test directory ${testDir}:`, error);
    }
  }
}
