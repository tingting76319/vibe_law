#!/bin/bash

# 4 位 Research 並行分析（穩定版）
# 每 45 秒執行一次，每次 5 位

API_URL="https://vibe-law.zeabur.app/api/judicial/quick-batch-analysis"
LOG_FILE="/home/node/.openclaw/workspace/vibe-coding/legal-rag/scripts/logs/research4.log"

echo "[$(date)] === 4 Research 平行分析開始 ===" | tee -a $LOG_FILE

# 同時啟動 4 個程序
for i in {1..4}; do
    (
        count=0
        while true; do
            result=$(curl -s -X POST --max-time 180 "$API_URL" 2>&1)
            
            if echo "$result" | grep -q "processed"; then
                processed=$(echo "$result" | grep -oP '"processed":\s*\K\d+' || echo "0")
                count=$((count + processed))
                echo "[Research$i] $(date '+%H:%M') 已分析: $count 位" | tee -a $LOG_FILE
            fi
            
            if echo "$result" | grep -q "All lawyers processed\|done"; then
                echo "[Research$i] 分析完成！" | tee -a $LOG_FILE
                break
            fi
            
            if echo "$result" | grep -q "error\|Error\|timeout"; then
                echo "[Research$i] 等待 60 秒..." | tee -a $LOG_FILE
                sleep 60
            fi
            
            sleep 45
        done
    ) &
done

# 等待所有程序
wait

echo "[$(date)] === 4 Research 平行分析完成 ===" | tee -a $LOG_FILE
