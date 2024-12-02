# Introducing ꜱᴛʀᴇᴀᴍʙʟʏ

ꜱᴛʀᴇᴀᴍʙʟʏ is a simple library inspired heavily by React's reactivity. In fact, one of ꜱᴛʀᴇᴀᴍʙʟʏ's design goals is that the app can be used with React.

## Motivation

ꜱᴛʀᴇᴀᴍʙʟʏ is designed to offer a simple way to create reactive objects/services, whatever you call it.

This is what ꜱᴛʀᴇᴀᴍʙʟʏ is composed of:

- A source/an entity, something to get started
- An API to interact with the source
- Certain facilities to go with its reactivity

All together, you have ꜱᴛʀᴇᴀᴍʙʟʏ.

## Enough talking, show me the code

```typescript
// Idiomatic counter
const counterApp = createStreamable(({ next }, initialValue = 0)) {
  const interval = setInterval(() => {
    next(++counter)
  }, 1000)

  return {
    initialValue,
    cleanup: () => clearInterval(interval),
  }
}
```

With this, you have a stream that'll generate a value every second, it also exposes a function to clear it up

But the counter app doesn't work right off, it needs a way to get kickstarted

```typescript
const counterAppInstance = createStream(counterApp, 100)

// you can also listen for the change
counterAppInstance.subscribe(() => [
  console.log(counterAppInstance.value())
  // 100
  // 200
  // 300
])

setInterval(() => {
  console.log(counterAppInstance.value())
}, 100)

// 100
// 200
// 300


```

## Usage with react

ꜱᴛʀᴇᴀᴍʙʟʏ comes with a package called ꜱᴛʀᴇᴀᴍʙʟʏ-react to cover what's needed in react

```typescript
// instead of creating a stream in nodejs, do so in react

import { createStream } from "streambly-react";

const { Provider, useAPI, useValueStream } = createStream(counterApp)

//....
<Provider initialValue={...} >

</Provider>

const count = useValueStream()
<div>{count}</div>

const inc = useAPI().inc

```