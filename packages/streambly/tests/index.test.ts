import { describe, it, expect, vi } from 'vitest';
import { createStream, streamable } from '../src/index';

type API = {
  inc: () => void
}

describe('createStream', () => {
  const numberStream = streamable<number>()
    .api<API>()
    .impls((({ setCurrent, getCurrent }, seed = 0) => {
      return {
        initialValue: seed,
        cleanup: () => { },
        controller: { inc: () => setCurrent(getCurrent() + 1) }
      }
    }))

  it('should start and stop the stream correctly', async () => {
    const notify = vi.fn()
    const stream = createStream(numberStream, 1, undefined)

    const unsub = stream.subscribe(notify)

    stream.isStarted && await stream.isStarted()

    expect(stream.value()).toBe(1);

    stream.controller().inc()
    expect(notify).toBeCalledTimes(1)
    expect(stream.value()).toBe(2);

    unsub()
    stream.controller().inc()
    expect(notify).toBeCalledTimes(1)

    stream.stop();
    expect(() => stream.value()).toThrowError();
  });

});

describe('createStream with timeout/promise', () => {
  it('should handle timeout correctly', async () => {
    const notify = vi.fn();
    const stream = createStream(({ setCurrent }, seed = 0) => {
      setTimeout(() => setCurrent(seed + 1), 100);

      return {
        initialValue: seed,
        controller: { inc: () => setCurrent(seed + 1) }
      };
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stream.value()).toBe(2);
    expect(notify).toBeCalledTimes(1);

    stream.stop();
  });

  it('should handle promise correctly', async () => {
    const notify = vi.fn();
    const stream = createStream(({ setCurrent: next }, seed = 0) => {
      new Promise<number>((resolve) => setTimeout(() => resolve(seed + 1), 100))
        .then(next);

      return {
        initialValue: seed,
        controller: { inc: () => next(seed + 1) }
      }
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stream.value()).toBe(2);
    expect(notify).toBeCalledTimes(1);

    stream.stop();
  });

  it("can use async function", async () => {
    const notify = vi.fn();

    const stream = createStream(async ({ setCurrent }, seed = 0) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      new Promise<number>((resolve) => setTimeout(() => resolve(seed + 1), 100))
        .then(setCurrent);

      return {
        initialValue: seed,
        controller: { inc: () => setCurrent(seed + 1) }
      };
    }, 1, undefined);
    stream.subscribe(notify);

    stream.isStarted && await stream.isStarted()

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(stream.value()).toBe(2);
    expect(notify).toBeCalledTimes(1);

    stream.stop();
  })
});

describe('createStream with cleanup', () => {
  it('should clean up interval on stop', async () => {
    const notify = vi.fn();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const stream = createStream(({ setCurrent }, seed = 0) => {
      let _seed = seed
      const intervalId = setInterval(() => setCurrent(_seed++), 100);
      return {
        initialValue: seed,
        cleanup: () => clearInterval(intervalId),
        controller: { inc: () => setCurrent(_seed++) }
      }
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(notify).toBeCalledTimes(2);

    stream.stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should clean up promise on stop', async () => {
    const notify = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const stream = createStream(({ setCurrent }, seed = 0) => {
      const timeoutId = setTimeout(() => setCurrent(seed + 1), 100);
      return {
        initialValue: seed,
        cleanup: () => clearTimeout(timeoutId),
        controller: { inc: () => setCurrent(seed + 1) }
      }
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 50));
    stream.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(notify).not.toBeCalled();
  });
});