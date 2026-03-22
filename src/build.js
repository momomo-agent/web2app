const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')
const { syncSource } = require('./run')

const CONFIG_FILE = 'web2app.config.json'

async function build(opts) {
  const { platform, release, out } = opts
  const configPath = path.join(process.cwd(), CONFIG_FILE)
  
  if (!await fs.pathExists(configPath)) {
    throw new Error('No web2app.config.json found. Run "web2app init" first.')
  }

  const config = await fs.readJson(configPath)
  
  console.log(chalk.cyan('🔨 web2app build'))
  console.log(chalk.gray(`   App: ${config.name}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Mode: ${release ? 'release' : 'debug'}`))
  console.log('')

  // Auto-sync web source (core fix: no more stale copies)
  await syncSource(config)

  // Capacitor sync
  console.log(chalk.cyan('📦 Syncing native projects...'))
  execSync('npx cap copy', { stdio: 'inherit' })
  execSync('npx cap sync', { stdio: 'inherit' })

  // Build Android
  if (platform === 'android' || platform === 'both') {
    await buildAndroid(config, release, out)
  }

  // Build iOS
  if (platform === 'ios' || platform === 'both') {
    await buildIOS(config, release, out)
  }
}

async function buildAndroid(config, release, outDir) {
  const androidDir = path.join(process.cwd(), 'android')
  
  if (!await fs.pathExists(androidDir)) {
    throw new Error('Android platform not found. Run "web2app init --platform android" first.')
  }

  console.log(chalk.cyan('🤖 Building Android...'))
  
  const gradlew = path.join(androidDir, 'gradlew')
  try { execSync(`chmod +x ${gradlew}`) } catch {}
  
  const task = release ? 'assembleRelease' : 'assembleDebug'
  
  execSync(`./gradlew ${task}`, { 
    cwd: androidDir, 
    stdio: 'inherit'
  })

  // Find APK
  const variant = release ? 'release' : 'debug'
  const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', variant)
  
  try {
    const apkFiles = (await fs.readdir(apkDir)).filter(f => f.endsWith('.apk'))
    
    if (apkFiles.length > 0) {
      const apkPath = path.join(apkDir, apkFiles[0])
      const size = ((await fs.stat(apkPath)).size / 1024 / 1024).toFixed(1)
      
      if (outDir) {
        await fs.ensureDir(outDir)
        const dest = path.join(outDir, apkFiles[0])
        await fs.copy(apkPath, dest)
        console.log(chalk.green('✅'), `APK (${size} MB): ${dest}`)
      } else {
        console.log(chalk.green('✅'), `APK (${size} MB): ${apkPath}`)
      }
    }
  } catch {
    console.log(chalk.green('✅'), 'Android build complete')
  }
}

async function buildIOS(config, release, outDir) {
  const iosDir = path.join(process.cwd(), 'ios')
  
  if (!await fs.pathExists(iosDir)) {
    throw new Error('iOS platform not found. Run "web2app init --platform ios" first.')
  }

  if (process.platform !== 'darwin') {
    console.log(chalk.yellow('⚠'), 'iOS builds require macOS + Xcode. Skipped.')
    return
  }

  console.log(chalk.cyan('🍎 Building iOS...'))
  
  const buildConfig = release ? 'Release' : 'Debug'
  
  execSync(`xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration ${buildConfig} -sdk iphoneos build`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  console.log(chalk.green('✅'), 'iOS build complete')
  console.log(chalk.gray('   To export IPA: npx cap open ios → Xcode → Archive'))
}

module.exports = { build }
