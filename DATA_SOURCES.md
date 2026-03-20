# Data Sources

## Safe Sites (Verified DeFi Protocols)

### Primary Sources
- Official protocol websites (uniswap.org, aave.com, etc.)
- DeFiLlama directory (defillama.com)
- Protocol documentation

### Categories

| Category | Protocols |
|----------|-----------|
| DEX | Uniswap, Curve, Balancer, SushiSwap, PancakeSwap, Orca, Raydium |
| Lending | Aave, Compound, Morpho |
| Liquid Staking | Lido, Rocket Pool |
| Stablecoin | MakerDAO, Frax |
| Yield | Yearn, Pendle |
| Aggregator | 1inch, Jupiter |
| Wallet | MetaMask, Phantom, Rabby |
| Analytics | DeFiLlama, Dune |
| Block Explorer | Etherscan, Arbiscan, Snowtrace |
| CEX | Coinbase, Binance, Kraken |

## Scam Sites (Blocklists)

### Remote Sources

1. **MetaMask eth-phishing-detect**
   - URL: https://github.com/MetaMask/eth-phishing-detect
   - Stars: 1,262
   - Update frequency: Multiple times daily
   - Content: JSON config with blacklist of phishing domains

2. **ScamSniffer scam-database**
   - URL: https://github.com/scamsniffer/scam-database
   - Stars: 238
   - Update frequency: Daily
   - Content: List of known crypto phishing domains

### Community Reports

Users can report scam sites via the popup interface. Reports include:
- URL of the suspicious site
- Reason/description (optional)
- Timestamp

### Known Scam Patterns

| Target | Example Scam Domains |
|--------|---------------------|
| Uniswap | uniswap-v3.online, verify-uniswap.com, tradeuniswapconnect.cc |
| Aave | aave-stake.com, mainnet-aave.com, app-aave.fun |
| Lido | lido-staking.io, lido-eth.top |
| MetaMask | metamask-wallet.io, metamask-sync.com |
| Phantom | phantom-wallet.io, phantom-eth.com |

## API Integration

### DeFiLlama API
- Base URL: https://api.llama.fi
- Endpoint: `/protocols` - List all DeFi protocols
- Documentation: https://api-docs.defillama.com

### TypeScript SDK
```bash
npm install @defillama/api
```

```typescript
import { DefiLlama } from "@defillama/api";
const client = new DefiLlama();
const protocols = await client.tvl.getProtocols();
```

## Data Refresh

- Initial load: On first extension install
- Manual sync: User-triggered via "Sync Now" button
- Auto-sync: Can be added via alarms API

## Adding New Protocols

1. Edit `data/initial-data.json`
2. Add entry to `safeSites` array:
```json
{
  "url": "https://protocol.example.com",
  "name": "Protocol Name",
  "category": "Category"
}
```
3. Rebuild extension
