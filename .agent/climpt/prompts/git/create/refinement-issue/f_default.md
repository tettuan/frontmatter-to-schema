---
c1: git
c2: create
c3: refinement-issue
title: Create Refinement Issue
description: Create a refinement issue from requirements documentation
usage: |
  Create refinement issues from requirement documents.
  Example: climpt-git create refinement-issue -f requirements.md
options:
  input: []
  adaptation: []
  file: [true]
  stdin: [false]
  destination: [true]
---

# Refinement Issue Creation

Based on the provided requirements: {input_text_file}

Create a refinement issue with the following structure:

- Issue title
- Description
- Acceptance criteria
- Technical considerations

Output to: {destination_path}
