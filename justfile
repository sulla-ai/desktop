# Sulla Desktop Development Commands

# Default command: list all available commands
default:
    @just --list

# Clean build artifacts only (preserves VM and cached images)
clean:
    @echo "Cleaning build artifacts..."
    rm -rf dist
    rm -rf resources/darwin/_output
    @echo "Clean complete."

# Clean all caches and generated files for a fresh install (WIPES VM AND IMAGES)
clean-hard:
    @echo "Cleaning up for fresh install (this will wipe VM and cached images)..."
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
    rm -rf ~/Library/Preferences/rancher-desktop
    rm -rf ~/Library/Caches/rancher-desktop
    rm -rf ~/Library/Caches/lima
    rm -rf ~/Library/Logs/rancher-desktop
    rm -rf ~/.rd
    rm -rf ~/.kube/config
    @echo "Cleanup complete. Run 'just build' for a fresh install."

# Install dependencies and build the application for production
build:
    yarn install
    yarn run postinstall
    yarn build

# Rebuild without wiping VM (preserves cached images)
rebuild: clean build

# Full rebuild - wipes everything including VM and cached images
rebuild-hard: clean-hard build

# Start the development server (runs in foreground)
start:
    yarn dev

# Tail the development server logs
logs:
    tail -f /tmp/sulla-desktop.log

# Stop the development server gracefully
stop:
    #!/usr/bin/env bash
    echo "Checking for running Sulla Desktop..."
    PIDS=$(pgrep -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true)
    if [ -z "$PIDS" ]; then
        echo "Sulla Desktop is not running."
        exit 0
    fi
    echo "Found Sulla processes: $PIDS"
    
    # Send SIGTERM for graceful shutdown
    echo "Requesting graceful shutdown (SIGTERM)..."
    pkill -TERM -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true
    
    # Wait for graceful shutdown (up to 15 seconds)
    for i in {1..15}; do
        REMAINING=$(pgrep -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true)
        if [ -z "$REMAINING" ]; then
            echo "Sulla Desktop stopped gracefully."
            exit 0
        fi
        echo "Waiting for shutdown... ($i/15)"
        sleep 1
    done
    
    # Force kill if graceful shutdown failed
    echo "Graceful shutdown timed out, force killing..."
    pkill -9 -f "sulla.*Electron|Electron.*sulla" 2>/dev/null || true
    sleep 1
    echo "Sulla Desktop stopped."

# Restart the development server (use --hard to wipe VM and images)
restart hard="":
    #!/usr/bin/env bash
    just stop
    if [ "{{hard}}" = "--hard" ] || [ "{{hard}}" = "hard" ]; then
        echo "Hard restart: full rebuild (wiping VM and images)..."
        just rebuild-hard
    else
        echo "Rebuilding (preserving VM and images)..."
        just rebuild
    fi
    just start

pods:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl get pods -n sulla

# Port-forward PostgreSQL to localhost:5432 for external access (e.g., pgAdmin, DBeaver)
# Connection: host=localhost, port=5432, user=sulla, password=sulla_dev_password, database=sulla
postgres:
    @echo "Port-forwarding PostgreSQL to localhost:5432..."
    @echo "Connect with: host=localhost, port=5432, user=sulla, password=sulla_dev_password, database=sulla"
    @echo "Press Ctrl+C to stop"
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl port-forward -n sulla svc/postgres 5432:5432 --address=0.0.0.0

# Port-forward Redis to localhost:6379 for external access
redis:
    @echo "Port-forwarding Redis to localhost:6379..."
    @echo "Press Ctrl+C to stop"
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl port-forward -n sulla svc/redis 6379:6379 --address=0.0.0.0

# Query PostgreSQL conversations table (summary)
pg-conversations:
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl exec -n sulla deploy/postgres -- \
    psql -U sulla -c "SELECT thread_id, jsonb_array_length(messages) as msg_count, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 10;"

# Query PostgreSQL conversations with full messages
pg-messages thread_id="":
    #!/usr/bin/env bash
    if [ -z "{{thread_id}}" ]; then
        echo "Usage: just pg-messages <thread_id>"
        echo "Get thread IDs with: just pg-conversations"
        exit 1
    fi
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    resources/darwin/lima/bin/limactl shell 0 -- \
    sudo k3s kubectl exec -n sulla deploy/postgres -- \
    psql -U sulla -c "SELECT jsonb_pretty(messages) FROM conversations WHERE thread_id = '{{thread_id}}';"

# Login to Docker Hub inside the VM (bypasses rate limiting for image pulls)
docker-login:
    @echo "Logging into Docker Hub inside the VM..."
    @echo "This will store credentials in the VM and bypass Docker Hub rate limits."
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- docker login

# Check Docker login status inside the VM
docker-status:
    @echo "Checking Docker login status..."
    LIMA_HOME=~/Library/Application\ Support/rancher-desktop/lima \
    limactl shell 0 -- docker info 2>/dev/null | grep -E "Username|Registry" || echo "Not logged in"
