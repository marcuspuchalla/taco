#!/bin/bash
#
# Test a single container manually
# Usage: ./test-single-container.sh <container-name>
#
# Example: ./test-single-container.sh node-borc
#

set -e

CONTAINER=${1:-node-borc}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Testing container: $CONTAINER"
echo "================================"

# Build container
echo "Building..."
docker build -t cbor-test-$CONTAINER "$SCRIPT_DIR/containers/$CONTAINER"

# Run container
echo "Starting container..."
CONTAINER_ID=$(docker run -d -p 8080:8080 cbor-test-$CONTAINER)

# Wait for health
echo "Waiting for container to be ready..."
sleep 2

for i in {1..30}; do
    if curl -s http://localhost:8080/health | grep -q "ok"; then
        echo "Container is ready!"
        break
    fi
    sleep 1
done

# Test health endpoint
echo ""
echo "Health check:"
curl -s http://localhost:8080/health | python3 -m json.tool

# Test decode
echo ""
echo "Decode test (hex '1864' = integer 100):"
curl -s -X POST http://localhost:8080/decode \
    -H "Content-Type: application/json" \
    -d '{"hex": "1864"}' | python3 -m json.tool

# Test decode array
echo ""
echo "Decode test (hex '83010203' = [1,2,3]):"
curl -s -X POST http://localhost:8080/decode \
    -H "Content-Type: application/json" \
    -d '{"hex": "83010203"}' | python3 -m json.tool

# Test decode byte string
echo ""
echo "Decode test (hex '450102030405' = byte string):"
curl -s -X POST http://localhost:8080/decode \
    -H "Content-Type: application/json" \
    -d '{"hex": "450102030405"}' | python3 -m json.tool

# Test encode
echo ""
echo "Encode test (value 42):"
curl -s -X POST http://localhost:8080/encode \
    -H "Content-Type: application/json" \
    -d '{"value": 42}' | python3 -m json.tool

# Test error handling
echo ""
echo "Error test (invalid hex):"
curl -s -X POST http://localhost:8080/decode \
    -H "Content-Type: application/json" \
    -d '{"hex": "invalid"}' | python3 -m json.tool

# Cleanup
echo ""
echo "Stopping container..."
docker stop $CONTAINER_ID > /dev/null
docker rm $CONTAINER_ID > /dev/null

echo "Done!"
