import { createStreamable, withController } from "streamable"

type CounterApp = {
  autoCount: number
  math: number
}

type CounterAPI = {
  inc: () => void
  minus: () => void
}

export const counter = createStreamable<CounterApp, CounterAPI>((notifier, initialValue) => {
  const app = structuredClone(initialValue)

  const interval = setInterval(() => {
    ++app.autoCount
    notifier.next(app)
  }, 5000)

  const counterApi: CounterAPI = {
    inc: () => {
      app.math++
      notifier.next(app)
    },
    minus: () => {
      app.math--
      notifier.next(app)
    }
  }

  return withController(() => {
    clearInterval(interval)
  }, counterApi)
})