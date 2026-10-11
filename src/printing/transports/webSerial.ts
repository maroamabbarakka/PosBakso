/**
 * Web Serial API Transport untuk Printer Thermal ESC/POS (USB / Virtual COM Port Bluetooth).
 * Bekerja pada Google Chrome dan Microsoft Edge di Windows, macOS, dan Linux tanpa server bridge tambahan.
 */

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

let activeSerialPort: any = null

export async function requestWebSerialPrinter(): Promise<{ name: string }> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API tidak didukung di browser ini. Gunakan Google Chrome atau Edge pada desktop.')
  }

  const nav = navigator as any
  const port = await nav.serial.requestPort()
  activeSerialPort = port
  const info = port.getInfo ? port.getInfo() : {}
  const portName = info.usbVendorId
    ? `USB Printer (VID: 0x${info.usbVendorId.toString(16).padStart(4, '0')})`
    : 'Serial / Bluetooth COM Printer'

  return { name: portName }
}

export async function openWebSerialPort(baudRate = 9600): Promise<any> {
  if (!activeSerialPort) {
    throw new Error('Belum ada port printer serial yang dipilih.')
  }

  if (!activeSerialPort.readable || !activeSerialPort.writable) {
    await activeSerialPort.open({ baudRate })
  }

  return activeSerialPort
}

export async function writeWebSerial(data: Uint8Array): Promise<void> {
  const port = await openWebSerialPort()
  const writer = port.writable.getWriter()
  try {
    await writer.write(data)
  } finally {
    writer.releaseLock()
  }
}

export function getWebSerialStatus(): { connected: boolean; name: string } {
  return {
    connected: Boolean(activeSerialPort?.writable),
    name: activeSerialPort ? 'Serial / COM Port' : '',
  }
}
