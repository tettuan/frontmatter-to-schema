---
c1: "git"
c2: "create"
c3: "refinement-issue"
description: "Creates a git refinement issue for code improvements"
usage: "climpt-git create refinement-issue --title='Issue Title' --body='Issue description'"
options:
  input: ["markdown", "json"]
  adaptation: ["standard", "custom"]
  input_file: [true]
  stdin: [true]
  destination: [true]
---

# Git Refinement Issue Creator

This command creates refinement issues in Git repositories to track code
improvements and technical debt.

## Usage Examples

```bash
# Create from file
climpt-git create refinement-issue -i=file.md

# Create from stdin
echo "Issue content" | climpt-git create refinement-issue

# Create with custom template
climpt-git create refinement-issue -a=custom -i=template.md
```
