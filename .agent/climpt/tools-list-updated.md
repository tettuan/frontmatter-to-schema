# Climpt Available Commands List

Generated on: $(date)

## climpt-build

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| robust | test | default | default | ✓ | ✓ | - |
| robust | test | default | strict | ✓ | ✓ | - |
| robust | code | default | default | ✓ | ✓ | - |

## climpt-design

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| domain | boundary | default | default | - | ✓ | ✓ |
| domain | boundary | code | default | - | - | ✓ |
| domain | architecture | default | default | ✓ | - | ✓ |
| domain | architecture | core | default | ✓ | - | ✓ |
| domain | architecture | detail | default | ✓ | - | ✓ |

## climpt-docs

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| generate-robust | instruction-doc | default | default | - | ✓ | ✓ |

## climpt-git

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| decide-branch | working-branch | default | default | - | ✓ | - |
| list-select | pr-branch | default | default | - | - | - |
| find-oldest | descendant-branch | default | default | - | - | - |
| merge-cleanup | develop-branches | default | default | - | - | - |
| group-commit | unstaged-changes | default | default | - | - | - |

## climpt-meta

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| resolve | registered-commands | default | default | - | ✓ | - |
| list | available-commands | default | default | - | ✓ | - |
| build-list | command-registry | default | default | - | - | - |
| build-list | command-registry | default | registry | - | - | - |
| build-list | command-registry | claude | default | - | ✓ | ✓ |

## climpt-refactor

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| ddd | architecture | default | default | - | - | - |
| basedon | ddd | nextaction | default | - | ✓ | - |
| basedon | ddd | default | default | - | - | - |

## climpt-spec

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| analyze | quality-metrics | default | default | ✓ | - | ✓ |

