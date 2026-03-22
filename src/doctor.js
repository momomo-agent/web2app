const { execSync } = require('child_process')
const chalk = require('chalk')

function check(name, cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    console.log(chalk.green('  ✓'), `${name}: ${output.split('\n')[0]}`)
    return true
  } catch {
    console.log(chalk.red('  ✗'), `${name}: not found`)
    return false
  }
}

async function doctor() {
  console.log(chalk.cyan('🩺 web2app doctor\n'))
  
  let ok = true
  
  // General
  console.log(chalk.white('General:'))
  check('Node.js', 'node --version')
  check('npm', 'npm --version')
  console.log('')
  
  // Android
  console.log(chalk.white('Android:'))
  const hasJava = check('JDK', 'java --version 2>&1 | head -1')
  const hasJavac = check('javac', 'javac --version')
  
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) {
    console.log(chalk.green('  ✓'), `ANDROID_SDK: ${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}`)
  } else {
    console.log(chalk.red('  ✗'), 'ANDROID_SDK: not set (set ANDROID_HOME)')
    ok = false
  }
  
  check('adb', 'adb --version | head -1')
  check('gradle', 'gradle --version 2>&1 | grep Gradle | head -1')
  console.log('')
  
  // iOS (macOS only)
  if (process.platform === 'darwin') {
    console.log(chalk.white('iOS:'))
    check('Xcode', 'xcodebuild -version | head -1')
    check('CocoaPods', 'pod --version')
    check('Simulator', 'xcrun simctl list devices available | grep "iPhone" | head -1')
    console.log('')
  }
  
  // Connected devices
  console.log(chalk.white('Devices:'))
  try {
    const devices = execSync('adb devices -l', { encoding: 'utf8' })
    const lines = devices.split('\n').filter(l => l.includes('device') && !l.includes('List'))
    if (lines.length > 0) {
      lines.forEach(l => console.log(chalk.green('  ✓'), `Android: ${l.trim()}`))
    } else {
      console.log(chalk.yellow('  -'), 'No Android devices connected')
    }
  } catch {
    console.log(chalk.yellow('  -'), 'Cannot check devices (adb not available)')
  }
  
  if (process.platform === 'darwin') {
    try {
      const sims = execSync('xcrun simctl list devices booted', { encoding: 'utf8' })
      const bootedLines = sims.split('\n').filter(l => l.includes('Booted'))
      if (bootedLines.length > 0) {
        bootedLines.forEach(l => console.log(chalk.green('  ✓'), `iOS Sim: ${l.trim()}`))
      } else {
        console.log(chalk.yellow('  -'), 'No iOS simulators running')
      }
    } catch {}
  }
  
  console.log('')
  
  if (!hasJava || !hasJavac) {
    console.log(chalk.yellow('💡 Install JDK:'))
    console.log(chalk.gray('   macOS: brew install openjdk@17'))
    console.log(chalk.gray('   Linux: apt install openjdk-17-jdk'))
    console.log('')
  }
  
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    console.log(chalk.yellow('💡 Install Android SDK:'))
    console.log(chalk.gray('   macOS: brew install android-commandlinetools'))
    console.log(chalk.gray('   Then: sdkmanager "platforms;android-34" "build-tools;34.0.0"'))
    console.log(chalk.gray('   Set: export ANDROID_HOME=$HOME/Library/Android/sdk'))
    console.log('')
  }
}

module.exports = { doctor }
