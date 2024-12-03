import diff from "microdiff"
import clone from "rfdc"

export type Notifier = () => void;
export type StreamEnder = () => void;
export type StreamSPI = Record<string, unknown> | undefined
export type ErrorHandler = (error: unknown) => void

export const errorMap = {
  "0000": "unknown error, check the cause",
  "0001": "stream failed to start",
  "0002": "stream failed on providing next value",
  "0003": "stream failed to end",
  "0004": "stream is used when it is stopped"
} as const

export class StreamblyError extends Error {
  errorCode: keyof typeof errorMap = "0000"
  constructor(errorCode: keyof typeof errorMap, cause?: unknown) {
    super(`${errorCode}: ${errorMap[errorCode]}`, { cause })
    this.errorCode = errorCode
  }
}

export type StreamController<P, API extends StreamSPI> = {
  initialValue: P
  cleanup?: StreamEnder
  controller: API
}

export function isDifferent(a: unknown, b: unknown): boolean {
  return (isObject(a) && isObject(b)) ? diff(a, b).length > 0 : a !== b;
}

export type Announcer<P> = {
  setCurrent: (p: P) => void;
  getCurrent: () => P;
  end: (p: P) => void;
};

export type Streamable<
  P,
  API extends StreamSPI,
  Context
> = (
  notifier: Announcer<P>,
  initialValue: P | undefined,
  config: Context
) => StreamController<P, API> | Promise<StreamController<P, API>>;

export type StreamInstance<P, API extends StreamSPI> = {
  id: number
  subscribe: (listener: Notifier) => () => void;
  value: () => P;
  stop: () => void;
  controller: () => API
  isStarted?: () => Promise<void>
  state: () => 'stop' | 'starting' | 'running'
}

type StreamState<P, API extends StreamSPI> =
  | { state: "stop" }
  | { state: "starting", signal: Promise<unknown> }
  | { state: "running", unsubscribe?: StreamEnder, container: { current: P }, snapshot: P, controller: API }

function defferedPromise<P>(): Promise<P> & {
  resolve: (value: P) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: P) => void;
  let reject: (reason?: unknown) => void;
  const promise: Promise<P> = new Promise((res, rej) => { resolve = res; reject = rej; });
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  return Object.assign(promise, { resolve: resolve!, reject: reject! });
}

function isPromise(p: unknown): p is Promise<unknown> {
  return Promise.resolve(p) === p;
}

function isObject(o: unknown): o is object {
  return o !== null && typeof o === "object";
}

const cloner = clone({ proto: false })

export function createStream<
  P,
  API extends StreamSPI = undefined,
  Context = undefined
>(
  fn: Streamable<P, API, Context>,
  initialValue: P | undefined,
  config: Context
): StreamInstance<P, API> {
  const listeners = new Set<Notifier>();

  let state: StreamState<P, API> = { state: "stop" };
  let isStarted: Promise<void> | undefined = undefined;

  function stop() {
    if (state.state === "stop") {
      throw new StreamblyError("0004");
    }

    if (state.state === "running") {
      try {
        state.unsubscribe?.();
      } catch (e) {
        throw new StreamblyError("0003", e);
      }
    }

    isStarted = undefined;
    state = { state: "stop" };
  }

  const notifier: Announcer<P> = {
    setCurrent: (next: P) => {
      if (state.state === "stop" || state.state === "starting") {
        console.warn("Stream is yet started stopped");
        return;
      }

      if (isObject(next) && isObject(state.snapshot)) {
        const diffResult = diff(state.snapshot, next);
        if (diffResult.length === 0) {
          return;
        }
      }

      state.container.current = next;
      state.snapshot = cloner(state.container.current)

      for (const listener of listeners) {
        listener();
      }
    },
    getCurrent: () => {
      if (state.state === "stop" || state.state === "starting") {
        throw new StreamblyError("0004");
      }

      return state.container.current;
    },
    end: () => {
      if (state.state === "stop") {
        console.warn("Stream is stopped");
        return;
      }

      stop()
    }
  }

  let impl: StreamController<P, API> | Promise<StreamController<P, API>>;

  try {
    impl = fn(notifier, initialValue, config);
  } catch (e) {
    throw new StreamblyError("0001", e);
  }

  if (!isPromise(impl)) {
    const { controller, cleanup, initialValue } = impl;
    const snapshot = cloner(initialValue)
    state = { state: "running", unsubscribe: cleanup, controller, container: { current: initialValue }, snapshot };

  } else {
    const _isStarted = defferedPromise<void>()
    isStarted = _isStarted
    state = { state: "starting", signal: impl };

    Promise.resolve(impl)
      .then(({ cleanup, controller, initialValue }) => {
        _isStarted.resolve();
        const snapshot = cloner(initialValue)
        state = { state: "running", unsubscribe: cleanup, controller, container: { current: initialValue }, snapshot };
      });
  }

  return {
    id: new Date().getTime(),
    stop,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    isStarted: isStarted ? () => isStarted! : undefined,
    subscribe: (listener: Notifier) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener)
      };
    },
    value: () => {
      if (state.state !== "running") {
        throw new StreamblyError("0004");
      }

      return state.container.current;
    },
    controller: () => {
      if (state.state !== "running") {
        throw new StreamblyError("0004");
      }

      return state.controller as API;
    },
    state: () => {
      return state.state
    }
  } satisfies StreamInstance<P, API>;
}

export function createStreamable<
  P,
  API extends StreamSPI = undefined,
  Context = undefined
>(streamable: Streamable<NoInfer<P>, NoInfer<API>, NoInfer<Context>>): Streamable<P, API, Context> {
  return streamable;
}

export class Builder<P, API extends StreamSPI = undefined, Context = undefined> {

  context<_Context>(): Builder<P, API, _Context> {
    return this as unknown as Builder<P, API, _Context>;
  }

  api<_API extends StreamSPI>(): Builder<P, _API, Context> {
    return this as unknown as Builder<P, _API, Context>;
  }

  impls(streamable: Streamable<P, API, Context>) {
    return streamable;
  }

}

export function streamable<P>() {
  return new Builder<P>();
}