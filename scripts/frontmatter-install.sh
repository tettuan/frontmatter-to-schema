#!/bin/bash

# Frontmatter-to-schema installation script
# Installs the CLI tool directly from GitHub to ~/.deno/bin/
#
# Usage:
#   ./frontmatter-install.sh              # Install latest from main branch
#   ./frontmatter-install.sh v1.3.1       # Install specific version tag
#   ./frontmatter-install.sh --version v1.3.1  # Install specific version tag
#   FRONTMATTER_TO_SCHEMA_VERSION=v1.3.1 ./frontmatter-install.sh  # Use env var

set -e

# Parse command-line arguments
VERSION=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [OPTIONS] [VERSION]"
            echo ""
            echo "Install frontmatter-to-schema CLI tool from GitHub"
            echo ""
            echo "OPTIONS:"
            echo "  --version, -v <version>  Install specific version tag (e.g., v1.3.1)"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "EXAMPLES:"
            echo "  $0                      # Install latest from main branch"
            echo "  $0 v1.3.1              # Install version v1.3.1"
            echo "  $0 --version v1.3.1    # Install version v1.3.1"
            echo ""
            echo "ENVIRONMENT VARIABLES:"
            echo "  FRONTMATTER_TO_SCHEMA_VERSION        Version/tag to install"
            echo "  FRONTMATTER_TO_SCHEMA_BRANCH         Branch to install (default: main)"
            echo "  FRONTMATTER_TO_SCHEMA_INSTALL_ROOT   Install location (default: ~/.deno)"
            echo "  FRONTMATTER_TO_SCHEMA_BINARY_NAME    Binary name (default: frontmatter-to-schema)"
            echo "  FRONTMATTER_TO_SCHEMA_GITHUB_TOKEN   GitHub token for private repos"
            echo "  FRONTMATTER_TO_SCHEMA_PERMISSIONS    Custom Deno permissions"
            exit 0
            ;;
        --version|-v)
            VERSION="$2"
            shift 2
            ;;
        v*.*.*)
            VERSION="$1"
            shift
            ;;
        *)
            echo "❌ Unknown argument: $1"
            echo "Usage: $0 [--version|-v <version>] or $0 <version>"
            echo "Run '$0 --help' for more information"
            exit 1
            ;;
    esac
done

echo "📦 Installing frontmatter-to-schema from GitHub..."
echo ""

# Check if deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Error: Deno is not installed."
    echo "Please install Deno first: https://deno.land/manual/getting_started/installation"
    exit 1
fi

# GitHub repository information
GITHUB_REPO="https://github.com/tettuan/frontmatter-to-schema"
GITHUB_RAW="https://raw.githubusercontent.com/tettuan/frontmatter-to-schema"

# Load .env file if it exists
if [ -f .env ]; then
    echo "📋 Loading .env file..."
    set -a
    source .env
    set +a
fi

# Use repository-name-based environment variables
# Priority: CLI arg > Env var > Default
VERSION="${VERSION:-${FRONTMATTER_TO_SCHEMA_VERSION:-}}"
BRANCH="${FRONTMATTER_TO_SCHEMA_BRANCH:-main}"

# If version is specified, use it as branch/tag
if [ -n "$VERSION" ]; then
    BRANCH="$VERSION"
    echo "📌 Installing version: $VERSION"
fi
INSTALL_ROOT="${FRONTMATTER_TO_SCHEMA_INSTALL_ROOT:-$HOME/.deno}"
BIN_DIR="${INSTALL_ROOT}/bin"
BINARY_NAME="${FRONTMATTER_TO_SCHEMA_BINARY_NAME:-frontmatter-to-schema}"
GITHUB_TOKEN="${FRONTMATTER_TO_SCHEMA_GITHUB_TOKEN:-}"

# Set installation directory in user's home
REPO_INSTALL_DIR="$HOME/.frontmatter-to-schema"

echo "📥 Installing from GitHub (branch: $BRANCH)..."

# Remove old installation if exists
if [ -d "$REPO_INSTALL_DIR" ]; then
    echo "🔄 Updating existing installation..."
    rm -rf "$REPO_INSTALL_DIR"
fi

# Clone repository to permanent location
# Use GitHub token if available for private repos or to avoid rate limits
if [ -n "$GITHUB_TOKEN" ]; then
    git clone --quiet --depth 1 --branch "$BRANCH" "https://${GITHUB_TOKEN}@github.com/tettuan/frontmatter-to-schema.git" "$REPO_INSTALL_DIR"
else
    git clone --quiet --depth 1 --branch "$BRANCH" "$GITHUB_REPO.git" "$REPO_INSTALL_DIR"
fi

# Check if cli.ts exists
if [ ! -f "$REPO_INSTALL_DIR/cli.ts" ]; then
    echo "❌ Error: cli.ts not found in repository"
    exit 1
fi

# Set permissions
PERMISSIONS="--allow-read --allow-write --allow-env --allow-run"

# Check for custom permissions in environment
if [ -n "$FRONTMATTER_TO_SCHEMA_PERMISSIONS" ]; then
    echo "🔐 Using custom permissions: $FRONTMATTER_TO_SCHEMA_PERMISSIONS"
    PERMISSIONS="$FRONTMATTER_TO_SCHEMA_PERMISSIONS"
fi

# Install using deno install with the permanent location
echo "🔧 Installing to ${BIN_DIR}/${BINARY_NAME}"
mkdir -p "$BIN_DIR"

DENO_INSTALL_ROOT="$INSTALL_ROOT" deno install \
    --global \
    $PERMISSIONS \
    --name "$BINARY_NAME" \
    --config "$REPO_INSTALL_DIR/deno.json" \
    --force \
    "$REPO_INSTALL_DIR/cli.ts"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📍 Installed to: ${BIN_DIR}/${BINARY_NAME}"
echo ""

# Check if bin directory is in PATH
if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "⚠️  Warning: ${BIN_DIR} is not in your PATH"
    echo ""
    echo "Add the following to your shell configuration file:"
    echo ""
    
    # Detect shell
    if [ -n "$ZSH_VERSION" ]; then
        echo "  # For Zsh (~/.zshrc):"
        echo "  export PATH=\"${BIN_DIR}:\$PATH\""
    elif [ -n "$BASH_VERSION" ]; then
        echo "  # For Bash (~/.bashrc or ~/.bash_profile):"
        echo "  export PATH=\"${BIN_DIR}:\$PATH\""
    elif [ -n "$FISH_VERSION" ]; then
        echo "  # For Fish (~/.config/fish/config.fish):"
        echo "  set -gx PATH ${BIN_DIR} \$PATH"
    else
        echo "  export PATH=\"${BIN_DIR}:\$PATH\""
    fi
    
    echo ""
    echo "Then reload your shell configuration"
else
    echo "📍 ${BIN_DIR} is already in your PATH"
fi

# Show configuration if custom values were used
if [ -n "$VERSION" ] || [ "$BRANCH" != "main" ] || [ "$INSTALL_ROOT" != "$HOME/.deno" ] || [ -n "$FRONTMATTER_TO_SCHEMA_PERMISSIONS" ] || [ "$BINARY_NAME" != "frontmatter-to-schema" ] || [ -n "$GITHUB_TOKEN" ]; then
    echo ""
    echo "🔧 Configuration used:"
    [ -n "$VERSION" ] && echo "  Version: $VERSION"
    [ -z "$VERSION" ] && [ "$BRANCH" != "main" ] && echo "  Branch: $BRANCH"
    [ "$INSTALL_ROOT" != "$HOME/.deno" ] && echo "  Install root: $INSTALL_ROOT"
    [ -n "$FRONTMATTER_TO_SCHEMA_PERMISSIONS" ] && echo "  Permissions: $FRONTMATTER_TO_SCHEMA_PERMISSIONS"
    [ "$BINARY_NAME" != "frontmatter-to-schema" ] && echo "  Binary name: $BINARY_NAME"
    [ -n "$GITHUB_TOKEN" ] && echo "  GitHub token: ****** (configured)"
fi

echo ""
echo "🚀 Usage:"
echo "  ${BINARY_NAME} --help"
echo ""
echo "Example:"
echo "  ${BINARY_NAME} ./docs --schema=schema.json --template=template.json --destination=./output"
echo ""

# Display installed version
echo "📌 Installed version:"
${BINARY_NAME} -v 2>/dev/null || echo "  (version check failed)"
echo ""