import type { AppData } from '../types.ts'
import { commitLocalCommand, type SyncMutation } from '../lib/localDb.ts'

export interface CommandResult<T = void> {
  nextState: AppData
  mutations: SyncMutation[]
  value?: T
}

/**
 * Serialized business command executor dengan canonical in-memory state.
 *
 * Mencegah 100% race condition stale-state closure React:
 * Canonical in-memory state diperbarui secara SINKRON tepat setelah
 * IndexedDB commit selesai, SEBELUM command berikutnya dalam antrean
 * diizinkan membaca state.
 *
 * React hanya berfungsi sebagai projection/view layer.
 */
export class CommandExecutor {
  private tail: Promise<unknown> = Promise.resolve()
  private currentState: AppData

  constructor(
    initialState: AppData,
    private readonly onStateChanged: (state: AppData) => void,
  ) {
    this.currentState = initialState
  }

  getCurrentState(): AppData {
    return this.currentState
  }

  setCanonicalState(next: AppData): void {
    this.currentState = next
  }

  run<T>(command: (current: AppData) => CommandResult<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      // 1. Ambil canonical state paling mutakhir secara sinkron dari memori executor
      const current = this.currentState
      const result = command(current)

      // 2. Durability barrier: simpan state baru dan outbox mutation secara atomik ke IndexedDB
      await commitLocalCommand(result.nextState, result.mutations)

      // 3. Perbarui canonical in-memory state secara SINKRON SEBELUM command berikutnya membaca
      this.currentState = result.nextState

      // 4. Perbarui state React untuk re-render tampilan
      this.onStateChanged(result.nextState)

      return result.value as T
    }

    const pending = this.tail.then(execute, execute)
    this.tail = pending.catch(() => undefined)
    return pending
  }
}
