const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

async function run(opts) {
  const { platform, device } = opts
  const configPath = path.join(process.cwd(), 'web2app.config.json')
  
  if (!await fs.pathExists(configPath)) {
    throw new Error('No web2app.config.json found. Run "web2app init" first.')
  }
  
  const config = await fs.readJson(configPath)
  
  console.log(chalk.cyan('▶ web2app run'))
  console.log(chalk.gray(`   App: ${config.name}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Target: ${device ? 'device' : 'emulator'}`))
  console.log('')
  
  // Sync web source first
  await syncSource(config)
  
  // Capacitor sync
  execSync('npx cap copy', { cwd: process.cwd(), stdio: 'inherit' })
  execSync('npx cap sync', { cwd: process.cwd(), stdio: 'inherit' })
  
  if (platform === 'android') {
    await runAndroid(device)
  } else if (platform === 'ios') {
    await runIOS(device)
  } else if (platform === 'mac') {
    await runMac()
  } else {
    throw new Error('Please specify --platform android, ios, or mac for run')
  }
}

async function syncSource(config) {
  if (!config.source) return // URL mode, nothing to sync
  
  const srcPath = path.resolve(config.sourceAbsolute || config.source)
  const wwwDir = path.join(process.cwd(), 'www')
  
  if (!await fs.pathExists(srcPath)) {
    throw new Error(`Source not found: ${srcPath}`)
  }
  
  console.log(chalk.cyan('📦 Syncing web source...'))
  
  const stat = await fs.stat(srcPath)
  
  if (stat.isDirectory()) {
    // Check for build output directories
    const buildDirs = ['dist', 'build', 'out', 'public']
    let buildDir = srcPath
    
    for (const dir of buildDirs) {
      const candidate = path.join(srcPath, dir)
      if (await fs.pathExists(candidate)) {
        buildDir = candidate
        break
      }
    }
    
    await fs.emptyDir(wwwDir)
    await fs.copy(buildDir, wwwDir)
  } else {
    await fs.emptyDir(wwwDir)
    await fs.copy(srcPath, path.join(wwwDir, path.basename(srcPath)))
    
    if (path.basename(srcPath) !== 'index.html') {
      const redirect = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${path.basename(srcPath)}"></head></html>`
      await fs.writeFile(path.join(wwwDir, 'index.html'), redirect)
    }
  }
  
  console.log(chalk.green('✓'), 'Web source synced')
}

async function runAndroid(device) {
  const androidDir = path.join(process.cwd(), 'android')
  
  if (!await fs.pathExists(androidDir)) {
    throw new Error('Android platform not found. Run "web2app init --platform android" first.')
  }
  
  console.log(chalk.cyan('🤖 Building & running Android...'))
  
  const gradlew = path.join(androidDir, 'gradlew')
  try { execSync(`chmod +x ${gradlew}`) } catch {}
  
  // Build
  execSync('./gradlew assembleDebug', { cwd: androidDir, stdio: 'inherit' })
  
  // Find APK
  const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug')
  const apkFiles = (await fs.readdir(apkDir)).filter(f => f.endsWith('.apk'))
  
  if (apkFiles.length === 0) {
    throw new Error('APK not found after build')
  }
  
  const apkPath = path.join(apkDir, apkFiles[0])
  
  // Install
  console.log(chalk.cyan('📲 Installing...'))
  const target = device ? '-d' : '-e'
  execSync(`adb ${target} install -r "${apkPath}"`, { stdio: 'inherit' })
  
  // Get package name from config
  const config = await fs.readJson(path.join(process.cwd(), 'web2app.config.json'))
  
  // Launch
  console.log(chalk.cyan('🚀 Launching...'))
  execSync(`adb ${target} shell am start -n ${config.id}/.MainActivity`, { stdio: 'inherit' })
  
  console.log(chalk.green('✅ Running on', device ? 'device' : 'emulator'))
}

async function runIOS(device) {
  if (process.platform !== 'darwin') {
    throw new Error('iOS builds require macOS')
  }
  
  const iosDir = path.join(process.cwd(), 'ios')
  
  if (!await fs.pathExists(iosDir)) {
    throw new Error('iOS platform not found. Run "web2app init --platform ios" first.')
  }
  
  console.log(chalk.cyan('🍎 Building & running iOS...'))
  
  if (device) {
    execSync('npx cap run ios --target device', { cwd: process.cwd(), stdio: 'inherit' })
  } else {
    execSync('npx cap run ios', { cwd: process.cwd(), stdio: 'inherit' })
  }
  
  console.log(chalk.green('✅ Running on', device ? 'device' : 'simulator'))
}

async function runMac() {
  const macDir = path.join(process.cwd(), 'mac')
  
  if (!await fs.pathExists(macDir)) {
    throw new Error('Mac platform not found. Run "web2app init --platform mac" first.')
  }

  console.log(chalk.cyan('💻 Running Mac app...'))
  
  // Check electron is installed
  const electronPath = path.join(process.cwd(), 'node_modules', '.bin', 'electron')
  if (!await fs.pathExists(electronPath)) {
    console.log(chalk.cyan('📦 Installing electron...'))
    execSync('npm install electron@^33.0.0', { stdio: 'inherit' })
  }

  execSync('npx electron .', { 
    cwd: process.cwd(), 
    stdio: 'inherit' 
  })
  
  console.log(chalk.green('✅'), 'Mac app closed')
}

module.exports = { run, syncSource }
