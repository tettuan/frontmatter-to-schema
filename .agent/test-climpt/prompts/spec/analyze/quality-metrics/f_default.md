---
c1: spec
c2: analyze
c3: quality-metrics
title: Analyze Specification Quality
description: Analyze specification quality and completeness metrics
usage: climpt-spec analyze quality-metrics -f spec.md -o report.json
options:
  input: ["text", "file"]
  adaptation: ["default"]
  input_file: [true]
  stdin: [true]
  destination: [true]
---

# Specification Quality Analysis

Analyzing specification from: {input_text_file}

Evaluate:

- Completeness score
- Clarity metrics
- Testability rating
- Implementation readiness

Output results to: {destination_path}
