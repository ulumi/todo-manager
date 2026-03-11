#!/bin/bash
DIR="$(cd "$(dirname "$0")"; pwd)"
echo "Starting Todo server..."
node "$DIR/server.js" &
SERVER_PID=$!
sleep 0.5
open "http://localhost:3000"
echo "Press Ctrl+C to stop."
wait $SERVER_PID
