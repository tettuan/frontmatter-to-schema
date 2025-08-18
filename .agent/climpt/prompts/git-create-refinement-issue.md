---
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

Creates GitHub issues for requirement refinement based on documentation.
