# web2app

> Turn any web content into native iOS, Android & Mac apps. One command.

## Quick Start

```bash
git clone https://github.com/momomo-agent/web2app.git
cd web2app
npm install
npm link   # 注册全局命令 web2app

# URL → App
web2app init --url https://your-site.com --name "MyApp" --platform android

# HTML file → App
web2app init --source ./index.html --name "MyApp" --platform both

# Mac desktop app
web2app init --url https://your-site.com --name "MyApp" --platform mac

# All platforms (iOS + Android + Mac)
web2app init --source ./project/ --name "MyApp" --platform all --permissions camera,microphone

# Build
cd my-app && web2app build --platform android
cd my-app && web2app build --platform mac --release  # → .dmg
```

## Agent Integration

### OpenClaw

```bash
openclaw install web2app
```

Or manually copy `SKILL.md` to your skills directory.

### Claude Code

Copy `AGENTS.md` to your project root. Claude Code will automatically read it.

### Cursor

Copy `.cursorrules` to your project root. Cursor will automatically read it.

### Any AI Agent

Just give your agent the docs page: **https://web2app.momomo.dev**

The page contains everything an agent needs to use web2app.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--name` | App name | (required) |
| `--id` | Bundle ID | auto-generated |
| `--url` | Remote URL to wrap | - |
| `--source` | Local file or directory | - |
| `--platform` | `android`, `ios`, `mac`, `both`, `all` | `both` |
| `--permissions` | Comma-separated list | none |
| `--fullscreen` | Enable fullscreen | `false` |
| `--orientation` | `portrait`, `landscape`, `any` | `any` |
| `--color` | Theme color | `#ffffff` |
| `--icon` | App icon (1024x1024 PNG) | - |
| `--out` | Output directory | `.` |

### Platform values

| Value | Platforms |
|-------|----------|
| `android` | Android only |
| `ios` | iOS only |
| `mac` | macOS only (Electron) |
| `both` | iOS + Android |
| `all` | iOS + Android + Mac |

## Permissions

| Flag | Android | iOS |
|------|---------|-----|
| `camera` | CAMERA | NSCameraUsageDescription |
| `microphone` | RECORD_AUDIO | NSMicrophoneUsageDescription |
| `location` | ACCESS_FINE_LOCATION | NSLocationWhenInUseUsageDescription |
| `storage` | READ/WRITE_EXTERNAL_STORAGE | NSPhotoLibraryUsageDescription |
| `notifications` | POST_NOTIFICATIONS | Push Notifications capability |

## Mac App Details

Mac apps are built with Electron:
- `web2app run --platform mac` — run in development
- `web2app build --platform mac` — build .app (unpacked, fast)
- `web2app build --platform mac --release` — build .dmg (distributable)
- Hidden title bar with traffic lights (`titleBarStyle: hiddenInset`)
- Same `www/` directory shared with mobile builds

## Prerequisites

**Android**: JDK 17+, Android SDK, Gradle
**iOS**: Xcode 15+, CocoaPods (macOS only)
**Mac**: Node.js 18+ (Electron auto-installed)

## License

MIT
