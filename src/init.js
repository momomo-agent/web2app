const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

const CAPACITOR_VERSION = '^6.0.0'

function generateBundleId(name) {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `com.web2app.${clean}`
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

  // 2. Create package.json
  const pkg = {
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'echo "No build step needed"'
    },
    dependencies: {
      '@capacitor/core': CAPACITOR_VERSION,
      '@capacitor/cli': CAPACITOR_VERSION
    }
  }

  // Add platform-specific packages
  if (platform === 'android' || platform === 'both') {
    pkg.dependencies['@capacitor/android'] = CAPACITOR_VERSION
  }
  if (platform === 'ios' || platform === 'both') {
    pkg.dependencies['@capacitor/ios'] = CAPACITOR_VERSION
  }

  // Add permission plugins
  const permList = (permissions || '').split(',').filter(Boolean)
  const pluginMap = {
    camera: '@capacitor/camera',
    microphone: '@nicolo-ribaudo/capacitor-microphone',
    location: '@capacitor/geolocation',
    storage: '@capacitor/filesystem',
    notifications: '@capacitor/push-notifications',
    haptics: '@capacitor/haptics',
    share: '@capacitor/share',
    clipboard: '@capacitor/clipboard',
    statusbar: '@capacitor/status-bar'
  }
  
  for (const p of permList) {
    if (pluginMap[p]) {
      pkg.dependencies[pluginMap[p]] = 'latest'
    }
  }

  await fs.writeJson(path.join(projectDir, 'package.json'), pkg, { spaces: 2 })
  console.log(chalk.green('✓'), 'package.json')

  // 3. Create web directory
  const webDir = path.join(projectDir, 'www')
  await fs.ensureDir(webDir)

  if (source) {
    // Copy local source
    const srcPath = path.resolve(source)
    const stat = await fs.stat(srcPath)
    
    if (stat.isDirectory()) {
      // Check for common build outputs
      const buildDirs = ['dist', 'build', 'out', 'public']
      let buildDir = srcPath
      
      for (const dir of buildDirs) {
        const candidate = path.join(srcPath, dir)
        if (await fs.pathExists(candidate)) {
          buildDir = candidate
          break
        }
      }
      
      await fs.copy(buildDir, webDir)
      console.log(chalk.green('✓'), `Copied ${buildDir} → www/`)
    } else {
      // Single file — create minimal HTML wrapper
      await fs.copy(srcPath, path.join(webDir, path.basename(srcPath)))
      
      // If not index.html, create redirect
      if (path.basename(srcPath) !== 'index.html') {
        const redirect = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${path.basename(srcPath)}"></head></html>`
        await fs.writeFile(path.join(webDir, 'index.html'), redirect)
      }
      console.log(chalk.green('✓'), `Copied ${srcPath} → www/`)
    }
  } else {
    // URL mode — create WebView page
    const html = generateURLWrapper(url, name, fullscreen, color)
    await fs.writeFile(path.join(webDir, 'index.html'), html)
    console.log(chalk.green('✓'), `Generated URL wrapper for ${url}`)
  }

  // 4. Capacitor config
  const capConfig = {
    appId: bundleId,
    appName: name,
    webDir: 'www',
    server: url ? {
      url: url,
      cleartext: true
    } : undefined,
    plugins: {
      StatusBar: {
        overlaysWebView: true,
        style: 'dark',
        backgroundColor: '#00000000'
      }
    },
    android: {
      backgroundColor: color,
      allowMixedContent: true,
      appendUserAgent: 'web2app'
    },
    ios: {
      backgroundColor: color,
      contentInset: 'always'
    }
  }

  // Fullscreen / status bar
  if (fullscreen) {
    capConfig.plugins.StatusBar = { style: 'dark', overlaysWebView: true }
  }

  // Screen orientation
  if (orientation !== 'any') {
    capConfig.android.orientation = orientation
    capConfig.ios.preferredContentMode = orientation === 'portrait' ? 'mobile' : 'desktop'
  }

  // Permissions config
  if (permList.includes('camera')) {
    capConfig.plugins.Camera = {
      permissionType: 'camera',
      presentationStyle: 'popover'
    }
  }

  await fs.writeJson(path.join(projectDir, 'capacitor.config.json'), capConfig, { spaces: 2 })
  console.log(chalk.green('✓'), 'capacitor.config.json')

  // 5. Generate Android permissions manifest snippet
  if (platform === 'android' || platform === 'both') {
    await generateAndroidPermissions(projectDir, permList)
  }

  // 6. Install dependencies
  console.log('')
  console.log(chalk.cyan('📦 Installing dependencies...'))
  execSync('npm install', { cwd: projectDir, stdio: 'inherit' })

  // 7. Add platforms
  console.log('')
  console.log(chalk.cyan('📱 Adding platforms...'))
  
  if (platform === 'android' || platform === 'both') {
    execSync('npx cap add android', { cwd: projectDir, stdio: 'inherit' })
    console.log(chalk.green('✓'), 'Android platform added')
    
    // Apply immersive mode
    await applyAndroidImmersive(projectDir, bundleId)
    
    // Apply permissions to AndroidManifest.xml
    if (permList.length > 0) {
      await applyAndroidPermissions(projectDir, permList)
    }
  }
  
  if (platform === 'ios' || platform === 'both') {
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

  // 8. Copy web assets to native
  execSync('npx cap copy', { cwd: projectDir, stdio: 'inherit' })

  // 9. Handle icon
  if (opts.icon) {
    console.log(chalk.yellow('⚠'), 'Icon generation requires @capacitor/assets. Run:')
    console.log(chalk.gray(`   cd ${projectDir} && npx @capacitor/assets generate --iconBackgroundColor ${color}`))
  }

  console.log('')
  console.log(chalk.green('✅ Project initialized!'))
  console.log('')
  console.log(chalk.cyan('Next steps:'))
  console.log(chalk.gray(`   cd ${projectDir}`))
  
  if (platform === 'android' || platform === 'both') {
    console.log(chalk.gray('   npx cap open android    # Open in Android Studio'))
    console.log(chalk.gray('   web2app build --platform android'))
  }
  if (platform === 'ios' || platform === 'both') {
    console.log(chalk.gray('   npx cap open ios        # Open in Xcode'))
    console.log(chalk.gray('   web2app build --platform ios'))
  }

  return projectDir
}

async function applyAndroidImmersive(projectDir, bundleId) {
  // Find MainActivity.java
  const pkgPath = bundleId.replace(/\./g, '/')
  const mainActivityPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'java', pkgPath, 'MainActivity.java')
  
  if (!await fs.pathExists(mainActivityPath)) {
    console.log(chalk.yellow('⚠'), 'MainActivity.java not found, skipping immersive mode')
    return
  }
  
  const immersiveCode = `package ${bundleId};

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge: extend content behind status bar and navigation bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Make status bar and navigation bar transparent
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Optional: control system bar appearance (light/dark icons)
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }
}
`
  
  await fs.writeFile(mainActivityPath, immersiveCode)
  console.log(chalk.green('✓'), 'Android immersive mode applied')
  
  // Also update styles.xml for edge-to-edge theme
  const stylesPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml')
  if (await fs.pathExists(stylesPath)) {
    const styles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowTranslucentStatus">false</item>
        <item name="android:windowTranslucentNavigation">false</item>
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
    </style>
</resources>
`
    await fs.writeFile(stylesPath, styles)
    console.log(chalk.green('✓'), 'Android styles.xml updated for edge-to-edge')
  }
}

function generateURLWrapper(url, name, fullscreen, color) {
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

async function generateAndroidPermissions(projectDir, permList) {
  const permMap = {
    camera: ['android.permission.CAMERA'],
    microphone: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
    location: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    storage: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    notifications: ['android.permission.POST_NOTIFICATIONS'],
  }
  
  const perms = permList.flatMap(p => permMap[p] || [])
  const snippet = perms.map(p => `    <uses-permission android:name="${p}" />`).join('\n')
  
  await fs.writeFile(path.join(projectDir, 'android-permissions.xml'), 
    `<!-- Add these to AndroidManifest.xml inside <manifest> tag -->\n${snippet}\n`)
  console.log(chalk.green('✓'), 'android-permissions.xml')
}

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
  console.log(chalk.green('✓'), 'Android permissions applied')
}

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
  console.log(chalk.green('✓'), 'iOS permissions applied')
}

module.exports = { init }
