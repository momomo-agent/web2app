---
name: web2app
description: Turn any web content (URL, HTML file, or web project) into native iOS, Android & Mac apps. Supports permissions, fullscreen, custom icons, and offline mode. Mobile via Capacitor, Mac via Electron.
---

# web2app

Turn any web content into native iOS, Android & Mac apps.

## Installation

```bash
git clone https://github.com/momomo-agent/web2app.git
cd web2app
npm install
npm link   # registers global command 'web2app'
```

## Usage

### Three modes

**1. URL mode** — Wrap a website:
```bash
web2app init --url https://your-site.com --name "MyApp" --platform android
```

**2. File mode** — Single HTML file:
```bash
web2app init --source ./index.html --name "MyApp" --platform both
```

**3. Project mode** — Full web project:
```bash
web2app init --source ./my-project/ --name "MyApp" --platform all
```

### Build

```bash
cd my-app
web2app build --platform android  # APK
web2app build --platform mac      # .app (dev)
web2app build --platform mac --release  # .dmg
web2app build --platform all      # everything
```

### Run

```bash
web2app run --platform android    # emulator
web2app run --platform mac        # Electron window
```

## Options

```bash
web2app init \
  --name "App Name" \
  --id com.example.app \
  --url https://site.com \
  --platform all \              # android | ios | mac | both | all
  --permissions camera,microphone,location,storage,notifications \
  --fullscreen \
  --orientation portrait \
  --color "#ffffff" \
  --out ./output
```

### Platform values

| Value | Platforms |
|-------|----------|
| `android` | Android only |
| `ios` | iOS only |
| `mac` | macOS only (Electron) |
| `both` | iOS + Android |
| `all` | iOS + Android + Mac |

## Permissions

- `camera` — Camera access
- `microphone` — Audio recording
- `location` — GPS location
- `storage` — File system access
- `notifications` — Push notifications

## Prerequisites

**Android:**
- JDK 17+
- Android SDK
- Gradle

**iOS (macOS only):**
- Xcode 15+
- CocoaPods

**Mac:**
- Node.js 18+
- Electron + electron-builder (auto-installed)

## Output

- **Android**: APK file in `android/app/build/outputs/apk/`
- **iOS**: Open in Xcode to archive and export IPA
- **Mac**: `.app` in `mac-dist/mac-arm64/` or `.dmg` in `mac-dist/`

## Examples

```bash
# Visual Talk → Android app with mic permission
web2app init \
  --source /path/to/visual-talk/ \
  --name "Visual Talk" \
  --platform android \
  --permissions microphone \
  --fullscreen

# URL wrapper → Mac desktop app
web2app init \
  --url https://example.com \
  --name "Example" \
  --platform mac

# All platforms with permissions
web2app init \
  --url https://example.com \
  --name "Example" \
  --permissions camera,microphone,location,storage \
  --platform all
```

## Documentation

Full docs: https://web2app.momomo.dev

## Repository

https://github.com/momomo-agent/web2app
