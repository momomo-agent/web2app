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

  const wantsMobile = platform === 'android' || platform === 'ios' || platform === 'both' || platform === 'all'

  // Capacitor sync (only for mobile)
  if (wantsMobile) {
    console.log(chalk.cyan('📦 Syncing native projects...'))
    execSync('npx cap copy', { stdio: 'inherit' })
    execSync('npx cap sync', { stdio: 'inherit' })
  }

  // Build Android
  if (platform === 'android' || platform === 'both' || platform === 'all') {
    await buildAndroid(config, release, out)
  }

  // Build iOS
  if (platform === 'ios' || platform === 'both' || platform === 'all') {
    await buildIOS(config, release, out)
  }

  // Build Mac
  if (platform === 'mac' || platform === 'all') {
    await buildMac(config, release, out)
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

async function buildMac(config, release, outDir) {
  const macDir = path.join(process.cwd(), 'mac')
  
  if (!await fs.pathExists(macDir)) {
    throw new Error('Mac platform not found. Run "web2app init --platform mac" first.')
  }

  if (process.platform !== 'darwin') {
    console.log(chalk.yellow('⚠'), 'Mac builds are best done on macOS. Continuing anyway...')
  }

  console.log(chalk.cyan('💻 Building Mac app...'))

  // Check electron-builder is available
  const builderPath = path.join(process.cwd(), 'node_modules', '.bin', 'electron-builder')
  if (!await fs.pathExists(builderPath)) {
    console.log(chalk.cyan('📦 Installing electron-builder...'))
    execSync('npm install --save-dev electron-builder@^25.0.0', { stdio: 'inherit' })
  }

  const args = ['--mac']
  if (!release) args.push('--dir') // dev build = unpacked directory (faster)
  
  execSync(`npx electron-builder ${args.join(' ')}`, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } // skip codesign for dev
  })

  // Find output
  const distDir = path.join(process.cwd(), 'mac-dist')
  if (await fs.pathExists(distDir)) {
    const files = await fs.readdir(distDir)
    const dmg = files.find(f => f.endsWith('.dmg'))
    const appDir = files.find(f => f === 'mac' || f === 'mac-arm64' || f === 'mac-universal')
    
    if (dmg) {
      const dmgPath = path.join(distDir, dmg)
      const size = ((await fs.stat(dmgPath)).size / 1024 / 1024).toFixed(1)
      if (outDir) {
        await fs.ensureDir(outDir)
        const dest = path.join(outDir, dmg)
        await fs.copy(dmgPath, dest)
        console.log(chalk.green('✅'), `DMG (${size} MB): ${dest}`)
      } else {
        console.log(chalk.green('✅'), `DMG (${size} MB): ${dmgPath}`)
      }
    } else if (appDir) {
      const appDirPath = path.join(distDir, appDir)
      const apps = (await fs.readdir(appDirPath)).filter(f => f.endsWith('.app'))
      if (apps.length > 0) {
        console.log(chalk.green('✅'), `App: ${path.join(appDirPath, apps[0])}`)
      } else {
        console.log(chalk.green('✅'), 'Mac build complete')
      }
    } else {
      console.log(chalk.green('✅'), 'Mac build complete')
    }
  }
}

module.exports = { build }
