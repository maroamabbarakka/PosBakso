export function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(value)
}

export function rupiahCompact(value: number) {
  return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(value)
}

export function numberId(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits }).format(value)
}

export function dateTimeId(value: string | Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Makassar' }).format(new Date(value))
}

export function dateId(value: string | Date) {
  return new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year:'numeric', timeZone:'Asia/Makassar' }).format(new Date(value))
}

export function timeId(value: string | Date) {
  return new Intl.DateTimeFormat('id-ID', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Makassar' }).format(new Date(value))
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
}

export function localDateKey(value: string | Date = new Date()) {
  const d = new Date(value)
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Makassar', year:'numeric', month:'2-digit', day:'2-digit' }).format(d)
}
