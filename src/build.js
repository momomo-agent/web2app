const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')
const { CONFIG_FILE } = require('./init')

async function build(opts) {
  const { platform, release, out } = opts
  
  const configPath = path.join(process.cwd(), CONFIG_FILE)
  const capConfigPath = path.join(process.cwd(), 'capacitor.config.json')
  
  if (!await fs.pathExists(capConfigPath)) {
    throw new Error('Not a web2app project. Run "web2app init" first.')
  }

  const capConfig = await fs.readJson(capConfigPath)
  const web2appConfig = await fs.pathExists(configPath) ? await fs.readJson(configPath) : {}
  
  console.log(chalk.cyan('🔨 web2app build'))
  console.log(chalk.gray(`   App: ${capConfig.appName}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Mode: ${release ? 'release' : 'debug'}`))
  console.log('')

  // Auto-sync: if source is symlinked, just cap sync
  // If source was copied, re-copy from original path
  if (web2appConfig.source && web2appConfig.mode === 'local') {
    const wwwDir = path.join(process.cwd(), 'www')
    const stat = await fs.lstat(wwwDir).catch(() => null)
    
    if (stat && !stat.isSymbolicLink()) {
      // www/ is a copy, re-sync from source
      console.log(chalk.cyan('📂 Syncing web source...'))
      await fs.remove(wwwDir)
      await fs.copy(web2appConfig.source, wwwDir)
      console.log(chalk.green('✓'), 'Web source synced')
    } else {
      console.log(chalk.green('✓'), 'Source symlinked (auto-sync)')
    }
  }

  // Capacitor sync
  console.log(chalk.cyan('📦 Syncing to native...'))
  execSync('npx cap sync', { stdio: 'inherit' })

  // Build
  if (platform === 'android' || platform === 'both') {
    await buildAndroid(release, out)
  }

  if (platform === 'ios' || platform === 'both') {
    await buildIOS(capConfig, release)
  }
}

async function buildAndroid(release, outDir) {
  const androidDir = path.join(process.cwd(), 'android')
  
  if (!await fs.pathExists(androidDir)) {
    throw new Error('Android platform not found. Run "web2app init --platform android"')
  }

  console.log(chalk.cyan('🤖 Building Android...'))
  
  const gradlew = path.join(androidDir, 'gradlew')
  try { execSync(`chmod +x ${gradlew}`) } catch {}
  
  const task = release ? 'assembleRelease' : 'assembleDebug'
  
  execSync(`./gradlew ${task}`, { 
    cwd: androidDir, 
    stdio: 'inherit',
    env: { ...process.env }
  })

  // Find and report APK
  const variant = release ? 'release' : 'debug'
  const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', variant)
  
  if (await fs.pathExists(apkDir)) {
    const apkFiles = (await fs.readdir(apkDir)).filter(f => f.endsWith('.apk'))
    
    if (apkFiles.length > 0) {
      const apkPath = path.join(apkDir, apkFiles[0])
      const size = (await fs.stat(apkPath)).size
      
      if (outDir) {
        await fs.ensureDir(outDir)
        const dest = path.join(outDir, apkFiles[0])
        await fs.copy(apkPath, dest)
        console.log(chalk.green('✅'), `APK: ${dest} (${(size / 1024 / 1024).toFixed(1)} MB)`)
      } else {
        console.log(chalk.green('✅'), `APK: ${apkPath} (${(size / 1024 / 1024).toFixed(1)} MB)`)
      }
    }
  }
}

async function buildIOS(config, release) {
  const iosDir = path.join(process.cwd(), 'ios')
  
  if (!await fs.pathExists(iosDir)) {
    throw new Error('iOS platform not found. Run "web2app init --platform ios"')
  }

  if (process.platform !== 'darwin') {
    console.log(chalk.yellow('⚠'), 'iOS builds require macOS. Skipped.')
    return
  }

  console.log(chalk.cyan('🍎 Building iOS...'))
  
  const buildConfig = release ? 'Release' : 'Debug'
  
  execSync(`xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration ${buildConfig} -sdk iphoneos build`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  console.log(chalk.green('✅'), 'iOS build complete')
  console.log(chalk.gray('   Use "npx cap open ios" to archive in Xcode'))
}

module.exports = { build }
