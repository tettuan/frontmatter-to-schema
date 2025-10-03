---
version: "1.0.0"
description: "Basic command registry example"
c1: spec
c2: analyze
c3: quality-metrics
title: Analyze Quality Metrics
usage: "climpt spec analyze quality-metrics --input=spec.md"
options:
  input: ["file", "stdin"]
  adaptation: ["default", "detailed"]
  input_file: [true]
  stdin: [true]
  destination: [true, false]
---

# Analyze Quality Metrics

This command analyzes code quality metrics from specification documents.

## Usage

```bash
climpt spec analyze quality-metrics --input=spec.md
```

## Description

Processes specification documents to extract and analyze quality metrics.
