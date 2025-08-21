# Installation Guide

## Quick Install (Recommended)

Install directly from GitHub with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/install.sh | bash
```

Or with wget:

```bash
wget -qO- https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/install.sh | bash
```

## Custom Installation

### Using Environment Variables

Create a `.env` file with your preferences:

```bash
# Copy the example configuration
curl -o .env https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/.env.example

# Edit the configuration
vi .env
```

Example `.env` configuration:

```env
# Custom installation directory
FRONTMATTER_TO_SCHEMA_INSTALL_ROOT=/opt/deno

# Custom binary name
FRONTMATTER_TO_SCHEMA_BINARY_NAME=fts

# Install from specific branch
FRONTMATTER_TO_SCHEMA_BRANCH=develop

# GitHub token for private repos or to avoid rate limits
FRONTMATTER_TO_SCHEMA_GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

Then run the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/install.sh | bash
```

### Manual Installation

1. Clone the repository:

```bash
git clone https://github.com/tettuan/frontmatter-to-schema.git
cd frontmatter-to-schema
```

2. Run the install script:

```bash
./install.sh
```

## Verification

After installation, verify it works:

```bash
frontmatter-to-schema --help
```

## Updating

To update to the latest version, simply run the install command again:

```bash
curl -fsSL https://raw.githubusercontent.com/tettuan/frontmatter-to-schema/main/install.sh | bash
```

## Uninstalling

Remove the installed binary:

```bash
rm ~/.deno/bin/frontmatter-to-schema
```

Or if you used a custom name/location:

```bash
rm $FRONTMATTER_TO_SCHEMA_INSTALL_ROOT/bin/$FRONTMATTER_TO_SCHEMA_BINARY_NAME
```

## Troubleshooting

### Command not found

If you get "command not found" after installation, add `~/.deno/bin` to your
PATH:

**Bash:**

```bash
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Zsh:**

```bash
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Fish:**

```bash
echo 'set -gx PATH $HOME/.deno/bin $PATH' >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

### Permission denied

Make sure Deno is installed:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### GitHub rate limit

If you encounter GitHub API rate limits, use a GitHub token:

1. Create a personal access token at https://github.com/settings/tokens
2. Add it to your `.env` file:
   ```env
   FRONTMATTER_TO_SCHEMA_GITHUB_TOKEN=your_token_here
   ```
3. Run the installer again

## Environment Variables Reference

| Variable                             | Description                   | Default                                              |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------- |
| `FRONTMATTER_TO_SCHEMA_INSTALL_ROOT` | Installation directory        | `~/.deno`                                            |
| `FRONTMATTER_TO_SCHEMA_BINARY_NAME`  | Name of the installed command | `frontmatter-to-schema`                              |
| `FRONTMATTER_TO_SCHEMA_BRANCH`       | Git branch to install from    | `main`                                               |
| `FRONTMATTER_TO_SCHEMA_PERMISSIONS`  | Deno permissions              | `--allow-read --allow-write --allow-env --allow-run` |
| `FRONTMATTER_TO_SCHEMA_GITHUB_TOKEN` | GitHub personal access token  | (none)                                               |
| `FRONTMATTER_TO_SCHEMA_TEST_MODE`    | Enable test mode (runtime)    | `false`                                              |
| `FRONTMATTER_TO_SCHEMA_DEBUG`        | Enable debug mode (runtime)   | `false`                                              |
