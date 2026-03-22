const fs = require('fs-extra')
const path = require('path')
const { execSync } = require('child_process')
const chalk = require('chalk')

// Android adaptive icon sizes
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
  const srcImage = path.resolve(imagePath)
  
  if (!await fs.pathExists(srcImage)) {
    throw new Error(`Image not found: ${srcImage}`)
  }
  
  console.log(chalk.cyan('🎨 web2app icon'))
  console.log(chalk.gray(`   Source: ${srcImage}`))
  console.log('')
  
  // Check if sharp or sips is available
  let resizer = null
  
  try {
    require.resolve('sharp')
    resizer = 'sharp'
  } catch {
    if (process.platform === 'darwin') {
      resizer = 'sips'
    }
  }
  
  if (!resizer) {
    console.log(chalk.yellow('⚠'), 'Install sharp for icon generation: npm install sharp')
    console.log(chalk.yellow('⚠'), 'Or use macOS (sips is built-in)')
    return
  }
  
  // Android icons
  const androidResDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res')
  if (await fs.pathExists(androidResDir)) {
    console.log(chalk.gray('Android:'))
    
    for (const { dir, size } of ANDROID_ICONS) {
      const outDir = path.join(androidResDir, dir)
      await fs.ensureDir(outDir)
      const outPath = path.join(outDir, 'ic_launcher.png')
      
      await resize(resizer, srcImage, outPath, size)
      console.log(chalk.green('  ✓'), `${dir}/ic_launcher.png (${size}x${size})`)
      
      // Also create round icon
      const roundPath = path.join(outDir, 'ic_launcher_round.png')
      await resize(resizer, srcImage, roundPath, size)
      console.log(chalk.green('  ✓'), `${dir}/ic_launcher_round.png (${size}x${size})`)
    }
  }
  
  // iOS icons
  const iosAssetsDir = path.join(process.cwd(), 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
  if (await fs.pathExists(iosAssetsDir)) {
    console.log('')
    console.log(chalk.gray('iOS:'))
    
    const contents = { images: [], info: { version: 1, author: 'web2app' } }
    
    for (const { size, scales } of IOS_ICONS) {
      for (const scale of scales) {
        const px = Math.round(size * scale)
        const filename = `icon-${size}x${size}@${scale}x.png`
        const outPath = path.join(iosAssetsDir, filename)
        
        await resize(resizer, srcImage, outPath, px)
        console.log(chalk.green('  ✓'), `${filename} (${px}x${px})`)
        
        contents.images.push({
          size: `${size}x${size}`,
          idiom: size === 76 || size === 83.5 ? 'ipad' : 'iphone',
          filename: filename,
          scale: `${scale}x`
        })
      }
    }
    
    // Add universal 1024
    contents.images.push({
      size: '1024x1024',
      idiom: 'ios-marketing',
      filename: 'icon-1024x1024@1x.png',
      scale: '1x'
    })
    
    await fs.writeJson(path.join(iosAssetsDir, 'Contents.json'), contents, { spaces: 2 })
    console.log(chalk.green('  ✓'), 'Contents.json updated')
  }
  
  console.log('')
  console.log(chalk.green('✅ Icons generated!'))
}

async function resize(resizer, src, dest, size) {
  if (resizer === 'sharp') {
    const sharp = require('sharp')
    await sharp(src).resize(size, size).png().toFile(dest)
  } else if (resizer === 'sips') {
    const tmp = dest + '.tmp.png'
    await fs.copy(src, tmp)
    execSync(`sips -z ${size} ${size} "${tmp}" --out "${dest}" 2>/dev/null`, { stdio: 'pipe' })
    await fs.remove(tmp)
  }
}

module.exports = { icon }
