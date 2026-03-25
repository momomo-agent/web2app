# AGENTS.md — web2app

You have access to `web2app`, a CLI tool that turns web content into native iOS, Android & Mac apps.

## Installation

```bash
git clone https://github.com/momomo-agent/web2app.git
cd web2app
npm install
npm link   # registers global command 'web2app'
```

## When to use

Use `web2app` when the user wants to:
- Convert a website/URL into a mobile or desktop app
- Package HTML/CSS/JS files as a native app
- Create an APK, IPA, or Mac .app/.dmg from a web project
- Wrap a web app for mobile or desktop distribution

## Commands

### Initialize a project

```bash
# From URL → Android
web2app init --url https://example.com --name "MyApp" --platform android

# From URL → Mac desktop app
web2app init --url https://example.com --name "MyApp" --platform mac

# From web project → all platforms
web2app init --source ./my-project/ --name "MyApp" --platform all

# With permissions and options
web2app init \
  --source ./project/ \
  --name "My App" \
  --id com.example.myapp \
  --permissions camera,microphone,location,storage,notifications \
  --fullscreen \
  --orientation portrait \
  --color "#000000" \
  --platform all
```

### Platform values

| Value | Platforms |
|-------|----------|
| `android` | Android only |
| `ios` | iOS only |
| `mac` | macOS only (Electron) |
| `both` | iOS + Android |
| `all` | iOS + Android + Mac |

### Build

```bash
cd <project-dir>
web2app build --platform android   # APK
web2app build --platform ios       # IPA (macOS only)
web2app build --platform mac       # .app (dev, fast)
web2app build --platform mac --release  # .dmg (distributable)
web2app build --platform all
```

### Run

```bash
web2app run --platform android     # emulator
web2app run --platform mac         # Electron window
```

## Output locations

- **APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **iOS**: Open in Xcode via `npx cap open ios`, then archive
- **Mac .app**: `mac-dist/mac-arm64/MyApp.app`
- **Mac .dmg**: `mac-dist/MyApp-1.0.0.dmg`

## Permissions reference

Available permissions: `camera`, `microphone`, `location`, `storage`, `notifications`

Pass as comma-separated: `--permissions camera,microphone`

## Prerequisites

- **Android**: JDK 17+, Android SDK
- **iOS**: macOS + Xcode 15+ + CocoaPods
- **Mac**: Node.js 18+ (Electron auto-installed)

## Important notes

- For URL mode, the app loads the remote site in a native WebView (mobile) or Electron BrowserWindow (Mac)
- For file/project mode, web assets are bundled into the app (offline-capable)
- The tool auto-detects build directories (dist/, build/, out/, public/)
- Bundle ID is auto-generated from app name if not specified
- Mac apps use `titleBarStyle: hiddenInset` with traffic lights for a native feel
- The same `www/` directory is shared across all platforms
