/**
 * Web Bluetooth API Transport untuk Printer Thermal ESC/POS (BLE GATT).
 * Bekerja pada Google Chrome dan Microsoft Edge di Android, ChromeOS, Windows, dan macOS.
 */

// UUID GATT Service yang umum digunakan oleh printer thermal Bluetooth BLE
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Pos-58 common
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/Chinese printer GATT
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic custom 58mm/80mm
]

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

let activeBleDevice: any = null
let activeBleCharacteristic: any = null

export async function requestWebBluetoothPrinter(): Promise<{ id: string; name: string }> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Google Chrome pada Android atau Desktop.')
  }

  const nav = navigator as any
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  })

  activeBleDevice = device
  return {
    id: device.id,
    name: device.name || 'Bluetooth Thermal Printer',
  }
}

export async function connectWebBluetooth(device?: any): Promise<any> {
  const targetDevice = device || activeBleDevice
  if (!targetDevice) {
    throw new Error('Belum ada printer Web Bluetooth yang dipilih.')
  }

  const server = await targetDevice.gatt.connect()
  let characteristic: any = null

  // Cari service dan characteristic yang dapat menerima data write
  for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid)
      const characteristics = await service.getCharacteristics()
      characteristic = characteristics.find(
        (c: any) => c.properties.write || c.properties.writeWithoutResponse
      )
      if (characteristic) break
    } catch {
      // Lanjutkan ke service berikutnya jika service UUID tidak cocok
    }
  }

  if (!characteristic) {
    throw new Error('Layanan penulisan data ESC/POS (write characteristic) tidak ditemukan pada printer ini.')
  }

  activeBleCharacteristic = characteristic
  return characteristic
}

/**
 * Mengirim data ESC/POS biner dengan chunking aman untuk mencegah buffer overflow pada printer thermal portabel.
 */
export async function writeWebBluetooth(data: Uint8Array, chunkSize = 100, delayMs = 15): Promise<void> {
  if (!activeBleCharacteristic || !activeBleDevice?.gatt?.connected) {
    await connectWebBluetooth()
  }

  const characteristic = activeBleCharacteristic
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk)
    } else {
      await characteristic.writeValue(chunk)
    }
    if (delayMs > 0 && i + chunkSize < data.length) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

export function getWebBluetoothStatus(): { connected: boolean; name: string; id: string } {
  return {
    connected: Boolean(activeBleDevice?.gatt?.connected),
    name: activeBleDevice?.name || '',
    id: activeBleDevice?.id || '',
  }
}
