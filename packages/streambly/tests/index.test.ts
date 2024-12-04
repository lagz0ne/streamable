import { describe, it, expect, vi } from 'vitest';
import { createStream, streamable } from '../src/index';

type API = {
  inc: () => void
}

describe('createStream', () => {
  const numberStream = streamable<number>()
    .api<API>()
    .impls((({ set, get }, initialValue = 0) => {
      return {
        initialValue,
        cleanup: () => { },
        controller: { inc: () => set(get() + 1) }
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
    const stream = createStream(({ set }, seed = 0) => {
      setTimeout(() => set(seed + 1), 100);

      return {
        initialValue: seed,
        controller: { inc: () => set(seed + 1) }
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
    const stream = createStream(({ set: next }, seed = 0) => {
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

    const stream = createStream(async ({ set }, seed = 0) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      new Promise<number>((resolve) => setTimeout(() => resolve(seed + 1), 100))
        .then(set);

      return {
        initialValue: seed,
        controller: { inc: () => set(seed + 1) }
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

    const stream = createStream(({ set }, seed = 0) => {
      let _seed = seed
      const intervalId = setInterval(() => set(_seed++), 100);
      return {
        initialValue: seed,
        cleanup: () => clearInterval(intervalId),
        controller: { inc: () => set(_seed++) }
      }
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 310));
    expect(notify).toBeCalledTimes(2);

    stream.stop();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should clean up promise on stop', async () => {
    const notify = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const stream = createStream(({ set }, seed = 0) => {
      const timeoutId = setTimeout(() => set(seed + 1), 100);
      return {
        initialValue: seed,
        cleanup: () => clearTimeout(timeoutId),
        controller: { inc: () => set(seed + 1) }
      }
    }, 1, undefined);

    stream.subscribe(notify);

    await new Promise((resolve) => setTimeout(resolve, 50));
    stream.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(notify).not.toBeCalled();
  });
});

describe('Stream States', () => {
  const simpleStream = streamable<number>()
    .impls(({ set }, initial = 0) => ({
      initialValue: initial,
      controller: undefined
    }));

  it('should report correct state transitions', async () => {
    const stream = createStream(async ({ set }, initial = 0) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        initialValue: initial,
        controller: {}
      };
    }, 0, undefined);

    expect(stream.state()).toBe('starting');
    stream.isStarted && await stream.isStarted();
    expect(stream.state()).toBe('running');
    stream.stop();
    expect(stream.state()).toBe('stop');
  });

  it('should handle multiple stops gracefully', () => {
    const stream = createStream(simpleStream, 0, undefined);
    stream.stop();
    expect(() => stream.stop()).toThrow();
    expect(() => stream.value()).toThrow();
  });
});

describe('Stream Error Handling', () => {
  it('should throw when accessing value before stream is ready', async () => {
    const stream = createStream(async ({ set }) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        initialValue: 0,
        controller: {}
      };
    }, 0, undefined);

    expect(() => stream.value()).toThrow();
    stream.isStarted && await stream.isStarted();
    expect(stream.value()).toBe(0);
  });

  it('should throw when accessing controller before stream is ready', async () => {
    const stream = createStream(async ({ set }) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        initialValue: 0,
        controller: { test: () => { } }
      };
    }, 0, undefined);

    expect(() => stream.controller()).toThrow();
    stream.isStarted && await stream.isStarted();
    expect(stream.controller()).toBeDefined();
  });

  it('should handle errors in stream initialization', () => {
    expect(() => createStream(() => {
      throw new Error('Init error');
    }, 0, undefined)).toThrow();
  });
});

describe('Stream Value Updates', () => {
  it('should not notify listeners if value has not changed (primitive)', () => {
    const notify = vi.fn();
    const stream = createStream(({ set }, initial = 0) => ({
      initialValue: initial,
      controller: { update: (val: number) => set(val) }
    }), 1, undefined);

    stream.subscribe(notify);
    stream.controller().update(1); // Same value
    expect(notify).not.toHaveBeenCalled();
  });

  it('should not notify listeners if object value has not changed', () => {
    const notify = vi.fn();
    const stream = createStream(({ set }, initial = { count: 0 }) => ({
      initialValue: initial,
      controller: { update: (val: typeof initial) => set(val) }
    }), { count: 1 }, undefined);

    stream.subscribe(notify);
    stream.controller().update({ count: 1 }); // Equivalent object
    expect(notify).not.toHaveBeenCalled();
  });

  it('should support function-based updates', () => {
    const stream = createStream(({ set }, initial = 0) => ({
      initialValue: initial,
      controller: { increment: () => set(prev => prev + 1) }
    }), 0, undefined);

    stream.controller().increment();
    expect(stream.value()).toBe(1);
  });
});