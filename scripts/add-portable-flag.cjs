// electron-builder artifactBuildCompleted hook: put portable.flag into the
// portable zip, so that copy keeps its data in a "data" folder next to the exe
// (SPEC 8). The installers never get the flag.
const { execFileSync } = require('node:child_process')
const { chmodSync } = require('node:fs')
const path = require('node:path')
const { path7za } = require('7zip-bin')

exports.default = async function addPortableFlag(context) {
  if (!context.file || !context.file.endsWith('-portable.zip')) return
  if (process.platform !== 'win32') chmodSync(path7za, 0o755)
  execFileSync(path7za, ['a', '-tzip', context.file, 'portable.flag'], {
    cwd: path.join(__dirname, '..', 'build', 'portable'),
    stdio: 'inherit',
  })
}
