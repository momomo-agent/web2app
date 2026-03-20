# web2app

把任何 Web 内容变成原生 App（iOS + Android）。

## 三种模式

```bash
# 1. URL 模式 — 网址变 App
web2app --url https://your-site.com --name "MyApp" --platform android

# 2. 文件模式 — HTML 文件变 App
web2app --source ./index.html --name "MyApp" --platform both

# 3. 工程模式 — Web 项目变 App
web2app --source ./my-project/ --name "MyApp" --platform both
```

## 安装

```bash
npm install -g web2app
```

## 前置要求

- **Android**: JDK 17+, Android SDK, Gradle
- **iOS**: Xcode 15+, CocoaPods（仅 macOS）

## 功能

- ✅ iOS + Android 双端
- ✅ 自定义图标、名称、包名
- ✅ 权限管理（摄像头、麦克风、位置、存储等）
- ✅ 全屏/状态栏控制
- ✅ 离线支持
- ✅ 自适应屏幕
- ✅ AI agent 友好（Claude Code / Cursor / OpenClaw）

## 许可

MIT
