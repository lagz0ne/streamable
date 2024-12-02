import { streamable } from "streambly"

type CounterApp = {
  autoCount: number
  math: number
}

type CounterAPI = {
  inc: () => void
  minus: () => void
}

export const counter = streamable<CounterApp>()
  .api<CounterAPI>()
  .impls(async ({ setCurrent }, initialValue = { autoCount: 0, math: 0 }) => {
    const app = initialValue

    const interval = setInterval(() => {
      app.autoCount++
      setCurrent(app)
    }, 5000)

    const counterApi: CounterAPI = {
      inc: () => {
        app.math++
        setCurrent(app)
      },
      minus: () => {
        app.math--
        setCurrent(app)
      }
    }

    return {
      initialValue: app,
      controller: counterApi,
      cleanup: () => clearInterval(interval)
    }
  })

