# SatCode - a software bounty platform built for the AI era.

Bounties are organized in the open on Nostr, work is paid in Bitcoin - a permissionless design suitable for AI agents. Funds are locked in a trust-minimized multiparty escrow built on Arkade until the work is done. Clear acceptance criteria enable predictable, machine-verifiable outcomes by design. Disputes are resolved automatically based on oracle attestations, with a panel of human jurors acting as a fallback mechanism.

## Build

Install [Bun](https://bun.sh), then install dependencies:

```sh
bun install
```

### Run

Start the development server:

```sh
bun run dev
```

Build for production and preview the result:

```sh
bun run build
bun run preview
```

### Checks

Run these before submitting a PR, in this order:

```sh
bun run format  # format code with prettier
bun run lint    # prettier/eslint checks
bun run check   # svelte-check / TypeScript
bun run test    # unit tests
bun run build   # production build
```

Or run them all in one go:

```sh
bun run pr
```

CI runs the same checks (all except `format`) on every pull request.

## Retracting a bounty

There is no retract button yet. Until there is, publish a [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) deletion request by hand, from the browser console on any SatCode page, signed in with your NIP-07 extension.

Start by grabbing your pubkey and the relay list. Both later steps use them.

```js
const pubkey = await window.nostr.getPublicKey();

// Keep in sync with DEFAULT_RELAYS in src/lib/ndk.ts
const relays = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay.nos.social',
  'wss://nos.lol',
  'wss://nostr.bitcoiner.social',
  'wss://relay.primal.net',
  'wss://nostr.land'
];
```

Now list the bounties you have published, and copy the address of the one you want gone. A bounty usually reaches only some of the relays, so ask all of them and collapse the answers by address. Cards link to `/bounties/<address>`, so you can also read one out of the URL bar instead.

```js
const mine = new Map();

for (const url of relays) {
  const ws = new WebSocket(url);
  ws.onopen = () =>
    ws.send(
      JSON.stringify([
        'REQ',
        'mine',
        { kinds: [30050], authors: [pubkey], limit: 50 }
      ])
    );
  ws.onmessage = ({ data }) => {
    const [type, , event] = JSON.parse(data);
    if (type !== 'EVENT') return ws.close(); // EOSE, CLOSED, NOTICE
    const tag = (name) => event.tags.find((t) => t[0] === name)?.[1];
    mine.set(`30050:${event.pubkey}:${tag('d')}`, tag('title'));
  };
  setTimeout(() => ws.close(), 5000);
}

// give it a few seconds, then
console.table([...mine]);
```

Then sign a kind 5 request naming that address, and send it to every relay:

```js
const address = '30050:<pubkey>:<d>'; // from the table above

const request = await window.nostr.signEvent({
  kind: 5,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  content: 'retracted',
  tags: [
    ['a', address],
    ['k', '30050']
  ]
});

for (const url of relays) {
  const ws = new WebSocket(url);
  ws.onopen = () => ws.send(JSON.stringify(['EVENT', request]));
  ws.onmessage = ({ data }) => {
    console.log(url, data);
    ws.close();
  };
  setTimeout(() => ws.close(), 5000);
}
```

Both tags matter. `a` names the bounty by address rather than by event id, so the request covers every revision of it. `k` is what the listing subscribes to, so a request without `["k", "30050"]` reaches the relays but stays invisible to SatCode.

Each relay answers `["OK", <id>, true, ""]` on success, or `false` with a reason. Relays that require [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) authentication will reject this, because the snippet does not authenticate and the app does, so a bounty published through SatCode may sit on relays this cannot reach.

Deletion is a request, not a command, and a relay may keep serving the event regardless. SatCode filters retracted bounties out client side, and only honours a request signed by the bounty's own author, so the card leaves the listing either way.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.
