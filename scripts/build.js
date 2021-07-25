/*
NODE_ENV=production node scripts/build --formats esm -t // build
*/

const path = require('path')
const fs = require('fs-extra')
const chalk = require('chalk')
const execa = require('execa')
const { gzipSync } = require('zlib')
const { resolve } = require('path')
const pkg = require('../package.json')

const args = require('minimist')(process.argv.slice(2))
const formats = args.formats || args.f
const sourceMap = args.sourcemap || args.s
const buildTypes = args.types || args.t

const reoslve = (p) => path.resolve(__dirname, '..', p)

run()

async function run() {
  await build()
  checkFileSize(resolve(pkg.jsdelivr))
  // await fs.remove(resolve('dist/src'))

  console.log()
  console.log(chalk.cyan('build success ~'))
}

async function build() {
  if (!formats) {
    await fs.remove(reoslve('dist'))
  }
  const env = (pkg.buildOptions && pkg.buildOptions.env) || process.env.NODE_ENV || 'production'

  // rollup build
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [
        `NODE_ENV:${env}`,
        formats ? `FORMATS:${formats}` : ``,
        buildTypes ? `TYPES:true` : ``,
        sourceMap ? `SOURCE_MAP:true` : ``,
      ]
        .filter(Boolean)
        .join(','),
    ],
    {
      stdio: 'inherit',
    }
  )

  // build types
  if (buildTypes && pkg.types) {
    console.log()
    console.log(chalk.bold(chalk.yellow(`Rolling up type definitions ...`)))

    // build types
    const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(resolve('api-extractor.json'))
    const extractorResult = Extractor.invoke(extractorConfig, { localBuild: true, showVerboseMessages: true })

    if (extractorResult.succeeded) {
      // concat additional d.ts to rolled-up dts
      const typesDir = resolve('types')
      if (await fs.pathExists(typesDir)) {
        const dtsPath = resolve(pkg.types)
        const existing = await fs.readFile(dtsPath, 'utf-8')
        const typeFiles = await fs.readdir(typesDir)
        const toAdd = await Promise.all(
          typeFiles.map((file) => {
            return fs.readFile(path.resolve(typesDir, file), 'utf-8')
          })
        )
        await fs.writeFile(dtsPath, existing + '\n' + toAdd.join('\n'))
      }
      console.log(chalk.bold(chalk.green(`API Extractor completed successfully.`)))
    } else {
      console.error(
        `API Extractor completed with ${extractorResult.errorCount} errors` +
          ` and ${extractorResult.warningCount} warnings`
      )
      process.exitCode = 1
    }
  }
}

function checkFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const file = fs.readFileSync(filePath)
  const minSize = (file.length / 1024).toFixed(2) + 'kb'
  const gzipped = gzipSync(file)
  const gzippedSize = (gzipped.length / 1024).toFixed(2) + 'kb'
  console.log()
  console.log(`${chalk.gray(chalk.bold(path.basename(filePath)))} min:${minSize} / gzip:${gzippedSize}`)
}
