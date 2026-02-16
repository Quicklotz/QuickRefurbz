# Homebrew Tap for QuickTestz

Official Homebrew tap for [QuickTestz](https://install.quicktestz.quicklotzwms.com) -- functional testing and grading tools for refurbished electronics.

## Setup

Add the tap:

```bash
brew tap quicklotz/quicktestz
```

## Install the CLI

```bash
brew install quicklotz/quicktestz/quicktestz
```

This installs three commands:

| Command | Description |
|---------|-------------|
| `quicktestz` | Main CLI for test workflows |
| `qr-enhanced` | Enhanced CLI with extended diagnostics |
| `qr` | Short alias for quick access |

Verify the installation:

```bash
quicktestz --help
```

## Install the Desktop App

```bash
brew install --cask quicklotz/quicktestz/quicktestz
```

This installs **QuickTestz.app** into `/Applications`.

## Updating

```bash
brew update
brew upgrade quicktestz        # CLI
brew upgrade --cask quicktestz  # Desktop app
```

## Uninstall

```bash
brew uninstall quicktestz        # CLI
brew uninstall --cask quicktestz  # Desktop app
brew untap quicklotz/quicktestz   # Remove the tap
```
