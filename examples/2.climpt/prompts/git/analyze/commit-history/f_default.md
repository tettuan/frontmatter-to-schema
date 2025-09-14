---
c1: git
c2: analyze
c3: commit-history
title: Analyze Commit History
description: Analyze git commit history and generate insights
usage: echo "main..feature" | climpt-git analyze commit-history
options:
  stdin: [true]
  destination: [true]
---

# Commit History Analysis

Analyze the commit history for: {input_text}

Generate insights about:

- Commit patterns
- Author contributions
- Change frequency
- Code areas affected
