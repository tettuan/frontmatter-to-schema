#!/bin/bash
# CI execution script with automatic issue creation on failure

set -e

# Run CI and capture output
if deno task ci; then
    echo "✅ CI passed successfully"
    exit 0
else
    echo "❌ CI failed"
    exit 1
fi
