const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

const CAPACITOR_VERSION = '^6.0.0'
const CONFIG_FILE = 'web2app.json'

function generateBundleId(name) {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `com.web2app.${clean}`
}

/**
 * Resolve the actual web directory from source path.
 * Checks for common build output dirs: dist/, build/, out/, public/
 */
function resolveWebDir(sourcePath) {
  const abs = path.resolve(sourcePath)
  const stat = fs.statSync(abs)
  
  if (!stat.isDirectory()) {
    // Single file — return its parent
    return { dir: path.dirname(abs), singleFile: path.basename(abs) }
  }
  
  // Check for build output directories
  const buildDirs = ['dist', 'build', 'out', 'public']
  for (const dir of buildDirs) {
    const candidate = path.join(abs, dir)
    if (fs.pathExistsSync(candidate) && fs.pathExistsSync(path.join(candidate, 'index.html'))) {
      return { dir: candidate }
    }
  }
  
  // Check if root has index.html
  if (fs.pathExistsSync(path.join(abs, 'index.html'))) {
    return { dir: abs }
  }
  
  // Fallback to source dir
  return { dir: abs }
}

async function init(opts) {
  const { name, url, source, platform, permissions, fullscreen, orientation, color, out } = opts
  const bundleId = opts.id || generateBundleId(name)
  const projectDir = path.resolve(out, name.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
  
  if (!url && !source) {
    throw new Error('Either --url or --source is required')
  }

  console.log(chalk.cyan('🚀 web2app init'))
  console.log(chalk.gray(`   Name: ${name}`))
  console.log(chalk.gray(`   ID: ${bundleId}`))
  console.log(chalk.gray(`   Mode: ${url ? 'URL (' + url + ')' : 'Local (' + source + ')'}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Output: ${projectDir}`))
  console.log('')

  // 1. Create project directory
  await fs.ensureDir(projectDir)

  // 2. Save web2app config (our own, not Capacitor's)
  //    This is the single source of truth
  const web2appConfig = {
    name,
    bundleId,
    mode: url ? 'url' : 'local',
    url: url || undefined,
    source: source ? path.resolve(source) : undefined,
    platform,
    permissions: (permissions || '').split(',').filter(Boolean),
    fullscreen: !!fullscreen,
    orientation,
    color,
    icon: opts.icon ? path.resolve(opts.icon) : undefined,
  }
  
  await fs.writeJson(path.join(projectDir, CONFIG_FILE), web2appConfig, { spaces: 2 })
  console.log(chalk.green('✓'), CONFIG_FILE)

  // 3. Create package.json
  const wantsMobileInit = platform === 'android' || platform === 'ios' || platform === 'both' || platform === 'all'
  
  const pkg = {
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: '1.0.0',
    private: true,
    dependencies: {}
  }

  // Capacitor deps only for mobile
  if (wantsMobileInit) {
    pkg.dependencies['@capacitor/core'] = CAPACITOR_VERSION
    pkg.dependencies['@capacitor/cli'] = CAPACITOR_VERSION
    pkg.dependencies['@capacitor/status-bar'] = CAPACITOR_VERSION
    
    if (platform === 'android' || platform === 'both' || platform === 'all') {
      pkg.dependencies['@capacitor/android'] = CAPACITOR_VERSION
    }
    if (platform === 'ios' || platform === 'both' || platform === 'all') {
      pkg.dependencies['@capacitor/ios'] = CAPACITOR_VERSION
    }
  }

  // Electron deps for mac
  if (platform === 'mac' || platform === 'all') {
    pkg.dependencies['electron'] = '^33.0.0'
    pkg.devDependencies = { 'electron-builder': '^25.0.0' }
    pkg.main = 'mac/main.js'
    pkg.build = {
      appId: bundleId,
      productName: name,
      mac: {
        category: 'public.app-category.utilities',
        target: ['dmg'],
        icon: 'mac/icon.icns'
      },
      directories: { output: 'mac-dist' },
      files: ['www/**/*', 'mac/**/*']
    }
  }

  // Permission plugins
  const permList = web2appConfig.permissions
  const pluginMap = {
    camera: '@capacitor/camera',
    location: '@capacitor/geolocation',
    storage: '@capacitor/filesystem',
    notifications: '@capacitor/push-notifications',
    haptics: '@capacitor/haptics',
  }
  
  for (const p of permList) {
    if (pluginMap[p]) pkg.dependencies[pluginMap[p]] = 'latest'
  }

  await fs.writeJson(path.join(projectDir, 'package.json'), pkg, { spaces: 2 })
  console.log(chalk.green('✓'), 'package.json')

  // 4. Prepare www/ directory
  const wwwDir = path.join(projectDir, 'www')
  
  if (source) {
    const resolved = resolveWebDir(source)
    
    if (resolved.singleFile) {
      // Single file: create www/ with the file and maybe an index.html redirect
      await fs.ensureDir(wwwDir)
      await fs.copy(path.join(resolved.dir, resolved.singleFile), path.join(wwwDir, resolved.singleFile))
      
      if (resolved.singleFile !== 'index.html') {
        await fs.writeFile(path.join(wwwDir, 'index.html'),
          `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${resolved.singleFile}"></head></html>`)
      }
      console.log(chalk.green('✓'), `Copied ${resolved.singleFile} → www/`)
    } else {
      // Directory: create symlink so changes auto-sync
      // Remove www/ if exists
      await fs.remove(wwwDir)
      
      // Create symlink: www -> source directory
      await fs.symlink(resolved.dir, wwwDir)
      console.log(chalk.green('✓'), `Linked www/ → ${resolved.dir}`)
      console.log(chalk.gray('   (changes to source auto-sync, no copying needed)'))
    }
  } else {
    // URL mode: generate wrapper page
    await fs.ensureDir(wwwDir)
    const html = generateURLWrapper(url, name, color)
    await fs.writeFile(path.join(wwwDir, 'index.html'), html)
    console.log(chalk.green('✓'), `Generated URL wrapper for ${url}`)
  }

  // 5. Capacitor config
  const capConfig = {
    appId: bundleId,
    appName: name,
    webDir: 'www',
    server: url ? { url, cleartext: true } : undefined,
    plugins: {
      StatusBar: {
        overlaysWebView: true,
        style: 'dark',
        backgroundColor: '#00000000'
      }
    },
    android: {
      backgroundColor: color,
      allowMixedContent: true
    },
    ios: {
      backgroundColor: color,
      contentInset: 'always'
    }
  }

  if (orientation !== 'any') {
    capConfig.android.orientation = orientation
  }

  await fs.writeJson(path.join(projectDir, 'capacitor.config.json'), capConfig, { spaces: 2 })
  console.log(chalk.green('✓'), 'capacitor.config.json')

  // 6. Install dependencies
  console.log('')
  console.log(chalk.cyan('📦 Installing dependencies...'))
  execSync('npm install', { cwd: projectDir, stdio: 'inherit' })

  // 7. Add platforms
  console.log('')
  console.log(chalk.cyan('📱 Adding platforms...'))
  
  const wantsMobile = platform === 'android' || platform === 'ios' || platform === 'both' || platform === 'all'
  const wantsMac = platform === 'mac' || platform === 'all'

  if (platform === 'android' || platform === 'both' || platform === 'all') {
    execSync('npx cap add android', { cwd: projectDir, stdio: 'inherit' })
    console.log(chalk.green('✓'), 'Android platform added')
    
    await applyAndroidImmersive(projectDir, bundleId)
    
    if (permList.length > 0) {
      await applyAndroidPermissions(projectDir, permList)
    }
  }
  
  if (platform === 'ios' || platform === 'both' || platform === 'all') {
    try {
      execSync('npx cap add ios', { cwd: projectDir, stdio: 'inherit' })
      console.log(chalk.green('✓'), 'iOS platform added')
      
      if (permList.length > 0) {
        await applyIOSPermissions(projectDir, permList)
      }
    } catch (e) {
      console.log(chalk.yellow('⚠'), 'iOS requires macOS + Xcode. Skipped.')
    }
  }

  if (wantsMac) {
    await scaffoldMac(projectDir, name, bundleId, url, color)
  }

  // 8. Sync web assets to native (only if mobile platforms exist)
  if (wantsMobile) {
    execSync('npx cap sync', { cwd: projectDir, stdio: 'inherit' })
  }

  // Done
  console.log('')
  console.log(chalk.green('✅ Project ready!'))
  console.log('')
  console.log(chalk.cyan('Commands:'))
  console.log(chalk.gray(`   cd ${path.relative(process.cwd(), projectDir)}`))
  console.log(chalk.gray('   web2app build --platform android    # Build APK'))
  console.log(chalk.gray('   web2app run --platform android      # Run on device'))
  console.log(chalk.gray('   web2app doctor                      # Check environment'))
  console.log('')
  
  if (source && !fs.lstatSync(wwwDir).isFile()) {
    console.log(chalk.cyan('💡 Source is symlinked:'))
    console.log(chalk.gray('   Edit your web files normally.'))
    console.log(chalk.gray('   Run "web2app build" to rebuild — it auto-syncs.'))
  }

  return projectDir
}

// ── URL Wrapper ──
function generateURLWrapper(url, name, color) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="${color}">
  <title>${name}</title>
  <style>
    * { margin: 0; padding: 0; }
    html, body, iframe {
      width: 100%; height: 100%;
      border: none; overflow: hidden;
    }
    body {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
  </style>
</head>
<body>
  <iframe src="${url}" allow="camera;microphone;geolocation;fullscreen;autoplay" 
          allowfullscreen sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"></iframe>
</body>
</html>`
}

// ── Android Immersive ──
async function applyAndroidImmersive(projectDir, bundleId) {
  const pkgPath = bundleId.replace(/\./g, '/')
  const mainActivityPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'java', pkgPath, 'MainActivity.java')
  
  if (!await fs.pathExists(mainActivityPath)) return
  
  const code = `package ${bundleId};

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c != null) {
            c.setAppearanceLightStatusBars(false);
            c.setAppearanceLightNavigationBars(false);
        }
    }
}
`
  await fs.writeFile(mainActivityPath, code)
  console.log(chalk.green('✓'), 'Immersive mode')

  const stylesPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml')
  if (await fs.pathExists(stylesPath)) {
    await fs.writeFile(stylesPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
    </style>
</resources>
`)
  }
}

// ── Android Permissions ──
async function applyAndroidPermissions(projectDir, permList) {
  const manifestPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
  if (!await fs.pathExists(manifestPath)) return
  
  const permMap = {
    camera: ['android.permission.CAMERA'],
    microphone: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
    location: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    storage: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    notifications: ['android.permission.POST_NOTIFICATIONS'],
  }
  
  let manifest = await fs.readFile(manifestPath, 'utf8')
  const perms = permList.flatMap(p => permMap[p] || [])
  
  for (const perm of perms) {
    const tag = `<uses-permission android:name="${perm}" />`
    if (!manifest.includes(perm)) {
      manifest = manifest.replace('</manifest>', `    ${tag}\n</manifest>`)
    }
  }
  
  await fs.writeFile(manifestPath, manifest)
  console.log(chalk.green('✓'), 'Android permissions')
}

// ── iOS Permissions ──
async function applyIOSPermissions(projectDir, permList) {
  const plistPath = path.join(projectDir, 'ios', 'App', 'App', 'Info.plist')
  if (!await fs.pathExists(plistPath)) return
  
  const descMap = {
    camera: { key: 'NSCameraUsageDescription', desc: 'This app needs camera access' },
    microphone: { key: 'NSMicrophoneUsageDescription', desc: 'This app needs microphone access' },
    location: { key: 'NSLocationWhenInUseUsageDescription', desc: 'This app needs location access' },
    storage: { key: 'NSPhotoLibraryUsageDescription', desc: 'This app needs photo library access' },
  }
  
  let plist = await fs.readFile(plistPath, 'utf8')
  
  for (const p of permList) {
    const d = descMap[p]
    if (d && !plist.includes(d.key)) {
      plist = plist.replace('</dict>', `\t<key>${d.key}</key>\n\t<string>${d.desc}</string>\n</dict>`)
    }
  }
  
  await fs.writeFile(plistPath, plist)
  console.log(chalk.green('✓'), 'iOS permissions')
}

// ── Mac (Electron) Scaffold ──
async function scaffoldMac(projectDir, name, bundleId, url, color) {
  const macDir = path.join(projectDir, 'mac')
  await fs.ensureDir(macDir)

  // Main process
  const mainJs = `const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

const URL_MODE = ${url ? `'${url}'` : 'null'}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 360,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '${color}',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  if (URL_MODE) {
    win.loadURL(URL_MODE)
  } else {
    win.loadFile(path.join(__dirname, '..', 'www', 'index.html'))
  }

  // Clean menu
  const template = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
`
  await fs.writeFile(path.join(macDir, 'main.js'), mainJs)
  console.log(chalk.green('✓'), 'Mac: Electron main process')

  // Preload (minimal, for future use)
  await fs.writeFile(path.join(macDir, 'preload.js'), '// Preload script — extend as needed\n')
  console.log(chalk.green('✓'), 'Mac: Electron scaffold ready')
}

module.exports = { init, CONFIG_FILE }
