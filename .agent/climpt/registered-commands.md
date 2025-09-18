# Climpt Command Registry

This document provides a comprehensive registry of all available climpt
commands, their directives, layers, and adaptations.

## climpt-build

| directive | layer | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ----- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| robust    | code  | -         | default        | -                   | -                  | -               |
| robust    | test  | -         | default        | -                   | -                  | -               |
| robust    | test  | -         | default_strict | -                   | -                  | -               |

### Command Details

**climpt-build robust code --adaptation=default**:

- **Title**: APIを強固に構築する
- **Description**: N/A
- **Variables**:
  - `{input_text}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-build robust test --adaptation=default**:

- **Title**: testを強固に構築する
- **Description**:
  ドメイン駆動設計と全域性（Totality）原則に基づいた、強固で堅牢なテスト構築を行う
- **Usage**: 強固に構築すべき機能要件ファイルと追加指示を入力として、
  ドメイン駆動設計に基づいた堅牢なテストを構築します。
- **Variables**:
  - `{input_text}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-build robust test --adaptation=default_strict**:

- **Title**: 強固で堅牢なテスト構築指示書
- **Description**:
  変更に強く、再現性が高く、保守性に優れたテストコードを構築し、ビジネスロジックの品質を確実に保証する
- **Usage**:
  テスト対象機能の仕様書ファイルと追加要件を入力として、強固で堅牢なテストコードを構築します。
  テスト範囲（unit/integration/e2e）を指定して実行してください。
- **Variables**:
  - `{ // Arrange: 準備 sut := NewSystemUnderTest() input := CreateTestInput()

    // Act: 実行 result, err := sut.Execute(input)

    // Assert: 検証 assert.NoError(t, err) assert.Equal(t, expected, result) }`:
    Variable extracted from template
  - `{
       // テストケース定義
   }`: Variable extracted from template
  - `{
       T        *testing.T
       DB       *TestDB
       Fixtures *FixtureManager
       Cleanup  func()
   }`:
    Variable extracted from template
  - `{
       name     string
       input    Input
       expected Output
       wantErr  bool
   }`:
    Variable extracted from template
  - `{1..10}`: Variable extracted from template
  - `{input_text}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template
  - `{uv-test-scope}`: Variable extracted from template

## climpt-debug

| directive    | layer          | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ------------ | -------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze-deep | project-issues | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-debug analyze-deep project-issues --adaptation=default**:

- **Title**: プロジェクト全体の深掘り調査と修正タスク洗い出し
- **Description**:
  プロジェクト全体を深く調査し、リファクタ課題や重複コード、修正すべき問題を洗い出し、ドメイン駆動設計からテスト駆動設計への移行を支援する
- **Usage**: プロジェクト全体の深掘り調査と修正タスクの洗い出しを実行します。
  既存のissue一覧を確認し、適切な処理を行います。

## climpt-design

| directive | layer        | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | --------- | -------------- | ------------------- | ------------------ | --------------- |
| domain    | architecture | -         | core           | -                   | -                  | -               |
| domain    | architecture | -         | default        | -                   | -                  | -               |
| domain    | architecture | -         | detail         | -                   | -                  | -               |
| domain    | boundary     | -         | code           | -                   | -                  | -               |
| domain    | boundary     | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-design domain architecture --adaptation=core**:

- **Title**: ドメイン設計の中心設計
- **Description**: ドメイン境界情報をもとに、中心概念について、設計を行う。
- **Usage**:
  ドメイン境界情報をもとに、ドメインに基づいた詳細設計を、ドメイン領域ごとに実施します。
  実装情報を加味した、詳細な型定義を行います。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-design domain architecture --adaptation=default**:

- **Title**: ドメイン設計
- **Description**: ドメイン境界情報などを元に、ドメイン設計を行う。
- **Usage**: ドメイン境界線情報ファイルを入力として、ドメイン設計を行います。
  まずは粗い型定義を行い、全域性の原則を踏まえて設計します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-design domain architecture --adaptation=detail**:

- **Title**: ドメイン設計詳細版
- **Description**:
  ドメイン境界情報などを元に、ドメイン設計を行う。既存のドメイン情報を加味して詳細な型定義を行う。
- **Usage**: ドメイン情報をもとに、実装情報を加味した詳細な型定義を行います。
  既存のドメイン情報と新しいドメイン情報を統合して設計します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-design domain boundary --adaptation=code**:

- **Title**: ドメイン境界線設計（コードベース）
- **Description**: コードベースをもとに、ドメイン境界線を引く。
- **Usage**:
  現在の実装をもとに、ドメイン設計の境界線分析を行い、ドメイン境界線を設計します。
  実行コードをシミュレートして中心点を特定します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template

**climpt-design domain boundary --adaptation=default**:

- **Title**: ドメイン境界線設計
- **Description**: 粗い考えをもとに、ドメイン境界線を引いてみる。
- **Usage**:
  原案をもとに、ドメイン設計の境界線分析を行い、境界線そのものを設計します。
  中心極限定理に基づいて複数の中心点を特定します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text}`: Variable extracted from template

## climpt-docs

| directive       | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| generate-robust | instruction-doc | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-docs generate-robust instruction-doc --adaptation=default**:

- **Title**: Climpt プロンプト作成指示書
- **Description**:
  短い指示文からでも、既存情報を補完して高再現性の指示書を作成するための標準手順と品質基準を定める。
- **Usage**: 指示したい内容を入力として、既存レポジトリや関連資料を調査し、
  変更に強く再現性の高い指示書を作成します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text}`: Variable extracted from template
  - `{text_input}`: Variable extracted from template

## climpt-git

| directive     | layer             | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ------------- | ----------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze       | commit-history    | default   | default        | -                   | ✓                  | ✓               |
| create        | refinement-issue  | -         | default        | -                   | -                  | -               |
| decide-branch | working-branch    | -         | default        | -                   | -                  | -               |
| document      | fix-instruction   | default   | default        | -                   | ✓                  | -               |
| find-oldest   | descendant-branch | -         | default        | -                   | -                  | -               |
| group-commit  | unstaged-changes  | -         | default        | -                   | -                  | -               |
| list-select   | pr-branch         | -         | default        | -                   | -                  | -               |
| merge-cleanup | develop-branches  | -         | default        | -                   | -                  | -               |
| merge-up      | base-branch       | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-git analyze commit-history --adaptation=default**:

- **Title**: Analyze Commit History
- **Description**: Analyze git commit history and generate insights
- **Usage**: echo "main..feature" | climpt-git analyze commit-history
- **Variables**:
  - `{input_text}`: Variable extracted from template

**climpt-git create refinement-issue --adaptation=default**:

- **Title**: Create Refinement Issue
- **Description**: Create a refinement issue from requirements documentation
- **Usage**: Create refinement issues from requirement documents. Example:
  climpt-git create refinement-issue -f requirements.md
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-git decide-branch working-branch --adaptation=default**:

- **Title**: git branch の新規立ち上げ判断と、新ブランチ作成
- **Description**:
  作業内容に基づいてGitブランチの新規作成判断と適切なブランチ選択を行う
- **Usage**:
  今回の作業内容を30文字以内で指定して、適切なGitブランチの判断と作成を行います。
  現在のブランチとの近さ基準に基づいて最適なブランチを選択します。
- **Variables**:
  - `{input_text}`: Variable extracted from template

**climpt-git document fix-instruction --adaptation=default**:

- **Title**: 修正指示を文書化する
- **Description**: 問題点をまとめ、次の修正指示をGitのIssueへ登録する
- **Usage**: climpt-git document fix-instruction
- **Variables**:
  - `{input_text}`: Variable extracted from template

**climpt-git find-oldest descendant-branch --adaptation=default**:

- **Title**: Git関連ブランチ探索とマージ処理実行
- **Description**:
  現在のGitブランチから派生した子孫ブランチと兄弟ブランチを探索し、最も古い関連ブランチの作業状態を確認してマージ処理を実行
- **Usage**:
  現在のブランチから関連ブランチを探索し、作業が完了している最も古いブランチを
  元の親ブランチへマージするための処理を実行します。
- **Variables**:
  - `{
  # 子孫ブランチ（優先度: 1）
  子孫ブランチ一覧 | while read branch; do timestamp=$(echo $branch | grep -o
  '[0-9]\{8\}`: Variable extracted from template
  - `{
  echo "$descendant_branches" | while read branch; do
    ts=$(echo $branch | grep -o '[0-9]\{8\}`:
    Variable extracted from template
  - `{4\}`: Variable extracted from template
  - `{8\}`: Variable extracted from template

**climpt-git group-commit unstaged-changes --adaptation=default**:

- **Title**: 意味的近さでコミットを分けて実施する
- **Description**:
  Gitコミットを、ファイルの変更内容の意味的近さ単位でグループ化し、適切にまとめてコミットする
- **Usage**:
  ファイルの変更内容の意味的近さでグループ化し、複数回のコミット処理を連続実行します。
  まったく異なる内容を1つのコミットに含めることを避けます。

**climpt-git list-select pr-branch --adaptation=default**:

- **Title**: 現存のPRとブランチをリスト化して、次に作業する対象を選ぶ
- **Description**:
  ローカル・リモートブランチとPRを一覧化し、次に作業すべき対象を自動選択する
- **Usage**:
  現存のPRとブランチを一覧化して、次に作業すべき対象を自動選択します。
  選択結果に基づいて次の作業を進めます。

**climpt-git merge-cleanup develop-branches --adaptation=default**:

- **Title**: developにマージして不要なブランチを掃除する
- **Description**:
  mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。
- **Usage**:
  mergeされていないブランチを全てdevelopへ統合し、マージ後に削除します。
  作成順序と進捗状況を考慮して適切な順番でマージします。

**climpt-git merge-up base-branch --adaptation=default**:

- **Title**: 作業ブランチ間のマージ処理
- **Description**:
  作業ブランチから派生した作業ブランチを、元の作業ブランチへマージする。
- **Usage**:
  現在のブランチから分岐元ブランチを特定し、適切なマージ処理を実行します。
  未コミットファイルの処理も含めて安全にマージします。
- **Variables**:
  - `{ local current_branch=$1

  # 1. reflog に明示的な記録がある場合
  local explicit_parent=$(git reflog show
  $current_branch | grep "branch: Created from" | sed 's/.*Created from //' | grep -v HEAD)
  if [[ -n "$explicit_parent" ]]; then echo "$explicit_parent" return fi

  # 2. checkout 履歴から特定
  local checkout_from=$(git reflog --date=iso | grep -B1 "checkout:.*to
  $current_branch" | grep "checkout: moving from" | head -1 | sed 's/.*moving from \([^ ]*\).*/\1/')
  if [[ -n "$checkout_from" ]] && [[ "$checkout_from" != "$current_branch" ]];
  then echo "$checkout_from" return fi

  # 3. ブランチ名の階層構造から推定
  local hierarchical_parent=$(find_hierarchical_parent $current_branch)
  if [[ -n "$hierarchical_parent" ]]; then echo "$hierarchical_parent" return fi

  # 4. 最後の手段：develop（ただし警告を出す）
  echo "WARNING: Could not determine exact parent branch, defaulting to develop"
  > &2 echo "develop" }`: Variable extracted from template
  - `{print $1}`: Variable extracted from template
  - `{print $2, $3}`: Variable extracted from template

## climpt-meta

| directive  | layer               | input(-i)         | adaptation(-a)   | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ---------- | ------------------- | ----------------- | ---------------- | ------------------- | ------------------ | --------------- |
| build-list | command-registry    | claude            | claude           | -                   | -                  | ✓               |
| build-list | command-registry    | -                 | default          | -                   | -                  | -               |
| build-list | command-registry    | default, registry | default_registry | -                   | -                  | ✓               |
| resolve    | registered-commands | -                 | default          | -                   | -                  | -               |

### Command Details

**climpt-meta build-list command-registry --adaptation=claude**:

- **Title**: Climpt Available Commands List Generation (Claude Code Version)
- **Description**: Generates available commands list using Claude Code with
  shell scripting. Lists prompt files mechanically with sh, then analyzes each
  file content using claude -p in a loop.
- **Usage**: climpt list usage --adaptation=claude-code
- **Variables**:
  - `{
        "c1": "code",
        "c2": "create",
        "c3": "implementation",
        "description": "Create implementation from design documents"
      }`:
    Variable extracted from template
  - `{
        "c1": "code",
        "c2": "refactor",
        "c3": "architecture",
        "description": "Refactor code architecture based on patterns"
      }`:
    Variable extracted from template
  - `{
        "c1": "docs",
        "c2": "generate",
        "c3": "api-reference",
        "description": "Generate API reference documentation"
      }`:
    Variable extracted from template
  - `{
        "c1": "docs",
        "c2": "update",
        "c3": "user-guide",
        "description": "Update user guide documentation"
      }`:
    Variable extracted from template
  - `{
        "c1": "git",
        "c2": "analyze",
        "c3": "commit-history",
        "description": "Analyze commit history and generate insights"
      }`:
    Variable extracted from template
  - `{
        "c1": "meta",
        "c2": "list",
        "c3": "available-commands",
        "description": "List all available Climpt commands"
      }`:
    Variable extracted from template
  - `{
        "c1": "meta",
        "c2": "resolve",
        "c3": "command-definition",
        "description": "Resolve and display command definitions"
      }`:
    Variable extracted from template
  - `{
        "c1": "spec",
        "c2": "analyze",
        "c3": "quality-metrics",
        "description": "Analyze specification quality and completeness"
      }`:
    Variable extracted from template
  - `{
        "c1": "spec",
        "c2": "validate",
        "c3": "requirements",
        "description": "Validate requirements against standards"
      }`:
    Variable extracted from template
  - `{
        "c1": "test",
        "c2": "execute",
        "c3": "integration-suite",
        "description": "Execute integration test suite"
      }`:
    Variable extracted from template
  - `{
        "c1": "test",
        "c2": "generate",
        "c3": "unit-tests",
        "description": "Generate unit tests from specifications"
      }`:
    Variable extracted from template
  - `{
        "c1": string,         // Domain/category (git, spec, test, code, docs, meta)
        "c2": string,         // Action/directive (create, analyze, execute, etc.)
        "c3": string,         // Target/layer (refinement-issue, quality-metrics, etc.)
        "description": string,// Command description
        "usage": string,      // Usage instructions and examples
        "options": {          // Available options for this command
          "input": string[],     // Supported input formats
          "adaptation": string[], // Processing modes
          "input_file": boolean[],  // File input support
          "stdin": boolean[],       // Standard input support
          "destination": boolean[]  // Output destination support
        }`:
    Variable extracted from template
  - `{
    "has_input_file": boolean,
    "has_stdin": boolean,
    "has_destination": boolean,
    "user_variables": ["list of uv-* variables"]
  }`:
    Variable extracted from template
  - `{
  "has_frontmatter": boolean,
  "frontmatter": {
    "title": "string or null",
    "description": "string or null",
    "usage": "string or null"
  }`:
    Variable extracted from template
  - `{
  "version": "1.0.0",
  "description": "Climpt comprehensive configuration for MCP server and command registry",
  "tools": {
    "availableConfigs": [
      "code",
      "docs",
      "git",
      "meta",
      "spec",
      "test"
    ],
    "commands": [
      // Git commands
      {
        "c1": "git",
        "c2": "create",
        "c3": "refinement-issue",
        "description": "Create a refinement issue from requirements documentation",
        "usage": "Create refinement issues from requirement documents.\nExample: climpt-git create refinement-issue -f requirements.md",
        "options": {
          "input": ["MD"],
          "adaptation": ["default", "detailed"],
          "input_file": [true],
          "stdin": [false],
          "destination": [true]
        }`:
    Variable extracted from template
  - `{
  "version": string,           // Registry version (e.g., "1.0.0")
  "description": string,       // Overall registry description
  "tools": {
    // Tool names array - each becomes available as climpt-{name}`:
    Variable extracted from template
  - `{cmd}`: Variable extracted from template
  - `{command_name}`: Variable extracted from template
  - `{destination_path}`: Variable extracted from template
  - `{filename#f_}`: Variable extracted from template
  - `{input_file}`: Variable extracted from template
  - `{input_text}`: Variable extracted from template
  - `{prompt_file#.agent/climpt/prompts/}`: Variable extracted from template
  - `{uv-*}`: Variable extracted from template
  - `{variable}`: Variable extracted from template
  - `{variable_name}`: Variable extracted from template

**climpt-meta build-list command-registry --adaptation=default**:

- **Title**: Climpt 実行可能コマンドの一覧作成
- **Description**: 使用可能な Climpt
  リストを作成する。パラメータで渡した値をもとに、プロンプトテンプレートの変数を置換する。
- **Usage**: 使用可能なClimptコマンドの一覧を作成します。
  プロンプトテンプレートの変数置換機能も含めて説明します。
- **Variables**:
  - `{
                      "input_text": "今回のスコープを指定する",
                      "input_text_file": "ざっくり説明された情報を受け取る",
                      "destination_path": "出力先を複数ファイルで指定",
                      "uv-subdomain": "サブドメインのprefixを指定する"
                    }`:
    Variable extracted from template
  - `{
                      "type": "string",
                      "description": "フロントマターの説明文"
                    }`:
    Variable extracted from template
  - `{
                  "type": "boolean",
                  "description": "destination(-o)オプションの利用可否"
                }`:
    Variable extracted from template
  - `{
                  "type": "boolean",
                  "description": "input(-i)オプションの利用可否"
                }`:
    Variable extracted from template
  - `{
                  "type": "boolean",
                  "description": "input_text (STDIN)の利用可否"
                }`:
    Variable extracted from template
  - `{
                  "type": "boolean",
                  "description": "input_text_file(-f)オプションの利用可否"
                }`:
    Variable extracted from template
  - `{
                  "type": "object",
                  "description": "プロンプトで使用される変数（オプションで値が渡される）の説明",
                  "additionalProperties": {
                    "type": "string",
                    "description": "変数の説明文"
                  }`:
    Variable extracted from template
  - `{
                  "type": "object",
                  "description": "プロンプトファイルのフロントマター情報",
                  "properties": {
                    "title": {
                      "type": "string",
                      "description": "フロントマターのタイトル"
                    }`:
    Variable extracted from template
  - `{
                  "type": "string",
                  "description": "adaptation(-a)オプションの値（例: detail, core, subdomain）"
                }`:
    Variable extracted from template
  - `{
                  "type": "string",
                  "description": "レイヤー名（例: architecture, boundary）"
                }`:
    Variable extracted from template
  - `{
            "type": "array",
            "description": "プロンプトファイル単位の詳細説明",
            "items": {
              "type": "object",
              "properties": {
                "promptKey": {
                  "type": "string",
                  "description": "プロンプトの識別キー（例: 'domain architecture --adaptation=detail'）",
                  "pattern": "^[a-z]+ [a-z]+ --[a-z_]+=\\w+$"
                }`:
    Variable extracted from template
  - `{
            "type": "array",
            "description": "利用可能なオプションの組み合わせ",
            "items": {
              "type": "object",
              "properties": {
                "directive": {
                  "type": "string",
                  "description": "ディレクティブ名（例: domain）"
                }`:
    Variable extracted from template
  - `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Climpt Tools List Output Schema",
  "type": "object",
  "properties": {
    "commands": {
      "type": "array",
      "description": "実行可能なClimptコマンドの一覧",
      "items": {
        "type": "object",
        "properties": {
          "commandName": {
            "type": "string",
            "description": "コマンド名（例: climpt-design）",
            "pattern": "^climpt-[a-z0-9-]+$"
          }`:
    Variable extracted from template
  - `{variable}`: Variable extracted from template

**climpt-meta build-list command-registry --adaptation=default_registry**:

- **Title**: Climpt Registry.json Generation
- **Description**: Automatically generates a registry.json file for MCP server
  configuration by analyzing existing Climpt commands, configurations, and
  prompt files. Creates a comprehensive tool registry following the C3L (Climpt
  3-word Language) specification.
- **Usage**: climpt list usage --adaptation=registry
- **Variables**:
  - `{
                "type": "string",
                "description": "Action/directive",
                "pattern": "^[a-z][a-z0-9-]*$"
              }`:
    Variable extracted from template
  - `{
                "type": "string",
                "description": "Command description",
                "minLength": 10
              }`:
    Variable extracted from template
  - `{
                "type": "string",
                "description": "Example usage pattern",
                "pattern": "^climpt-[a-z][a-z0-9-]* .+"
              }`:
    Variable extracted from template
  - `{
                "type": "string",
                "description": "Human-readable tool description",
                "minLength": 10
              }`:
    Variable extracted from template
  - `{
                "type": "string",
                "description": "Target/layer",
                "pattern": "^[a-z][a-z0-9-]*$"
              }`:
    Variable extracted from template
  - `{
          "type": "array",
          "description": "C3L command registry",
          "items": {
            "type": "object",
            "required": ["c1", "c2", "c3", "description"],
            "properties": {
              "c1": {
                "type": "string",
                "description": "Domain/category",
                "pattern": "^[a-z][a-z0-9-]*$"
              }`:
    Variable extracted from template
  - `{
        "c1": "string", // Domain (git, spec, test, etc.)
        "c2": "string", // Action (create, analyze, etc.)
        "c3": "string", // Target (refinement-issue, etc.)
        "description": "string" // Command description
      }`:
    Variable extracted from template
  - `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Climpt MCP Registry Schema",
  "type": "object",
  "required": ["tools"],
  "properties": {
    "tools": {
      "type": "object",
      "required": ["availableConfigs", "commands"],
      "properties": {
        "availableConfigs": {
          "type": "array",
          "description": "Available tool configurations for MCP server",
          "items": {
            "type": "object",
            "required": ["name", "description", "usage"],
            "properties": {
              "name": {
                "type": "string",
                "description": "Tool identifier",
                "pattern": "^[a-z][a-z0-9-]*$",
                "examples": ["git", "spec", "test", "code", "docs", "meta"]
              }`:
    Variable extracted from template
  - `{
  "c1": "git",
  "c2": "create",
  "c3": "refinement-issue",
  "description": "Create a refinement issue from requirements documentation"
}`:
    Variable extracted from template
  - `{
  "name": "git",
  "description": "Git operations and repository management",
  "usage": "climpt-git create refinement-issue --from=requirements.md"
}`:
    Variable extracted from template
  - `{
  "tools": {
    "availableConfigs": [
      {
        "name": "string", // Tool identifier (e.g., "git")
        "description": "string", // Human-readable description
        "usage": "string" // Example usage with options
      }`:
    Variable extracted from template

**climpt-meta resolve registered-commands --adaptation=default**:

- **Title**: climpt実行コマンドを構築するclimpt
- **Description**: 渡された内容に相応しい climpt-* を構築し、示す。
- **Usage**:
  使いたいファイルリストや内容を入力として、適切なclimpt-*コマンドを構築して提示します。
  登録済みコマンドから最適なものを選択または新規提案します。
- **Variables**:
  - `{PRのCIも<br/>完了済み？}`: Variable extracted from template
  - `{deno task ci<br/>が完全にpass済み？}`: Variable extracted from template
  - `{deno task ci<br/>実行済み？}`: Variable extracted from template
  - `{input_text}`: Variable extracted from template
  - `{uv-*}`: Variable extracted from template
  - `{ブランチ統合のclimpt-*はあるか？}`: Variable extracted from template
  - `{仕掛かりブランチがあるか？}`: Variable extracted from template
  - `{既存のブランチ統合を実行する}`: Variable extracted from template

## climpt-refactor

| directive | layer        | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | --------- | -------------- | ------------------- | ------------------ | --------------- |
| basedon   | ddd          | -         | default        | -                   | -                  | -               |
| basedon   | ddd          | -         | nextaction     | -                   | -                  | -               |
| ddd       | architecture | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-refactor basedon ddd --adaptation=default**:

- **Title**: ドメイン駆動設計と全域性（Totality）に基づくリファクタリング
- **Description**:
  現在の実装をドメイン駆動設計と全域性（Totality）による設計で、堅牢になるようリファクタリングする
- **Usage**: ドメイン駆動設計とTotalityに基づくリファクタリングを実行します。
  ドメイン領域の明確な理解に基づき、型安全性を強化して実装します。

**climpt-refactor basedon ddd --adaptation=nextaction**:

- **Title**: ドメイン駆動設計と全域性（Totality）の融合完成 - ネクストアクション
- **Description**:
  実行済の結果から導き出したネクストアクションを進める。基本事項を維持した状態で、次アクションを指示する
- **Usage**:
  ドメイン駆動設計とTotalityに基づくリファクタリングの継続を実行します。
  ネクストアクションの指示書に基づいて処理を進めます。
- **Variables**:
  - `{input_text}`: Variable extracted from template
  - `{uv-scope}`: Variable extracted from template

**climpt-refactor ddd architecture --adaptation=default**:

- **Title**: ドメイン駆動設計の再設計
- **Description**:
  ドメイン設計のアーキテクチャを再設計する。要求をベースに、型安全性を強化して、骨格が通った芯の強いコード実装を再設計する
- **Usage**: ドメイン駆動設計の設計自体を堅牢になるようリファクタリングします。
  docs/domain/architecture.mdをシンプルで骨格の中心線が通った設計へ再設計します。

## climpt-spec

| directive         | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ----------------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze           | quality-metrics | default   | default        | ✓                   | -                  | ✓               |
| analyze-structure | requirements    | -         | default        | -                   | -                  | -               |

### Command Details

**climpt-spec analyze quality-metrics --adaptation=default**:

- **Title**: Analyze Specification Quality
- **Description**: Analyze specification quality and completeness metrics
- **Usage**: climpt-spec analyze quality-metrics -f spec.md -o report.json
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template

**climpt-spec analyze-structure requirements --adaptation=default**:

- **Title**: 要求をブレイクダウンし構造化する
- **Description**:
  要求のファイルをもとに、情報を整理して、構造化されたファイルを出力する
- **Usage**:
  要求のファイルをもとにプロセス分解とユーザーフローに基づいて構造化します。
  MosCow分析を含めて必須要件を明確化します。
- **Variables**:
  - `{destination_path}`: Variable extracted from template
  - `{input_text_file}`: Variable extracted from template
