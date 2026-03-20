const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

async function build(opts) {
  const { platform, release, out } = opts
  
  // Find capacitor.config.json in current directory
  const configPath = path.join(process.cwd(), 'capacitor.config.json')
  
  if (!await fs.pathExists(configPath)) {
    throw new Error('No capacitor.config.json found. Run "web2app init" first.')
  }

  const config = await fs.readJson(configPath)
  
  console.log(chalk.cyan('🔨 web2app build'))
  console.log(chalk.gray(`   App: ${config.appName}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Mode: ${release ? 'release' : 'debug'}`))
  console.log('')

  // Sync web assets
  console.log(chalk.cyan('📦 Syncing web assets...'))
  execSync('npx cap copy', { stdio: 'inherit' })
  execSync('npx cap sync', { stdio: 'inherit' })

  // Build Android
  if (platform === 'android' || platform === 'both') {
    await buildAndroid(release, out)
  }

  // Build iOS
  if (platform === 'ios' || platform === 'both') {
    await buildIOS(config, release, out)
  }
}

async function buildAndroid(release, outDir) {
  const androidDir = path.join(process.cwd(), 'android')
  
  if (!await fs.pathExists(androidDir)) {
    throw new Error('Android platform not found. Run "web2app init --platform android" first.')
  }

  console.log(chalk.cyan('🤖 Building Android...'))
  
  const gradlew = path.join(androidDir, 'gradlew')
  
  // Make gradlew executable
  try { execSync(`chmod +x ${gradlew}`) } catch {}
  
  const task = release ? 'assembleRelease' : 'assembleDebug'
  
  execSync(`./gradlew ${task}`, { 
    cwd: androidDir, 
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64' }
  })

  // Find APK
  const variant = release ? 'release' : 'debug'
  const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', variant)
  const apkFiles = (await fs.readdir(apkDir)).filter(f => f.endsWith('.apk'))
  
  if (apkFiles.length > 0) {
    const apkPath = path.join(apkDir, apkFiles[0])
    
    if (outDir) {
      const dest = path.join(outDir, apkFiles[0])
      await fs.copy(apkPath, dest)
      console.log(chalk.green('✅'), `APK: ${dest}`)
    } else {
      console.log(chalk.green('✅'), `APK: ${apkPath}`)
    }
  }
}

async function buildIOS(config, release, outDir) {
  const iosDir = path.join(process.cwd(), 'ios')
  
  if (!await fs.pathExists(iosDir)) {
    throw new Error('iOS platform not found. Run "web2app init --platform ios" first.')
  }

  // Check if on macOS
  if (process.platform !== 'darwin') {
    console.log(chalk.yellow('⚠'), 'iOS builds require macOS + Xcode. Skipped.')
    return
  }

  console.log(chalk.cyan('🍎 Building iOS...'))
  
  const scheme = config.appName || 'App'
  const buildConfig = release ? 'Release' : 'Debug'
  
  execSync(`xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration ${buildConfig} -sdk iphoneos build`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  console.log(chalk.green('✅'), 'iOS build complete')
  console.log(chalk.gray('   Open in Xcode to archive and export IPA:'))
  console.log(chalk.gray('   npx cap open ios'))
}

module.exports = { build }
