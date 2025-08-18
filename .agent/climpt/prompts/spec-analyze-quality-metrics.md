---
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

Analyzes specification documents for quality metrics and completeness.
