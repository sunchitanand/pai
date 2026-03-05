#!/bin/bash
# Supervisor script: runs Chromium, Pinchtab (browser automation), and the code execution entrypoint.
# Exits if any process dies.

set -e

# Try to launch Chromium with --no-sandbox (required in containers that drop capabilities).
# If Chrome fails, Pinchtab will launch its own instance as fallback.
chromium \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-software-rasterizer \
  --disable-extensions \
  --disable-background-networking \
  --disable-features=Vulkan \
  --no-first-run \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 \
  about:blank \
  2>&1 | grep -v -E '(dbus|UPower|Vulkan|vkCreate|gcm|PHONE_REGISTRATION|DEPRECATED_ENDPOINT)' &
CHROME_PID=$!

# Wait for Chrome DevTools Protocol to be ready (up to 15s)
CHROME_READY=false
for i in $(seq 1 30); do
  # Check Chrome is still running
  if ! kill -0 $CHROME_PID 2>/dev/null; then
    echo "WARN: Chrome process exited early" >&2
    break
  fi
  if curl -sf http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
    CHROME_READY=true
    break
  fi
  sleep 0.5
done

# Extract browser-specific WebSocket URL for chromedp's remote allocator
CDP_ARGS=""
if [ "$CHROME_READY" = "true" ]; then
  CDP_WS=$(curl -sf http://127.0.0.1:9222/json/version | python3 -c "import sys,json; print(json.load(sys.stdin).get('webSocketDebuggerUrl',''))" 2>/dev/null || true)
  if [ -n "$CDP_WS" ]; then
    echo "Chrome ready, CDP URL: $CDP_WS" >&2
    CDP_ARGS="$CDP_WS"
  else
    echo "WARN: Chrome ready but could not extract webSocketDebuggerUrl" >&2
  fi
else
  echo "WARN: Chrome not ready, Pinchtab will launch its own browser" >&2
  # Kill the failed Chrome process
  kill $CHROME_PID 2>/dev/null || true
  CHROME_PID=""
fi

# Start Pinchtab — with CDP_URL if Chrome is ready, otherwise let it launch Chrome itself
if [ -n "$CDP_ARGS" ]; then
  CDP_URL="$CDP_ARGS" pinchtab &
else
  pinchtab &
fi
PINCHTAB_PID=$!

# Start code execution server on :8888
python3 -u /app/entrypoint.py &
ENTRYPOINT_PID=$!

# Wait for any process to exit
wait -n

# If we get here, one process died — kill the others and exit
kill $CHROME_PID $PINCHTAB_PID $ENTRYPOINT_PID 2>/dev/null || true
exit 1
