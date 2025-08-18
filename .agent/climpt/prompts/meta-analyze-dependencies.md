---
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

Analyzes project dependencies for security, updates, and relationships.
