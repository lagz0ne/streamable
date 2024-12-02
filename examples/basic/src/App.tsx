import React, { useState } from "react";
import { counterStream } from "./counter";

export function Home() {
	const [initialApp, setInitialApp] = useState(() => ({
		autoCount: 0,
		math: 0,
	}));

	return (
		<counterStream.Provider initialValue={initialApp}>
			<CountApp />
			<MathApp />
			<button
				type="button"
				onClick={() => setInitialApp({ autoCount: 0, math: 0 })}
			>
				Reset
			</button>
		</counterStream.Provider>
	);
}

function CountApp() {
	const autoCount = counterStream.useValueStream((v) => v.autoCount);

	return (
		<>
			<div>{autoCount}</div>
		</>
	);
}

function MathApp() {
	const math = counterStream.useValueStream((v) => v.math);
	const counterAPI = counterStream.useAPI();
	return (
		<div>
			<button type="button" onClick={counterAPI.inc}>
				+
			</button>
			<button type="button" onClick={counterAPI.minus}>
				-
			</button>
			{math}
		</div>
	);
}
