---
workflow:
  id: "unused-services-integration"
  type: "architecture-debug"
  scope: "integration"
  version: "1.0"
  xml_convertible: true
dependencies:
  - breakdownlogger: "@tettuan/breakdownlogger@^1.0.0"
  - environment_vars: ["LOG_KEY", "LOG_LENGTH", "LOG_LEVEL"]
outputs:
  - debug_logs: "tmp/debug-unused-services-{timestamp}.log"
  - evidence: "tmp/evidence-unused-services.json"
---

# 未使用サービス統合デバッグワークフロー

## 目的

DocumentProcessingOrchestrator、ParallelProcessingService、MemoryBoundsServiceが作成されたが、既存コードに統合されていない問題を特定し、統合戦略を立案する。

## 前提条件

- [ ] 条件1: 最新のfeature/issue-1080-ddd-tdd-comprehensive-refactorブランチ
- [ ] 条件2: 環境変数設定（LOG_KEY=unused-services）
- [ ] 条件3: tmp/ディレクトリの存在

## 入力

- **対象**: DocumentProcessingOrchestrator, ParallelProcessingService,
  MemoryBoundsService
- **症状**: 作成済みファイルが一切使用されていない
- **コンテキスト**: リファクタリング途中で統合が未完了

## ワークフロー手順

### ステップ1: 未使用サービスの特定

{xml:step id="step1" type="verification"}

1. 新規作成されたサービスファイルの確認
   ```bash
   ls -la src/domain/frontmatter/services/document-processing-orchestrator.ts
   ls -la src/domain/frontmatter/services/parallel-processing-service.ts
   ls -la src/infrastructure/monitoring/memory-bounds-service.ts
   ```

2. importの有無を確認
   ```bash
   grep -r "import.*DocumentProcessingOrchestrator" src/ --include="*.ts"
   grep -r "import.*ParallelProcessingService" src/ --include="*.ts"
   grep -r "import.*MemoryBoundsService" src/ --include="*.ts"
   ```

3. 期待される結果: importが存在しないことの確認 {/xml:step}

### ステップ2: 統合ポイントの特定

{xml:step id="step2" type="investigation"}

1. FrontmatterTransformationServiceの責任分析
   ```bash
   grep -n "class\|async\|public" src/domain/frontmatter/services/frontmatter-transformation-service.ts | head -20
   ```

2. 102個のif文の分布確認
   ```bash
   grep -n "if \|else if" src/domain/frontmatter/services/frontmatter-transformation-service.ts | wc -l
   ```

3. 統合可能な責任の特定
   - ファイル処理 → DocumentProcessingOrchestrator
   - 並列処理 → ParallelProcessingService
   - メモリ管理 → MemoryBoundsService {/xml:step}

### ステップ3: テストカバレッジの確認

{xml:step id="step3" type="verification"}

1. 新サービスのテスト実行
   ```bash
   LOG_LEVEL=debug deno test --allow-all tests/unit/domain/frontmatter/services/document-processing-orchestrator_test.ts
   LOG_LEVEL=debug deno test --allow-all tests/unit/domain/frontmatter/services/parallel-processing-service_test.ts
   ```

2. カバレッジ確認
   ```bash
   deno test --allow-all --coverage=tmp/cov tests/unit/domain/frontmatter/services/
   deno coverage --html tmp/cov
   ```

{/xml:step}

### ステップ4: 統合戦略の立案

{xml:step id="step4" type="diagnosis"}

1. 責任分離パターンの適用
   - Strategy Pattern: 処理戦略の切り替え
   - Chain of Responsibility: 処理の連鎖
   - Observer Pattern: イベント駆動統合

2. 段階的統合計画
   - Phase 1: DocumentProcessingOrchestratorへのファイル処理移譲
   - Phase 2: ParallelProcessingServiceによる並列化
   - Phase 3: MemoryBoundsServiceのモニタリング統合

3. リスク評価
   - 既存テストへの影響
   - パフォーマンスへの影響
   - 互換性の維持 {/xml:step}

### ステップ5: 統合実装と検証

{xml:step id="step5" type="resolution"}

1. 最小限の統合実装
   ```typescript
   // FrontmatterTransformationServiceでの使用例
   import { DocumentProcessingOrchestrator } from "./document-processing-orchestrator.ts";
   ```

2. 統合テストの実行
   ```bash
   LOG_KEY=integration-test LOG_LEVEL=debug deno test --allow-all tests/integration/
   ```

3. 結果確認とロールバック準備 {/xml:step}

## 出力

- **ログファイル**: `tmp/debug-unused-services-{timestamp}.log`
- **証跡データ**: `tmp/evidence-unused-services.json`
- **解決策**: 段階的統合計画の実装

## 成功基準

- [ ] 未使用サービスの統合ポイントが特定されている
- [ ] 統合による影響範囲が明確になっている
- [ ] 段階的統合計画が文書化されている
- [ ] 統合後のテストが全て成功する

## 関連ワークフロー

- [02-frontmatter-transformation-refactoring.workflow.md](./02-frontmatter-transformation-refactoring.workflow.md)
- [04-service-complexity-analysis.workflow.md](./04-service-complexity-analysis.workflow.md)
- [05-hardcoding-violation-analysis.workflow.md](./05-hardcoding-violation-analysis.workflow.md)

## トラブルシューティング

### よくある問題

#### 問題1: 循環依存の発生

- **症状**: import時にCircular dependency detected
- **原因**: 相互参照による依存関係の循環
- **解決策**: インターフェース分離またはDependency Injection

#### 問題2: テスト失敗の増加

- **症状**: 統合後に既存テストが失敗
- **原因**: 責任分離による処理フローの変更
- **解決策**: モックの更新とテストの再構築
