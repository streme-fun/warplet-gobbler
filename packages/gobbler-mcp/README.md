# gobbler-mcp

MCP (Model Context Protocol) server that lets AI agents watch and play
[WarpletGobbler](https://warpletgobbler.xyz) on Base (chainId 8453).

The game: a $WARPGOBB SuperToken pot streams into the Gobbler (a DutchAuction
contract). Anyone who owns a [Warplet](https://opensea.io/collection/the-warplets-farcaster)
NFT can deposit it to drain the entire pot in one transaction ("gobble").
Gobbled Warplets are then auctioned off FIFO by the AuctionSell contract for a
bid token.

## Agent quickstart

Watch the pot with `get_game_state` (it includes a `whatYouCanDo` summary).
When the pot exceeds your threshold and you own a Warplet, call
`build_gobble_tx` with your address and tokenId, then submit the returned
transaction with `send_tx` (or sign it with your own wallet if no agent key is
configured). When it lands, call `compose_brag` with the tx hash to get
Farcaster cast text plus a rich share embed. If you would rather buy than
sell, watch the live auction in `get_game_state` and use `build_bid_tx`.

## Tools

| Tool | What it does |
| --- | --- |
| `get_game_state` | Pot size/stream rate/USD value, live auction lot, minimum next bid, queue, contract addresses, and a plain-English summary of available actions. |
| `build_gobble_tx` | Unsigned tx: `warplets.safeTransferFrom(from, dutchAuction, tokenId, abi.encode(minPrice))` — deposit a Warplet, drain the whole pot. Slippage-protected via `minPrice`. |
| `build_bid_tx` | Unsigned tx: ERC777 `send(auctionSell, amount, "0x")` on the bid SuperToken — places a bid in one tx via the `tokensReceived` hook. Defaults to the minimum valid next bid. |
| `send_tx` | Signs and submits a tx on Base with the configured agent key and waits for the receipt. Only registered when `AGENT_PRIVATE_KEY` is set. |
| `compose_brag` | Suggested Farcaster cast text + share embed URL (`/g/{txHash}` or `/w/{txHash}`) + a prefilled compose intent URL. |
| `get_recent_gobbles` | Recent gobble/settlement events from the hosted agent feed. |

## Running

From the repo root (after `pnpm install`):

```bash
# Run directly from TypeScript
pnpm --filter gobbler-mcp dev

# Or build once and run the compiled binary
pnpm --filter gobbler-mcp build
node packages/gobbler-mcp/dist/index.js
```

Or without building, from anywhere: `npx tsx packages/gobbler-mcp/src/index.ts`.

The server speaks MCP over stdio; it logs diagnostics to stderr only.

## MCP client configuration

Claude Desktop (`claude_desktop_config.json`) or any generic MCP client:

```json
{
  "mcpServers": {
    "warplet-gobbler": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/packages/gobbler-mcp/src/index.ts"],
      "env": {
        "GOBBLER_API_URL": "https://warpletgobbler.xyz",
        "BASE_RPC_URL": "https://mainnet.base.org",
        "AGENT_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

(After `pnpm --filter gobbler-mcp build` you can use
`"command": "node", "args": ["/absolute/path/to/packages/gobbler-mcp/dist/index.js"]`
instead.)

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GOBBLER_API_URL` | `https://warpletgobbler.xyz` | WarpletGobbler web app base URL — agent state/feed API and share embeds. |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base mainnet JSON-RPC endpoint for direct reads and tx submission. |
| `DUTCH_AUCTION_ADDRESS` | — | Override the Gobbler (DutchAuction) address; otherwise discovered via the agent API. |
| `AUCTION_SELL_ADDRESS` | — | Override the AuctionSell address; otherwise discovered via the agent API. |
| `WARPLETS_ADDRESS` | `0x699727f9e01a822efdcf7333073f0461e5914b4e` | Warplets NFT collection on Base. |
| `WARPGOBB_TOKEN_ADDRESS` | — | Override the streamed SuperToken; otherwise read from `DutchAuction.paymentToken()`. |
| `AGENT_PRIVATE_KEY` | — | Optional 0x-prefixed key. When set, enables the `send_tx` tool to sign and submit on Base. Keep it funded with a little ETH for gas. |

State reads prefer `GET {GOBBLER_API_URL}/api/agent/state` and fall back to
direct RPC reads when the API is unreachable (the fallback needs the contract
address env vars above, except Warplets which has a known default).
