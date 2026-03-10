#!/bin/bash

# Research 1-8 自動化風格分析排程
# 每 60 秒執行一次批次分析

API_URL="https://vibe-law.zeabur.app/api/judicial/quick-batch-analysis"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/research-analysis.log"

echo "=== Research 自動化分析開始 ===" | tee -a $LOG_FILE

count=0
while true; do
    result=$(curl -s -X POST --max-time 300 "$API_URL" 2>&1)
    echo "[$(date)] $result" | tee -a $LOG_FILE
    
    if echo "$result" | grep -q "processed"; then
        count=$((count + 5))
        echo "[$(date)] 已分析: $count 位" | tee -a $LOG_FILE
    fi
    
    if echo "$result" | grep -q "All lawyers processed"; then
        echo "[$(date)] 分析完成！" | tee -a $LOG_FILE
        break
    fi
    
    sleep 60
done

echo "=== 自動化分析結束 ===" | tee -a $LOG_FILE
