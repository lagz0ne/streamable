import React, {
	createContext,
	useRef,
	type PropsWithChildren,
	useEffect,
	useContext,
	useSyncExternalStore,
	useMemo,
} from "react";
import {
	type StreamSPI,
	createStream,
	type StreamInstance,
	type Streamable,
} from "streambly";

export function createStreamable<
	P,
	API extends StreamSPI = undefined,
	Config = undefined,
>(streamable: Streamable<P, API, Config>) {
	const streamableContext = createContext<StreamInstance<P, API> | null>(null);

	function Provider({
		children,
		initialValue,
		config,
	}: PropsWithChildren<{
		initialValue: P;
		config: Config;
	}>) {
		const stream = useMemo(() => {
			return createStream<P, API, Config>(streamable, initialValue, config);
		}, [streamable, initialValue, config]);

		useEffect(() => stream.stop, [stream]);

		return (
			<streamableContext.Provider value={stream}>
				{children}
			</streamableContext.Provider>
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

	function useController() {
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
		const versionRef = useRef<number>();
		const valueRef = useRef<O | P>();

		if (versionRef.current === undefined) {
			versionRef.current = stream.version();
		}

		if (valueRef.current === undefined) {
			valueRef.current = structuredClone(
				slice ? slice(stream.value()) : stream.value(),
			);
		}

		return useSyncExternalStore(stream.subscribe, () => {
			if (versionRef.current === stream.version()) {
				return valueRef.current as O extends P ? P : O;
			}

			const nextValue = slice ? slice(stream.value()) : stream.value();
			if (JSON.stringify(nextValue) === JSON.stringify(valueRef.current)) {
				return valueRef.current as O extends P ? P : O;
			}

			versionRef.current = stream.version();
			valueRef.current = structuredClone(
				slice ? slice(stream.value()) : stream.value(),
			);
			return valueRef.current as O extends P ? P : O;
		});
	}

	return {
		Provider,
		useStreamable,
		useController,
		useValueStream,
	};
}
