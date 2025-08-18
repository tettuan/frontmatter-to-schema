# Climpt Commands Report

Generated: 2025-08-18T15:29:02.885Z

## Statistics

- Total Commands: 6
- Total Variations: 22

## Commands

### climpt-design

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| domain | boundary | default | - | ✓ | ✓ |
| domain | boundary | code | - | - | ✓ |
| domain | architecture | default | ✓ | - | ✓ |
| domain | architecture | core | ✓ | - | ✓ |
| domain | architecture | detail | ✓ | - | ✓ |

### climpt-meta

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| resolve | registered-commands | default | - | ✓ | - |
| build-list | command-registry | default | - | - | - |
| build-list | command-registry | registry | - | - | - |
| build-list | command-registry | claude | - | ✓ | ✓ |

### climpt-docs

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| generate-robust | instruction-doc | default | - | ✓ | ✓ |

### climpt-build

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| robust | test | default | ✓ | ✓ | - |
| robust | test | strict | ✓ | ✓ | - |
| robust | code | default | ✓ | ✓ | - |

### climpt-git

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| decide-branch | working-branch | default | - | ✓ | - |
| list-select | pr-branch | default | - | - | - |
| find-oldest | descendant-branch | default | - | - | - |
| merge-cleanup | develop-branches | default | - | - | - |
| group-commit | unstaged-changes | default | - | - | - |
| merge-up | base-branch | default | - | - | - |

### climpt-refactor

| Directive | Layer | Adaptation | Input File | STDIN | Destination |
|-----------|-------|------------|------------|-------|-------------|
| ddd | architecture | default | - | - | - |
| basedon | ddd | nextaction | - | ✓ | - |
| basedon | ddd | default | - | - | - |

