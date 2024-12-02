import { createStream } from "streambly";
import { counter } from "../src/counter.app";
import { describe, expect, it } from "vitest"

describe("counter app should work", () => {

  it("should function", async () => {
    const stream = createStream(counter, { autoCount: 0, math: 0 }, undefined)

    stream.isStarted && await stream.isStarted()

    expect(stream.value().math).toBe(0)
    stream.controller().inc()

    expect(stream.value().math).toBe(1)
    stream.controller().minus()

    expect(stream.value().math).toBe(0)

  })
})
