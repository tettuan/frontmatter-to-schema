# 0.basic - 基本機能デモンストレーション

frontmatter-to-schemaの基本的な機能を実証する最小限の例です。

## 概要

この例は、以下の基本機能を実証します：

1. **フロントマター抽出**: Markdownファイルからフロントマターを抽出
2. **スキーマ検証**: JSON Schemaによる構造検証
3. **テンプレート処理**: 変数展開と出力生成
4. **ディレクティブ処理**: `x-derived-from`と`x-frontmatter-part`の動作

## ディレクトリ構成

```
0.basic/
├── command1.md              # gitコマンド定義
├── command2.md              # specコマンド定義
├── registry_schema.json     # メインスキーマ（x-derived-from定義含む）
├── command_schema.json      # 個別コマンドスキーマ
├── registry_template.json   # メインテンプレート
├── command_template.json    # 個別コマンドテンプレート
├── run.sh                   # 実行スクリプト
└── output.json             # 生成される出力ファイル
```

## 入力ファイル

### command1.md

```yaml
---
c1: git
c2: create
c3: branch
title: Create Git Branch
description: Create a new git branch for feature development
usage: "git checkout -b feature/new-feature"
options:
  input: ["string"]
  adaptation: ["default"]
  input_file: [false]
  stdin: [false]
  destination: [false]
---
```

### command2.md

```yaml
---
c1: spec
c2: analyze
c3: quality-metrics
title: Analyze Quality Metrics
description: Analyze code quality metrics from specifications
usage: "climpt spec analyze quality-metrics --input=spec.md"
options:
  input: ["file", "stdin"]
  adaptation: ["default", "detailed"]
  input_file: [true]
  stdin: [true]
  destination: [true, false]
---
```

## スキーマ定義の要点

### registry_schema.json

- `x-template`: メインテンプレートファイルを指定
- `x-template-items`: 個別要素テンプレートを指定
- `x-frontmatter-part: true`:
  `tools.commands`配列が各ファイルのフロントマターから生成
- `x-derived-from: "tools.commands[].c1"`: commandsのc1フィールドから値を集約
- `x-derived-unique: true`: 重複を削除

## 成功の定義

### 1. フロントマター抽出の成功

- command1.mdとcommand2.mdの両方からフロントマターが抽出される
- YAMLフォーマットが正しく解析される
- 全てのフィールド（c1, c2, c3, title, description, usage, options）が抽出される

### 2. スキーマ検証の成功

- 抽出されたデータが`command_schema.json`に準拠している
- 必須フィールド（c1, c2, c3, description, usage, options）が存在する
- データ型が正しい（stringやarray等）

### 3. x-frontmatter-part処理の成功

- `tools.commands`配列に2つのコマンドが追加される
- 各ファイルのフロントマターが個別の要素として処理される

### 4. x-derived-from処理の成功

- `tools.availableConfigs`が`["git", "spec"]`になる
- commandsのc1フィールド（"git", "spec"）から値が集約される
- `x-derived-unique: true`により重複が削除される

### 5. テンプレート展開の成功

- `{version}`が"1.0.0"に置換される
- `{description}`が"Basic command registry example"に置換される
- `{@items}`がcommandsの各要素に展開される
- 個別コマンドテンプレートが適用される

## 期待される出力

```json
{
  "version": "1.0.0",
  "description": "Basic command registry example",
  "tools": {
    "availableConfigs": ["git", "spec"], // ← x-derived-fromによる集約結果
    "commands": [
      {
        "c1": "git",
        "c2": "create",
        "c3": "branch",
        "title": "Create Git Branch",
        "description": "Create a new git branch for feature development",
        "usage": "git checkout -b feature/new-feature",
        "options": {
          "input": ["string"],
          "adaptation": ["default"],
          "input_file": [false],
          "stdin": [false],
          "destination": [false]
        }
      },
      {
        "c1": "spec",
        "c2": "analyze",
        "c3": "quality-metrics",
        "title": "Analyze Quality Metrics",
        "description": "Analyze code quality metrics from specifications",
        "usage": "climpt spec analyze quality-metrics --input=spec.md",
        "options": {
          "input": ["file", "stdin"],
          "adaptation": ["default", "detailed"],
          "input_file": [true],
          "stdin": [true],
          "destination": [true, false]
        }
      }
    ]
  }
}
```

## 実行方法

```bash
# プロジェクトルートから実行
bash examples/0.basic/run.sh

# または直接CLIで実行
./cli.ts \
  examples/0.basic/registry_schema.json \
  "examples/0.basic/command*.md" \
  examples/0.basic/output.json \
  --verbose
```

## 検証ポイント

1. **基本的な変換**: フロントマター → JSON
2. **スキーマ駆動**: スキーマに基づいた検証と構造化
3. **テンプレート適用**: 出力形式の制御
4. **ディレクティブ**: x-frontmatter-partとx-derived-fromの動作確認

## この例が実証すること

- frontmatter-to-schemaの最小限の動作例
- スキーマとテンプレートの基本的な関係
- 複数ファイルからの集約処理
- ディレクティブによる拡張処理の基礎
