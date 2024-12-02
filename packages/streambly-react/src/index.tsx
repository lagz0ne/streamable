import React, {
	createContext,
	useRef,
	type PropsWithChildren,
	useEffect,
	useContext,
	useSyncExternalStore,
	useMemo,
	useState,
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

	function StreamReady({
		stream,
		children,
	}: PropsWithChildren<{
		stream: StreamInstance<P, API>;
	}>) {
		const [isStarted, setIsStarted] = useState(stream.isStarted === undefined);

		useEffect(() => {
			const checkIsStarted = async () => {
				stream.isStarted && (await stream.isStarted());
				setIsStarted(true);
			};

			checkIsStarted();

			return stream.stop;
		}, [stream]);

		if (!isStarted) {
			return null;
		}

		return (
			<streamableContext.Provider value={stream}>
				{children}
			</streamableContext.Provider>
		);
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
		const version = useRef(0);

		const stream = useMemo(() => {
			version.current++;
			return _createStream<P, API, Context>(
				streamable,
				initialValue,
				context as Context,
			);
		}, [streamable, initialValue, context]);

		return (
			<StreamReady key={version.current} stream={stream}>
				{children}
			</StreamReady>
		);
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
		const stream = useContext(streamableContext);
		if (stream === null) {
			throw new Error(
				"useController must be used within a Streamable.Provider",
			);
		}

		return stream.controller();
	}

	function useValueStream<O = P>(slice?: (value: P) => O): O extends P ? P : O {
		const stream = useStreamable();
		const valueRef = useRef<O | P>();

		if (valueRef.current === undefined) {
			valueRef.current = clone(slice ? slice(stream.value()) : stream.value());
		}

		return useSyncExternalStore(stream.subscribe, () => {
			const nextValue = clone(slice ? slice(stream.value()) : stream.value());
			const diffed = isDifferent(valueRef.current, nextValue);

			if (!diffed) {
				return valueRef.current as O extends P ? P : O;
			}

			valueRef.current = nextValue;
			return valueRef.current as O extends P ? P : O;
		});
	}

	return {
		Provider,
		useStreamable,
		useController: useAPI,
		useValueStream,
	};
}
