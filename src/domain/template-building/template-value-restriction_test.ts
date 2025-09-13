import { assertEquals, assertExists, assertStringIncludes } from '@std/assert';
import { TemplateCompiler, TemplateLoader } from './template-compiler.ts';
import {
  TemplateSource,
  TemplateFilePath,
  TemplateValueSet,
  Result,
  success
} from '../template-shared/value-objects.ts';

/**
 * Tests to ensure values are used ONLY for variable substitution
 * and NOT for any other purpose (logic, paths, formats, etc.)
 */

// Mock loader for testing value restriction
class StrictMockTemplateLoader implements TemplateLoader {
  private template: string = '';

  setTemplate(content: string): void {
    this.template = content;
  }

  async load(templatePath: TemplateFilePath): Promise<Result<string, Error>> {
    return success(this.template);
  }
}

Deno.test('TemplateValueRestriction - values MUST be used ONLY for variable substitution', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  // Template with variable placeholders
  const templateContent = `
    {
      "name": "{{projectName}}",
      "version": "{{version}}",
      "description": "{{description}}"
    }
  `;
  loader.setTemplate(templateContent);

  const source: TemplateSource = {
    templatePath: new TemplateFilePath('test.json'),
    valueSet: {
      values: {
        projectName: 'TestProject',
        version: '1.0.0',
        description: 'A test project'
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // Verify values were used for substitution
    assertStringIncludes(content, '"name": "TestProject"');
    assertStringIncludes(content, '"version": "1.0.0"');
    assertStringIncludes(content, '"description": "A test project"');

    // Verify no placeholders remain
    assertEquals(content.includes('{{'), false);
    assertEquals(content.includes('}}'), false);
  }
});

Deno.test('TemplateValueRestriction - values MUST NOT affect template structure', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  // Template structure should remain constant regardless of values
  const templateContent = `
    <document>
      <title>{{title}}</title>
      <content>{{content}}</content>
    </document>
  `;
  loader.setTemplate(templateContent);

  // Test with different values - structure should remain same
  const testCases = [
    { title: 'Simple', content: 'Text' },
    { title: 'Complex <tag>', content: 'if (true) { code }' },
    { title: '{{nested}}', content: '${variable}' }
  ];

  for (const values of testCases) {
    const source: TemplateSource = {
      templatePath: new TemplateFilePath('test.xml'),
      valueSet: { values }
    };

    const result = await compiler.compile(source);
    assertEquals(result.ok, true);

    if (result.ok) {
      const content = result.data.getCompiledContent().toString();

      // Structure must remain unchanged
      assertStringIncludes(content, '<document>');
      assertStringIncludes(content, '<title>');
      assertStringIncludes(content, '</title>');
      assertStringIncludes(content, '<content>');
      assertStringIncludes(content, '</content>');
      assertStringIncludes(content, '</document>');

      // Only values should change
      assertStringIncludes(content, `<title>${values.title}</title>`);
      assertStringIncludes(content, `<content>${values.content}</content>`);
    }
  }
});

Deno.test('TemplateValueRestriction - values MUST NOT be used for conditional logic', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  // Template should NOT have conditional logic based on values
  // This is the correct template format - no conditionals
  const templateContent = `
    {
      "feature": "{{featureFlag}}",
      "mode": "{{mode}}",
      "enabled": "{{enabled}}"
    }
  `;
  loader.setTemplate(templateContent);

  const source: TemplateSource = {
    templatePath: new TemplateFilePath('test.json'),
    valueSet: {
      values: {
        featureFlag: 'true',
        mode: 'production',
        enabled: 'false'
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // Values should be inserted as-is, not evaluated
    assertStringIncludes(content, '"feature": "true"');
    assertStringIncludes(content, '"mode": "production"');
    assertStringIncludes(content, '"enabled": "false"');

    // The structure should remain exactly as defined in template
    const lines = content.split('\n').filter(l => l.trim());
    assertEquals(lines.length, 5); // opening brace, 3 fields, closing brace
  }
});

Deno.test('TemplateValueRestriction - values MUST NOT determine output path', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  const templateContent = 'Content: {{content}}';
  loader.setTemplate(templateContent);

  // Values that might be mistaken for path information
  const source: TemplateSource = {
    templatePath: new TemplateFilePath('template.txt'),
    valueSet: {
      values: {
        content: 'Some content',
        outputPath: '/some/other/path.txt', // This should NOT affect output path
        destination: './output/file.txt',   // This should NOT affect output path
        filename: 'different.txt'           // This should NOT affect output path
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    // The compiled template should only use 'content' value
    const content = result.data.getCompiledContent().toString();
    assertEquals(content, 'Content: Some content');

    // Path-like values should be ignored (not in template)
    assertEquals(content.includes('/some/other/path.txt'), false);
    assertEquals(content.includes('./output/file.txt'), false);
    assertEquals(content.includes('different.txt'), false);

    // Template path should remain as specified
    assertEquals(result.data.getTemplatePath().toString(), 'template.txt');
  }
});

Deno.test('TemplateValueRestriction - values MUST NOT determine output format', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  const templateContent = '{"data": "{{data}}"}';
  loader.setTemplate(templateContent);

  // Values that might be mistaken for format information
  const source: TemplateSource = {
    templatePath: new TemplateFilePath('template.json'),
    valueSet: {
      values: {
        data: 'test data',
        format: 'yaml',        // This should NOT change output format
        outputFormat: 'xml',   // This should NOT change output format
        type: 'markdown'       // This should NOT change output format
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // Output should still be JSON as determined by template
    assertStringIncludes(content, '{"data": "test data"}');

    // Format should be determined by template file, not values
    assertEquals(result.data.getFormat(), 'json');

    // Format-related values should not appear in output
    assertEquals(content.includes('yaml'), false);
    assertEquals(content.includes('xml'), false);
    assertEquals(content.includes('markdown'), false);
  }
});

Deno.test('TemplateValueRestriction - unused values MUST be ignored', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  const templateContent = 'Hello {{name}}!';
  loader.setTemplate(templateContent);

  const source: TemplateSource = {
    templatePath: new TemplateFilePath('greeting.txt'),
    valueSet: {
      values: {
        name: 'World',
        // These values are not in template and should be ignored
        unused1: 'should not appear',
        unused2: 123,
        unused3: { nested: 'object' },
        unused4: ['array', 'values']
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // Only the used value should appear
    assertEquals(content, 'Hello World!');

    // Unused values should not appear anywhere
    assertEquals(content.includes('should not appear'), false);
    assertEquals(content.includes('123'), false);
    assertEquals(content.includes('nested'), false);
    assertEquals(content.includes('array'), false);
  }
});

Deno.test('TemplateValueRestriction - template file content MUST be preserved except for substitutions', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  // Complex template with various formatting
  const templateContent = `
    # Configuration File
    # Generated from template

    [section1]
    key1 = {{value1}}
    key2 = "{{value2}}"

    [section2]
    # Comment line
    array = [1, 2, 3]
    name = {{name}}

    # End of file
  `;
  loader.setTemplate(templateContent);

  const source: TemplateSource = {
    templatePath: new TemplateFilePath('config.ini'),
    valueSet: {
      values: {
        value1: 'replaced1',
        value2: 'replaced2',
        name: 'MyApp'
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // All non-variable content must be preserved exactly
    assertStringIncludes(content, '# Configuration File');
    assertStringIncludes(content, '# Generated from template');
    assertStringIncludes(content, '[section1]');
    assertStringIncludes(content, '[section2]');
    assertStringIncludes(content, '# Comment line');
    assertStringIncludes(content, 'array = [1, 2, 3]');
    assertStringIncludes(content, '# End of file');

    // Only variables should be replaced
    assertStringIncludes(content, 'key1 = replaced1');
    assertStringIncludes(content, 'key2 = "replaced2"');
    assertStringIncludes(content, 'name = MyApp');

    // No placeholders should remain
    assertEquals(content.includes('{{'), false);
    assertEquals(content.includes('}}'), false);
  }
});

Deno.test('TemplateValueRestriction - values MUST NOT execute code or expressions', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  const templateContent = `
    {
      "result": "{{expression}}",
      "command": "{{command}}",
      "script": "{{script}}"
    }
  `;
  loader.setTemplate(templateContent);

  // Values that look like code/expressions
  const source: TemplateSource = {
    templatePath: new TemplateFilePath('test.json'),
    valueSet: {
      values: {
        expression: '2 + 2',
        command: 'rm -rf /',
        script: 'alert("xss")'
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();

    // Values should be inserted as literal strings, not executed
    assertStringIncludes(content, '"result": "2 + 2"');  // Not "4"
    assertStringIncludes(content, '"command": "rm -rf /"');
    assertStringIncludes(content, '"script": "alert(\\"xss\\")"');

    // Verify no execution occurred
    assertEquals(content.includes('"result": "4"'), false);
  }
});

Deno.test('TemplateValueRestriction - template output MUST match template file with substitutions only', async () => {
  const loader = new StrictMockTemplateLoader();
  const compiler = new TemplateCompiler(loader);

  // Store original template for comparison
  const originalTemplate = `
    Line 1: {{var1}}
    Line 2: no variables
    Line 3: {{var2}} and {{var3}}
    Line 4: end
  `;
  loader.setTemplate(originalTemplate);

  const source: TemplateSource = {
    templatePath: new TemplateFilePath('test.txt'),
    valueSet: {
      values: {
        var1: 'VALUE1',
        var2: 'VALUE2',
        var3: 'VALUE3'
      }
    }
  };

  const result = await compiler.compile(source);
  assertEquals(result.ok, true);

  if (result.ok) {
    const content = result.data.getCompiledContent().toString();
    const expectedOutput = `
    Line 1: VALUE1
    Line 2: no variables
    Line 3: VALUE2 and VALUE3
    Line 4: end
  `;

    // Output should exactly match template with substitutions
    assertEquals(content, expectedOutput);

    // Verify line count is preserved
    const originalLines = originalTemplate.split('\n').length;
    const outputLines = content.split('\n').length;
    assertEquals(outputLines, originalLines);
  }
});