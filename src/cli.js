#!/usr/bin/env node

const { Command } = require('commander')
const { init } = require('./init')
const { build } = require('./build')
const chalk = require('chalk')
const path = require('path')
const pkg = require('../package.json')

const program = new Command()

program
  .name('web2app')
  .description('Turn any web content into native iOS & Android apps')
  .version(pkg.version)

program
  .command('init')
  .description('Initialize a web2app project')
  .requiredOption('--name <name>', 'App name')
  .option('--id <id>', 'App bundle ID (e.g., com.example.app)')
  .option('--url <url>', 'Remote URL to wrap')
  .option('--source <path>', 'Local web source (file or directory)')
  .option('--platform <platform>', 'Target platform: android, ios, both', 'both')
  .option('--icon <path>', 'App icon (1024x1024 PNG)')
  .option('--splash <path>', 'Splash screen image')
  .option('--fullscreen', 'Enable fullscreen mode', false)
  .option('--orientation <mode>', 'Screen orientation: portrait, landscape, any', 'any')
  .option('--permissions <list>', 'Permissions: camera,microphone,location,storage,notifications', '')
  .option('--color <hex>', 'Status bar / theme color', '#ffffff')
  .option('--out <dir>', 'Output directory', '.')
  .action(async (opts) => {
    try {
      await init(opts)
    } catch (e) {
      console.error(chalk.red('Error:'), e.message)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build the native app')
  .option('--platform <platform>', 'Target platform: android, ios, both', 'both')
  .option('--release', 'Build release version', false)
  .option('--out <dir>', 'Output directory for APK/IPA')
  .action(async (opts) => {
    try {
      await build(opts)
    } catch (e) {
      console.error(chalk.red('Error:'), e.message)
      process.exit(1)
    }
  })

program.parse()
