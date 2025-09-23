#!/bin/bash

# Workflow Validation Script
# Validates workflow files for structure, completeness, and XML conversion compatibility

set -euo pipefail

echo "🔍 ワークフロー検証開始..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
VALID_FILES=0
INVALID_FILES=0

# Function to check file
validate_workflow_file() {
    local workflow_file="$1"
    local is_valid=true

    echo -e "📄 検証中: ${workflow_file}"

    # Check 1: YAML frontmatter
    if ! grep -q "^---" "$workflow_file"; then
        echo -e "  ${RED}❌ YAML frontmatter不足${NC}"
        is_valid=false
    fi

    # Check 2: XML conversion metadata
    if ! grep -q "xml_convertible: true" "$workflow_file"; then
        echo -e "  ${RED}❌ XML変換メタデータ不足${NC}"
        is_valid=false
    fi

    # Check 3: Required sections
    local required_sections=(
        "## 目的"
        "## 前提条件"
        "## 入力"
        "## ワークフロー手順"
        "## 出力"
        "## 成功基準"
    )

    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$workflow_file"; then
            echo -e "  ${RED}❌ 必須セクション不足: $section${NC}"
            is_valid=false
        fi
    done

    # Check 4: XML step structure
    local step_count=$(grep -c "{xml:step" "$workflow_file" 2>/dev/null || echo "0")
    if [[ $step_count -eq 0 ]]; then
        echo -e "  ${RED}❌ XML構造タグ不足: {xml:step}${NC}"
        is_valid=false
    else
        echo -e "  ${GREEN}✅ XML steps found: $step_count${NC}"
    fi

    # Check 5: Closing tags
    local closing_count=$(grep -c "{/xml:step}" "$workflow_file" 2>/dev/null || echo "0")
    if [[ $step_count -ne $closing_count ]]; then
        echo -e "  ${RED}❌ XMLタグ不整合: open=$step_count, close=$closing_count${NC}"
        is_valid=false
    fi

    # Check 6: BreakdownLogger references
    if grep -q "breakdownlogger" "$workflow_file"; then
        echo -e "  ${GREEN}✅ BreakdownLogger統合確認${NC}"
    else
        echo -e "  ${YELLOW}⚠️ BreakdownLogger参照不足${NC}"
    fi

    # Check 7: Environment variables
    if grep -q "environment_vars" "$workflow_file"; then
        echo -e "  ${GREEN}✅ 環境変数設定確認${NC}"
    else
        echo -e "  ${YELLOW}⚠️ 環境変数設定不足${NC}"
    fi

    # Check 8: Output specifications
    if grep -q "tmp/debug-" "$workflow_file"; then
        echo -e "  ${GREEN}✅ 出力仕様確認${NC}"
    else
        echo -e "  ${YELLOW}⚠️ 出力仕様不明確${NC}"
    fi

    if $is_valid; then
        echo -e "  ${GREEN}✅ 検証成功${NC}"
        ((VALID_FILES++))
    else
        echo -e "  ${RED}❌ 検証失敗${NC}"
        ((INVALID_FILES++))
    fi

    ((TOTAL_FILES++))
    echo ""
}

# Main validation loop
if [[ ! -d "docs/tests/debugs" ]]; then
    echo -e "${RED}❌ Error: docs/tests/debugs/ directory not found${NC}"
    exit 1
fi

echo "📁 ワークフローディレクトリ構造確認:"
find docs/tests/debugs -type f -name "*.workflow.md" | sort

echo ""
echo "🔍 個別ファイル検証:"

for workflow in docs/tests/debugs/**/*.workflow.md; do
    if [[ -f "$workflow" ]]; then
        validate_workflow_file "$workflow"
    fi
done

# Summary
echo "=================================================="
echo "📊 検証結果サマリー"
echo "=================================================="
echo -e "総ファイル数: $TOTAL_FILES"
echo -e "${GREEN}有効ファイル: $VALID_FILES${NC}"
echo -e "${RED}無効ファイル: $INVALID_FILES${NC}"

if [[ $INVALID_FILES -eq 0 ]]; then
    echo -e "${GREEN}🎉 全てのワークフローが検証に合格しました${NC}"
    exit 0
else
    echo -e "${RED}⚠️ $INVALID_FILES 個のワークフローに問題があります${NC}"
    exit 1
fi