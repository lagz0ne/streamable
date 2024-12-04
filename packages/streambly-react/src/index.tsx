import React, {
	createContext,
	useRef,
	type PropsWithChildren,
	useEffect,
	useContext,
	useSyncExternalStore,
	useState,
	useMemo,
} from "react";
import {
	type StreamSPI,
	createStream as _createStream,
	isDifferent,
	type StreamInstance,
	type Streamable,
} from "streambly";
import rfdc from "rfdc";

type GetMandatoryKeys<T> = {
	[P in keyof T]: T[P] extends Exclude<T[P], undefined> ? P : never;
}[keyof T];

type MandatoryProps<T> = Pick<T, GetMandatoryKeys<T>>;

type ConfigWithOptionalProps<T> = Partial<T> & MandatoryProps<T>;

export function createStream<
	P,
	API extends StreamSPI = undefined,
	Context = undefined,
>(streamable: Streamable<P, API, Context>) {
	const streamableContext = createContext<StreamInstance<P, API> | null>(null);
	const clone = rfdc();

	function StreamInstance({
		instance,
		children,
	}: PropsWithChildren<{ instance: StreamInstance<P, API> }>) {
		const [isReady, setReady] = useState(() => instance.state() === "running");

		useEffect(() => {
			instance.isStarted?.().then(() => {
				setReady(true);
			});
		});

		if (isReady) {
			return (
				<streamableContext.Provider value={instance}>
					{children}
				</streamableContext.Provider>
			);
		}
	}

	function Provider({
		children,
		initialValue,
		context,
	}: PropsWithChildren<
		ConfigWithOptionalProps<{
			initialValue?: P;
			context: Context;
		}>
	>) {
		const streamRef = useRef<StreamInstance<P, API> | null>(null);
		const [, setIsReady] = useState(false);

		useEffect(() => {
			const stream = _createStream(
				streamable,
				initialValue,
				context as Context,
			);

			streamRef.current = stream;
			let starting = false;

			if (stream.isStarted === undefined) {
				setIsReady(true);
			} else {
				starting = true;
				stream.isStarted().then(() => {
					setIsReady(true);
					starting = false;
				});
			}

			return () => {
				streamRef.current = null;
				!starting && stream.state() !== "running" && stream.stop();
			};
		}, [streamable, initialValue, context]);

		if (!streamRef.current) {
			return null;
		}

		return (
			<StreamInstance instance={streamRef.current}>{children}</StreamInstance>
		);
	}

	function useVersion() {
		const stream = useContext(streamableContext);
		if (!stream) {
			throw new Error("useVersion must be used within a Streamable.Provider");
		}

		return stream.id;
	}

	function useStreamable() {
		const stream = useContext(streamableContext);
		if (!stream) {
			throw new Error(
				"useStreamable must be used within a Streamable.Provider",
			);
		}

		return stream;
	}

	function useAPI() {
		const stream = useStreamable();
		return stream.controller();
	}

	function useValueStream<O = P>(slice?: (value: P) => O): O extends P ? P : O {
		const stream = useStreamable();
		const valueRef = useRef<O | P>();

		if (valueRef.current === undefined) {
			valueRef.current = clone(slice ? slice(stream.value()) : stream.value());
		}

		const [subscribe, getSnapshot] = useMemo(() => {
			return [
				stream.subscribe,
				() => {
					const nextValue = clone(
						slice ? slice(stream.value()) : stream.value(),
					);
					const diffed = isDifferent(valueRef.current, nextValue);

					if (!diffed) {
						return valueRef.current as O extends P ? P : O;
					}

					valueRef.current = nextValue;
					return valueRef.current as O extends P ? P : O;
				},
			] as const;
		}, [stream, slice]);

		return useSyncExternalStore(subscribe, getSnapshot);
	}

	return {
		Provider,
		useStreamable,
		useVersion,
		useAPI,
		useValueStream,
	};
}
