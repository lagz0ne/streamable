export type Notifier = () => void;
export type StreamEnder = () => void;
export type StreamAPI = Record<string, unknown> | undefined
export type StreamController<API extends StreamAPI> = [StreamEnder, API | undefined]

export function withAPI<API extends StreamAPI>(api: API): StreamController<API> {
  return [noOps, api];
}

export function withController<API extends StreamAPI>(ender: StreamEnder, api: API): StreamController<API> {
  return [ender, api];
}

export function withEnder<API extends StreamAPI>(ender: StreamEnder): StreamController<API> {
  return [ender, undefined];
}

export function withNoCleanups<API extends StreamAPI>(): StreamController<API> {
  return [noOps, undefined];
}

export type Announcer<P> = {
  next: (p: P) => void;
  end: (p: P) => void;
};

export type Streamable<P, API extends StreamAPI> = (notifier: Announcer<P>, initialValue: P) => StreamController<API> | Promise<StreamController<API>>;

export type ValueStream<P, API extends StreamAPI> = {
  version: () => number;
  subscribe: (listener: Notifier) => () => void;
  value: () => P;
  start: (initialValue: P) => void;
  isStarted: () => Promise<boolean>
  stop: () => void;
  controller: () => API
};

type StreamState<P, API extends StreamAPI> =
  | { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 }
  | { state: "starting", signal: Promise<unknown> }
  | { state: "running", unsubscribe: StreamEnder, container: { current: P }, controller: API, version: number }

function noOps() { }

function stream<P, API extends StreamAPI = undefined>(fn: Streamable<P, API>): ValueStream<P, API> {
  const listeners = new Set<Notifier>();

  let state: StreamState<P, API> = { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 };
  let isStarted: Promise<boolean> = Promise.resolve(false);

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

  function start(initialValue: P) {
    if (state.state === "running") {
      throw new Error("Stream is already running");
    }

    const startPromise = fn(notifier, initialValue);
    if (Promise.resolve(startPromise) !== startPromise) {
      const [ender, api] = startPromise as StreamController<API>;
      isStarted = Promise.resolve(true);
      state = { state: "running", unsubscribe: ender, controller: api as API, container: { current: initialValue }, version: 0 };
      return
    }

    state = { state: "starting", signal: startPromise };
    Promise.resolve(startPromise)
      .then(([ender, api]) => {
        isStarted = Promise.resolve(true);
        state = { state: "running", unsubscribe: ender, controller: api as API, container: { current: initialValue }, version: 0 };
      })

  }

  function stop() {
    if (state.state === "stop") {
      throw new Error("Stream is already stopped");
    }

    if (state.state === "running") {
      state.unsubscribe();
    }

    isStarted = Promise.resolve(false);
    state = { state: "stop", unsubscribe: undefined, container: undefined, controller: undefined, version: 0 };
  }

  return {
    start, stop,
    isStarted: () => isStarted,
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
  };
}

export function createStream<P, API extends StreamAPI = undefined>(
  streamable: Streamable<P, API>
): ValueStream<P, API> {
  return stream(streamable);
}
