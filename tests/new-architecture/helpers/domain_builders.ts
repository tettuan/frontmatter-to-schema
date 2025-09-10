/**
 * Domain Test Builders - DDD Compliant Test Data Generation
 * Provides Smart Constructor patterns for test data creation
 * Following robust test principles for change-resistant, reusable test utilities
 */

// Helper builders for creating test data

/**
 * Test Document Builder - Frontmatter Context
 * Builds test documents with configurable frontmatter and content
 */
export class TestDocumentBuilder {
  private path = "test.md";
  private content = "# Test Document\n\nTest content";
  private frontmatter: Record<string, unknown> = {};
  private hasValidFrontmatter = true;

  /**
   * Set document file path
   */
  withPath(path: string): this {
    this.path = path;
    return this;
  }

  /**
   * Set document content (excluding frontmatter)
   */
  withContent(content: string): this {
    this.content = content;
    return this;
  }

  /**
   * Add frontmatter fields
   */
  withFrontmatter(frontmatter: Record<string, unknown>): this {
    this.frontmatter = { ...this.frontmatter, ...frontmatter };
    return this;
  }

  /**
   * Set specific frontmatter field
   */
  withField(key: string, value: unknown): this {
    this.frontmatter[key] = value;
    return this;
  }

  /**
   * Create document with malformed frontmatter for error testing
   */
  withInvalidFrontmatter(): this {
    this.hasValidFrontmatter = false;
    return this;
  }

  /**
   * Build complete markdown document string
   */
  build(): string {
    if (Object.keys(this.frontmatter).length === 0) {
      return this.content;
    }

    if (!this.hasValidFrontmatter) {
      // Create malformed YAML for error testing
      return `---\n{ invalid yaml }\n---\n${this.content}`;
    }

    // Create valid YAML frontmatter
    const yamlLines = Object.entries(this.frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    return `---\n${yamlLines.join("\n")}\n---\n${this.content}`;
  }

  /**
   * Build document for file path testing
   */
  buildWithPath(): { path: string; content: string } {
    return {
      path: this.path,
      content: this.build(),
    };
  }
}

/**
 * Test Schema Builder - Schema Context
 * Builds test schemas with configurable validation rules
 */
export class TestSchemaBuilder {
  private properties: Record<string, unknown> = {};
  private required: string[] = [];
  private refs: Record<string, unknown> = {};
  private isValid = true;

  /**
   * Add schema property definition
   */
  withProperty(name: string, definition: unknown): this {
    this.properties[name] = definition;
    return this;
  }

  /**
   * Mark field as required
   */
  withRequired(...fields: string[]): this {
    this.required.push(...fields);
    return this;
  }

  /**
   * Add $ref definition for testing resolution
   */
  withRef(key: string, definition: unknown): this {
    this.refs[key] = definition;
    return this;
  }

  /**
   * Create invalid schema for error testing
   */
  withInvalidStructure(): this {
    this.isValid = false;
    return this;
  }

  /**
   * Build JSON schema object
   */
  build(): unknown {
    if (!this.isValid) {
      return { invalid: "schema structure" };
    }

    const schema: Record<string, unknown> = {
      type: "object",
      properties: this.properties,
    };

    if (this.required.length > 0) {
      schema.required = this.required;
    }

    if (Object.keys(this.refs).length > 0) {
      schema.$defs = this.refs;
    }

    return schema;
  }

  /**
   * Build as JSON string
   */
  buildJson(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}

/**
 * Test Template Builder - Template Context
 * Builds test templates with configurable variables and formats
 */
export class TestTemplateBuilder {
  private content = "# {title}\n\n{description}";
  private variables: string[] = ["title", "description"];
  private format: "json" | "yaml" | "xml" | "custom" = "custom";

  /**
   * Set template content with placeholders
   */
  withContent(content: string): this {
    this.content = content;
    return this;
  }

  /**
   * Add template variable
   */
  withVariable(variable: string): this {
    if (!this.variables.includes(variable)) {
      this.variables.push(variable);
    }
    return this;
  }

  /**
   * Set output format
   */
  withFormat(format: "json" | "yaml" | "xml" | "custom"): this {
    this.format = format;
    return this;
  }

  /**
   * Build template with JSON output structure
   */
  withJsonOutput(): this {
    this.content = `{
  "title": "{title}",
  "description": "{description}",
  "items": {items}
}`;
    this.format = "json";
    return this;
  }

  /**
   * Build template configuration
   */
  build(): {
    content: string;
    variables: string[];
    format: string;
  } {
    return {
      content: this.content,
      variables: this.variables,
      format: this.format,
    };
  }
}

/**
 * Test Configuration Builder - Application Context
 * Builds complete processing configurations for integration tests
 */
export class TestConfigurationBuilder {
  private schema = new TestSchemaBuilder().build();
  private template = new TestTemplateBuilder().build();
  private inputPath = "test-input";
  private outputPath = "test-output.json";
  private processingMode: "single" | "batch" | "aggregate" = "single";

  /**
   * Set schema configuration
   */
  withSchema(schemaBuilder: TestSchemaBuilder): this {
    this.schema = schemaBuilder.build();
    return this;
  }

  /**
   * Set template configuration
   */
  withTemplate(templateBuilder: TestTemplateBuilder): this {
    this.template = templateBuilder.build();
    return this;
  }

  /**
   * Set input path/pattern
   */
  withInput(path: string): this {
    this.inputPath = path;
    return this;
  }

  /**
   * Set output path
   */
  withOutput(path: string): this {
    this.outputPath = path;
    return this;
  }

  /**
   * Set processing mode
   */
  withMode(mode: "single" | "batch" | "aggregate"): this {
    this.processingMode = mode;
    return this;
  }

  /**
   * Build complete configuration
   */
  build(): {
    schema: unknown;
    template: unknown;
    input: string;
    output: string;
    mode: string;
  } {
    return {
      schema: this.schema,
      template: this.template,
      input: this.inputPath,
      output: this.outputPath,
      mode: this.processingMode,
    };
  }
}

/**
 * Factory functions for common test scenarios
 */
export const TestDataFactory = {
  /**
   * Create simple valid document
   */
  simpleDocument(): TestDocumentBuilder {
    return new TestDocumentBuilder()
      .withPath("simple.md")
      .withFrontmatter({
        title: "Simple Document",
        description: "A simple test document",
      });
  },

  /**
   * Create document with complex frontmatter
   */
  complexDocument(): TestDocumentBuilder {
    return new TestDocumentBuilder()
      .withPath("complex.md")
      .withFrontmatter({
        title: "Complex Document",
        description: "A complex test document",
        tags: ["test", "complex"],
        metadata: {
          author: "Test Author",
          version: "1.0.0",
        },
      });
  },

  /**
   * Create basic schema
   */
  basicSchema(): TestSchemaBuilder {
    return new TestSchemaBuilder()
      .withProperty("title", { type: "string" })
      .withProperty("description", { type: "string" })
      .withRequired("title");
  },

  /**
   * Create JSON output template
   */
  jsonTemplate(): TestTemplateBuilder {
    return new TestTemplateBuilder().withJsonOutput();
  },

  /**
   * Create complete valid configuration
   */
  validConfiguration(): TestConfigurationBuilder {
    return new TestConfigurationBuilder()
      .withSchema(this.basicSchema())
      .withTemplate(this.jsonTemplate())
      .withInput("*.md")
      .withOutput("output.json");
  },
};
