---
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

Automatically generates documentation from code structure and comments.
