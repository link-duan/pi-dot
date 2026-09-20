export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve()
  private count = 0

  get pending(): number {
    return this.count
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    this.count++
    const run = this.tail.then(fn, fn)
    this.tail = run.then(
      () => {
        this.count--
      },
      () => {
        this.count--
      },
    )
    return run
  }

  drain(): Promise<void> {
    return this.tail.then(
      () => undefined,
      () => undefined,
    )
  }
}
