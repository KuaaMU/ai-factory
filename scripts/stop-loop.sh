#!/usr/bin/env bash
# stop-loop.sh - Gracefully stop the auto-loop process
# Usage: stop-loop.sh [--force] [--output-dir DIR]
set -euo pipefail

OUTPUT_DIR="${OUTPUT_DIR:-./output}"
FORCE=false

###############################################################################
# Argument parsing
###############################################################################
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=true
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--force] [--output-dir DIR]" >&2
      exit 1
      ;;
  esac
done

PID_FILE="$OUTPUT_DIR/.auto-loop.pid"
STOP_SENTINEL="$OUTPUT_DIR/.auto-loop-stop"

###############################################################################
# Check if loop is running
###############################################################################
if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found at $PID_FILE. Auto-loop may not be running."
  exit 0
fi

PID="$(cat "$PID_FILE")"

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running. Cleaning up stale PID file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Auto-loop is running with PID $PID"

###############################################################################
# Create stop sentinel for graceful shutdown
###############################################################################
touch "$STOP_SENTINEL"
echo "Stop sentinel created. Waiting for graceful shutdown..."

###############################################################################
# Wait for graceful shutdown (up to 60 seconds)
###############################################################################
WAIT_SECONDS=60
elapsed=0

while (( elapsed < WAIT_SECONDS )); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Auto-loop stopped gracefully (took ${elapsed}s)."
    rm -f "$STOP_SENTINEL"
    # Verify PID file removed
    if [[ -f "$PID_FILE" ]]; then
      echo "Warning: PID file still exists. Removing."
      rm -f "$PID_FILE"
    fi
    exit 0
  fi
  sleep 1
  elapsed=$(( elapsed + 1 ))
done

###############################################################################
# Force kill if requested and graceful shutdown failed
###############################################################################
if [[ "$FORCE" == "true" ]]; then
  echo "Graceful shutdown timed out after ${WAIT_SECONDS}s. Sending SIGKILL..."
  kill -9 "$PID" 2>/dev/null || true
  sleep 2
  if kill -0 "$PID" 2>/dev/null; then
    echo "ERROR: Failed to kill process $PID" >&2
    exit 1
  fi
  echo "Process $PID killed."
  rm -f "$PID_FILE"
  rm -f "$STOP_SENTINEL"
  echo "Cleanup complete."
else
  echo "Graceful shutdown timed out after ${WAIT_SECONDS}s."
  echo "Use --force to send SIGKILL."
  exit 1
fi
