---
c1: "debug"
c2: "trace-error"
c3: "cause-analysis"
title: "エラー実装へのデバッグ出力追加と要因分析"
description: "エラー実装にデバッグ出力を追加し、出力情報を元に根本要因を分析するための体系的手順書。DDD/TDD/Totality原則に基づくエラー処理実装の分析・改善作業"
usage: "inspector-debug trace-error cause-analysis"
options:
  input:
    - "error-log"
    - "json"
    - "text"
  adaptation:
    - "default"
    - "comprehensive"
    - "quick-analysis"
  input_file: true
  stdin: true
  destination: true
variables:
  - uv-error-component: 対象のエラー処理コンポーネント名
  - uv-analysis-scope: 分析対象とするエラーの範囲または条件
  - input_text_file: 分析対象のエラーログファイルパス
  - destination_path: 分析結果の出力先パス
version: "1.0"
date: "2025-09-22"
created_by: "climpt-docs generate-robust instruction-doc"
---

# エラー実装へのデバッグ出力追加と要因分析手順書

## 0. 目的・適用範囲

- **目的**:
  エラー処理の実装にデバッグ出力機能を追加し、出力されたデバッグ情報を体系的に分析することで、エラーの根本要因を特定し、効果的な解決策を導出する。
- **適用範囲**:
  本プロジェクトのDDD/TDD/Totality原則に基づくエラー処理実装に対する全般的な分析・改善作業。
- **非適用範囲**:
  インフラレベルの運用監視やリアルタイム性を要求するプロダクション環境のモニタリングシステム構築。

---

## 1. 不変条件（壊してはならない性質）

1. デバッグ出力は既存のエラー処理ロジックや型安全性を破壊しない（型システム整合性
   100%）。
2. 追加されるデバッグ情報は構造化され、JSON形式で出力可能である（構造化率
   100%）。
3. 本番環境では適切にログレベル制御され、パフォーマンス影響を最小化する（パフォーマンス劣化
   ≤ 5%）。
4. エラーコンテキストは失われることなく、トレーサビリティが保たれる（情報損失率
   = 0%）。
5. Result<T,E>パターンとの一貫性を維持する（型パターン適合率 100%）。

---

## 2. 入力・前提条件

- **入力**: `uv-error-component`, `uv-analysis-scope`, `input_text_file`,
  `destination_path`
- **前提**:
  - TypeScript/Deno環境が利用可能である
  - 既存のエラー型システム（DomainError、ValidationError等）が理解できる
  - LoggingServiceとDebugLoggerの実装パターンが把握できる
  - Result<T,E>パターンによるエラーハンドリングが理解できる
- **禁止事項**:
  - console.log等の直接的なコンソール出力は使用しない
  - 既存のエラー型定義を破壊的に変更しない

---

## 3. 前提情報リスト

### 3.1 プロジェクト構造

- **アーキテクチャ**: Domain-Driven Design (DDD) + Test-Driven Development
  (TDD) + Totality原則
- **言語**: TypeScript (Deno環境)
- **エラーハンドリング**: Result<T,E>パターンによる型安全なエラー処理
- **ログシステム**: EnhancedDebugLogger + LoggingServiceによる構造化ログ

### 3.2 既存エラー型システム

- **DomainError**: ValidationError, SchemaError, FrontmatterError,
  TemplateError, AggregationError, FileSystemError, SystemError,
  PerformanceError
- **エラー作成関数**: createError, createContextualError, createEnhancedError
- **型安全性**: 判別可能ユニオン(discriminated
  union)パターンでkindフィールドによる分岐

### 3.3 ログシステム構成

- **LoggingService**: インフラレイヤーの集約ログサービス
- **EnhancedDebugLogger**: CLI特化の拡張デバッグロガー
- **LogContext**: 構造化ログコンテキスト（時刻、操作、場所、進捗等）
- **ログレベル**: error, warn, info, debug, trace

---

## 4. 仮定リスト

1. 既存のエラー処理実装は型安全性が保たれており、破壊的変更は最小限に留める
2. デバッグ出力は開発・テスト環境での問題解決を主目的とし、本番運用の詳細監視は対象外
3. 分析対象エラーは再現可能な状況で発生している、または十分なログが蓄積されている

---

## 5. 手順

### 5.1 Git ブランチ準備

- Gitブランチ準備:
  `echo "feature/error-debug-output-implementation" | climpt-git decide-branch working-branch`
  を実行し、出力結果の指示に従う。

### 5.2 対象エラー実装の調査・特定

#### 5.2.1 エラー実装箇所の特定

1. **対象コンポーネント特定**:
   ```bash
   # uv-error-componentに関連するエラー実装を検索
   grep -r "uv-error-component" src/ --include="*.ts"
   ```

2. **エラー型定義の確認**:
   ```bash
   # 関連するDomainError型を特定
   grep -r "kind.*Error" src/domain/shared/types/errors.ts
   ```

3. **エラー発生箇所の特定**:
   ```bash
   # createError, createContextualError, createEnhancedErrorの使用箇所
   grep -r "createError\|createContextualError\|createEnhancedError" src/
   ```

#### 5.2.2 現在のエラーハンドリングパターン分析

1. **Result<T,E>パターンの使用状況確認**
2. **既存のエラーコンテキスト情報の評価**
3. **ログ出力の現状把握**

### 5.3 デバッグ出力機能の設計

#### 5.3.1 デバッグコンテキスト拡張

1. **ErrorContext拡張の設計**:
   - 呼び出しスタック情報
   - 処理時点でのアプリケーション状態
   - 入力データのスナップショット
   - パフォーマンス指標（メモリ使用量、処理時間）

2. **StructuredLogContextの活用**:
   ```typescript
   // 拡張例
   type ErrorAnalysisContext = StructuredLogContext & {
     errorDetails: {
       errorKind: string;
       stackTrace: string[];
       applicationState: Record<string, unknown>;
       inputSnapshot: unknown;
       performanceMetrics: {
         memoryUsage: number;
         processingTime: number;
         timestamp: string;
       };
     };
   };
   ```

#### 5.3.2 デバッグ可能なエラー作成関数の実装

1. **createDebuggableError関数の実装**:
   ```typescript
   export const createDebuggableError = <T extends DomainError>(
     error: T,
     context: ErrorContext,
     debugInfo: {
       stackTrace?: string[];
       applicationState?: Record<string, unknown>;
       inputData?: unknown;
       performanceMetrics?: PerformanceMetrics;
     },
     customMessage?: string,
   ): T & ErrorWithContext & { debugInfo: typeof debugInfo }
   ```

2. **既存関数との互換性保持**

### 5.4 ログ出力機能の強化

#### 5.4.1 LoggingServiceへのエラー解析機能追加

1. **logErrorAnalysis メソッドの実装**:
   ```typescript
   logErrorAnalysis(
     error: DomainError & ErrorWithContext,
     analysisLevel: "basic" | "detailed" | "comprehensive",
     correlationId?: string,
   ): void
   ```

2. **エラーパターン分析機能**:
   - 同種エラーの発生頻度
   - エラー発生のコンテキストパターン
   - パフォーマンス影響分析

#### 5.4.2 構造化エラーログの出力設計

1. **JSON形式での構造化出力**
2. **時系列分析可能な形式**
3. **外部分析ツール連携可能な形式**

### 5.5 実装・統合

#### 5.5.1 段階的実装

1. **Phase 1**: 基本的なデバッグ情報追加
2. **Phase 2**: 構造化ログ出力機能
3. **Phase 3**: 分析・レポート機能

#### 5.5.2 既存コードへの統合

1. **createEnhancedError関数の段階的置き換え**
2. **テストケースの更新**
3. **型定義の拡張**

### 5.6 デバッグ情報の出力・収集

#### 5.6.1 デバッグセッションの実行

1. **対象エラーの再現実行**:
   ```bash
   # デバッグレベルログを有効化して実行
   DEBUG_LEVEL=3 deno run --allow-all cli.ts [parameters]
   ```

2. **構造化ログの収集**:
   ```bash
   # ログ出力をJSONファイルに保存
   DEBUG_LEVEL=3 deno run --allow-all cli.ts [parameters] 2>error-debug.json
   ```

#### 5.6.2 ログ情報の構造化保存

1. **`input_text_file`からのエラーログ読み込み**
2. **時系列順でのソート・整理**
3. **相関関係のあるエラーのグルーピング**

### 5.7 要因分析の実行

#### 5.7.1 データパターン分析

1. **エラー発生頻度の分析**:
   - エラー種別ごとの発生回数
   - 時間帯別の発生傾向
   - 特定入力パターンとの相関

2. **コンテキスト分析**:
   - エラー発生時のアプリケーション状態
   - 処理フローでの発生位置
   - 前後の処理ステップとの関連性

#### 5.7.2 根本要因の特定

1. **5W1H分析の適用**:
   - When: エラー発生タイミング
   - Where: エラー発生箇所
   - What: エラーの内容・種類
   - Who: エラーに関与するコンポーネント
   - Why: エラー発生の直接的原因
   - How: エラー発生に至るプロセス

2. **因果関係の分析**:
   - 直接的原因の特定
   - 間接的要因の洗い出し
   - システム設計上の課題の抽出

#### 5.7.3 改善案の策定

1. **短期的対策**:
   - エラーハンドリングロジックの改善
   - バリデーション強化
   - エラーメッセージの改善

2. **中長期的改善**:
   - アーキテクチャレベルの見直し
   - 予防的機能の追加
   - 監視・早期発見機能の強化

### 5.8 分析結果の出力・報告

#### 5.8.1 分析レポートの作成

1. **`destination_path`への構造化レポート出力**:
   ```json
   {
     "analysisId": "uuid",
     "timestamp": "2025-09-22T12:00:00Z",
     "scope": "uv-analysis-scope",
     "summary": {
       "totalErrors": 42,
       "errorTypes": ["ValidationError", "SchemaError"],
       "criticalErrors": 3,
       "patterns": ["高頻度: 入力データ不正", "中頻度: スキーマ不整合"]
     },
     "detailedAnalysis": {
       "errorBreakdown": {...},
       "rootCauses": [...],
       "recommendations": [...]
     }
   }
   ```

2. **実行可能な改善提案**:
   - 具体的なコード修正案
   - テストケース追加提案
   - 監視強化提案

#### 5.8.2 継続的改善のための仕組み

1. **エラー分析の自動化検討**
2. **定期的な要因分析の実行計画**
3. **改善効果の測定方法**

---

## 6. 成果物定義

### 6.1 主成果物

- **拡張されたエラー実装**: デバッグ情報付きエラー作成関数群
- **強化されたログシステム**: エラー解析機能付きLoggingService
- **分析レポート**: 構造化された要因分析結果（`destination_path`に出力）

### 6.2 付録

- **用語集**: プロジェクト固有のエラー用語定義
- **禁止語一覧**: 使用を避けるべき曖昧な表現
- **変化点リスト**: 既存コードへの変更箇所一覧
- **レビュー票**: 実装品質確認チェックリスト

---

## 7. Definition of Done (DoD)

1. **機能完全性**:
   - すべての対象エラータイプにデバッグ出力が追加されている
   - 構造化ログ出力が正常に動作する
   - 分析レポートが期待される形式で出力される

2. **品質基準**:
   - 既存のテストがすべてパスする
   - 新規追加コードのテストカバレッジが80%以上
   - 型安全性が保たれている（TypeScriptコンパイルエラーなし）

3. **運用要件**:
   - 本番環境でのパフォーマンス影響が5%以下
   - ログレベル制御が適切に機能する
   - メモリリークが発生しない

---

## 8. 参照資料

### 8.1 必須の参照資料（コード変更用）

- **全域性原則**: `docs/development/totality.ja.md`
- **[AI複雑化防止（科学的制御）](docs/development/ai-complexity-control_compact.ja.md)**
- **[Prohibit-Hardcoding](prohibit-hardcoding.ja.md)**

### 8.2 技術参照資料

- **エラー型定義**: `src/domain/shared/types/errors.ts`
- **ログシステム**: `src/infrastructure/logging/logging-service.ts`
- **デバッグロガー**: `src/domain/shared/services/debug-logger.ts`
- **Result型パターン**: `src/domain/shared/types/result.ts`

### 8.3 設計原則資料

- **DDD実装ガイド**: `docs/architecture/README.md`
- **テスト戦略**: `docs/tests/README.md`
- **型安全性ガイドライン**: TypeScript公式ドキュメント

---

## 9. 品質検証方法（24本評価）

本指示書の品質は以下の方法で検証される：

- **正規化手順**: 記号除去 → 全半角統一 → 数値を`<NUM>`化 → 日本語2-gram化
- **類似度計算**:
  - レーベンシュタイン類似度: `sim_lev(a,b) = 1 - Lev(a,b) / max(|a|, |b|)`
  - ジャッカード係数（2-gram）: `sim_jac(A,B) = |A∩B| / |A∪B|`
  - 合成スコア: `sim(a,b) = 0.5*sim_lev + 0.5*sim_jac`
- **品質基準**: MedSim ≥ 0.82（中央値類似度）で確定
