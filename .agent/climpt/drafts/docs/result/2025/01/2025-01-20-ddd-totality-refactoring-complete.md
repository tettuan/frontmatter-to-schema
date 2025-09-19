---
title: "DDD/Totality Refactoring Completion - Type Safety Transformation Guide"
variables:
  - input_text: "Target codebase requiring DDD/Totality transformation"
  - destination_path: "Path to source files requiring refactoring"
  - uv-layer: "Architectural layer (domain/application/infrastructure)"
created: 2025-01-20
version: 1.0
status: complete
---

# DDD/Totality Refactoring Completion - Type Safety Transformation Guide

## 概要

本指示書は、TypeScript/Denoプロジェクトにおけるドメイン駆動設計（DDD）と全域性（Totality）原則に基づく包括的なリファクタリング手法を記載する。型安全性の強化、unsafe
type
assertionの体系的除去、Result<T,E>パターンの一貫適用により、堅牢で保守性の高いアーキテクチャを実現する。

## 前提情報リスト

### プロジェクト構造

- **ドメイン**: `src/domain/` -
  純粋なビジネスロジック、エンティティ、値オブジェクト
- **アプリケーション**: `src/application/` -
  ユースケース、パイプライン、コマンド
- **インフラストラクチャ**: `src/infrastructure/` -
  外部システム連携、ファイルI/O
- **プレゼンテーション**: `src/presentation/` - CLI、HTTP等のインターフェース

### 技術スタック

- **言語**: TypeScript with Deno runtime
- **テスト**: Deno標準テストフレームワーク（283テストケース）
- **CI/CD**: 5段階パイプライン（TypeCheck, JSR互換性, テスト実行, Lint, Format）
- **品質管理**: 100%型安全性、Result<T,E>パターン、discriminated unions

### 全域性原則

- **部分関数の排除**: すべての関数は全ての入力に対して適切な出力を返す
- **Optional撲滅**: `undefined | T` 型をdiscriminated unionで置換
- **型安全性**: `as` type assertionの体系的除去

## 指示内容

### Phase 1: 事前調査と優先順位付け

1. **型assertion調査の実行**
   ```bash
   # 全ファイルの型assertion検出
   rg "as\s+[A-Z]|as any|as unknown|as Record" src/ --type ts
   ```

2. **優先度分類の実施**
   - **Priority 1**: Core domain files (6ファイル) - ビジネスロジックの中核
   - **Priority 2**: Application layer (8ファイル) - ユースケースとパイプライン
   - **Priority 3**: Infrastructure layer - 外部境界での型変換

3. **現状分析レポートの作成**
   - 検出された型assertionの総数
   - ファイル別のassert密度
   - critical pathの特定

### Phase 2: SafePropertyAccessパターンの確立

1. **共通ユーティリティの活用**
   ```typescript
   // Before: 危険な型assertion
   const obj = data as Record<string, unknown>;

   // After: 安全なパターン
   const objResult = SafePropertyAccess.asRecord(data);
   if (!objResult.ok) {
     return err(createError({
       kind: "InvalidType",
       message: "Expected object type",
     }));
   }
   const obj = objResult.data;
   ```

2. **Result<T,E>パターンの徹底**
   - すべての変換処理でResult型を返却
   - エラーハンドリングの明示化
   - 失敗時の適切なエラー情報提供

### Phase 3: 段階的refactoring実行

1. **Priority 1 - Domain Layer**
   - `format-config-loader.ts` - 11個の型assertion除去
   - `configuration-loader.ts` - 4個の型assertion除去
   - `domain-logger.ts` - 2個の型assertion除去
   - `jmespath-filter-service.ts` - 境界assertion検証
   - `safe-property-access.ts` - 基盤assertion検証
   - `load-schema-command.ts` - インターフェース型不整合修正

2. **Priority 2 - Application Layer**
   - `pipeline-config-accessor.ts` - 3/4個のassertion除去（1個は許容可能）
   - `resolve-template-command.ts` - 3個のassertion除去
   - `process-documents-command.ts` - 2個のassertion除去
   - `prepare-data-command.ts` - 2個のassertion除去
   - `render-output-command.ts` - 2個のassertion除去
   - `pipeline-state-machine.ts` - 2個のassertion除去（smart constructor使用）
   - `initialize-command.ts` - 1個のassertion除去
   - `pipeline-orchestrator-context.ts` - 1個のassertion除去

3. **Priority 3 - Infrastructure & Additional Domain**
   - `aggregator.ts` - globalThis debug assertion修正
   - `path-segment.ts` - property access assertion修正（Result unwrapping重要）
   - `variable-context.ts` - deprecated method assertion修正
   - `markdown-formatter.ts` - formatter assertion修正
   - `template-structure-analyzer.ts` - 構造解析assertion修正
   - `validation-rules.ts` - debug code assertion修正
   - `variable-replacer.ts` - 2個のassertion除去
   - `variable-replacement-strategy.ts` - 1個のassertion除去

### Phase 4: State Guard パターンの適用

1. **Discriminated Union強化**
   ```typescript
   // Before: Extract型assertionの使用
   const state = currentState as Extract<PipelineState, { kind: "processing" }>;

   // After: State guardの使用
   if (!PipelineStateGuards.isProcessing(currentState)) {
     return err(createError({
       kind: "ConfigurationError",
       message: "Invalid state for processing",
     }));
   }
   const state = currentState; // 型安全に確定
   ```

2. **Pipeline状態管理の強化**
   - 各CommandでcanExecute()による事前検証
   - State guard経由での型安全なstate access
   - 不正状態遷移の排除

### Phase 5: テスト維持とCI確保

1. **継続的検証の実施**
   ```bash
   # 各修正後の即座な検証
   deno check {modified_file}
   deno test --allow-all {related_test_file}
   ```

2. **回帰テスト防止策**
   - 283テストケースの全実行維持
   - CI pipeline（5段階）の緑維持
   - performance benchmarkの劣化防止

3. **Critical Bug修正例**
   - `path-segment.ts`でのResult unwrapping不備
   - `SafePropertyAccess.getProperty()`戻り値の適切な処理
   - Test期待値とactual値のmismatch解決

### Phase 6: 成果検証と品質確保

1. **量的成果指標**
   - 型assertion除去数: 35+
   - 修正ファイル数: 20+
   - テスト通過率: 100% (283/283)
   - CI成功率: 100% (5/5 stages)

2. **質的成果指標**
   - SafePropertyAccessパターンの一貫適用
   - Result<T,E>による堅牢なエラーハンドリング
   - Discriminated unionによる状態管理の強化
   - Smart constructorパターンの活用

## 成果物

### 主成果物

- **型安全化されたソースコード**: 全architectural layerの変換完了
- **統一的なエラーハンドリング**: Result<T,E>パターンの一貫適用
- **保守性向上**: SafePropertyAccessによる再利用可能なパターン確立

### 付録

- **変更ファイル一覧**: 優先度別整理された修正対象リスト
- **パターンカタログ**: 再現可能な変換パターン集
- **品質検証結果**: CI実行ログとテスト結果

## 参照資料

### 必須参照資料

- **全域性原則**: `docs/development/totality.ja.md`
- **AI複雑化防止（科学的制御）**:
  `docs/development/ai-complexity-control_compact.ja.md`
- **ドメイン境界**: `docs/domain/domain_boundary.md`
- **アーキテクチャ**: `docs/domain/architecture.md`

### 技術参照資料

- **テスト戦略**: `docs/testing.md`
- **DDD実装ガイド**: プロジェクト内実装例
- **TypeScript公式ドキュメント**: 型安全性best practices

## 仮定リスト

1. **開発環境**: Deno runtime環境が整備済み
2. **権限**: src/ディレクトリへの読み書き権限
3. **ブランチ戦略**: feature branchでの作業実施
4. **レビュープロセス**: PRベースでの変更管理

## 変更履歴

- v1.0 初版作成 - DDD/Totality refactoring完了時点での知見整理

## DoD (Definition of Done)

- [ ] 全Priority層の型assertion除去完了
- [ ] CI pipeline 5段階すべて成功
- [ ] 283テストケース全通過
- [ ] SafePropertyAccessパターン一貫適用
- [ ] Result<T,E>エラーハンドリング統一
- [ ] 性能劣化なし（benchmark維持）
- [ ] ドキュメント更新完了
