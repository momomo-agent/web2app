const { execSync } = require('child_process')
const chalk = require('chalk')
const fs = require('fs-extra')
const path = require('path')

function check(name, cmd) {
  try {
    const result = execSync(cmd, { stdio: 'pipe', timeout: 10000 }).toString().trim()
    const version = result.split('\n')[0].trim()
    if (version.includes('error') || version.includes('not found') || version.includes("couldn't")) {
      console.log(chalk.red('  ✗'), `${name}: not found`)
      return false
    }
    console.log(chalk.green('  ✓'), `${name}: ${version}`)
    return true
  } catch {
    console.log(chalk.red('  ✗'), `${name}: not found`)
    return false
  }
}

async function doctor() {
  console.log(chalk.cyan('🩺 web2app doctor\n'))
  
  let ok = true
  
  // Node.js
  console.log(chalk.gray('Core:'))
  check('Node.js', 'node --version')
  check('npm', 'npm --version')
  
  // Android
  console.log('')
  console.log(chalk.gray('Android:'))
  const hasJava = check('JDK', 'java --version 2>&1 | head -1')
  const hasAndroidHome = !!process.env.ANDROID_HOME || !!process.env.ANDROID_SDK_ROOT
  
  if (hasAndroidHome) {
    console.log(chalk.green('  ✓'), `ANDROID_HOME: ${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}`)
  } else {
    console.log(chalk.red('  ✗'), 'ANDROID_HOME: not set')
    ok = false
  }
  
  const hasGradle = check('Gradle', 'gradle --version 2>&1 | grep "Gradle "')
  const hasAdb = check('adb', 'adb --version 2>&1 | head -1')
  
  // Check connected devices
  try {
    const devices = execSync('adb devices 2>/dev/null', { stdio: 'pipe' }).toString()
    const connected = devices.split('\n').filter(l => l.includes('\tdevice')).length
    if (connected > 0) {
      console.log(chalk.green('  ✓'), `Connected devices: ${connected}`)
    } else {
      console.log(chalk.yellow('  ⚠'), 'No devices connected')
    }
  } catch {}
  
  // iOS (macOS only)
  if (process.platform === 'darwin') {
    console.log('')
    console.log(chalk.gray('iOS:'))
    check('Xcode', 'xcodebuild -version 2>&1 | head -1')
    check('CocoaPods', 'pod --version')
    check('ios-deploy', 'ios-deploy --version 2>&1 | head -1')
  }
  
  // Check current project
  console.log('')
  console.log(chalk.gray('Project:'))
  const configPath = path.join(process.cwd(), 'web2app.config.json')
  if (await fs.pathExists(configPath)) {
    const config = await fs.readJson(configPath)
    console.log(chalk.green('  ✓'), `Project: ${config.name} (${config.id})`)
    console.log(chalk.green('  ✓'), `Source: ${config.source || config.url || 'unknown'}`)
    console.log(chalk.green('  ✓'), `Platform: ${config.platform}`)
  } else {
    console.log(chalk.yellow('  ⚠'), 'No web2app project in current directory')
  }
  
  console.log('')
  if (ok) {
    console.log(chalk.green('✅ Environment looks good!'))
  } else {
    console.log(chalk.yellow('⚠  Some issues found. Fix them before building.'))
  }
}

module.exports = { doctor }
