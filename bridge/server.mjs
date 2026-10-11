import http from 'node:http'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.POS_BRIDGE_PORT || 18181)
const root = path.dirname(fileURLToPath(import.meta.url))
const stateFile = path.join(root, '.bridge-state.json')
const allowed = new Set(
  (process.env.POS_ALLOWED_ORIGINS || 'https://rhezeckpos.web.app,https://rhezeckpos.firebaseapp.com,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(x => x.trim())
)

let state = await fs.readFile(stateFile, 'utf8').then(JSON.parse).catch(() => ({
  token: crypto.randomBytes(32).toString('hex'),
  pairCode: String(crypto.randomInt(100000, 999999)),
  jobs: [],
}))
await fs.writeFile(stateFile, JSON.stringify(state, null, 2))

const completedJobs = new Set(state.jobs || [])
const inFlightJobs = new Set()
let failedPairings = []

function canAttemptPair() {
  const cutoff = Date.now() - 60_000
  failedPairings = failedPairings.filter(time => time > cutoff)
  return failedPairings.length < 5
}

const run = (file, args) =>
  new Promise((resolve, reject) =>
    execFile(file, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, (e, stdout) => (e ? reject(e) : resolve(stdout)))
  )

const printers = async () => {
  const raw = await run('powershell.exe', ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress'])
  if (!String(raw).trim()) return []
  const value = JSON.parse(String(raw))
  return Array.isArray(value) ? value : [value]
}

const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

const body = req =>
  new Promise((resolve, reject) => {
    let value = ''
    req.on('data', c => {
      value += c
      if (value.length > 8_000_000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(value ? JSON.parse(value) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })

const authorized = req => req.headers.authorization === `Bearer ${state.token}`

const persist = async () => {
  state.jobs = [...completedJobs].slice(-500)
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2))
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !allowed.has(origin)) return json(res, 403, { error: 'Origin tidak diizinkan' })
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  try {
    if (req.url === '/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, version: '1.1.0', printers: await printers() })
    }

    if (req.url === '/pair' && req.method === 'POST') {
      if (!canAttemptPair()) {
        return json(res, 429, { error: 'Terlalu banyak percobaan pairing gagal. Coba lagi dalam 1 menit.' })
      }
      const data = await body(req)
      if (String(data.code) !== state.pairCode) {
        failedPairings.push(Date.now())
        return json(res, 401, { error: 'Kode pairing salah' })
      }
      state.pairCode = String(crypto.randomInt(100000, 999999))
      await persist()
      return json(res, 200, { token: state.token })
    }

    if (!authorized(req)) return json(res, 401, { error: 'Token bridge belum dipasangkan' })

    if (req.url === '/printers' && req.method === 'GET') {
      return json(res, 200, { printers: await printers() })
    }

    if (req.url === '/print' && req.method === 'POST') {
      const data = await body(req)
      if (!data.jobId || !data.printerName || !data.data) {
        return json(res, 400, { error: 'jobId, printerName, dan data wajib diisi' })
      }

      // Race-condition duplicate print guard
      if (completedJobs.has(data.jobId) || inFlightJobs.has(data.jobId)) {
        return json(res, 200, { ok: true, duplicate: true })
      }

      inFlightJobs.add(data.jobId)
      const file = path.join(os.tmpdir(), `posbakso-${crypto.randomUUID()}.bin`)
      try {
        await fs.writeFile(file, Buffer.from(data.data, 'base64'))
        await run('powershell.exe', [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(root, 'print-raw.ps1'),
          '-PrinterName',
          data.printerName,
          '-FilePath',
          file,
        ])
        completedJobs.add(data.jobId)
        await persist()
        return json(res, 200, { ok: true })
      } finally {
        inFlightJobs.delete(data.jobId)
        await fs.unlink(file).catch(() => {})
      }
    }

    return json(res, 404, { error: 'Endpoint tidak ditemukan' })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`POS Bakso Print Bridge: http://127.0.0.1:${PORT}`)
  console.log(`Kode pairing: ${state.pairCode}`)
  console.log('Biarkan jendela ini tetap berjalan saat POS digunakan.')
})
