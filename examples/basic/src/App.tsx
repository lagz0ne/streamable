import React, { useState } from "react";
import { counterStream } from "./counter";

export function Home() {
	const [initialApp] = useState(() => ({ autoCount: 0, math: 0 }));
	return (
		<counterStream.Provider initialValue={initialApp} config={undefined}>
			<CountApp />
			<MathApp />
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
	const counterAPI = counterStream.useController();
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
