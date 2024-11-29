import { createStreamable } from "streamable-react";
import { counter } from "./counter.app";

export const counterStream = createStreamable(counter);
