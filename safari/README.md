# Safari Web Extension

This folder contains the Safari-specific files for the Security Search extension.

## Setup for Safari Development

### Requirements
- Xcode 15+
- macOS Sonoma (14.0)+
- Safari 17.0+

### Steps

1. **Open Xcode and create a new Safari Web Extension project**
   ```
   Xcode → File → New → Project → Safari Web Extension
   ```

2. **Copy extension files**
   ```bash
   cp -r ../*.js ../*.html ../manifest.json ../data ../icons ./YourExtension/
   ```

3. **Update manifest.json**
   The Safari manifest is already in this folder and configured for Safari.

4. **Update extension icon sizes**
   Safari requires specific icon sizes:
   - 48x48
   - 96x96
   - 128x128
   - 256x256
   - 512x512

5. **Build and run**
   ```bash
   xcodebuild -scheme YourExtension -configuration Debug
   ```

6. **Enable in Safari**
   - Open Safari → Preferences → Extensions
   - Enable "Security Search"
   - Allow access to all websites

## Safari-Specific Considerations

### Background Script
Safari uses a slightly different service worker model. The `background.js` in this folder is adapted for Safari.

### Storage
Safari's implementation of `browser.storage` is compatible with Chrome/Firefox.

### Content Scripts
Same as Chrome/Firefox - the `content.js` works across all browsers.

## Testing

1. Open Safari
2. Enable Developer menu: Safari → Preferences → Advanced → Show Develop menu
3. Go to Develop → Show Extension Builder
4. Test your extension

## Submission to App Store

1. Create a developer account at https://developer.apple.com
2. Archive your project in Xcode
3. Upload through Xcode Organizer
4. Complete the App Store listing information
5. Wait for Apple's review (typically 24-48 hours)
