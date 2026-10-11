import type { AppData } from '../types'
export function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean | undefined>>) {
  if (!rows.length) return
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text
  }
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => escape(row[h])).join(','))].join('\n')
  const blob = new Blob(['\uFEFF', csv], { type:'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}


export function createBackupPayload(data:AppData):AppData {
  return {
    ...data,
    users:data.users.map(user=>{const {pinHash:_pinHash,...safe}=user;return safe}),
    printers:data.printers.map(printer=>({...printer,connected:false})),
  }
}
