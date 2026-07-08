/**
 * Run a Python script with the first available interpreter (Windows: python/py; Unix: python3/python).
 */
const { spawnSync } = require('child_process')
const path = require('path')

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: node scripts/run-python.cjs <script.py> [args…]')
  process.exit(1)
}

const scriptPath = path.resolve(process.cwd(), args[0])
const scriptArgs = args.slice(1)
const candidates = process.platform === 'win32'
  ? ['python', 'py', 'python3']
  : ['python3', 'python']

for (const bin of candidates) {
  const result = spawnSync(bin, [scriptPath, ...scriptArgs], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error?.code === 'ENOENT') continue
  process.exit(result.status ?? 1)
}

console.error('[run-python] No Python found. Install Python 3.10+ and run: pip install pillow')
process.exit(1)
