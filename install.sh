#!/bin/bash

# Frontmatter-to-schema installation script
# Installs the CLI tool directly from GitHub to ~/.deno/bin/

set -e

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
BRANCH="${FRONTMATTER_TO_SCHEMA_BRANCH:-main}"
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
if [ "$BRANCH" != "main" ] || [ "$INSTALL_ROOT" != "$HOME/.deno" ] || [ -n "$FRONTMATTER_TO_SCHEMA_PERMISSIONS" ] || [ "$BINARY_NAME" != "frontmatter-to-schema" ] || [ -n "$GITHUB_TOKEN" ]; then
    echo ""
    echo "🔧 Configuration used:"
    [ "$BRANCH" != "main" ] && echo "  Branch: $BRANCH"
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