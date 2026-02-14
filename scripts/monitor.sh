#!/usr/bin/env bash
# monitor.sh - Monitor the auto-loop status
# Usage: monitor.sh [--output-dir DIR] [--follow]
set -euo pipefail

OUTPUT_DIR="${OUTPUT_DIR:-./output}"
FOLLOW=false

###############################################################################
# Argument parsing
###############################################################################
while [[ $# -gt 0 ]]; do
  case "$1" in
    --follow|-f)
      FOLLOW=true
      shift
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--follow|-f] [--output-dir DIR]" >&2
      exit 1
      ;;
  esac
done

STATE_FILE="$OUTPUT_DIR/.auto-loop-state"
CONSENSUS_FILE="$OUTPUT_DIR/memories/consensus.md"
LOG_FILE="$OUTPUT_DIR/logs/auto-loop.log"
PID_FILE="$OUTPUT_DIR/.auto-loop.pid"

###############################################################################
# Display current state
###############################################################################
echo "========================================"
echo "  AI Factory Auto-Loop Monitor"
echo "========================================"
echo ""

if [[ -f "$STATE_FILE" ]]; then
  echo "--- Current State ---"
  while IFS='=' read -r key value; do
    case "$key" in
      cycle_count)  echo "  Cycle Count:     $value" ;;
      error_count)  echo "  Error Count:     $value" ;;
      status)       echo "  Status:          $value" ;;
      engine)       echo "  Engine:          $value" ;;
      model)        echo "  Model:           $value" ;;
      last_run)     echo "  Last Run:        $value" ;;
      pid)          echo "  PID:             $value" ;;
    esac
  done < "$STATE_FILE"
  echo ""
else
  echo "  No state file found. Auto-loop may not have run yet."
  echo ""
fi

# Check if process is actually running
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "  Process:         RUNNING (PID $PID)"
  else
    echo "  Process:         NOT RUNNING (stale PID $PID)"
  fi
else
  echo "  Process:         NOT RUNNING (no PID file)"
fi
echo ""

###############################################################################
# Show consensus summary
###############################################################################
if [[ -f "$CONSENSUS_FILE" ]]; then
  echo "--- Consensus Summary (first 20 lines) ---"
  head -n 20 "$CONSENSUS_FILE"
  echo ""
  echo "  [... truncated, see full file at $CONSENSUS_FILE]"
  echo ""
else
  echo "--- Consensus ---"
  echo "  No consensus file found."
  echo ""
fi

###############################################################################
# Tail the log
###############################################################################
if [[ -f "$LOG_FILE" ]]; then
  if [[ "$FOLLOW" == "true" ]]; then
    echo "--- Log (following) ---"
    tail -f "$LOG_FILE"
  else
    echo "--- Recent Log (last 30 lines) ---"
    tail -n 30 "$LOG_FILE"
    echo ""
    echo "  Use --follow (-f) to tail the log in real time."
  fi
else
  echo "--- Log ---"
  echo "  No log file found."
fi
