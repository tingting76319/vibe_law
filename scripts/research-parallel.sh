#!/bin/bash

# 8 位 Research 並行分析

API_URL="https://vibe-law.zeabur.app/api/judicial/quick-batch-analysis"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/parallel.log"

echo "=== 8 Research 平行分析開始 ===" | tee -a $LOG_FILE

# 同時啟動 8 個程序
for i in {1..8}; do
    (
        count=0
        while true; do
            result=$(curl -s -X POST --max-time 300 "$API_URL" 2>&1)
            if echo "$result" | grep -q "processed"; then
                count=$((count + 5))
                echo "[Research$i] 已分析: $count 位" | tee -a $LOG_FILE
            fi
            if echo "$result" | grep -q "All lawyers processed"; then
                break
            fi
            sleep 30
        done
    ) &
done

# 等待所有程序完成
wait

echo "=== 平行分析完成 ===" | tee -a $LOG_FILE
