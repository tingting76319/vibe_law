#!/bin/bash

# 自動分析腳本 - 包含重試機制

API_URL="https://vibe-law.zeabur.app/api/judicial"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/auto-analysis.log"

echo "[$(date)] === 自動分析開始 ===" | tee -a $LOG_FILE

count=0
retry=0
max_retries=5

while true; do
    # 嘗試批次分析
    result=$(curl -s -X POST --max-time 300 "$API_URL/quick-batch-analysis" 2>&1)
    
    if echo "$result" | grep -q "processed"; then
        processed=$(echo "$result" | grep -oP '"processed":\s*\K\d+' || echo "0")
        count=$((count + processed))
        retry=0
        echo "[$(date)] 已分析: $count 位 (+$processed)" | tee -a $LOG_FILE
    elif echo "$result" | grep -q "All lawyers\|done"; then
        echo "[$(date)] 分析完成！總共: $count 位" | tee -a $LOG_FILE
        break
    else
        # 超時或錯誤，重試
        retry=$((retry + 1))
        echo "[$(date)] 超時或錯誤 (重試 $retry/$max_retries)" | tee -a $LOG_FILE
        
        if [ $retry -ge $max_retries ]; then
            echo "[$(date)] 達到最大重試次數，等待 60 秒..." | tee -a $LOG_FILE
            sleep 60
            retry=0
        fi
    fi
    
    sleep 30
done

echo "[$(date)] === 自動分析結束 ===" | tee -a $LOG_FILE
