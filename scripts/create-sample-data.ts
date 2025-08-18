#!/usr/bin/env -S deno run --allow-write --allow-read

const samplePrompts = [
  {
    filename: "git-create-refinement-issue.md",
    content: `---
title: Create Refinement Issue
domain: git
action: create
target: refinement-issue
description: Create a refinement issue from requirements documentation
tags:
  - git
  - issue-tracking
  - refinement
config:
  input_formats: ["MD", "TXT"]
  processing_modes: ["default", "detailed"]
  supports:
    file_input: true
    stdin_input: false
    output_destination: true
usage: |
  Create refinement issues from requirement documents.
  Example: climpt-git create refinement-issue -f requirements.md
---

# Create Refinement Issue

Creates GitHub issues for requirement refinement based on documentation.`,
  },
  {
    filename: "spec-analyze-quality-metrics.md",
    content: `---
title: Analyze Quality Metrics
domain: spec
action: analyze
target: quality-metrics
description: Analyze specification quality and completeness
tags:
  - specification
  - quality
  - metrics
config:
  input_formats: ["MD", "JSON"]
  processing_modes: ["default", "comprehensive"]
  supports:
    file_input: true
    stdin_input: true
    output_destination: true
---

# Spec Quality Analysis

Analyzes specification documents for quality metrics and completeness.`,
  },
  {
    filename: "test-execute-integration-suite.md",
    content: `---
title: Execute Integration Suite
domain: test
action: execute
target: integration-suite
description: Execute integration test suite
tags:
  - testing
  - integration
  - automation
config:
  input_formats: ["YAML", "JSON"]
  processing_modes: ["default", "verbose", "quiet"]
  supports:
    file_input: true
    stdin_input: false
    output_destination: true
---

# Integration Test Suite

Executes the full integration test suite with detailed reporting.`,
  },
  {
    filename: "code-generate-documentation.md",
    content: `---
title: Generate Documentation
domain: code
action: generate
target: documentation
description: Generate documentation from code comments and structure
tags:
  - documentation
  - code-generation
  - automation
config:
  input_formats: ["TS", "JS", "PY"]
  processing_modes: ["default", "detailed", "minimal"]
  supports:
    file_input: true
    stdin_input: false
    output_destination: true
usage: |
  Generate comprehensive documentation from source code.
  Example: climpt-code generate documentation -f src/
---

# Documentation Generator

Automatically generates documentation from code structure and comments.`,
  },
  {
    filename: "meta-analyze-dependencies.md",
    content: `---
title: Analyze Dependencies
domain: meta
action: analyze
target: dependencies
description: Analyze project dependencies and their relationships
tags:
  - dependencies
  - analysis
  - meta
config:
  input_formats: ["JSON", "YAML", "TOML"]
  processing_modes: ["default", "security", "outdated"]
  supports:
    file_input: true
    stdin_input: true
    output_destination: true
---

# Dependency Analysis

Analyzes project dependencies for security, updates, and relationships.`,
  },
];

async function createSampleData() {
  const baseDir = ".agent/climpt/prompts";

  console.log("Creating sample prompt directory...");
  await Deno.mkdir(baseDir, { recursive: true });

  for (const prompt of samplePrompts) {
    const filepath = `${baseDir}/${prompt.filename}`;
    console.log(`Creating: ${filepath}`);
    await Deno.writeTextFile(filepath, prompt.content);
  }

  console.log(
    `\n✅ Created ${samplePrompts.length} sample prompt files in ${baseDir}`,
  );
}

if (import.meta.main) {
  await createSampleData();
}
