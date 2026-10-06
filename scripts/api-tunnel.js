import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const identity = process.env.JOYNO_SSH_KEY || join(homedir(), '.ssh', 'roarly_vps')
if (!existsSync(identity)) {
  console.error('SSH key not found. Set JOYNO_SSH_KEY to your existing private key path. Never paste the key in chat.')
  process.exitCode = 1
} else {
  const host = process.env.JOYNO_SSH_HOST || '187.53.140.168'
  const user = process.env.JOYNO_SSH_USER || 'root'
  const localPort = Number(process.env.JOYNO_TUNNEL_PORT || 3002)
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !/^[a-zA-Z0-9_-]+$/.test(user) || !Number.isInteger(localPort) || localPort < 1024 || localPort > 65535) {
    throw new Error('Invalid SSH hostname/user or local tunnel port.')
  }
  console.log(`Opening private VPS tunnel on 127.0.0.1:${localPort}. Keep this terminal open; Ctrl+C closes it.`)
  const child = spawn('ssh', ['-i', identity, '-N', '-T',
    '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
    '-L', `127.0.0.1:${localPort}:127.0.0.1:3101`, `${user}@${host}`], { stdio: 'inherit' })
  child.on('error', () => { console.error('Could not start SSH. Check OpenSSH and the key path.'); process.exitCode = 1 })
  child.on('exit', (code) => { process.exitCode = code ?? 1 })
  process.once('SIGINT', () => child.kill('SIGINT'))
  process.once('SIGTERM', () => child.kill('SIGTERM'))
}
