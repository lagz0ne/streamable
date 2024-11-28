import { describe, it, expect, vi } from 'vitest';
import { createStream, withAPI, withController } from './index';

type API = {
  inc: () => void
}

describe('createStream', () => {
  it('should start and stop the stream correctly', async () => {
    const notify = vi.fn()
    const stream = createStream<number, API>(({ next }, seed) => {
      let _seed = seed

      return withAPI({
        inc: () => {
          next(++_seed);
        }
      })
    });

    const unsub = stream.subscribe(notify)

    stream.start(1);
    await stream.isStarted()
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
    const stream = createStream<number>(({ next }, seed) => {
      setTimeout(() => next(seed + 1), 100);
      return withAPI(undefined);
    });

    stream.start(1);
    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stream.value()).toBe(2);
    expect(notify).toBeCalledTimes(1);

    stream.stop();
  });

  it('should handle promise correctly', async () => {
    const notify = vi.fn();
    const stream = createStream<number>(({ next }, seed) => {
      new Promise<number>((resolve) => setTimeout(() => resolve(seed + 1), 100))
        .then(next);
      return withAPI(undefined);
    });

    stream.start(1);
    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(stream.value()).toBe(2);
    expect(notify).toBeCalledTimes(1);

    stream.stop();
  });

  it("can use async function", async () => {
    const notify = vi.fn();

    const stream = createStream<number>(async ({ next }, seed) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      new Promise<number>((resolve) => setTimeout(() => resolve(seed + 1), 100))
        .then(next);

      return withAPI(undefined);
    });
    stream.subscribe(notify);

    stream.start(1);
    await stream.isStarted()

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

    const stream = createStream<number>(({ next }, seed) => {
      let _seed = seed
      const intervalId = setInterval(() => next(_seed++), 100);
      return withController(() => clearInterval(intervalId), undefined);
    });

    stream.start(1);
    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(notify).toBeCalledTimes(2);

    stream.stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should clean up promise on stop', async () => {
    const notify = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const stream = createStream<number>(({ next }, seed) => {
      const timeoutId = setTimeout(() => next(seed + 1), 100);
      return withController(() => clearTimeout(timeoutId), undefined);
    });

    stream.start(1);
    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 50));
    stream.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(notify).not.toBeCalled();
  });
});