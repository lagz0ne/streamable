import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./App";

// Ensure React renders to the #app element
// biome-ignore lint/style/noNonNullAssertion: <explanation>
createRoot(document.getElementById("app")!).render(
	<StrictMode>
		<Home />
	</StrictMode>,
);
