#!/bin/bash

# 穩定版分析腳本
# 每次1位 + 60秒間隔

API_URL="https://vibe-law.zeabur.app/api/judicial"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/stable.log"

echo "[$(date)] === 穩定分析開始 ===" | tee -a $LOG_FILE

count=0
while true; do
    result=$(curl -s -X POST --max-time 120 "$API_URL/quick-batch-analysis" 2>&1)
    
    if echo "$result" | grep -q "processed"; then
        processed=$(echo "$result" | grep -oP '"processed":\s*\K\d+' || echo "0")
        count=$((count + processed))
        echo "[$(date)] 已分析: $count 位 (+$processed)" | tee -a $LOG_FILE
    elif echo "$result" | grep -q "All lawyers\|done"; then
        echo "[$(date)] 分析完成！總共: $count 位" | tee -a $LOG_FILE
        break
    else
        echo "[$(date)] 等待 60 秒..." | tee -a $LOG_FILE
        sleep 60
    fi
    
    sleep 60
done

echo "[$(date)] === 穩定分析結束 ===" | tee -a $LOG_FILE
