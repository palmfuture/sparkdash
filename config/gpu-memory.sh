#!/bin/bash
# Run on host to write GPU memory to shared file
# Add to crontab: * * * * * /mnt/admin/sparkDash/config/gpu-memory.sh

OUTPUT="/mnt/admin/sparkDash/config/gpu-memory.json"
MEMORY=$(nvidia-smi --query-compute-apps=pid,used_gpu_memory --format=csv,noheader,nounits 2>/dev/null | awk -F',' '{sum+=$2} END {print sum+0}')
TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)

echo "{\"used\": $MEMORY, \"total\": \"$(echo $TOTAL | tr -d ' ')\", \"timestamp\": $(date +%s)}" > "$OUTPUT"