# Architecture

## File Structure

```
.
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker
├── content.js            # Content script
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── data/
│   └── initial-data.json # Pre-loaded safe/scam lists
├── icons/                # Extension icons
└── LICENSE               # MIT License
```

## Components

### manifest.json
Manifest V3 configuration defining permissions, host access, and content script matches.

### background.js
- Service worker handling storage operations
- Message handling for popup communication
- Remote list synchronization
- Initial data loading on first install

### content.js
- Runs on search engine result pages
- Scans DOM for search results
- Matches URLs against safe/scam lists
- Injects warning badges and safe indicators

### popup.html / popup.js
- User interface for manual reporting
- Statistics display
- Sync controls

## Storage Schema

```javascript
{
  scamList: [
    { url: string, reason: string, reportedAt: number, source?: string }
  ],
  safeList: [
    { url: string, name?: string, category?: string, markedAt: number }
  ],
  stats: { scamsReported: number },
  lastSync: number,
  initialized: boolean
}
```

## Message Protocol

| Action | Direction | Payload |
|--------|-----------|---------|
| getLists | popup → background | - |
| addScam | popup → background | { url, reason } |
| addSafe | popup → background | { url } |
| removeScam | popup → background | { url } |
| removeSafe | popup → background | { url } |
| syncRemote | popup → background | - |
| listUpdated | background → content | - |

## Remote Sources

```javascript
const REMOTE_SOURCES = {
  SCAM_LISTS: [
    'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json',
    'https://raw.githubusercontent.com/scamsniffer/scam-database/main/domains.json'
  ]
};
```

## Browser Compatibility

- Chrome 88+
- Firefox 109+
- Safari 15.4+
- Edge 88+
