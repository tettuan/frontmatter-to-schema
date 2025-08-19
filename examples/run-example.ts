#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { CLI } from "../src/application/cli.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["example"],
    boolean: ["help"],
    alias: {
      e: "example",
      h: "help",
    },
  });

  if (args.help || !args.example) {
    console.log(`
Example Runner - Run predefined examples

Usage:
  deno run --allow-read --allow-write --allow-run examples/run-example.ts -e <example-name>

Available Examples:
  climpt    - Process Climpt prompts and generate registry.json
  articles  - Process article drafts and generate books.yml

Options:
  -e, --example <name>   Example to run
  -h, --help            Show this help message

Examples:
  # Run Climpt registry generation
  deno run --allow-read --allow-write --allow-run examples/run-example.ts -e climpt

  # Run articles index generation
  deno run --allow-read --allow-write --allow-run examples/run-example.ts -e articles
`);
    return;
  }

  const cli = new CLI();
  
  switch (args.example) {
    case "climpt": {
      console.log("🚀 Running Climpt Registry Example");
      console.log("================================\n");
      
      // First, create sample prompt files if they don't exist
      await ensureClimptSampleFiles();
      
      await cli.run(["-c", "examples/climpt-registry/config.json", "-v"]);
      break;
    }
    
    case "articles": {
      console.log("📚 Running Articles Index Example");
      console.log("================================\n");
      
      // First, create sample article files if they don't exist
      await ensureArticleSampleFiles();
      
      await cli.run(["-c", "examples/articles-index/config.json", "-v"]);
      break;
    }
    
    default:
      console.error(`Unknown example: ${args.example}`);
      console.log("Run with --help to see available examples");
      Deno.exit(1);
  }
}

async function ensureClimptSampleFiles() {
  const dir = ".agent/climpt/prompts";
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  const sampleFiles = [
    {
      path: `${dir}/git-create-refinement-issue.md`,
      content: `---
c1: git
c2: create
c3: refinement-issue
description: Create a refinement issue from requirements documentation
usage: |
  Create refinement issues from requirement documents.
  Example: climpt-git create refinement-issue -f requirements.md
options:
  input: [MD]
  adaptation: [default, detailed]
  input_file: [true]
  stdin: [false]
  destination: [true]
---

# Git Create Refinement Issue

This prompt creates a refinement issue from requirements documentation.

## Template Variables
- {{requirements}}: The requirements document content
- {{context}}: Additional context for the issue

## Prompt
Based on the following requirements, create a detailed refinement issue...`
    },
    {
      path: `${dir}/spec-analyze-quality-metrics.md`,
      content: `---
c1: spec
c2: analyze
c3: quality-metrics
description: Analyze specification quality and completeness
---

# Spec Analyze Quality Metrics

Analyzes the quality and completeness of specifications.

## Metrics Evaluated
- Completeness
- Clarity
- Testability
- Consistency`
    },
    {
      path: `${dir}/test-execute-integration-suite.md`,
      content: `---
c1: test
c2: execute
c3: integration-suite
description: Execute integration test suite
usage: Run the full integration test suite with coverage reporting
---

# Test Execute Integration Suite

Executes the complete integration test suite.`
    }
  ];

  for (const file of sampleFiles) {
    try {
      await Deno.stat(file.path);
      console.log(`  ✓ Sample file exists: ${file.path}`);
    } catch {
      await Deno.writeTextFile(file.path, file.content);
      console.log(`  ✓ Created sample file: ${file.path}`);
    }
  }
}

async function ensureArticleSampleFiles() {
  const dir = ".agent/drafts/articles";
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  const sampleFiles = [
    {
      path: `${dir}/claude-code-best-practices.md`,
      content: `---
title: Claude Code Best Practices
emoji: 🤖
type: tech
topics: [claudecode, ai, bestpractices]
published: true
published_at: 2025-08-15 10:00
---

# Claude Code Best Practices

Best practices for using Claude Code effectively...`
    },
    {
      path: `${dir}/deno-typescript-guide.md`,
      content: `---
title: Complete Deno TypeScript Guide
type: tutorial
tags: [deno, typescript, javascript]
draft: false
created_at: 2025-08-10
---

# Complete Deno TypeScript Guide

A comprehensive guide to using TypeScript with Deno...`
    },
    {
      path: `${dir}/domain-driven-design.md`,
      content: `---
title: Domain-Driven Design in Practice
emoji: 🏗️
category: idea
keywords: [ddd, architecture, design]
status: published
date: 2025-08-05 14:30
---

# Domain-Driven Design in Practice

Implementing DDD principles in modern applications...`
    }
  ];

  for (const file of sampleFiles) {
    try {
      await Deno.stat(file.path);
      console.log(`  ✓ Sample file exists: ${file.path}`);
    } catch {
      await Deno.writeTextFile(file.path, file.content);
      console.log(`  ✓ Created sample file: ${file.path}`);
    }
  }
}

if (import.meta.main) {
  await main();
}