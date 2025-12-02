#!/bin/bash
#
# TACO - Docker Test Runner
# Usage: ./run-tests.sh [options]
#
# Options:
#   --build      Force rebuild of containers
#   --parallel   Run library containers in parallel (default)
#   --sequential Run library containers one at a time
#   --clean      Remove containers and images after run
#   --help       Show this help message
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default options
BUILD_FLAG=""
CLEAN_AFTER=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD_FLAG="--build"
            shift
            ;;
        --clean)
            CLEAN_AFTER=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -n +2 | sed 's/^# //'
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "========================================"
echo "  TACO - Docker Runner"
echo "========================================"
echo ""

# Create reports directory
mkdir -p reports

# Build and run
echo "Starting containers..."
docker compose up $BUILD_FLAG --abort-on-container-exit --exit-code-from test-runner

# Show results
echo ""
echo "========================================"
echo "  Test Results"
echo "========================================"
echo ""

if [ -f "reports/summary.json" ]; then
    cat reports/summary.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('Rankings:')
for i, r in enumerate(data['rankings']):
    medal = ['🥇', '🥈', '🥉'][i] if i < 3 else '  '
    print(f\"{medal} {i+1}. {r['name']}: {r['passRate']}% ({r['passed']}/{r['total']})\")
" 2>/dev/null || cat reports/summary.json
fi

# Cleanup if requested
if [ "$CLEAN_AFTER" = true ]; then
    echo ""
    echo "Cleaning up..."
    docker compose down --rmi local --volumes
fi

echo ""
echo "Reports saved to: $SCRIPT_DIR/reports/"
