# Security Search Extension

Browser extension to protect users from scam sites in search results. Built for Firefox, Chrome, and Safari.

## Features

- Detects scam sites in Google, Bing, DuckDuckGo, Yahoo, and Baidu search results
- Community-driven scam reporting system
- Pre-loaded list of legitimate DeFi protocols (Uniswap, Aave, Lido, Curve, etc.)
- Real-time warnings for known scam domains
- Safe site verification badges
- Remote blocklist synchronization from MetaMask and ScamSniffer

## Installation

### Chrome / Chromium
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension directory

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the extension directory

### Safari
1. Open Xcode and create a new Safari Extension project
2. Copy the extension files into the project
3. Build and enable in Safari Preferences

## Usage

1. Click the extension icon to open the popup
2. View current page status in the header
3. Report scam sites using the "Report a Scam" form
4. Mark legitimate sites as safe using "Mark as Safe"
5. Click "Sync Now" to fetch latest blocklists from remote sources

## Supported Search Engines

- Google (google.com)
- Bing (bing.com)
- DuckDuckGo (duckduckgo.com)
- Yahoo (yahoo.com)
- Baidu (baidu.com)

## Supported DeFi Protocols

The extension includes verified sites for:
- DEX: Uniswap, Curve, Balancer, SushiSwap, PancakeSwap
- Lending: Aave, Compound, Morpho
- Liquid Staking: Lido, Rocket Pool
- Stablecoins: MakerDAO, Frax
- Aggregators: 1inch, Jupiter
- Wallets: MetaMask, Phantom, Rabby
- Block Explorers: Etherscan, Arbiscan, Snowtrace

## Data Sources

### Safe Sites
- Manually curated list of official protocol websites
- Categories: DEX, Lending, Liquid Staking, Stablecoin, Wallet, Analytics, Block Explorer

### Scam Sites
- MetaMask eth-phishing-detect
- ScamSniffer scam-database
- Community reports

See [DATA_SOURCES.md](DATA_SOURCES.md) for detailed information.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details.

## License

MIT - See [LICENSE](LICENSE)
