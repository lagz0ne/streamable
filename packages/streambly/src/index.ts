export type Notifier = () => void;
export type StreamEnder = () => void;
export type StreamSPI = Record<string, unknown> | undefined
export type StreamController<API extends StreamSPI> = [StreamEnder, API]

export function withAPI<API extends StreamSPI>(api: API): StreamController<API> {
  return [noOps, api];
}

export function withController<API extends StreamSPI>(ender: StreamEnder, api: API): StreamController<API> {
  return [ender, api];
}

export function withEnder(ender: StreamEnder): StreamController<undefined> {
  return [ender, undefined];
}

export function withNoCleanups(): StreamController<undefined> {
  return [noOps, undefined];
}

export type Announcer<P> = {
  next: (p: P) => void;
  end: (p: P) => void;
};

export type Streamable<P, API extends StreamSPI, Config> = (notifier: Announcer<P>, initialValue: P, config: Config) => StreamController<API> | Promise<StreamController<API>>;

export type StreamInstance<P, API extends StreamSPI> = {
  version: () => number;
  subscribe: (listener: Notifier) => () => void;
  value: () => P;
  stop: () => void;
  controller: () => API
  isStarted: () => Promise<void>
}

type StreamState<P, API extends StreamSPI> =
  | { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 }
  | { state: "starting", signal: Promise<unknown> }
  | { state: "running", unsubscribe: StreamEnder, container: { current: P }, controller: API, version: number }

function noOps() { }

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

export function createStream<P, API extends StreamSPI = undefined, Config = undefined>(fn: Streamable<P, API, Config>, initialValue: P, config: Config): StreamInstance<P, API> {
  const listeners = new Set<Notifier>();

  let state: StreamState<P, API> = { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 };
  let isStarted = defferedPromise<void>();

  function stop() {
    if (state.state === "stop") {
      throw new Error("Stream is already stopped");
    }

    if (state.state === "running") {
      state.unsubscribe();
    }

    isStarted = defferedPromise();
    state = { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 };
  }

  const notifier: Announcer<P> = {
    next: (p: P) => {
      if (state.state === "stop" || state.state === "starting") {
        console.warn("Stream is yet started stopped");
        return;
      }

      ++state.version;
      state.container.current = p;

      for (const listener of listeners) {
        listener();
      }
    },
    end: () => {
      if (state.state === "stop") {
        console.warn("Stream is stopped");
        return;
      }

      stop()
    }
  }

  const startPromise = fn(notifier, initialValue, config);
  if (Promise.resolve(startPromise) !== startPromise) {
    const [ender, api] = startPromise as StreamController<API>;
    isStarted.resolve();
    state = { state: "running", unsubscribe: ender, controller: api as API, container: { current: initialValue }, version: 0 };
  } else {
    state = { state: "starting", signal: startPromise };
    Promise.resolve(startPromise)
      .then(([ender, api]) => {
        isStarted.resolve();
        state = { state: "running", unsubscribe: ender, controller: api as API, container: { current: initialValue }, version: 0 };
      })
  }

  return {
    stop,
    isStarted: async () => await isStarted,
    version: () => {
      if (state.state !== "running") {
        throw new Error("Stream is not running");
      }


      return state.version;
    },
    subscribe: (listener: Notifier) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    value: () => {
      if (state.state !== "running") {
        throw new Error("Stream is yet started");
      }

      return state.container.current;
    },
    controller: () => {
      if (state.state !== "running") {
        throw new Error("Stream is yet started");
      }

      return state.controller as API;
    }
  } satisfies StreamInstance<P, API>;
}

export function createStreamable<P, API extends StreamSPI = undefined, Config = undefined>(streamable: Streamable<P, API, Config>): Streamable<P, API, Config> {
  return streamable;
}