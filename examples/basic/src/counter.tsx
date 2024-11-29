import { createStreamable } from "streambly-react";
import { counter } from "./counter.app";

export const counterStream = createStreamable(counter);
