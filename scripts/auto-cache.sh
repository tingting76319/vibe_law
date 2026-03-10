#!/bin/bash

# 自動建立快取 - 包含重試機制

API_URL="https://vibe-law.zeabur.app/api/judicial/build-lawyer-cache-v2"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/auto-cache.log"

echo "[$(date)] === 自動建立快取開始 ===" | tee -a $LOG_FILE

count=0
retry=0

while true; do
    result=$(curl -s -X POST --max-time 300 "$API_URL" 2>&1)
    
    if echo "$result" | grep -q "cached"; then
        cached=$(echo "$result" | grep -oP '"cached":\s*\K\d+' || echo "0")
        count=$((count + cached))
        retry=0
        echo "[$(date)] 快取記錄: $count (+$cached)" | tee -a $LOG_FILE
    elif echo "$result" | grep -q "All lawyers\|done"; then
        echo "[$(date)] 快取建立完成！總記錄: $count" | tee -a $LOG_FILE
        break
    else
        retry=$((retry + 1))
        echo "[$(date)] 超時 (重試 $retry)" | tee -a $LOG_FILE
        sleep 60
    fi
    
    sleep 30
done

echo "[$(date)] === 自動建立快取結束 ===" | tee -a $LOG_FILE
