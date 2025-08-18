# Climpt Commands Registry

## climpt-build

| directive | layer | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ----- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| robust    | code  | -         | default        | ✓                   | ✓                  | -               |
| robust    | test  | -         | default        | ✓                   | ✓                  | -               |
| robust    | test  | -         | strict         | ✓                   | ✓                  | -               |

**climpt-build robust test default**: testを強固に構築する input_text_file:
ざっくり説明された情報を受け取る input_text: 今回のスコープを指定する

**climpt-build robust test strict**: 強固で堅牢なテスト構築指示書
input_text_file: ざっくり説明された情報を受け取る input_text:
今回のスコープを指定する uv-test-scope: test-scopeのprefixを指定する

**climpt-build robust code default**: APIを強固に構築する input_text_file:
ざっくり説明された情報を受け取る input_text: 今回のスコープを指定する

## climpt-design

| directive | layer        | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | --------- | -------------- | ------------------- | ------------------ | --------------- |
| domain    | architecture | -         | default        | ✓                   | -                  | ✓               |
| domain    | architecture | core      | default        | ✓                   | -                  | ✓               |
| domain    | architecture | detail    | default        | ✓                   | -                  | ✓               |
| domain    | boundary     | -         | default        | -                   | ✓                  | ✓               |
| domain    | boundary     | code      | default        | -                   | -                  | ✓               |

**climpt-design domain boundary default**:
コードベースをもとに、ドメイン境界線を引く。 destination_path:
出力先を複数ファイルで指定

**climpt-design domain architecture default**:
ドメイン境界情報などを元に、ドメイン設計を行う。既存のドメイン情報を加味して詳細な型定義を行う。
input_text_file: ざっくり説明された情報を受け取る destination_path:
出力先を複数ファイルで指定

## climpt-docs

| directive       | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| generate-robust | instruction-doc | -         | default        | -                   | ✓                  | ✓               |

**climpt-docs generate-robust instruction-doc default**: Climpt
プロンプト作成指示書
短い指示文からでも、既存情報を補完して高再現性の指示書を作成するための標準手順と品質基準を定める。
input_text: 今回のスコープを指定する destination_path:
出力先を複数ファイルで指定

## climpt-git

| directive     | layer             | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ------------- | ----------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| decide-branch | working-branch    | -         | default        | -                   | ✓                  | -               |
| find-oldest   | descendant-branch | -         | default        | -                   | -                  | -               |
| group-commit  | unstaged-changes  | -         | default        | -                   | -                  | -               |
| list-select   | pr-branch         | -         | default        | -                   | -                  | -               |
| merge-cleanup | develop-branches  | -         | default        | -                   | -                  | -               |
| merge-up      | base-branch       | -         | default        | -                   | -                  | -               |
| analyze       | commit-history    | -         | default        | -                   | ✓                  | -               |
| create        | refinement-issue  | -         | default        | ✓                   | -                  | ✓               |

**climpt-git decide-branch working-branch default**: git branch
の新規立ち上げ判断と、新ブランチ作成 input_text: 今回のスコープを指定する

**climpt-git list-select pr-branch default**:
現存のPRとブランチをリスト化して、次に作業する対象を選ぶ

**climpt-git find-oldest descendant-branch default**:
Git関連ブランチ探索とマージ処理実行

**climpt-git merge-cleanup develop-branches default**:
developにマージして不要なブランチを掃除する
mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。

**climpt-git group-commit unstaged-changes default**:
意味的近さでコミットを分けて実施する

**climpt-git merge-up base-branch default**: 作業ブランチ間のマージ処理
作業ブランチから派生した作業ブランチを、元の作業ブランチへマージする。

**climpt-git analyze commit-history default**: Analyze Commit History
Analyze git commit history and generate insights
Usage: echo "main..feature" | climpt-git analyze commit-history
input_text: 今回のスコープを指定する

**climpt-git create refinement-issue default**: Create Refinement Issue
Create a refinement issue from requirements documentation
Usage: climpt-git create refinement-issue -f requirements.md
input_text_file: ざっくり説明された情報を受け取る destination_path: 出力先を複数ファイルで指定

## climpt-meta

| directive  | layer            | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ---------- | ---------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| resolve    | registered-commands | -       | default        | -                   | ✓                  | -               |
| list       | available-commands | -        | default        | -                   | ✓                  | -               |
| build-list | command-registry | -         | default        | -                   | -                  | -               |
| build-list | command-registry | -         | registry       | -                   | -                  | -               |
| build-list | command-registry | claude    | default        | -                   | ✓                  | ✓               |

**climpt-meta build-list command-registry default**: Climpt Available Commands
List Generation (Claude Code Version) Generates available commands list using
Claude Code with shell scripting. Lists prompt files mechanically with sh, then
analyzes each file content using claude -p in a loop. Usage: climpt list usage
--adaptation=claude-code input_text: 今回のスコープを指定する destination_path:
出力先を複数ファイルで指定 uv-*: *のprefixを指定する

**climpt-meta resolve registered-commands default**: climpt実行コマンドを構築するclimpt
渡された内容に相応しい climpt-* を構築し、示す。
input_text: 今回のスコープを指定する

**climpt-meta list available-commands default**: List Available Commands
List all available Climpt commands and their options
Usage: climpt-meta list available-commands
input_text: 今回のスコープを指定する

**climpt-meta build-list command-registry default**: Climpt 実行可能コマンドの一覧作成

**climpt-meta build-list command-registry registry**: Climpt Registry.json
Generation Automatically generates a registry.json file for MCP server
configuration by analyzing existing Climpt commands, configurations, and prompt
files. Creates a comprehensive tool registry following the C3L (Climpt 3-word
Language) specification. Usage: climpt list usage --adaptation=registry

**climpt-meta build-list command-registry claude**: Climpt Available Commands
List Generation (Claude Code Version) Generates available commands list using
Claude Code with shell scripting. Lists prompt files mechanically with sh, then
analyzes each file content using claude -p in a loop. Usage: climpt list usage
--adaptation=claude-code input_text: 今回のスコープを指定する destination_path:
出力先を複数ファイルで指定 uv-*: *のprefixを指定する

## climpt-refactor

| directive | layer        | input(-i)  | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | ---------- | -------------- | ------------------- | ------------------ | --------------- |
| basedon   | ddd          | nextaction | default        | -                   | ✓                  | -               |
| basedon   | ddd          | -          | default        | -                   | -                  | -               |
| ddd       | architecture | -          | default        | -                   | -                  | -               |

**climpt-refactor ddd architecture default**:

**climpt-refactor basedon ddd default**:
ドメイン駆動設計と全域性（Totality）に基づくリファクタリング

## climpt-spec

| directive | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze   | quality-metrics | -         | default        | ✓                   | -                  | ✓               |

**climpt-spec analyze quality-metrics default**: Analyze Specification Quality
Analyze specification quality and completeness metrics
Usage: climpt-spec analyze quality-metrics -f spec.md -o report.json
input_text_file: ざっくり説明された情報を受け取る destination_path: 出力先を複数ファイルで指定
