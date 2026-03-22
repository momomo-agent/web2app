const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

// Android icon sizes
const ANDROID_ICONS = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
]

// iOS icon sizes
const IOS_ICONS = [
  { size: 20, scales: [2, 3] },
  { size: 29, scales: [2, 3] },
  { size: 40, scales: [2, 3] },
  { size: 60, scales: [2, 3] },
  { size: 76, scales: [1, 2] },
  { size: 83.5, scales: [2] },
  { size: 1024, scales: [1] },
]

async function icon(imagePath) {
  const absPath = path.resolve(imagePath)
  
  if (!await fs.pathExists(absPath)) {
    throw new Error(`Image not found: ${absPath}`)
  }

  console.log(chalk.cyan('🎨 Generating icons'))
  console.log(chalk.gray(`   Source: ${absPath}`))
  console.log('')

  // Check if sips is available (macOS)
  let resizer = 'sips'
  try {
    execSync('which sips', { stdio: 'pipe' })
  } catch {
    // Try sharp
    try {
      require('sharp')
      resizer = 'sharp'
    } catch {
      // Try ffmpeg
      try {
        execSync('which ffmpeg', { stdio: 'pipe' })
        resizer = 'ffmpeg'
      } catch {
        throw new Error('No image resizer found. Install sharp (npm i sharp) or use macOS (sips).')
      }
    }
  }

  // Android icons
  const androidResDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res')
  
  if (await fs.pathExists(androidResDir)) {
    console.log(chalk.white('Android:'))
    
    for (const { dir, size } of ANDROID_ICONS) {
      const outDir = path.join(androidResDir, dir)
      await fs.ensureDir(outDir)
      const outPath = path.join(outDir, 'ic_launcher.png')
      
      resizeImage(resizer, absPath, outPath, size)
      
      // Also create round icon
      const roundPath = path.join(outDir, 'ic_launcher_round.png')
      resizeImage(resizer, absPath, roundPath, size)
      
      console.log(chalk.green('  ✓'), `${dir}: ${size}x${size}`)
    }
    console.log('')
  }

  // iOS icons
  const iosAssetsDir = path.join(process.cwd(), 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
  
  if (await fs.pathExists(iosAssetsDir)) {
    console.log(chalk.white('iOS:'))
    
    const contents = { images: [] }
    
    for (const { size, scales } of IOS_ICONS) {
      for (const scale of scales) {
        const px = Math.round(size * scale)
        const filename = `icon-${size}@${scale}x.png`
        const outPath = path.join(iosAssetsDir, filename)
        
        resizeImage(resizer, absPath, outPath, px)
        
        contents.images.push({
          size: `${size}x${size}`,
          idiom: size >= 76 ? 'ipad' : 'iphone',
          filename,
          scale: `${scale}x`
        })
        
        console.log(chalk.green('  ✓'), `${filename}: ${px}x${px}`)
      }
    }
    
    // Also add universal
    const universalPath = path.join(iosAssetsDir, 'icon-1024.png')
    resizeImage(resizer, absPath, universalPath, 1024)
    contents.images.push({
      size: '1024x1024',
      idiom: 'ios-marketing',
      filename: 'icon-1024.png',
      scale: '1x'
    })
    
    await fs.writeJson(path.join(iosAssetsDir, 'Contents.json'), { images: contents.images, info: { version: 1, author: 'web2app' } }, { spaces: 2 })
    console.log('')
  }

  console.log(chalk.green('✅'), 'Icons generated!')
  console.log(chalk.gray('   Run "web2app build" to apply.'))
}

function resizeImage(resizer, input, output, size) {
  if (resizer === 'sips') {
    execSync(`sips -z ${size} ${size} "${input}" --out "${output}"`, { stdio: 'pipe' })
  } else if (resizer === 'ffmpeg') {
    execSync(`ffmpeg -y -i "${input}" -vf "scale=${size}:${size}" "${output}"`, { stdio: 'pipe' })
  }
}

module.exports = { icon }
