# Climpt Available Commands List

Generated on: $(date)

## climpt-build

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| robust | test | default | default | ✓ | ✓ | - |
| robust | test | default | strict | ✓ | ✓ | - |
| robust | code | default | default | ✓ | ✓ | - |

**climpt-build robust test**:
testを強固に構築する

**climpt-build robust test**:
強固で堅牢なテスト構築指示書

**climpt-build robust code**:
APIを強固に構築する

## climpt-design

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| domain | boundary | default | default | - | ✓ | ✓ |
| domain | boundary | code | default | - | - | ✓ |
| domain | architecture | default | default | ✓ | - | ✓ |
| domain | architecture | core | default | ✓ | - | ✓ |
| domain | architecture | detail | default | ✓ | - | ✓ |

**climpt-design domain boundary**:
title:
粗い考えをもとに、ドメイン境界線を引いてみる。

**climpt-design domain boundary**:
title:
コードベースをもとに、ドメイン境界線を引く。

**climpt-design domain architecture**:
title:
ドメイン境界情報などを元に、ドメイン設計を行う。

**climpt-design domain architecture**:
title:
ドメイン境界情報をもとに、中心概念について、設計を行う。

**climpt-design domain architecture**:
title:
ドメイン境界情報などを元に、ドメイン設計を行う。既存のドメイン情報を加味して詳細な型定義を行う。

## climpt-docs

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| generate-robust | instruction-doc | default | default | - | ✓ | ✓ |

**climpt-docs generate-robust instruction-doc**:
Climpt プロンプト作成指示書
短い指示文からでも、既存情報を補完して高再現性の指示書を作成するための標準手順と品質基準を定める。

## climpt-git

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| decide-branch | working-branch | default | default | - | ✓ | - |
| list-select | pr-branch | default | default | - | - | - |
| find-oldest | descendant-branch | default | default | - | - | - |
| merge-cleanup | develop-branches | default | default | - | - | - |
| group-commit | unstaged-changes | default | default | - | - | - |
| analyze | commit-history | default | default | - | ✓ | - |
| merge-up | base-branch | default | default | - | - | - |
| create | refinement-issue | default | default | ✓ | - | ✓ |

**climpt-git decide-branch working-branch**:
git branch の新規立ち上げ判断と、新ブランチ作成

**climpt-git list-select pr-branch**:
現存のPRとブランチをリスト化して、次に作業する対象を選ぶ

**climpt-git find-oldest descendant-branch**:
Git関連ブランチ探索とマージ処理実行

**climpt-git merge-cleanup develop-branches**:
developにマージして不要なブランチを掃除する
mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。

**climpt-git group-commit unstaged-changes**:
意味的近さでコミットを分けて実施する

**climpt-git analyze commit-history**:
Analyze Commit History
Analyze git commit history and generate insights
Usage: echo "main..feature" | climpt-git analyze commit-history

**climpt-git merge-up base-branch**:
作業ブランチ間のマージ処理
作業ブランチから派生した作業ブランチを、元の作業ブランチへマージする。

**climpt-git create refinement-issue**:
Create Refinement Issue
Create a refinement issue from requirements documentation
Usage: climpt-git create refinement-issue -f requirements.md

## climpt-meta

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| resolve | registered-commands | default | default | - | ✓ | - |
| list | available-commands | default | default | - | ✓ | - |
| build-list | command-registry | default | default | - | - | - |
| build-list | command-registry | default | registry | - | - | - |
| build-list | command-registry | claude | default | - | ✓ | ✓ |

**climpt-meta resolve registered-commands**:
climpt実行コマンドを構築するclimpt
渡された内容に相応しい climpt-* を構築し、示す。

**climpt-meta list available-commands**:
List Available Commands
List all available Climpt commands and their options
Usage: climpt-meta list available-commands

**climpt-meta build-list command-registry**:
Climpt 実行可能コマンドの一覧作成

**climpt-meta build-list command-registry**:
Climpt Registry.json Generation
Automatically generates a registry.json file for MCP server configuration by analyzing existing Climpt commands, configurations, and prompt files. Creates a comprehensive tool registry following the C3L (Climpt 3-word Language) specification.
Usage: climpt list usage --adaptation=registry

**climpt-meta build-list command-registry**:
Climpt Available Commands List Generation (Claude Code Version)
Generates available commands list using Claude Code with shell scripting. Lists prompt files mechanically with sh, then analyzes each file content using claude -p in a loop.
Usage: climpt list usage --adaptation=claude-code

## climpt-refactor

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| ddd | architecture | default | default | - | - | - |
| basedon | ddd | nextaction | default | - | ✓ | - |
| basedon | ddd | default | default | - | - | - |

**climpt-refactor ddd architecture**:
title:
description:

**climpt-refactor basedon ddd**:
title:
description:

**climpt-refactor basedon ddd**:
ドメイン駆動設計と全域性（Totality）に基づくリファクタリング
description:

## climpt-spec

|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|
|---|---|---|---|---|---|---|
| analyze | quality-metrics | default | default | ✓ | - | ✓ |

**climpt-spec analyze quality-metrics**:
Analyze Specification Quality
Analyze specification quality and completeness metrics
Usage: climpt-spec analyze quality-metrics -f spec.md -o report.json

