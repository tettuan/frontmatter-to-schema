---
c1: git
c2: create
c3: branch
title: Create Git Branch
description: Create a new git branch for feature development
usage: "git checkout -b feature/new-feature"
options:
  input: ["string"]
  adaptation: ["default"]
  input_file: [false]
  stdin: [false]
  destination: [false]
---

# Create Git Branch

This command creates a new git branch for feature development.

## Usage

```bash
git checkout -b feature/new-feature
```

## Description

Creates and switches to a new git branch based on the current branch.
