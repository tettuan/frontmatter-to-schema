---
c1: "debug"
c2: "design-flow"
c3: "reproducible-steps"
title: "自然言語ワークフロー作成：再現可能デバッグ手順の体系化"
description: "Deno DDDプロジェクトにおいてデバッグ手順を自然言語ワークフローとして体系化し、XML構造化データへの変換を可能にする実装手順。BreakdownLogger統合による再現可能性の確立"
usage: "inspector-debug design-flow reproducible-steps"
options:
  input:
    - "workflow-template"
    - "markdown"
    - "yaml"
  adaptation:
    - "default"
    - "detailed"
    - "minimal"
  input_file: true
  stdin: false
  destination: true
variables:
  - uv-workflow-type: ワークフロータイプ（debug/test/validation/analysis）を指定する変数
  - uv-target-scope: 対象スコープ（component/integration/e2e）を指定する変数
  - uv-output-format: 出力フォーマット（xml/json/markdown）を指定する変数
  - destination_path: ワークフローファイルの出力先ディレクトリパス
version: "1.0"
date: "2025-09-25"
created_by: "inspector-debug design-flow reproducible-steps"
---

# 自然言語ワークフロー作成指示書：再現可能デバッグ手順の体系化

## 概要

本指示書は、Deno DDD
プロジェクトにおいてデバッグ手順を自然言語ワークフローとして体系化し、XML構造化データへの変換が可能な形式で
`docs/tests/debugs/*.workflow.md`
に記載する実装手順を定義する。BreakdownLoggerとの統合により再現可能なデバッグフローを確立し、トラブルシューティングの標準化と効率化を実現する。

## 前提情報リスト

**プロジェクト構造**:

- Deno + TypeScript + DDD + Totality原則
- 既存テスト環境: Unit/Integration/E2E（257テスト通過）
- BreakdownLogger統合済み（環境変数制御）
- デバッグ戦略ドキュメント:
  `docs/tests/test-debugging-strategy.md`、`docs/tests/breakdownlogger-integration.md`

**ワークフロー要求**:

- 自然言語記述による手順の明確化
- XML構造化データへの変換可能性
- 再現可能性95%以上の達成
- 段階的なデバッグプロセスの標準化

**技術制約**:

- `docs/tests/debugs/` ディレクトリ構造（新規作成）
- `*.workflow.md` ファイル命名規則
- XML変換互換性の確保
- BreakdownLoggerとの完全統合

## 仮定リスト

1. `docs/tests/debugs/` ディレクトリの新規作成が許可されている
2. ワークフローファイルの構造化記述が要求通りに実装される
3. XML変換用メタデータの埋め込みが技術的に実現可能
4. 既存のBreakdownLogger環境変数制御が継続利用される

## 手順

### 1. ディレクトリ構造の設計と作成

#### 1.1 基本ディレクトリ構造

```
docs/tests/debugs/
├── component/              # コンポーネント別デバッグワークフロー
│   ├── schema-validation.workflow.md
│   ├── template-rendering.workflow.md
│   └── frontmatter-parsing.workflow.md
├── integration/            # 統合テストデバッグワークフロー
│   ├── pipeline-orchestrator.workflow.md
│   ├── base-property-population.workflow.md
│   └── end-to-end-flow.workflow.md
├── e2e/                   # E2Eテストデバッグワークフロー
│   ├── cli-basic.workflow.md
│   ├── cli-validation.workflow.md
│   └── workflow-complete.workflow.md
└── meta/                  # メタワークフロー
    ├── workflow-template.workflow.md
    └── xml-conversion-guide.workflow.md
```

#### 1.2 ディレクトリ作成手順

- `docs/tests/debugs/` 基本ディレクトリ作成
- `{uv-target-scope}` に応じたサブディレクトリ作成
- テンプレートファイルの配置

### 2. 自然言語ワークフロー記述形式の標準化

#### 2.1 ワークフローファイル構造

```markdown
---
# XML変換メタデータ
workflow:
  id: "{workflow-unique-id}"
  type: "{uv-workflow-type}"
  scope: "{uv-target-scope}"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-{workflow-id}-{timestamp}.log"
  - evidence: "tmp/evidence-{workflow-id}.json"
---

# {ワークフロータイトル}

## 目的

{このワークフローが解決する具体的な問題}

## 前提条件

- [ ] 条件1: {具体的な前提条件}
- [ ] 条件2: {環境変数設定}
- [ ] 条件3: {必要なファイルの存在}

## 入力

- **対象**: {デバッグ対象の特定}
- **症状**: {問題の現象}
- **コンテキスト**: {発生状況}

## ワークフロー手順

### ステップ1: 初期確認

{xml:step id="step1" type="verification"}

1. {具体的な確認項目}
2. {実行コマンド例}
3. {期待される結果} {/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定: `export LOG_KEY={component-key} LOG_LEVEL=debug`
2. BreakdownLogger有効化確認
3. 出力先ディレクトリ確認: `mkdir -p tmp/` {/xml:step}

### ステップ3: 段階的調査

{xml:step id="step3" type="investigation"}

1. {第1段階の調査項目}
   - 実行コマンド: `{command}`
   - 確認ポイント: {check-points}
2. {第2段階の調査項目}
   - 実行コマンド: `{command}`
   - 確認ポイント: {check-points} {/xml:step}

### ステップ4: 問題特定

{xml:step id="step4" type="diagnosis"}

1. ログ分析: `{log-analysis-method}`
2. 症状パターン確認: {pattern-matching}
3. 根本原因仮説: {hypothesis}` {/xml:step}

### ステップ5: 検証・解決

{xml:step id="step5" type="resolution"}

1. 仮説検証: {verification-method}
2. 解決策適用: {solution-implementation}
3. 結果確認: {result-verification} {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-{workflow-id}-{timestamp}.log`
- **証跡データ**: `tmp/evidence-{workflow-id}.json`
- **解決策**: {solution-summary}

## 成功基準

- [ ] 問題の根本原因が特定されている
- [ ] 解決策が実装され、検証されている
- [ ] デバッグプロセスが完全に記録されている
- [ ] 再現手順が他者によって実行可能

## 関連ワークフロー

- [前処理ワークフロー](./prerequisite.workflow.md)
- [エラーハンドリング](./error-handling.workflow.md)
- [パフォーマンス分析](./performance-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: {common-issue-1}

- **症状**: {symptom}
- **原因**: {cause}
- **解決策**: {solution}

#### 問題2: {common-issue-2}

- **症状**: {symptom}
- **原因**: {cause}
- **解決策**: {solution}
```

#### 2.2 XML変換対応仕様

**XML構造化要素**:

- `{xml:step}` タグ: 各ステップの構造化
- `{xml:condition}` タグ: 条件分岐の明示
- `{xml:loop}` タグ: 反復処理の定義
- `{xml:data}` タグ: データ構造の記述

**変換可能性確保**:

- YAML フロントマターによるメタデータ定義
- 構造化コメントによるセマンティクス明示
- 標準化されたステップ記述形式

### 3. コンポーネント別ワークフロー実装

#### 3.1 基本コンポーネントワークフロー

**対象コンポーネント**:

- `schema-validation`: スキーマ検証ロジック
- `template-rendering`: テンプレート処理
- `frontmatter-parsing`: フロントマター抽出
- `aggregation-rules`: データ集約ロジック

#### 3.2 統合テストワークフロー

**対象統合テスト**:

- `pipeline-orchestrator`: 完全処理パイプライン
- `base-property-population`: ベースプロパティ設定
- `base-property-override`: フロントマター上書き

#### 3.3 E2Eワークフロー

**対象E2Eテスト**:

- `cli-basic`: 基本CLI機能
- `cli-validation`: CLI引数検証
- `end-to-end-flow`: 完全ワークフロー

### 4. XML変換システムの設計

#### 4.1 変換スクリプト作成

```typescript
// scripts/workflow-to-xml.ts
interface WorkflowMetadata {
  id: string;
  type: string;
  scope: string;
  version: string;
  xml_convertible: boolean;
}

interface WorkflowStep {
  id: string;
  type: "verification" | "setup" | "investigation" | "diagnosis" | "resolution";
  content: string;
  commands?: string[];
  checkpoints?: string[];
}

class WorkflowXMLConverter {
  convertMarkdownToXML(workflowPath: string): Result<string, ConversionError>;
  validateXMLStructure(xmlContent: string): Result<boolean, ValidationError>;
  generateXMLSchema(): string;
}
```

#### 4.2 XML出力形式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<workflow id="{workflow-id}" type="{workflow-type}" scope="{scope}" version="1.0">
  <metadata>
    <dependencies>
      <dependency name="breakdownlogger" version="^1.0.0"/>
    </dependencies>
    <environment_vars>
      <var name="LOG_KEY" required="true"/>
      <var name="LOG_LENGTH" default="S"/>
      <var name="LOG_LEVEL" default="info"/>
    </environment_vars>
  </metadata>

  <purpose>{workflow-purpose}</purpose>

  <prerequisites>
    <condition id="1">{condition-description}</condition>
    <condition id="2">{condition-description}</condition>
  </prerequisites>

  <steps>
    <step id="step1" type="verification">
      <title>{step-title}</title>
      <actions>
        <action type="command">{command}</action>
        <action type="verify">{verification}</action>
      </actions>
      <expected_result>{expected-result}</expected_result>
    </step>
    <!-- Additional steps -->
  </steps>

  <outputs>
    <output type="log" path="tmp/debug-{workflow-id}-{timestamp}.log"/>
    <output type="evidence" path="tmp/evidence-{workflow-id}.json"/>
  </outputs>

  <success_criteria>
    <criterion>{success-criterion-1}</criterion>
    <criterion>{success-criterion-2}</criterion>
  </success_criteria>
</workflow>
```

### 5. BreakdownLogger統合強化

#### 5.1 ワークフロー専用ログキー

```bash
# ワークフロー専用ログキー体系
LOG_KEY=workflow-{workflow-type}-{component}

# 例
LOG_KEY=workflow-debug-schema-validation
LOG_KEY=workflow-test-pipeline-orchestrator
LOG_KEY=workflow-analysis-performance
```

#### 5.2 ワークフロー実行スクリプト

```bash
#!/bin/bash
# scripts/run-workflow.sh

WORKFLOW_FILE=${1}
WORKFLOW_TYPE=${2:-"debug"}
TARGET_SCOPE=${3:-"component"}

# 環境変数設定
export LOG_KEY="workflow-${WORKFLOW_TYPE}-$(basename ${WORKFLOW_FILE} .workflow.md)"
export LOG_LENGTH=${LOG_LENGTH:-"L"}
export LOG_LEVEL=${LOG_LEVEL:-"debug"}

# ワークフロー実行
echo "Executing workflow: ${WORKFLOW_FILE}"
echo "Log key: ${LOG_KEY}"

# ワークフロー内容の解析と実行
# (実際の実装では、ワークフローファイルを解析して自動実行)
```

### 6. 品質保証と検証

#### 6.1 ワークフロー検証項目

- **再現性**: 同一環境での実行結果一致率≥95%
- **完全性**: 全ステップの実行可能性確認
- **XML変換**: 構造化データの正確性検証
- **統合性**: BreakdownLoggerとの連携確認

#### 6.2 自動検証スクリプト

```bash
# scripts/validate-workflows.sh
#!/bin/bash

echo "ワークフロー検証開始..."

for workflow in docs/tests/debugs/**/*.workflow.md; do
  echo "検証中: $workflow"

  # フロントマター検証
  if ! grep -q "xml_convertible: true" "$workflow"; then
    echo "❌ XML変換メタデータ不足: $workflow"
    continue
  fi

  # ステップ構造検証
  if ! grep -q "{xml:step" "$workflow"; then
    echo "❌ XML構造タグ不足: $workflow"
    continue
  fi

  echo "✅ 検証成功: $workflow"
done

echo "ワークフロー検証完了"
```

## 品質基準

### 完了条件

1. **ディレクトリ構造**: `docs/tests/debugs/` 配下の体系的整備完了
2. **ワークフローファイル**: 主要コンポーネント別ワークフロー作成完了
3. **XML変換対応**: 全ワークフローのXML変換可能性確認
4. **BreakdownLogger統合**: 環境変数制御との完全統合確認
5. **再現性検証**: 第三者による実行成功率≥95%達成

### 検証方法

```bash
# 基本ワークフロー実行テスト
./scripts/run-workflow.sh docs/tests/debugs/component/schema-validation.workflow.md debug component

# XML変換テスト
deno run --allow-read --allow-write scripts/workflow-to-xml.ts docs/tests/debugs/component/schema-validation.workflow.md

# 再現性確認
LOG_KEY=workflow-debug-schema-validation LOG_LEVEL=debug deno test tests/unit/domain/schema/
```

## 成果物定義

### 主成果物

1. **ワークフローディレクトリ**: `docs/tests/debugs/` 完全構造
2. **ワークフローファイル**: 全主要コンポーネント対応（12+ファイル）
3. **XML変換スクリプト**: TypeScript実装
4. **実行管理スクリプト**: Bash実装
5. **検証システム**: 自動品質確認機能

### 付録

- **ワークフローテンプレート**: 新規作成用標準フォーマット
- **XML変換仕様書**: 詳細技術仕様
- **BreakdownLogger統合ガイド**: 環境変数制御リファレンス
- **トラブルシューティングマニュアル**: よくある問題と解決策

## 参照資料

### 必須参照（コード変更用）

- **全域性原則**: `docs/development/totality.md`
- **[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control.md)**

### プロジェクト固有資料

- **[テストデバッグ戦略](docs/tests/test-debugging-strategy.md)**:
  包括的デバッグアプローチ
- **[BreakdownLogger統合ガイド](docs/tests/breakdownlogger-integration.md)**:
  実装済み統合パターン
- **[テストガイドライン](docs/tests/testing_guidelines.md)**: TDD実践と実装指針
- **[包括的テスト戦略](docs/testing/comprehensive-test-strategy.md)**:
  全体テストアプローチ

### 技術標準資料

- **XML 1.0 仕様**: W3C XML仕様準拠
- **YAML 1.2 仕様**: フロントマターメタデータ形式
- **Markdown CommonMark**: 基本記述フォーマット

## DoD (Definition of Done)

- [ ] 不変条件（再現性≥95%、曖昧語≤2%、用語統一100%、トレーサビリティ100%）を満たすこと
- [ ] 前提情報リストが網羅されていること
- [ ] `docs/tests/debugs/` ディレクトリ構造完全実装
- [ ] 主要コンポーネント別ワークフロー作成完了（12+ファイル）
- [ ] XML変換スクリプト実装・動作確認済み
- [ ] BreakdownLogger統合確認済み
- [ ] 再現性検証（第三者実行）成功
- [ ] 自動検証システム稼働確認
