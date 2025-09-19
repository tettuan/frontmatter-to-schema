# Climpt Commands Registry

## climpt-build

| directive | layer | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ----- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| robust    | code  | -         | default        | ✓                   | ✓                  | -               |
| robust    | test  | -         | default        | ✓                   | ✓                  | -               |
| robust    | test  | -         | strict         | ✓                   | ✓                  | -               |

**climpt-build robust test default**: testを強固に構築する
ドメイン駆動設計と全域性（Totality）原則に基づいた、強固で堅牢なテスト構築を行う
Usage: 強固に構築すべき機能要件ファイルと追加指示を入力として、
ドメイン駆動設計に基づいた堅牢なテストを構築します。

input_text_file: ざっくり説明された情報を受け取る input_text:
今回のスコープを指定する

**climpt-build robust test strict**: 強固で堅牢なテスト構築指示書
変更に強く、再現性が高く、保守性に優れたテストコードを構築し、ビジネスロジックの品質を確実に保証する
Usage:
テスト対象機能の仕様書ファイルと追加要件を入力として、強固で堅牢なテストコードを構築します。
テスト範囲（unit/integration/e2e）を指定して実行してください。

input_text_file: ざっくり説明された情報を受け取る input_text:
今回のスコープを指定する uv-test-scope: test-scopeのprefixを指定する

**climpt-build robust code default**: APIを強固に構築する input_text_file:
ざっくり説明された情報を受け取る input_text: 今回のスコープを指定する

## climpt-debug

| directive    | layer          | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ------------ | -------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze-deep | project-issues | -         | default        | -                   | -                  | -               |

**climpt-debug analyze-deep project-issues default**:
プロジェクト全体の深掘り調査と修正タスク洗い出し
プロジェクト全体を深く調査し、リファクタ課題や重複コード、修正すべき問題を洗い出し、ドメイン駆動設計からテスト駆動設計への移行を支援する
Usage: プロジェクト全体の深掘り調査と修正タスクの洗い出しを実行します。
既存のissue一覧を確認し、適切な処理を行います。

## climpt-design

| directive | layer        | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | --------- | -------------- | ------------------- | ------------------ | --------------- |
| domain    | architecture | -         | default        | ✓                   | -                  | ✓               |
| domain    | architecture | core      | default        | ✓                   | -                  | ✓               |
| domain    | architecture | detail    | default        | ✓                   | -                  | ✓               |
| domain    | boundary     | -         | default        | -                   | ✓                  | ✓               |
| domain    | boundary     | code      | default        | -                   | -                  | ✓               |

**climpt-design domain boundary default**: ドメイン境界線設計（コードベース）
コードベースをもとに、ドメイン境界線を引く。 Usage:
現在の実装をもとに、ドメイン設計の境界線分析を行い、ドメイン境界線を設計します。
実行コードをシミュレートして中心点を特定します。

destination_path: 出力先を複数ファイルで指定

**climpt-design domain architecture default**: ドメイン設計詳細版
ドメイン境界情報などを元に、ドメイン設計を行う。既存のドメイン情報を加味して詳細な型定義を行う。
Usage: ドメイン情報をもとに、実装情報を加味した詳細な型定義を行います。
既存のドメイン情報と新しいドメイン情報を統合して設計します。

input_text_file: ざっくり説明された情報を受け取る destination_path:
出力先を複数ファイルで指定

## climpt-docs

| directive       | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| generate-robust | instruction-doc | -         | default        | -                   | ✓                  | ✓               |

**climpt-docs generate-robust instruction-doc default**: Climpt
プロンプト作成指示書
短い指示文からでも、既存情報を補完して高再現性の指示書を作成するための標準手順と品質基準を定める。
Usage: 指示したい内容を入力として、既存レポジトリや関連資料を調査し、
変更に強く再現性の高い指示書を作成します。

input_text: 今回のスコープを指定する destination_path:
出力先を複数ファイルで指定

## climpt-git

| directive     | layer             | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ------------- | ----------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze       | commit-history    | -         | default        | -                   | ✓                  | -               |
| create        | refinement-issue  | -         | default        | ✓                   | -                  | ✓               |
| decide-branch | working-branch    | -         | default        | -                   | ✓                  | -               |
| document      | fix-instruction   | -         | default        | -                   | ✓                  | -               |
| find-oldest   | descendant-branch | -         | default        | -                   | -                  | -               |
| group-commit  | unstaged-changes  | -         | default        | -                   | -                  | -               |
| list-select   | pr-branch         | -         | default        | -                   | -                  | -               |
| merge-cleanup | develop-branches  | -         | default        | -                   | -                  | -               |
| merge-up      | base-branch       | -         | default        | -                   | -                  | -               |

**climpt-git decide-branch working-branch default**: git branch
の新規立ち上げ判断と、新ブランチ作成
作業内容に基づいてGitブランチの新規作成判断と適切なブランチ選択を行う Usage:
今回の作業内容を30文字以内で指定して、適切なGitブランチの判断と作成を行います。
現在のブランチとの近さ基準に基づいて最適なブランチを選択します。

input_text: 今回のスコープを指定する

**climpt-git list-select pr-branch default**:
現存のPRとブランチをリスト化して、次に作業する対象を選ぶ
ローカル・リモートブランチとPRを一覧化し、次に作業すべき対象を自動選択する
Usage: 現存のPRとブランチを一覧化して、次に作業すべき対象を自動選択します。
選択結果に基づいて次の作業を進めます。

**climpt-git find-oldest descendant-branch default**:
Git関連ブランチ探索とマージ処理実行
現在のGitブランチから派生した子孫ブランチと兄弟ブランチを探索し、最も古い関連ブランチの作業状態を確認してマージ処理を実行
Usage:
現在のブランチから関連ブランチを探索し、作業が完了している最も古いブランチを
元の親ブランチへマージするための処理を実行します。

**climpt-git document fix-instruction default**: 修正指示を文書化する
問題点をまとめ、次の修正指示をGitのIssueへ登録する Usage: climpt-git document
fix-instruction input_text: 今回のスコープを指定する

**climpt-git merge-cleanup develop-branches default**:
developにマージして不要なブランチを掃除する
mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。 Usage:
mergeされていないブランチを全てdevelopへ統合し、マージ後に削除します。
作成順序と進捗状況を考慮して適切な順番でマージします。

**climpt-git group-commit unstaged-changes default**:
意味的近さでコミットを分けて実施する
Gitコミットを、ファイルの変更内容の意味的近さ単位でグループ化し、適切にまとめてコミットする
Usage:
ファイルの変更内容の意味的近さでグループ化し、複数回のコミット処理を連続実行します。
まったく異なる内容を1つのコミットに含めることを避けます。

**climpt-git analyze commit-history default**: Analyze Commit History Analyze
git commit history and generate insights Usage: echo "main..feature" |
climpt-git analyze commit-history input_text: 今回のスコープを指定する

**climpt-git merge-up base-branch default**: 作業ブランチ間のマージ処理
作業ブランチから派生した作業ブランチを、元の作業ブランチへマージする。 Usage:
現在のブランチから分岐元ブランチを特定し、適切なマージ処理を実行します。
未コミットファイルの処理も含めて安全にマージします。

**climpt-git create refinement-issue default**: Create Refinement Issue Create a
refinement issue from requirements documentation Usage: Create refinement issues
from requirement documents. Example: climpt-git create refinement-issue -f
requirements.md

input_text_file: ざっくり説明された情報を受け取る destination_path:
出力先を複数ファイルで指定

## climpt-meta

| directive  | layer               | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ---------- | ------------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| build-list | command-registry    | -         | default        | -                   | -                  | -               |
| build-list | command-registry    | -         | registry       | -                   | -                  | -               |
| build-list | command-registry    | claude    | default        | -                   | ✓                  | ✓               |
| resolve    | registered-commands | -         | default        | -                   | ✓                  | -               |

**climpt-meta resolve registered-commands default**:
climpt実行コマンドを構築するclimpt 渡された内容に相応しい climpt-*
を構築し、示す。 Usage:
使いたいファイルリストや内容を入力として、適切なclimpt-*コマンドを構築して提示します。
登録済みコマンドから最適なものを選択または新規提案します。

input_text: 今回のスコープを指定する uv-*: *のprefixを指定する

**climpt-meta build-list command-registry default**: Climpt Available Commands
List Generation (Claude Code Version) Generates available commands list using
Claude Code with shell scripting. Lists prompt files mechanically with sh, then
analyzes each file content using claude -p in a loop. Usage: climpt list usage
--adaptation=claude-code input_text: 今回のスコープを指定する destination_path:
出力先を複数ファイルで指定 uv-*: *のprefixを指定する

**climpt-meta build-list command-registry registry**: Climpt Registry.json
Generation Automatically generates a registry.json file for MCP server
configuration by analyzing existing Climpt commands, configurations, and prompt
files. Creates a comprehensive tool registry following the C3L (Climpt 3-word
Language) specification. Usage: climpt list usage --adaptation=registry

## climpt-refactor

| directive | layer        | input(-i)  | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ------------ | ---------- | -------------- | ------------------- | ------------------ | --------------- |
| basedon   | ddd          | nextaction | default        | -                   | ✓                  | -               |
| basedon   | ddd          | -          | default        | -                   | -                  | -               |
| basedon   | requirements | -          | default        | -                   | -                  | -               |
| ddd       | architecture | -          | default        | -                   | -                  | -               |

**climpt-refactor ddd architecture default**: ドメイン駆動設計の再設計
ドメイン設計のアーキテクチャを再設計する。要求をベースに、型安全性を強化して、骨格が通った芯の強いコード実装を再設計する
Usage: ドメイン駆動設計の設計自体を堅牢になるようリファクタリングします。
docs/domain/architecture.mdをシンプルで骨格の中心線が通った設計へ再設計します。

**climpt-refactor basedon ddd default**:
ドメイン駆動設計と全域性（Totality）に基づくリファクタリング
現在の実装をドメイン駆動設計と全域性（Totality）による設計で、堅牢になるようリファクタリングする
Usage: ドメイン駆動設計とTotalityに基づくリファクタリングを実行します。
ドメイン領域の明確な理解に基づき、型安全性を強化して実装します。

**climpt-refactor basedon requirements default**: 要求に基づくリファクタリング
現在の実装を要求に基づいて、要求実現に必要なリファクタリングをする Usage:
climpt-refactor basedon requirement

## climpt-requirements

| directive | layer | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| --------- | ----- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| draft     | entry | -         | default        | -                   | -                  | -               |

**climpt-requirements draft entry default**: requirement entry Usage:
climpt-requirement basedon ddd -o refactor_plan.md

## climpt-spec

| directive         | layer           | input(-i) | adaptation(-a) | input_text_file(-f) | input_text (STDIN) | destination(-o) |
| ----------------- | --------------- | --------- | -------------- | ------------------- | ------------------ | --------------- |
| analyze           | quality-metrics | -         | default        | ✓                   | -                  | ✓               |
| analyze-structure | requirements    | -         | default        | ✓                   | -                  | ✓               |

**climpt-spec analyze-structure requirements default**:
要求をブレイクダウンし構造化する
要求のファイルをもとに、情報を整理して、構造化されたファイルを出力する Usage:
要求のファイルをもとにプロセス分解とユーザーフローに基づいて構造化します。
MosCow分析を含めて必須要件を明確化します。

input_text_file: ざっくり説明された情報を受け取る destination_path:
出力先を複数ファイルで指定

**climpt-spec analyze quality-metrics default**: Analyze Specification Quality
Analyze specification quality and completeness metrics Usage: climpt-spec
analyze quality-metrics -f spec.md -o report.json input_text_file:
ざっくり説明された情報を受け取る destination_path: 出力先を複数ファイルで指定
