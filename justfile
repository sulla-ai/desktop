# Sulla Desktop Development Commands

# Default command: list all available commands
default:
    @just --list

# Clean all caches and generated files for a fresh install
cleanup:
    @echo "Cleaning up for fresh install..."
    rm -rf node_modules
    rm -rf .yarn/cache
    rm -rf .yarn/install-state.gz
    rm -rf dist
    rm -rf resources/darwin/lima
    rm -rf resources/darwin/_output
    rm -f resources/darwin/alpine-lima-*.iso
    rm -rf ~/.lima
    rm -rf ~/Library/Application\ Support/rancher-desktop
    rm -rf ~/Library/Application\ Support/sulla-desktop
    rm -rf ~/Library/Caches/lima
    @echo "Cleanup complete. Run 'just build' for a fresh install."

# Install dependencies and build the application for production
build:
    yarn install
    yarn run postinstall
    yarn build

rebuild: cleanup build

# Start the development server (runs in foreground)
start:
    yarn dev

# Tail the development server logs
logs:
    tail -f /tmp/sulla-desktop.log

# Stop the development server
stop:
    @echo "Stopping Sulla Desktop..."
    -pkill -f "yarn dev" 2>/dev/null || true
    -pkill -f "electron" 2>/dev/null || true
    @echo "Sulla Desktop stopped."

# Restart the development server
restart: stop start
