import { assertEquals, assertExists } from '@std/assert';
import { CompiledTemplate, ValidationError } from './compiled-template.ts';
import { TemplateFilePath, TemplateValueSet, OutputFormat } from '../template-shared/value-objects.ts';

Deno.test('CompiledTemplate - creates instance with valid data', () => {
  const templatePath = new TemplateFilePath('templates/test.json');
  const valueSet: TemplateValueSet = {
    values: {
      name: 'Test',
      version: '1.0.0'
    }
  };

  const template = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '{"name": "Test", "version": "1.0.0"}',
    format: OutputFormat.JSON
  });

  assertExists(template);
  assertEquals(template.getTemplatePath(), templatePath);
  assertEquals(template.getAppliedValues(), valueSet);
  assertEquals(template.getFormat(), OutputFormat.JSON);
  assertExists(template.getChecksum());
  assertExists(template.getCompiledAt());
});

Deno.test('CompiledTemplate - validates JSON format correctly', () => {
  const templatePath = new TemplateFilePath('templates/test.json');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  // Valid JSON
  const validTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '{"test": "value"}',
    format: OutputFormat.JSON
  });

  const validResult = validTemplate.validate();
  assertEquals(validResult.ok, true);

  // Invalid JSON
  const invalidTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '{invalid json}',
    format: OutputFormat.JSON
  });

  const invalidResult = invalidTemplate.validate();
  assertEquals(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assertExists(invalidResult.error);
    assertEquals(invalidResult.error.name, 'ValidationError');
  }
});

Deno.test('CompiledTemplate - validates empty content', () => {
  const templatePath = new TemplateFilePath('templates/test.txt');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  const emptyTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '',
    format: OutputFormat.TEXT
  });

  const result = emptyTemplate.validate();
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.message, 'Compiled content cannot be empty');
  }
});

Deno.test('CompiledTemplate - validates empty values', () => {
  const templatePath = new TemplateFilePath('templates/test.txt');
  const valueSet: TemplateValueSet = {
    values: {}
  };

  const template = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'test content',
    format: OutputFormat.TEXT
  });

  const result = template.validate();
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.message, 'No values were applied to template');
  }
});

Deno.test('CompiledTemplate - validates YAML format', () => {
  const templatePath = new TemplateFilePath('templates/test.yaml');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  // Valid YAML (no tabs)
  const validTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'test: value\nname: test',
    format: OutputFormat.YAML
  });

  const validResult = validTemplate.validate();
  assertEquals(validResult.ok, true);

  // Invalid YAML (contains tabs)
  const invalidTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'test:\tvalue',
    format: OutputFormat.YAML
  });

  const invalidResult = invalidTemplate.validate();
  assertEquals(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assertEquals(invalidResult.error.message, 'YAML cannot contain tabs');
  }
});

Deno.test('CompiledTemplate - validates XML format', () => {
  const templatePath = new TemplateFilePath('templates/test.xml');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  // Valid XML
  const validTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '<root><test>value</test></root>',
    format: OutputFormat.XML
  });

  const validResult = validTemplate.validate();
  assertEquals(validResult.ok, true);

  // Invalid XML
  const invalidTemplate = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'not xml content',
    format: OutputFormat.XML
  });

  const invalidResult = invalidTemplate.validate();
  assertEquals(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assertEquals(invalidResult.error.message, 'Invalid XML format');
  }
});

Deno.test('CompiledTemplate - creates copy with updated content', () => {
  const templatePath = new TemplateFilePath('templates/test.json');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  const original = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: '{"test": "value"}',
    format: OutputFormat.JSON
  });

  const newContent = '{"test": "updated"}';
  const updated = original.withUpdatedContent(newContent);

  assertEquals(updated.getCompiledContent(), newContent);
  assertEquals(updated.getTemplatePath(), original.getTemplatePath());
  assertEquals(updated.getAppliedValues(), original.getAppliedValues());
  assertEquals(updated.getFormat(), original.getFormat());

  // Original should remain unchanged
  assertEquals(original.getCompiledContent(), '{"test": "value"}');
});

Deno.test('CompiledTemplate - handles Buffer content', () => {
  const templatePath = new TemplateFilePath('templates/test.bin');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  const bufferContent = Buffer.from('test content');
  const template = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: bufferContent,
    format: OutputFormat.TEXT
  });

  const result = template.validate();
  assertEquals(result.ok, true);
  assertEquals(template.getCompiledContent(), bufferContent);
  assertExists(template.getChecksum());
});

Deno.test('CompiledTemplate - generates different checksums for different content', () => {
  const templatePath = new TemplateFilePath('templates/test.txt');
  const valueSet: TemplateValueSet = {
    values: { test: 'value' }
  };

  const template1 = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'content 1',
    format: OutputFormat.TEXT
  });

  const template2 = new CompiledTemplate({
    templatePath,
    appliedValues: valueSet,
    compiledContent: 'content 2',
    format: OutputFormat.TEXT
  });

  // Checksums should be different
  const checksum1 = template1.getChecksum();
  const checksum2 = template2.getChecksum();

  assertExists(checksum1);
  assertExists(checksum2);
  assertEquals(checksum1 === checksum2, false);
});