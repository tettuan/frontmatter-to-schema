---
title: "ハードコーディング禁止規定"
description: "ソースコードにおける固定値直書きを禁止し、保守性・セキュリティ・環境依存排除を担保する規定"
compliance_level: strict
version: 1.0
last_updated: 2025-08-19
scope:
  - Python
  - TypeScript
  - Node.js
  - Frontend (React, Next.js)
enforcement:
  - code_review: true
  - CI/CD_check: true
  - secret_scan: true
prohibited_items:
  - API keys
  - passwords
  - URLs and file paths
  - magic numbers
  - environment-dependent values
recommendations:
  - use_env_vars: true
  - use_config_files: true
  - inject_external_values: true
---

# ハードコーディング禁止規定

## 第1条（目的）

本規定は、ソースコードの可読性、保守性、セキュリティ、及び環境依存性を排除するため、ハードコーディングを禁止することを目的とする。

## 第2条（定義）

1. 「ハードコーディング」とは、ソースコード内に固定値を直接記述する行為を指す。
2. 固定値には、数値、文字列、パス、URL、認証情報、環境依存設定その他すべての定数的情報を含む。

## 第3条（禁止事項）

以下の行為を禁止する。違反が確認された場合、修正が完了するまでコードのレビュー承認及びマージを認めない。

1. APIキー、認証情報、パスワードをソースコードに直接記述すること
2. 環境ごとに異なる値（例：URL、ポート番号、ファイルパス等）をコードに固定すること
3. 意味を持たない数値（マジックナンバー）を直接記述すること
4. 設定ファイル・環境変数で管理すべき値をソースコードに記述すること

## 第4条（遵守方法）

1. 定数・設定値は必ず以下のいずれかの方法により管理し、コードに直書きしてはならない。
   - 設定ファイル（例：YAML, JSON, TOML 等）
   - 環境変数（例：`.env` ファイル、CI/CD の Secret 管理）
   - 定数定義ファイル（例：`constants.go`, `config.py`）
   - データベースや外部システム
2. 環境に依存する値は、外部から注入できる設計としなければならない。

## 第5条（レビュー義務）

1. コードレビューにおいて、レビュアーはハードコーディングの有無を必ず確認する義務を負う。
2. 違反が発見された場合、当該コードは修正されるまで承認してはならない。

## 第6条（罰則）

1. 本規定への違反が確認された場合、以下の措置を適用する。
   - **初回違反**：当該プルリクエストの差し戻し、修正完了までレビュー保留
   - **再違反**：当該開発者に対するコード品質指導、並びに追加レビュー義務付け
   - **重大違反（認証情報の直書き等）**：直ちにリポジトリから当該コードを削除し、秘密情報の失効処理を行う。さらに、違反者に対しプロジェクト管理者から正式な警告を発する
2. 罰則措置は、プロジェクト管理者またはレビューチームが判断し執行するものとする。

## 第7条（自動化による検出と強制措置）

1. 本規定の遵守を担保するため、CI/CD
   パイプラインにおいて自動チェックを実施する。
   - **静的解析ツール**により、ソースコード中の固定値（APIキー、URL、パス、マジックナンバー等）を検出する。
   - **Secret Scan** 機能を利用し、認証情報の直書きを自動的にブロックする。
   - **Lint ルール**や **正規表現検出**を導入し、禁止事項を検出する。
2. CI/CD チェックにおいて違反が検出された場合、以下の措置を適用する。
   - **ビルド失敗扱い**とし、当該ブランチのマージを禁止する。
   - レポートを開発者およびレビューチームに自動通知する。
   - 秘密情報が検出された場合は、直ちにリポジトリ履歴から削除し、該当 Secret
     を失効させる。
3. 自動化による検出結果はレビュー記録として保存され、違反履歴として管理する。

## 第8条（違反例：Python）

```python
# ❌ 規定違反例
API_KEY = "abcd1234"  
URL = "http://localhost:8080/api"
```

## 第9条（適正例：Python）

```python
# ✅ 規定遵守例
import os

API_KEY = os.getenv("API_KEY")
URL = os.getenv("API_URL")
```

## 第10条（違反例：TypeScript）

```typescript
// ❌ 規定違反例
const API_KEY = "abcd1234";
const BASE_URL = "http://localhost:3000/api";

function fetchData() {
  return fetch(`${BASE_URL}/data?key=${API_KEY}`);
}
```

## 第11条（適正例：TypeScript）

```typescript
// ✅ 規定遵守例
const API_KEY = process.env.API_KEY ?? "";
const BASE_URL = process.env.API_URL ?? "";

function fetchData() {
  return fetch(`${BASE_URL}/data?key=${API_KEY}`);
}
```

### 備考

- TypeScript/JavaScript の場合、Node.js 実行環境では **`process.env`**
  を用いる。
- フロントエンド（React, Next.js
  等）の場合は、**ビルド時に環境変数を注入**する仕組みを利用すること（例：`NEXT_PUBLIC_`
  プレフィックス）。
- CI/CD パイプラインでは **環境変数の注入と Secret 管理** を必須とする。

---

本規定は、すべての開発者が遵守しなければならない。\
違反は重大なセキュリティリスク及び保守コスト増大を招くため、いかなる理由においても例外を認めない。\
また、自動化による検出により違反が明示された場合、その責任は当該コードを提出した開発者に帰属する。
