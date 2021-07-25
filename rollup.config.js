import path from 'path'
import ts from 'rollup-plugin-typescript2'
import postcss from 'rollup-plugin-postcss'
import rollupResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

import pkg from './package.json'

const name = path.basename(pkg.name)
const resolve = (p) => path.resolve(__dirname, p)
const packageOptions = pkg.buildOptions || {}
const dist = process.env.DIST || `dist`
const isProd = process.env.NODE_ENV === 'production'

const date = {
  day: new Date().getDate(),
  month: 'January February March April May June July August September October November December'.split(' ')[
    new Date().getMonth()
  ],
  year: new Date().getFullYear(),
}
const banner = `
/**!
 * ${pkg.name} ${pkg.version}
 * Released on: ${date.month} ${date.day}, ${date.year}
 */
`.trim()

const outputConfigs = {
  esm: {
    file: resolve(`${dist}/src/${name}.esm.js`),
    format: 'es',
  },
  cjs: {
    file: resolve(`${dist}/src/${name}.cjs.js`),
    format: 'cjs',
  },
  global: {
    file: resolve(`${dist}/src/${name}.global.js`),
    format: 'iife',
  },
  dev: {
    file: resolve(`${dist}/${name}.global.js`),
    format: 'iife',
  },
}

const defaultFormats = ['esm', 'cjs']
const inlineFormats = process.env.FORMATS && process.env.FORMATS.split('.')
const formats = inlineFormats || pkg.buildOptions.formats || defaultFormats

// ensure TS checks only once for each build
let hasTSChecked = false

const configs = (inlineFormats || ['global']).map((format) => createConfig(format, outputConfigs[format]))

if (isProd) {
  formats.forEach((format) => {
    configs.push(createProdConfig(format))
  })
}

export default configs

function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(require('chalk').yellow(`invalid format: "${format}"`))
    process.exit(1)
  }

  output.banner = banner
  output.sourcemap = !!process.env.SOURCE_MAP
  output.externalLiveBindings = false
  format === 'cjs' && (output.exports = 'auto')

  const isGlobalBuild = /iife/.test(output.format)
  isGlobalBuild && (output.name = packageOptions.name || name)

  const shouldEmitDeclarations = process.env.TYPES != null && !hasTSChecked

  const tsPlugins = ts({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    tsconfigOverride: {
      compilerOptions: {
        sourceMap: false,
        declaration: shouldEmitDeclarations,
        declarationMap: shouldEmitDeclarations,
      },
    },
  })

  // ensure TS checks only once for each build
  hasTSChecked = true

  const external = []

  return {
    input: 'src/index.ts',
    output,
    external,
    plugins: [
      postcss({ plugins: [require('autoprefixer')], minimize: isProd }),
      rollupResolve({ browser: true }),
      commonjs({ exclude: 'node_modules' }),
      json,
      tsPlugins,
      ...plugins,
    ],
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
    // treeshake: {
    //   moduleSideEffects: false
    // }
  }
}

function createProdConfig(format) {
  const { terser } = require('rollup-plugin-terser')
  const plugins = []
  if (/^(global|esm)/.test(format)) {
    plugins.push(
      terser({
        module: /^esm/.test(format),
        compress: { ecma: 2015, pure_getters: true },
        safari10: true,
      })
    )
  }
  return createConfig(
    format,
    {
      file: resolve(`${dist}/${name}.${format}.js`),
      format: outputConfigs[format].format,
    },
    plugins
  )
}
