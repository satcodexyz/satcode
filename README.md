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

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.