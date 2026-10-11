import type { AppData } from '../types'
import { commitLocalCommand, type SyncMutation } from '../lib/localDb'

export interface CommandResult<T = void> {
  nextState: AppData
  mutations: SyncMutation[]
  value?: T
}

/**
 * Serialized business command executor.
 * Mencegah race condition yang disebabkan oleh pembacaan stale React closure.
 * Menjamin bahwa setiap mutasi bisnis membaca state paling mutakhir,
 * menyimpan durabilitas ke IndexedDB secara atomik sebelum state React di-render ulang.
 */
export class CommandExecutor {
  private tail: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly getState: () => AppData,
    private readonly replaceState: (state: AppData) => void,
  ) {}

  run<T>(command: (current: AppData) => CommandResult<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      // Ambil snapshot data paling mutakhir tepat saat giliran eksekusi tiba
      const current = this.getState()
      const result = command(current)

      // Simpan state baru dan antrean mutasi cloud secara atomik
      await commitLocalCommand(result.nextState, result.mutations)

      // Terapkan ke state aplikasi di memory/React
      this.replaceState(result.nextState)

      return result.value as T
    }

    const pending = this.tail.then(execute, execute)
    this.tail = pending.catch(() => undefined)
    return pending
  }
}
