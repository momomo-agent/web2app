---
name: web2app
description: Turn any web content (URL, HTML file, or web project) into native iOS & Android apps. Supports permissions, fullscreen, custom icons, and offline mode. Built on Capacitor.
---

# web2app

Turn any web content into native iOS & Android apps.

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
web2app init --source ./my-project/ --name "MyApp" --platform both
```

### Build

```bash
cd my-app
web2app build --platform android  # or ios, or both
```

## Options

```bash
web2app init \
  --name "App Name" \
  --id com.example.app \
  --url https://site.com \
  --platform both \
  --permissions camera,microphone,location,storage,notifications \
  --fullscreen \
  --orientation portrait \
  --color "#ffffff" \
  --out ./output
```

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

## Output

- **Android**: APK file in `android/app/build/outputs/apk/`
- **iOS**: Open in Xcode to archive and export IPA

## Examples

```bash
# Visual Talk → Android app with mic permission
web2app init \
  --source /path/to/visual-talk/ \
  --name "Visual Talk" \
  --platform android \
  --permissions microphone \
  --fullscreen

# URL wrapper with all permissions
web2app init \
  --url https://example.com \
  --name "Example" \
  --permissions camera,microphone,location,storage \
  --platform both
```

## Documentation

Full docs: https://momomo-agent.github.io/web2app/

## Repository

https://github.com/momomo-agent/web2app
