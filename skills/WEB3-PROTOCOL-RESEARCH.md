# Skill: Web3 Protocol Safety Research

## Overview
Research Web3/DeFi protocols to verify legitimacy and identify potential scam sites. Used by the Security Search extension to protect users.

## When to Use
- User visits an unfamiliar DeFi protocol
- Need to verify if a site is the official protocol site
- Research new/fork protocols for safety
- Cross-reference domains against known blocklists

## Research Workflow

### Step 1: Identify Protocol
Extract protocol name from domain:
```javascript
const protocolName = extractProtocolName(domain); // "uniswap" from "app.uniswap.io"
```

### Step 2: Verify Official Sources
Check against known official domains:
- **Uniswap**: uniswap.org, app.uniswap.org
- **Aave**: aave.com, app.aave.com
- **Lido**: lido.fi, stake.lido.fi
- **Curve**: curve.fi, app.curve.fi
- **Compound**: compound.finance, app.compound.finance
- **MakerDAO**: makerdao.com, oasis.app
- **1inch**: 1inch.io, app.1inch.io
- **Sushi**: sushi.com, app.sushi.com
- **PancakeSwap**: pancakeswap.finance
- **Jupiter**: jup.ag, jup.io
- **Raydium**: raydium.io, app.raydium.io
- **Orca**: orca.so, app.orca.so
- **MetaMask**: metamask.io
- **Phantom**: phantom.app
- **Rabby**: rabby.io

### Step 3: Check Blocklists
Query remote blocklist APIs:
- MetaMask eth-phishing-detect
- ScamSniffer database
- ChainPatrol lookup

### Step 4: Analyze Domain Patterns
Common scam patterns to detect:
- **Typosquatting**: unisswap.org, aavee.com
- **Extra TLDs**: uniswap.com.ru, aave.io.net
- **Subdomain abuse**: uniswap.staking-rewards.com
- **Fake extensions**: uniswap-v3.online, uniswap-defi.site

## API References

### DeFiLlama Protocol API
```bash
GET https://api.llama.fi/protocols
```
Returns all DeFi protocols with TVL, categories, and chain info.

### ChainPatrol API
```bash
GET https://api.chainpatrol.io/v2/check?domain={domain}
```
Check if domain is in blocklist.

### GitHub Blocklists
- https://github.com/MetaMask/eth-phishing-detect
- https://github.com/scamsniffer/scam-database

## Response Format

When verifying a protocol, return:
```json
{
  "domain": "app.uniswap.org",
  "isSafe": true,
  "isOfficial": true,
  "protocol": "Uniswap",
  "category": "DEX",
  "warnings": [],
  "officialDomains": ["uniswap.org", "app.uniswap.org", "uniswap.eth.xyz"],
  "sources": ["internal", "defillama"]
}
```

## Quick Verification Rules

### HIGH RISK Indicators
- Domain not in official list
- Recently registered (< 30 days)
- Similar to known protocol but slight variation
- Claims unusually high APY
- No documentation or social presence
- Poor SSL certificate (self-signed)

### SAFE Indicators
- Domain matches official protocol site
- Linked from official social media
- Listed on DeFiLlama with matching info
- Has audit reports
- Active community
- Open source code

## Integration

This skill integrates with:
- `content.js` - Search result scanning
- `background.js` - Remote list sync
- `data/initial-data.json` - Safe site database

## Categories Reference

| Category | Examples |
|----------|----------|
| DEX | Uniswap, Curve, Balancer |
| Lending | Aave, Compound, Morpho |
| Liquid Staking | Lido, Rocket Pool |
| Stablecoin | MakerDAO, Frax, USDC |
| Yield Aggregator | Yearn, Pendle |
| Aggregator | 1inch, Jupiter, Matcha |
| Bridge | Across, Stargate, LayerZero |
| NFT | OpenSea, Blur, Foundation |
| Options | Lyra, Dopex |
| Perpetuals | GMX, dYdX |
