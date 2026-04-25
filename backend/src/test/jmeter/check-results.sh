#!/usr/bin/env bash
# check-results.sh — Validate JMeter CSV results against performance thresholds
# Thresholds: error rate <= 5%, p95 response time <= 5000ms
set -euo pipefail

RESULTS_FILE="${1:-results.csv}"
MAX_ERROR_RATE="${2:-5.0}"
MAX_P95_MS="${3:-5000}"

if [[ ! -f "$RESULTS_FILE" ]]; then
  echo "ERROR: Results file '$RESULTS_FILE' not found"
  exit 1
fi

TOTAL=$(tail -n +2 "$RESULTS_FILE" | wc -l | tr -d ' ')
if [[ "$TOTAL" -eq 0 ]]; then
  echo "ERROR: No samples found in results"
  exit 1
fi

ERRORS=$(tail -n +2 "$RESULTS_FILE" | awk -F',' '{print $8}' | grep -ci 'false' || true)
ERROR_RATE=$(awk "BEGIN {printf \"%.2f\", ($ERRORS / $TOTAL) * 100}")

# Calculate p95 from the "elapsed" column (column 2, 1-indexed)
P95=$(tail -n +2 "$RESULTS_FILE" | awk -F',' '{print $2}' | sort -n | awk -v n="$TOTAL" 'NR==int(n*0.95+0.5) {print; exit}')

# Calculate additional stats
AVG=$(tail -n +2 "$RESULTS_FILE" | awk -F',' '{sum += $2; count++} END {printf "%.0f", sum/count}')
MIN=$(tail -n +2 "$RESULTS_FILE" | awk -F',' 'NR==1 || $2<min {min=$2} END {print min}')
MAX=$(tail -n +2 "$RESULTS_FILE" | awk -F',' 'NR==1 || $2>max {max=$2} END {print max}')

# Per-endpoint summary
echo "========================================"
echo "  JMeter Performance Test Results"
echo "========================================"
echo ""
echo "  Total Requests:    $TOTAL"
echo "  Failed Requests:   $ERRORS"
echo "  Error Rate:        ${ERROR_RATE}%  (threshold: <=${MAX_ERROR_RATE}%)"
echo "  Min Response:      ${MIN}ms"
echo "  Avg Response:      ${AVG}ms"
echo "  P95 Response:      ${P95}ms  (threshold: <=${MAX_P95_MS}ms)"
echo "  Max Response:      ${MAX}ms"
echo ""
echo "----------------------------------------"
echo "  Per-Endpoint Summary"
echo "----------------------------------------"
printf "  %-35s %8s %8s %8s %8s\n" "Endpoint" "Count" "Avg(ms)" "P95(ms)" "Err%"
echo "  -------------------------------------------------------------------"

# Get unique labels
LABELS=$(tail -n +2 "$RESULTS_FILE" | awk -F',' '{print $3}' | sort -u)

while IFS= read -r label; do
  [[ -z "$label" ]] && continue
  # Extract stats for this label
  read -r cnt errcnt avg_val <<< $(tail -n +2 "$RESULTS_FILE" | awk -F',' -v lbl="$label" '$3==lbl {
    sum += $2; count++; if (tolower($8)=="false") errs++
  } END {
    printf "%d %d %.0f\n", count, errs+0, (count>0 ? sum/count : 0)
  }')

  # P95 via sort
  EP95=$(tail -n +2 "$RESULTS_FILE" | awk -F',' -v lbl="$label" '$3==lbl {print $2}' | sort -n | awk -v n="$cnt" 'NR==int(n*0.95+0.5) {print; exit}')
  ERR_PCT=$(awk "BEGIN {printf \"%.1f\", ($errcnt / $cnt) * 100}")

  printf "  %-35s %8d %8s %8s %7s%%\n" "$label" "$cnt" "$avg_val" "${EP95:-0}" "$ERR_PCT"
done <<< "$LABELS" | sort

echo ""

# Threshold checks
FAILED=0

OVER_ERROR=$(awk "BEGIN {print ($ERROR_RATE > $MAX_ERROR_RATE) ? 1 : 0}")
if [[ "$OVER_ERROR" -eq 1 ]]; then
  echo "FAIL: Error rate ${ERROR_RATE}% exceeds threshold ${MAX_ERROR_RATE}%"
  FAILED=1
else
  echo "PASS: Error rate ${ERROR_RATE}% within threshold ${MAX_ERROR_RATE}%"
fi

OVER_P95=$(awk "BEGIN {print ($P95 > $MAX_P95_MS) ? 1 : 0}")
if [[ "$OVER_P95" -eq 1 ]]; then
  echo "FAIL: P95 response time ${P95}ms exceeds threshold ${MAX_P95_MS}ms"
  FAILED=1
else
  echo "PASS: P95 response time ${P95}ms within threshold ${MAX_P95_MS}ms"
fi

echo ""
if [[ "$FAILED" -eq 1 ]]; then
  echo "========================================" 
  echo "  PERFORMANCE TEST FAILED"
  echo "========================================"
  exit 1
else
  echo "========================================"
  echo "  PERFORMANCE TEST PASSED"
  echo "========================================"
  exit 0
fi
