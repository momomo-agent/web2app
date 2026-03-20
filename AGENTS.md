# AGENTS.md — web2app

You have access to `web2app`, a CLI tool that turns web content into native iOS & Android apps.

## Installation

```bash
npm install -g web2app
```

## When to use

Use `web2app` when the user wants to:
- Convert a website/URL into a mobile app
- Package HTML/CSS/JS files as a native app
- Create an APK or IPA from a web project
- Wrap a web app for mobile distribution

## Commands

### Initialize a project

```bash
# From URL
web2app init --url https://example.com --name "MyApp" --platform android

# From HTML file
web2app init --source ./index.html --name "MyApp" --platform both

# From web project directory
web2app init --source ./my-project/ --name "MyApp" --platform both

# With permissions and options
web2app init \
  --source ./project/ \
  --name "My App" \
  --id com.example.myapp \
  --permissions camera,microphone,location,storage,notifications \
  --fullscreen \
  --orientation portrait \
  --color "#000000" \
  --platform both
```

### Build

```bash
cd <project-dir>
web2app build --platform android   # APK
web2app build --platform ios       # IPA (macOS only)
web2app build --platform both
web2app build --release            # Release build
```

## Output locations

- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **iOS**: Open in Xcode via `npx cap open ios`, then archive

## Permissions reference

Available permissions: `camera`, `microphone`, `location`, `storage`, `notifications`

Pass as comma-separated: `--permissions camera,microphone`

## Prerequisites

- **Android**: JDK 17+, Android SDK
- **iOS**: macOS + Xcode 15+ + CocoaPods

## Important notes

- For URL mode, the app loads the remote site in a native WebView
- For file/project mode, web assets are bundled into the app (offline-capable)
- The tool auto-detects build directories (dist/, build/, out/, public/)
- Bundle ID is auto-generated from app name if not specified
