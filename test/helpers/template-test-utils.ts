/**
 * Test utilities for Template Domain testing
 */

import { TemplateLoader } from '../../src/domain/template-building/template-compiler.ts';
import { OutputWriteAdapter } from '../../src/domain/template-output/output-writer.ts';
import { CompiledTemplate } from '../../src/domain/template-building/compiled-template.ts';
import {
  TemplateFilePath,
  TemplateValueSet,
  TemplateSource,
  OutputFormat,
  OutputDestination,
  OutputSpecification,
  OutputEncoding,
  Result,
  success,
  failure
} from '../../src/domain/template-shared/value-objects.ts';

/**
 * Mock template loader for testing
 */
export class MockTemplateLoader implements TemplateLoader {
  private templates: Map<string, string> = new Map();
  private loadCount = 0;
  private shouldFail = false;
  private failureError?: Error;

  setTemplate(path: string, content: string): void {
    this.templates.set(path, content);
  }

  setShouldFail(fail: boolean, error?: Error): void {
    this.shouldFail = fail;
    this.failureError = error || new Error('Template load failed');
  }

  getLoadCount(): number {
    return this.loadCount;
  }

  async load(templatePath: TemplateFilePath): Promise<Result<string, Error>> {
    this.loadCount++;

    if (this.shouldFail) {
      return failure(this.failureError!);
    }

    const path = templatePath.toString();
    const content = this.templates.get(path);

    if (content !== undefined) {
      return success(content);
    }

    return failure(new Error(`Template not found: ${path}`));
  }

  reset(): void {
    this.templates.clear();
    this.loadCount = 0;
    this.shouldFail = false;
    this.failureError = undefined;
  }
}

/**
 * Mock write adapter for testing
 */
export class MockWriteAdapter implements OutputWriteAdapter {
  private writtenFiles: Map<string, Buffer | string> = new Map();
  private writtenStreams: Array<{ stream: WritableStream; content: Buffer | string }> = [];
  private writtenBuffers: Array<{ buffer: Buffer; content: Buffer | string }> = [];
  private writeCount = 0;
  private shouldFail = false;
  private failureError?: Error;

  setShouldFail(fail: boolean, error?: Error): void {
    this.shouldFail = fail;
    this.failureError = error || new Error('Write failed');
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  getWrittenContent(path: string): Buffer | string | undefined {
    return this.writtenFiles.get(path);
  }

  getAllWrittenFiles(): Map<string, Buffer | string> {
    return new Map(this.writtenFiles);
  }

  async writeToFile(path: string, content: Buffer | string): Promise<Result<number, Error>> {
    this.writeCount++;

    if (this.shouldFail) {
      return failure(this.failureError!);
    }

    this.writtenFiles.set(path, content);
    const size = typeof content === 'string'
      ? Buffer.byteLength(content)
      : content.length;

    return success(size);
  }

  async writeToStream(stream: WritableStream, content: Buffer | string): Promise<Result<number, Error>> {
    this.writeCount++;

    if (this.shouldFail) {
      return failure(this.failureError!);
    }

    this.writtenStreams.push({ stream, content });
    const size = typeof content === 'string'
      ? Buffer.byteLength(content)
      : content.length;

    return success(size);
  }

  writeToBuffer(buffer: Buffer, content: Buffer | string): Result<number, Error> {
    this.writeCount++;

    if (this.shouldFail) {
      return failure(this.failureError!);
    }

    this.writtenBuffers.push({ buffer, content });
    const size = typeof content === 'string'
      ? Buffer.byteLength(content)
      : content.length;

    return success(size);
  }

  reset(): void {
    this.writtenFiles.clear();
    this.writtenStreams = [];
    this.writtenBuffers = [];
    this.writeCount = 0;
    this.shouldFail = false;
    this.failureError = undefined;
  }
}

/**
 * Test data factory for creating test objects
 */
export class TestDataFactory {
  static createTemplateFilePath(path: string = 'test.tmpl'): TemplateFilePath {
    return new TemplateFilePath(path);
  }

  static createTemplateValueSet(values: Record<string, unknown> = { test: 'value' }): TemplateValueSet {
    return {
      values,
      metadata: {
        source: 'test',
        timestamp: new Date()
      }
    };
  }

  static createTemplateSource(
    path: string = 'test.tmpl',
    values: Record<string, unknown> = { test: 'value' }
  ): TemplateSource {
    return {
      templatePath: this.createTemplateFilePath(path),
      valueSet: this.createTemplateValueSet(values)
    };
  }

  static createCompiledTemplate(
    content: string = '{"test": "value"}',
    format: OutputFormat = OutputFormat.JSON
  ): CompiledTemplate {
    return new CompiledTemplate({
      templatePath: this.createTemplateFilePath(),
      appliedValues: this.createTemplateValueSet(),
      compiledContent: content,
      format
    });
  }

  static createOutputDestination(
    type: 'file' | 'stream' | 'buffer' = 'file',
    target: string | WritableStream | Buffer = 'output.json'
  ): OutputDestination {
    return new OutputDestination(type, target);
  }

  static createOutputSpecification(
    format: OutputFormat = OutputFormat.JSON,
    destinationType: 'file' | 'stream' | 'buffer' = 'file',
    encoding: OutputEncoding = OutputEncoding.UTF8
  ): OutputSpecification {
    return {
      format,
      destination: this.createOutputDestination(destinationType),
      encoding,
      options: {}
    };
  }
}

/**
 * Template content generators for testing
 */
export class TemplateContentGenerator {
  static generateJsonTemplate(variables: string[] = ['name', 'version']): string {
    const fields = variables.map(v => `"${v}": "{{${v}}}"`).join(',\n  ');
    return `{\n  ${fields}\n}`;
  }

  static generateYamlTemplate(variables: string[] = ['name', 'version']): string {
    return variables.map(v => `${v}: {{${v}}}`).join('\n');
  }

  static generateXmlTemplate(variables: string[] = ['name', 'version']): string {
    const fields = variables.map(v => `  <${v}>{{${v}}}</${v}>`).join('\n');
    return `<?xml version="1.0"?>\n<root>\n${fields}\n</root>`;
  }

  static generateHtmlTemplate(variables: string[] = ['title', 'content']): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>{{title}}</title>
</head>
<body>
  <h1>{{title}}</h1>
  <div>{{content}}</div>
</body>
</html>`;
  }

  static generateMarkdownTemplate(variables: string[] = ['title', 'content']): string {
    return `# {{title}}\n\n{{content}}`;
  }

  static generateLargeTemplate(size: number = 1000): string {
    const lines: string[] = [];
    for (let i = 0; i < size; i++) {
      lines.push(`line_${i}: "value_{{var_${i}}}"`);
    }
    return `{\n  ${lines.join(',\n  ')}\n}`;
  }
}

/**
 * Assertion helpers for template testing
 */
export class TemplateAssertions {
  static assertValidJson(content: string): void {
    try {
      JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e}`);
    }
  }

  static assertValidYaml(content: string): void {
    // Basic YAML validation
    if (content.includes('\t')) {
      throw new Error('YAML contains tabs');
    }
  }

  static assertValidXml(content: string): void {
    // Basic XML validation
    if (!content.includes('<') || !content.includes('>')) {
      throw new Error('Invalid XML structure');
    }
  }

  static assertTemplateProcessed(
    template: CompiledTemplate,
    expectedValues: Record<string, unknown>
  ): void {
    const content = template.getCompiledContent().toString();

    // Check that placeholders are replaced
    if (content.includes('{{') || content.includes('}}')) {
      throw new Error('Template contains unprocessed placeholders');
    }

    // Check that values are present
    for (const [key, value] of Object.entries(expectedValues)) {
      if (!content.includes(String(value))) {
        throw new Error(`Expected value '${value}' for key '${key}' not found in output`);
      }
    }
  }

  static assertMetadataPresent(metadata: any): void {
    if (!metadata) {
      throw new Error('Metadata is missing');
    }

    if (!metadata.renderedAt && !metadata.compiledAt) {
      throw new Error('Metadata missing timestamp');
    }

    if (typeof metadata.size !== 'number') {
      throw new Error('Metadata missing or invalid size');
    }
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceUtils {
  static async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    return { result, duration };
  }

  static generateLargeValueSet(size: number = 1000): Record<string, unknown> {
    const values: Record<string, unknown> = {};

    for (let i = 0; i < size; i++) {
      values[`field_${i}`] = `value_${i}`;
    }

    return values;
  }

  static async runConcurrent<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }
}

/**
 * File system test utilities
 */
export class FileSystemTestUtils {
  private static tempDir = './test-temp';
  private static createdFiles: string[] = [];

  static async setupTempDir(): Promise<string> {
    await Deno.mkdir(this.tempDir, { recursive: true });
    return this.tempDir;
  }

  static async cleanupTempDir(): Promise<void> {
    try {
      await Deno.remove(this.tempDir, { recursive: true });
    } catch {
      // Ignore errors during cleanup
    }
    this.createdFiles = [];
  }

  static getTempFilePath(filename: string): string {
    const path = `${this.tempDir}/${filename}`;
    this.createdFiles.push(path);
    return path;
  }

  static async writeTestFile(filename: string, content: string): Promise<string> {
    const path = this.getTempFilePath(filename);
    await Deno.writeTextFile(path, content);
    return path;
  }

  static async readTestFile(filename: string): Promise<string> {
    const path = `${this.tempDir}/${filename}`;
    return await Deno.readTextFile(path);
  }

  static async fileExists(filename: string): Promise<boolean> {
    try {
      await Deno.stat(`${this.tempDir}/${filename}`);
      return true;
    } catch {
      return false;
    }
  }
}