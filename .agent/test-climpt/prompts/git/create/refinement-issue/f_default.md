---
c1: git
c2: create
c3: refinement-issue
title: Create Refinement Issue
description: Create a refinement issue from requirements documentation
usage: climpt-git create refinement-issue -f requirements.md
options:
  input: ["text", "file"]
  adaptation: ["default"]
  input_file: [true]
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
