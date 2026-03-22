const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

async function run(opts) {
  const { platform, device } = opts
  
  const capConfigPath = path.join(process.cwd(), 'capacitor.config.json')
  
  if (!await fs.pathExists(capConfigPath)) {
    throw new Error('Not a web2app project. Run "web2app init" first.')
  }

  const config = await fs.readJson(capConfigPath)
  
  console.log(chalk.cyan('🚀 web2app run'))
  console.log(chalk.gray(`   App: ${config.appName}`))
  console.log(chalk.gray(`   Platform: ${platform}`))
  console.log(chalk.gray(`   Target: ${device ? 'device' : 'emulator'}`))
  console.log('')

  // Sync first
  console.log(chalk.cyan('📦 Syncing...'))
  execSync('npx cap sync', { stdio: 'inherit' })

  if (platform === 'android') {
    await runAndroid(device)
  } else if (platform === 'ios') {
    await runIOS(device)
  } else {
    throw new Error('Please specify --platform android or --platform ios')
  }
}

async function runAndroid(device) {
  const androidDir = path.join(process.cwd(), 'android')
  
  if (!await fs.pathExists(androidDir)) {
    throw new Error('Android platform not found.')
  }

  // Check for connected devices
  try {
    const devices = execSync('adb devices -l', { encoding: 'utf8' })
    const lines = devices.split('\n').filter(l => l.includes('device') && !l.includes('List'))
    
    if (lines.length === 0 && device) {
      console.log(chalk.yellow('⚠'), 'No devices connected. Connect a device or start an emulator.')
      console.log(chalk.gray('   Start emulator: emulator -avd <name>'))
      console.log(chalk.gray('   List emulators: emulator -list-avds'))
      return
    }
    
    if (lines.length > 0) {
      console.log(chalk.green('✓'), `Found ${lines.length} device(s)`)
    }
  } catch {
    console.log(chalk.yellow('⚠'), 'adb not found. Make sure Android SDK is installed.')
  }

  console.log(chalk.cyan('🤖 Building and installing...'))
  
  const gradlew = path.join(androidDir, 'gradlew')
  try { execSync(`chmod +x ${gradlew}`) } catch {}
  
  // Build and install
  execSync('./gradlew installDebug', {
    cwd: androidDir,
    stdio: 'inherit'
  })

  // Launch the app
  const configPath = path.join(process.cwd(), 'capacitor.config.json')
  const config = await fs.readJson(configPath)
  
  try {
    execSync(`adb shell am start -n ${config.appId}/.MainActivity`, { stdio: 'inherit' })
    console.log(chalk.green('✅'), 'App launched!')
  } catch {
    console.log(chalk.green('✅'), 'APK installed. Launch manually if needed.')
  }
}

async function runIOS(device) {
  if (process.platform !== 'darwin') {
    throw new Error('iOS runs require macOS.')
  }
  
  const iosDir = path.join(process.cwd(), 'ios')
  
  if (!await fs.pathExists(iosDir)) {
    throw new Error('iOS platform not found.')
  }

  console.log(chalk.cyan('🍎 Running on iOS...'))
  
  const target = device ? '-destination "generic/platform=iOS"' : '-destination "platform=iOS Simulator,name=iPhone 16"'
  
  execSync(`xcodebuild -workspace ios/App/App.xcworkspace -scheme App ${target} -configuration Debug build`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })

  if (!device) {
    // Boot simulator and install
    try {
      execSync('xcrun simctl boot "iPhone 16"', { stdio: 'pipe' })
    } catch {} // might already be booted
    
    execSync('open -a Simulator')
    console.log(chalk.green('✅'), 'App built. Install via Xcode or Simulator.')
  }
}

module.exports = { run }
