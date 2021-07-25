/*
NODE_ENV=development yarn dev
*/
const execa = require('execa')
const args = require('minimist')(process.argv.slice(2))
const formats = args.formats || args.f
const sourceMap = args.sourcemap || args.s
const dist = args.dist || args.d

execa(
  'rollup',
  [
    '-wc',
    '--environment',
    [
      `FORMATS:${formats || 'dev'}`,
      `DIST:${dist || 'public'}`,
      sourceMap ? `SOURCE_MAP:true` : ``
    ]
      .filter(Boolean)
      .join(',')
  ],
  {
    stdio: 'inherit'
  }
)
