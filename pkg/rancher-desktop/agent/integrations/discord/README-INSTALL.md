# Sulla Desktop - Discord Integration Troubleshooting Log

**Date range:** Early 2025  
**Goal:** Build DiscordClient singleton using discord.js v14 (Gateway/WebSocket)  
**Environment:** macOS (Apple Silicon), Node 20/22, Yarn 4.9.4, Vue CLI/Webpack build  
**Current status:** Build fails on 'zlib-sync' resolution despite multiple attempts

## Timeline & Attempts

1. Initial install  
   - `yarn add discord.js@14.16.3`  
   - Pulled transitive `@discordjs/ws@1.1.1`  
   - Build failed: Can't resolve 'zlib-sync' in @discordjs/ws/dist

2. Removal & no-optional  
   - `yarn remove zlib-sync` → "Pattern doesn't match" (not direct dep)  
   - `yarn add @discordjs/ws@1.9.0 --no-optional` → version not found  
   - Same error persisted

3. Pinning attempts  
   - Tried ws@1.10.0, 1.10.1, 1.11.0 → all "No candidates found"  
   - Let discord.js manage ws/rest → still pulls zlib-sync optional

4. vue.config.js fallbacks  
   - Added fallback: { 'zlib-sync': false }  
   - Added IgnorePlugin for zlib-sync → build still fails (Webpack still scans import)

5. postinstall patch  
   - Tried overwriting index.js → node_modules not committed, fragile  
   - Removed patch as it's temp

6. yarn-deduplicate  
   - `yarn dlx yarn-deduplicate` → lockfile parse error (Yarn 4 incompatible)

## Root Causes
- discord.js v14 uses optional native zlib-sync for compression  
- Webpack (Vue CLI) eagerly resolves optional deps → fails if native module not compiled  
- Apple Silicon + Node = frequent native compile failures  
- Yarn 4 lockfile breaks older dedupe tools  
- Transitive ws version locked low (1.1.1), no newer pins available

## Next Steps (Decisive Order)

1. **IgnorePlugin + fallback – final attempt**  
   vue.config.js:
   ```js
   const webpack = require('webpack');

   module.exports = {
     configureWebpack: {
       plugins: [
         new webpack.IgnorePlugin({
           resourceRegExp: /^zlib-sync$/
         })
       ],
       resolve: {
         fallback: {
           'zlib-sync': false
         }
       }
     }
   };
   ```
   
   Then:
   ```bash
   yarn install
   yarn build
   ```
   Switch to REST-only client
Drop Gateway. Use @discordjs/rest for sendMessage/reply/react.
No native deps, no build issues.
Implement minimal version now if Option 1 fails.
Isolate Discord in child process
Spawn separate Node script for discord.js Gateway.
Communicate via internal WebSocket or IPC.
Keeps Vue build clean.
Abandon discord.js Gateway
Use raw Discord HTTP API + axios/fetch.
Poll for messages if real-time needed (webhooks better).

Immediate action: Apply vue.config.js IgnorePlugin block → run build.
If fails → pivot to REST-only. No more fighting natives.