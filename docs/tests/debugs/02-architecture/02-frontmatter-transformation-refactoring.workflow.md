---
# XML変換メタデータ
workflow:
  id: "frontmatter-transformation-refactoring"
  type: "architecture-analysis"
  scope: "domain-service"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
  - inspector: "inspector-debug analyze-deep project-issues"
outputs:
  - debug_logs: "tmp/debug-frontmatter-refactoring-{timestamp}.log"
  - evidence: "tmp/evidence-frontmatter-service-analysis.json"
  - issue_update: "GitHub Issue #1059"
---

# FrontmatterTransformationService 責任分離リファクタリング分析ワークフロー

## 目的

FrontmatterTransformationService（2392行、284分岐）の責任過多問題を解決するため、DDD原則に基づくサービス分離戦略を分析し、実装可能なリファクタリングプランを作成する。

## 前提条件

- [ ] 条件1: Issue #1059が作成されている
- [ ] 条件2: inspector-debug analyze-deep project-issuesが実行可能
- [ ] 条件3: 既存テストスイートが397テスト通過状態
- [ ] 条件4: BreakdownLogger環境変数設定済み

## 入力

- **対象**:
  `src/domain/frontmatter/services/frontmatter-transformation-service.ts`
- **症状**: 単一責任原則違反、284分岐による複雑度過多
- **コンテキスト**: DDD設計原則との乖離、24実行例パターンの過剰集約

## ワークフロー手順

### ステップ1: 現状分析・複雑度測定

{xml:step id="step1" type="verification"}

1. ファイルサイズ確認
   ```bash
   wc -l src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

2. 分岐数測定
   ```bash
   grep -c -E "if\s*\(|else|switch\s*\(|case\s|[?]|&&|\|\|" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

3. クラス・メソッド構造分析
   ```bash
   export LOG_KEY=frontmatter-service-analysis LOG_LEVEL=debug
   mcp-serena get-symbols-overview src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

期待される結果: 2392行、284分岐の確認

{/xml:step}

### ステップ2: 責任領域の特定

{xml:step id="step2" type="investigation"}

1. import文分析による依存関係把握
   ```bash
   head -50 src/domain/frontmatter/services/frontmatter-transformation-service.ts | grep "import"
   ```

2. 24実行例パターンとの対応分析
   - 基本処理パターン (1-8): フロントマター抽出、Schema解析
   - エラーハンドリングパターン (9-16): ValidationError、SchemaError
   - 複雑処理パターン (17-24): 大量データ、ネスト、多段階処理

3. メソッド責任の分類
   ```bash
   export LOG_KEY=method-responsibility-analysis
   grep -n "public\|private.*(" src/domain/frontmatter/services/frontmatter-transformation-service.ts
   ```

{/xml:step}

### ステップ3: DDD原則に基づく分離設計

{xml:step id="step3" type="diagnosis"}

1. サブドメイン境界の特定
   - **Extraction Domain**: フロントマター抽出専門
   - **Validation Domain**: バリデーション・型安全性
   - **Transformation Domain**: データ変換・構造化
   - **Integration Domain**: 外部サービス統合

2. 分離後サービス設計
   ```typescript
   // 設計案
   class FrontmatterExtractionService     // 抽出専門 (~400行)
   class FrontmatterValidationService     // バリデーション専門 (~300行)
   class DataTransformationService        // データ変換専門 (~500行)
   class ProcessingCoordinationService    // 統合調整専門 (~200行)
   ```

3. 既存テストへの影響分析
   ```bash
   find tests -name "*frontmatter-transformation-service*test.ts"
   ```

{/xml:step}

### ステップ4: 段階的リファクタリング計画

{xml:step id="step4" type="resolution"}

1. **Phase 1**: インターフェース抽出
   - 現在のpublicメソッドをインターフェースとして定義
   - 外部依存への影響最小化

2. **Phase 2**: 責任別クラス分離
   - Extract Method → Extract Class パターン適用
   - 各サービス独立実装

3. **Phase 3**: 統合・テスト更新
   - ProcessingCoordinationServiceでの統合
   - テストスイート更新・検証

実装検証コマンド:

```bash
# 分離後の構造検証
export LOG_KEY=refactoring-verification LOG_LEVEL=info
deno test --allow-all tests/unit/domain/frontmatter/services/
```

{/xml:step}

### ステップ5: Issue進捗更新

{xml:step id="step5" type="documentation"}

1. GitHub Issue #1059への進捗報告
   ```bash
   gh issue comment 1059 --body "## リファクタリング分析完了

   **分析結果**:
   - 現状: 2392行、284分岐
   - 分離案: 4サービスに責任分散
   - 推定分離後: 各400-500行以下

   **次段階**: Phase 1インターフェース抽出を開始"
   ```

2. ワークフロー実行ログの保存
   ```bash
   echo "$(date): Workflow completed" >> tmp/frontmatter-refactoring-progress.log
   ```

{/xml:step}

## 出力

- **分析レポート**: `tmp/evidence-frontmatter-service-analysis.json`
- **リファクタリング計画**: 段階的実装ロードマップ
- **Issue更新**: GitHub Issue #1059への進捗反映

## 成功基準

- [ ] 284分岐の責任領域分類が完了している
- [ ] 4つの専門サービスへの分離設計が明確化されている
- [ ] 既存テストへの影響が最小限に抑制されている
- [ ] Issue #1059に具体的なリファクタリング計画が記載されている

## 関連ワークフロー

- [Totality原則検証](./01-totality-verification.workflow.md)
- [DDD境界分析](../component/domain-boundary-analysis.workflow.md)
- [テスト影響分析](../integration/test-impact-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 依存関係の循環参照

- **症状**: 分離後サービス間で相互依存が発生
- **原因**: ドメイン境界の不明確さ
- **解決策**: Dependency Inversionパターン適用、共通インターフェース定義

#### 問題2: テスト実行時間の大幅増加

- **症状**: 分離後のテスト実行が2倍以上に増加
- **原因**: サービス間統合テストの追加負荷
- **解決策**: テスト並列実行、MockService活用による分離テスト

#### 問題3: 既存API互換性の破綻

- **症状**: 分離後に外部呼び出し元でコンパイルエラー
- **原因**: publicメソッドシグネチャの変更
- **解決策**: Facade Pattern適用、段階的移行期間の設定
