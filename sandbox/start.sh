#!/bin/bash
# Supervisor script: runs Pinchtab (browser automation) and the code execution entrypoint.
# Exits if either process dies.

set -e

# Start Pinchtab — launches Chrome internally with --no-sandbox (patched at build time)
pinchtab &
PINCHTAB_PID=$!

# Start code execution server on :8888
python3 -u /app/entrypoint.py &
ENTRYPOINT_PID=$!

# Wait for any process to exit
wait -n

# If we get here, one process died — kill the other and exit
kill $PINCHTAB_PID $ENTRYPOINT_PID 2>/dev/null || true
exit 1
