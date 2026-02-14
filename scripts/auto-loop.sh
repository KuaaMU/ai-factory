#!/usr/bin/env bash
# auto-loop.sh - Enhanced autonomous loop for AI Factory
# Cross-platform: macOS, Linux, Git Bash on Windows
# Multi-engine support: claude (default) or codex
set -euo pipefail

###############################################################################
# Configuration (override via environment variables)
###############################################################################
ENGINE="${ENGINE:-claude}"
MODEL="${MODEL:-}"
LOOP_INTERVAL="${LOOP_INTERVAL:-30}"
CYCLE_TIMEOUT_SECONDS="${CYCLE_TIMEOUT_SECONDS:-1800}"
MAX_CONSECUTIVE_ERRORS="${MAX_CONSECUTIVE_ERRORS:-5}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-300}"
LIMIT_WAIT_SECONDS="${LIMIT_WAIT_SECONDS:-3600}"
MAX_LOGS="${MAX_LOGS:-200}"
OUTPUT_DIR="${OUTPUT_DIR:-./output}"

# Set default model based on engine
if [[ -z "$MODEL" ]]; then
  case "$ENGINE" in
    claude) MODEL="opus" ;;
    codex)  MODEL="" ;;
    *)      MODEL="opus" ;;
  esac
fi

# Enable agent teams for Claude
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

###############################################################################
# Derived paths (relative to OUTPUT_DIR)
###############################################################################
LOG_DIR="$OUTPUT_DIR/logs"
CONSENSUS_FILE="$OUTPUT_DIR/memories/consensus.md"
PROMPT_FILE="$OUTPUT_DIR/PROMPT.md"
PID_FILE="$OUTPUT_DIR/.auto-loop.pid"
STATE_FILE="$OUTPUT_DIR/.auto-loop-state"
STOP_SENTINEL="$OUTPUT_DIR/.auto-loop-stop"
LOG_FILE="$LOG_DIR/auto-loop.log"

###############################################################################
# Internal state
###############################################################################
CYCLE_COUNT=0
ERROR_COUNT=0
STATUS="idle"

###############################################################################
# Utility: portable file size (GNU stat vs BSD stat)
###############################################################################
get_file_size_bytes() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "0"
    return
  fi
  # Try GNU stat first, fall back to BSD stat
  if stat --version >/dev/null 2>&1; then
    stat -c%s "$file" 2>/dev/null || echo "0"
  else
    stat -f%z "$file" 2>/dev/null || echo "0"
  fi
}

###############################################################################
# Logging
###############################################################################
log() {
  local level="$1"
  shift
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local message="[$timestamp] [$level] $*"
  echo "$message" >> "$LOG_FILE"
  if [[ "$level" == "ERROR" || "$level" == "WARN" ]]; then
    echo "$message" >&2
  else
    echo "$message"
  fi
}

log_cycle() {
  local cycle_num="$1"
  local status="$2"
  local cost="${3:-}"
  local summary="${4:-}"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  local cycle_log_file="$LOG_DIR/cycle-${cycle_num}.log"

  {
    echo "cycle: $cycle_num"
    echo "status: $status"
    echo "cost: $cost"
    echo "timestamp: $timestamp"
    echo "engine: $ENGINE"
    echo "model: $MODEL"
    echo "---"
    echo "$summary"
  } > "$cycle_log_file"

  log "INFO" "Cycle #$cycle_num completed with status=$status cost=$cost"
}

###############################################################################
# Rate limit / stop / circuit breaker checks
###############################################################################
check_usage_limit() {
  local output="$1"
  # Check for common rate limit indicators in the output
  if echo "$output" | grep -qi "rate.limit\|429\|too many requests\|quota.exceeded"; then
    return 0  # rate limited
  fi
  return 1  # not rate limited
}

check_stop_requested() {
  if [[ -f "$STOP_SENTINEL" ]]; then
    return 0  # stop requested
  fi
  return 1  # no stop
}

###############################################################################
# State persistence
###############################################################################
save_state() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  cat > "$STATE_FILE" <<EOF
cycle_count=$CYCLE_COUNT
error_count=$ERROR_COUNT
status=$STATUS
engine=$ENGINE
model=$MODEL
last_run=$timestamp
pid=$$
EOF
}

###############################################################################
# Cleanup on exit
###############################################################################
cleanup() {
  log "INFO" "Shutting down auto-loop (PID $$)"
  STATUS="stopped"
  save_state
  rm -f "$PID_FILE"
  rm -f "$STOP_SENTINEL"
  log "INFO" "Cleanup complete"
}

###############################################################################
# Log rotation
###############################################################################
rotate_logs() {
  # Rotate main log file at 10MB
  local max_log_bytes=10485760  # 10 * 1024 * 1024
  if [[ -f "$LOG_FILE" ]]; then
    local log_size
    log_size="$(get_file_size_bytes "$LOG_FILE")"
    if (( log_size > max_log_bytes )); then
      local rotated_name="${LOG_FILE}.$(date '+%Y%m%d%H%M%S')"
      mv "$LOG_FILE" "$rotated_name"
      touch "$LOG_FILE"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] Main log rotated (was ${log_size} bytes)" >> "$LOG_FILE"
      # Keep only the 3 most recent rotated logs
      local rotated_logs
      rotated_logs=( "$LOG_DIR"/auto-loop.log.* )
      if [[ "${#rotated_logs[@]}" -gt 0 ]] && [[ -e "${rotated_logs[0]}" ]]; then
        local rcount="${#rotated_logs[@]}"
        if (( rcount > 3 )); then
          local rto_remove=$(( rcount - 3 ))
          printf '%s\n' "${rotated_logs[@]}" | sort | head -n "$rto_remove" | while IFS= read -r f; do
            rm -f "$f"
          done
        fi
      fi
    fi
  fi

  # Rotate cycle logs (keep MAX_LOGS most recent)
  local cycle_logs
  cycle_logs=( "$LOG_DIR"/cycle-*.log )
  # If glob didn't match, array contains the literal glob pattern
  if [[ "${#cycle_logs[@]}" -eq 0 ]] || [[ ! -e "${cycle_logs[0]}" ]]; then
    return
  fi

  local count="${#cycle_logs[@]}"
  if (( count > MAX_LOGS )); then
    local to_remove=$(( count - MAX_LOGS ))
    log "INFO" "Rotating logs: removing $to_remove old cycle logs"
    # Sort by name (which includes cycle number) and remove oldest
    printf '%s\n' "${cycle_logs[@]}" | sort -t- -k2 -n | head -n "$to_remove" | while IFS= read -r f; do
      rm -f "$f"
    done
  fi
}

###############################################################################
# Consensus management
###############################################################################
backup_consensus() {
  if [[ -f "$CONSENSUS_FILE" ]]; then
    cp "$CONSENSUS_FILE" "${CONSENSUS_FILE}.bak"
  fi
}

restore_consensus() {
  if [[ -f "${CONSENSUS_FILE}.bak" ]]; then
    cp "${CONSENSUS_FILE}.bak" "$CONSENSUS_FILE"
    log "WARN" "Restored consensus from backup"
  fi
}

validate_consensus() {
  # Validation: file exists, is non-empty, contains required sections
  if [[ ! -f "$CONSENSUS_FILE" ]]; then
    log "ERROR" "Consensus file missing: $CONSENSUS_FILE"
    return 1
  fi
  local size
  size="$(get_file_size_bytes "$CONSENSUS_FILE")"
  if (( size == 0 )); then
    log "ERROR" "Consensus file is empty"
    return 1
  fi
  # Check it hasn't been truncated to near-zero compared to backup
  if [[ -f "${CONSENSUS_FILE}.bak" ]]; then
    local bak_size
    bak_size="$(get_file_size_bytes "${CONSENSUS_FILE}.bak")"
    if (( bak_size > 0 && size * 5 < bak_size )); then
      log "WARN" "Consensus file shrank to less than 20% of previous size"
      return 1
    fi
  fi
  # Check required sections exist
  local missing_sections=()
  if ! grep -q "^# Auto Company Consensus" "$CONSENSUS_FILE" 2>/dev/null; then
    missing_sections+=("# Auto Company Consensus")
  fi
  if ! grep -q "^## Next Action" "$CONSENSUS_FILE" 2>/dev/null; then
    missing_sections+=("## Next Action")
  fi
  if ! grep -q "^## Company State" "$CONSENSUS_FILE" 2>/dev/null; then
    missing_sections+=("## Company State")
  fi
  if (( ${#missing_sections[@]} > 0 )); then
    log "WARN" "Consensus missing required sections: ${missing_sections[*]}"
    return 1
  fi
  return 0
}

###############################################################################
# Run a single cycle
###############################################################################
run_cycle() {
  local cycle_num="$1"

  # Build the full prompt
  local prompt_content=""
  if [[ -f "$PROMPT_FILE" ]]; then
    prompt_content="$(cat "$PROMPT_FILE")"
  else
    log "ERROR" "Prompt file not found: $PROMPT_FILE"
    return 1
  fi

  local consensus_content=""
  if [[ -f "$CONSENSUS_FILE" ]]; then
    consensus_content="$(cat "$CONSENSUS_FILE")"
  fi

  local full_prompt
  full_prompt="${prompt_content}
---
## Current Consensus
${consensus_content}
---
This is Cycle #${cycle_num}. Act decisively."

  # Run the appropriate engine with a timeout watchdog
  local output=""
  local exit_code=0
  local cmd_pid

  case "$ENGINE" in
    claude)
      timeout "$CYCLE_TIMEOUT_SECONDS" \
        claude -p "$full_prompt" --model "$MODEL" --dangerously-skip-permissions --output-format json \
        > "$LOG_DIR/.cycle-output.tmp" 2>&1 &
      cmd_pid=$!
      ;;
    codex)
      local codex_args=(--quiet --full-auto)
      if [[ -n "$MODEL" ]]; then
        codex_args+=(--model "$MODEL")
      fi
      timeout "$CYCLE_TIMEOUT_SECONDS" \
        codex "${codex_args[@]}" "$full_prompt" \
        > "$LOG_DIR/.cycle-output.tmp" 2>&1 &
      cmd_pid=$!
      ;;
    *)
      log "ERROR" "Unknown engine: $ENGINE"
      return 1
      ;;
  esac

  # Wait for the command to finish
  if wait "$cmd_pid"; then
    exit_code=0
  else
    exit_code=$?
  fi

  if [[ -f "$LOG_DIR/.cycle-output.tmp" ]]; then
    output="$(cat "$LOG_DIR/.cycle-output.tmp")"
    rm -f "$LOG_DIR/.cycle-output.tmp"
  fi

  # Return output via a temp file for the caller to read
  echo "$output" > "$LOG_DIR/.last-output.tmp"
  return "$exit_code"
}

###############################################################################
# Extract metadata from cycle output
###############################################################################
extract_cycle_metadata() {
  local output="$1"
  # For claude JSON output, extract fields
  # result, cost_usd, subtype, type
  EXTRACTED_RESULT=""
  EXTRACTED_COST=""
  EXTRACTED_SUBTYPE=""
  EXTRACTED_TYPE=""

  if [[ "$ENGINE" == "claude" ]]; then
    # Parse JSON fields using grep/sed (avoid jq dependency)
    EXTRACTED_RESULT="$(echo "$output" | grep -o '"result"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"result"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)"
    EXTRACTED_COST="$(echo "$output" | grep -o '"cost_usd"[[:space:]]*:[[:space:]]*[0-9.]*' | head -1 | sed 's/.*"cost_usd"[[:space:]]*:[[:space:]]*//' || true)"
    EXTRACTED_SUBTYPE="$(echo "$output" | grep -o '"subtype"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"subtype"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)"
    EXTRACTED_TYPE="$(echo "$output" | grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"type"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//' || true)"
  else
    # For codex, the output is plain text
    EXTRACTED_RESULT="$output"
    EXTRACTED_COST=""
    EXTRACTED_SUBTYPE=""
    EXTRACTED_TYPE=""
  fi
}

###############################################################################
# Main loop
###############################################################################
main() {
  # Ensure directories exist
  mkdir -p "$LOG_DIR"
  mkdir -p "$(dirname "$CONSENSUS_FILE")"
  mkdir -p "$(dirname "$PID_FILE")"

  # Check for already running instance
  if [[ -f "$PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$PID_FILE")"
    if kill -0 "$existing_pid" 2>/dev/null; then
      log "ERROR" "Auto-loop already running with PID $existing_pid"
      exit 1
    else
      log "WARN" "Stale PID file found (PID $existing_pid not running). Cleaning up."
      rm -f "$PID_FILE"
    fi
  fi

  # Write PID file
  echo $$ > "$PID_FILE"

  # Set up cleanup trap
  trap cleanup EXIT INT TERM

  # Remove any lingering stop sentinel
  rm -f "$STOP_SENTINEL"

  # Load previous state if available
  if [[ -f "$STATE_FILE" ]]; then
    local prev_cycle prev_errors
    prev_cycle="$(grep '^cycle_count=' "$STATE_FILE" | cut -d= -f2 || echo "0")"
    prev_errors="$(grep '^error_count=' "$STATE_FILE" | cut -d= -f2 || echo "0")"
    CYCLE_COUNT="${prev_cycle:-0}"
    ERROR_COUNT="${prev_errors:-0}"
    log "INFO" "Resumed from previous state: cycle=$CYCLE_COUNT errors=$ERROR_COUNT"
  fi

  STATUS="running"
  save_state
  log "INFO" "Auto-loop started (PID $$, engine=$ENGINE, model=$MODEL)"

  while true; do
    # 1. Check for stop request
    if check_stop_requested; then
      log "INFO" "Stop requested. Exiting loop."
      STATUS="stopped"
      save_state
      break
    fi

    # 2. Increment cycle count
    CYCLE_COUNT=$(( CYCLE_COUNT + 1 ))

    # 3. Rotate logs if needed
    rotate_logs

    # 4. Backup consensus
    backup_consensus

    # 5-7. Run the cycle
    STATUS="running"
    save_state
    log "INFO" "Starting cycle #$CYCLE_COUNT"

    local cycle_exit_code=0
    if ! run_cycle "$CYCLE_COUNT"; then
      cycle_exit_code=$?
    fi

    # Read cycle output
    local cycle_output=""
    if [[ -f "$LOG_DIR/.last-output.tmp" ]]; then
      cycle_output="$(cat "$LOG_DIR/.last-output.tmp")"
      rm -f "$LOG_DIR/.last-output.tmp"
    fi

    # 8. Extract metadata
    extract_cycle_metadata "$cycle_output"

    # 9. Classify success/failure
    local cycle_status="ok"
    local failure_reason=""

    if (( cycle_exit_code == 124 )); then
      cycle_status="timeout"
      failure_reason="Cycle timed out after ${CYCLE_TIMEOUT_SECONDS}s"
    elif (( cycle_exit_code != 0 )); then
      cycle_status="fail"
      failure_reason="Non-zero exit code: $cycle_exit_code"
    elif [[ -n "$EXTRACTED_SUBTYPE" && "$EXTRACTED_SUBTYPE" != "success" ]]; then
      cycle_status="fail"
      failure_reason="Non-success subtype: $EXTRACTED_SUBTYPE"
    elif ! validate_consensus; then
      cycle_status="fail"
      failure_reason="Consensus validation failed"
    fi

    # 10-11. Handle success or failure
    if [[ "$cycle_status" == "ok" ]]; then
      ERROR_COUNT=0
      log_cycle "$CYCLE_COUNT" "ok" "$EXTRACTED_COST" "$EXTRACTED_RESULT"
    else
      ERROR_COUNT=$(( ERROR_COUNT + 1 ))
      log "ERROR" "Cycle #$CYCLE_COUNT failed: $failure_reason"
      restore_consensus
      log_cycle "$CYCLE_COUNT" "$cycle_status" "$EXTRACTED_COST" "$failure_reason"
    fi

    # 12. Check for rate limit
    if check_usage_limit "$cycle_output"; then
      log "WARN" "Rate limit detected. Waiting ${LIMIT_WAIT_SECONDS}s"
      STATUS="waiting_limit"
      save_state
      sleep "$LIMIT_WAIT_SECONDS"
    fi

    # 13. Check circuit breaker
    if (( ERROR_COUNT >= MAX_CONSECUTIVE_ERRORS )); then
      log "ERROR" "Circuit breaker triggered after $ERROR_COUNT consecutive errors. Cooling down ${COOLDOWN_SECONDS}s"
      STATUS="circuit_break"
      save_state
      sleep "$COOLDOWN_SECONDS"
      ERROR_COUNT=0
      log "INFO" "Cooldown complete. Resuming."
    fi

    # 14. Save state and sleep
    STATUS="running"
    save_state
    sleep "$LOOP_INTERVAL"
  done
}

###############################################################################
# Entry point
###############################################################################
main "$@"
