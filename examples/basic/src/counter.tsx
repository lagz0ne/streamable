import { createStream } from "streambly-react";
import { counter } from "./counter.app";

export const counterStream = createStream(counter);
