---
# XML変換メタデータ
workflow:
  id: "duplicate-code-refactor-941"
  type: "refactor"
  scope: "component"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-duplicate-code-{timestamp}.log"
  - evidence: "tmp/evidence-duplicate-code.json"
---

# ProcessingCoordinator重複コードリファクタリングワークフロー

## 目的

Issue #941で特定されたProcessingCoordinator内の重複コードパターンを体系的にリファクタリングし、DRY原則に準拠した実装に改善する。

## 前提条件

- [ ] Issue #941が登録済み
- [ ] 現在のテストカバレッジ80%以上
- [ ] TypeScriptコンパイル成功
- [ ] git developブランチが最新

## 入力

- **対象**: `src/application/coordinators/processing-coordinator.ts`
- **症状**: 4つのprocessDocuments系メソッドで同一パターンの重複
- **コンテキスト**: 300箇所以上のエラーハンドリング重複パターン

## ワークフロー手順

### ステップ1: 現状分析と影響範囲確認

{xml:step id="step1" type="verification"}

1. 重複パターンの特定
   ```bash
   grep -n "processDocuments\|processResult.ok\|return err" src/application/coordinators/processing-coordinator.ts
   ```

2. テストカバレッジ確認
   ```bash
   deno task test:coverage | grep -A5 "processing-coordinator"
   ```

3. 依存関係の確認
   ```bash
   grep -r "ProcessingCoordinator" src/ --include="*.ts" | wc -l
   ```

期待される結果: 4つのメソッドで同一パターン確認、依存箇所リスト出力
{/xml:step}

### ステップ2: デバッグ環境設定

{xml:step id="step2" type="setup"}

1. 環境変数設定
   ```bash
   export LOG_KEY=refactor-processing-coordinator
   export LOG_LEVEL=debug
   export LOG_LENGTH=L
   ```

2. BreakdownLogger統合確認
   ```bash
   grep -n "BreakdownLogger\|logger" src/application/coordinators/processing-coordinator.ts
   ```

3. 作業ブランチ作成
   ```bash
   git checkout -b refactor/issue-941-dry-principle
   ```
{/xml:step}

### ステップ3: 段階的リファクタリング計画

{xml:step id="step3" type="investigation"}

1. 共通処理パターンの抽出
   - processDocuments()呼び出し
   - Result型チェック
   - エラー早期リターン
   - 追加処理実行

2. 抽象化設計
   - BaseProcessingStrategyインターフェース定義
   - 処理ステップのComposition化
   - エラーハンドリングユーティリティ作成

3. 影響テストの特定
   ```bash
   grep -l "processDocumentsWithFullExtraction\|processDocumentsWithExtractFrom" tests/**/*_test.ts
   ```
{/xml:step}

### ステップ4: リファクタリング実装

{xml:step id="step4" type="diagnosis"}

1. 共通基底クラス/ユーティリティ作成
   ```typescript
   // src/application/coordinators/processing-base.ts
   abstract class ProcessingBase {
     protected async executeWithProcessing<T>(
       processFunc: () => Promise<Result<FrontmatterData, DomainError>>,
       postProcess: (data: FrontmatterData) => Promise<Result<T, DomainError>>
     ): Promise<Result<T, DomainError>> {
       const result = await processFunc();
       if (!result.ok) return result;
       return postProcess(result.data);
     }
   }
   ```

2. 各メソッドのリファクタリング
   - processDocumentsWithExtractFrom
   - processDocumentsWithItemsExtraction
   - processDocumentsWithFullExtraction

3. エラーハンドリング統一
   ```typescript
   // src/application/utils/error-handler.ts
   export const handleResult = <T, E>(result: Result<T, E>): T | never => {
     if (!result.ok) throw new ProcessingError(result.error);
     return result.data;
   };
   ```
{/xml:step}

### ステップ5: 検証と品質確認

{xml:step id="step5" type="resolution"}

1. テスト実行
   ```bash
   deno test tests/unit/application/coordinators/ --allow-all
   ```

2. カバレッジ確認
   ```bash
   deno task test:coverage
   ```

3. TypeScript型チェック
   ```bash
   deno check src/application/coordinators/processing-coordinator.ts
   ```

4. 重複削減の測定
   ```bash
   # Before
   wc -l src/application/coordinators/processing-coordinator.ts
   # After
   wc -l src/application/coordinators/processing-coordinator.ts
   ```
{/xml:step}

## 出力

- **ログファイル**: `tmp/debug-duplicate-code-{timestamp}.log`
- **証跡データ**: `tmp/evidence-duplicate-code.json`
- **解決策**: 共通処理の基底クラス化、エラーハンドリングユーティリティの統一

## 成功基準

- [ ] 重複コード行数50%以上削減
- [ ] 全テスト通過（カバレッジ80%以上維持）
- [ ] TypeScriptコンパイルエラーなし
- [ ] パフォーマンス劣化なし（±5%以内）

## 関連ワークフロー

- [エラーハンドリング統一](./error-handling-unification.workflow.md)
- [テスト駆動リファクタリング](./tdd-refactoring.workflow.md)
- [パフォーマンス影響分析](./performance-impact-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: テスト失敗

- **症状**: リファクタリング後に既存テストが失敗
- **原因**: メソッドシグネチャの変更、内部実装の仮定崩れ
- **解決策**: テストのモック/スタブを更新、実装の後方互換性維持

#### 問題2: 型エラー

- **症状**: TypeScriptコンパイルエラー
- **原因**: ジェネリック型の不整合、Result型の扱い
- **解決策**: 型パラメータの明示的指定、型ガードの追加