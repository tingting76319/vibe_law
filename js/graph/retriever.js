// Graph-RAG Retriever - 檢索策略實作
// 包含：Seed Selection / Multi-hop Diffusion / Rerank / Citation Chain

class GraphRAGRetriever {
    constructor(graphBuilder) {
        this.graph = graphBuilder;
        this.defaultTopK = 5;
        this.maxHops = 3;
    }

    // ========== 1. Seed Selection（種子選擇） ==========
    selectSeeds(query, nodeTypes = ['law', 'case', 'issue']) {
        const queryLower = query.toLowerCase();
        const queryKeywords = queryLower.split(/\s+/).filter(k => k.length > 1);
        
        const seeds = [];
        
        for (const [id, node] of this.graph.nodes) {
            if (!nodeTypes.includes(node.type)) continue;
            
            const searchText = this.getNodeSearchText(node).toLowerCase();
            let score = 0;
            
            for (const keyword of queryKeywords) {
                if (searchText.includes(keyword)) {
                    score += 1;
                }
            }

            if (score > 0) {
                const boostFactors = this.calculateBoostFactors(node, queryLower);
                seeds.push({
                    node,
                    score: score * boostFactors
                });
            }
        }

        return seeds
            .sort((a, b) => b.score - a.score)
            .slice(0, this.defaultTopK);
    }

    getNodeSearchText(node) {
        const props = node.properties;
        if (node.type === 'law') {
            return `${props.name} ${props.content} ${props.category}`;
        } else if (node.type === 'case') {
            return `${props.title} ${props.summary} ${props.result}`;
        } else if (node.type === 'issue') {
            return `${props.name} ${props.description}`;
        }
        return JSON.stringify(props);
    }

    calculateBoostFactors(node, query) {
        let boost = 1.0;
        
        if (node.type === 'law') {
            if (query.includes('民法') && node.properties.category === '民法') boost *= 1.5;
            if (query.includes('刑法') && node.properties.category === '刑法') boost *= 1.5;
            if (query.includes('勞動') && node.properties.category?.includes('勞動')) boost *= 1.5;
        }
        
        if (node.type === 'case') {
            if (node.properties.result?.includes('勝訴')) boost *= 1.2;
            if (node.properties.year >= 108) boost *= 1.1;
        }

        return boost;
    }

    // ========== 2. Multi-hop Diffusion（多跳擴散） ==========
    multiHopDiffusion(seeds, maxHops = 2, edgeWeights = {}) {
        const expanded = new Map();
        const defaultWeights = {
            'cites': 0.9,
            'hasElement': 0.8,
            'causes': 0.7,
            'similarTo': 0.6,
            'rev:cites': 0.9,
            'rev:hasElement': 0.8,
            'rev:causes': 0.7,
            'rev:similarTo': 0.6
        };

        const weights = { ...defaultWeights, ...edgeWeights };

        for (const seed of seeds) {
            const queue = [{ nodeId: seed.node.id, depth: 0, cumulativeScore: seed.score }];
            const visited = new Set([seed.node.id]);

            while (queue.length > 0) {
                const { nodeId, depth, cumulativeScore } = queue.shift();

                if (depth >= maxHops) continue;

                const neighbors = this.graph.getNeighbors(nodeId, null, 1);
                
                for (const neighbor of neighbors) {
                    if (visited.has(neighbor.node.id)) continue;
                    
                    const edgeWeight = weights[neighbor.edge.edgeType] || 0.5;
                    const newScore = cumulativeScore * edgeWeight * (1 - depth * 0.1);
                    
                    const existing = expanded.get(neighbor.node.id);
                    if (!existing || existing.score < newScore) {
                        expanded.set(neighbor.node.id, {
                            node: neighbor.node,
                            score: newScore,
                            depth: depth + 1,
                            viaEdge: neighbor.edge.edgeType,
                            parentNodeId: nodeId
                        });
                    }

                    visited.add(neighbor.node.id);
                    queue.push({ 
                        nodeId: neighbor.node.id, 
                        depth: depth + 1, 
                        cumulativeScore: newScore 
                    });
                }
            }
        }

        return Array.from(expanded.values())
            .sort((a, b) => b.score - a.score);
    }

    // ========== 3. Rerank（重新排序） ==========
    rerank(results, query, alpha = 0.7) {
        const queryKeywords = query.toLowerCase().split(/\s+/);
        
        return results.map(item => {
            const text = this.getNodeSearchText(item.node).toLowerCase();
            
            let keywordMatchScore = 0;
            for (const keyword of queryKeywords) {
                if (text.includes(keyword)) keywordMatchScore += 1;
            }
            keywordMatchScore = keywordMatchScore / queryKeywords.length;

            const finalScore = alpha * item.score + (1 - alpha) * keywordMatchScore;
            
            return {
                ...item,
                finalScore,
                keywordMatchScore,
                reason: this.getRerankReason(item, query)
            };
        }).sort((a, b) => b.finalScore - a.finalScore);
    }

    getRerankReason(item, query) {
        const reasons = [];
        
        if (item.depth === 0) reasons.push('直接匹配');
        else reasons.push(`透過${item.viaEdge}擴散(${item.depth}跳)`);
        
        if (item.keywordMatchScore > 0.5) reasons.push('關鍵詞高度匹配');
        
        return reasons.join(' + ');
    }

    // ========== 4. Citation Chain Generation（引用鏈生成） ==========
    generateCitationChain(targetNode, seeds, maxDepth = 3) {
        const chain = [];
        
        for (const seed of seeds) {
            const path = this.graph.findPath(seed.node.id, targetNode.id, maxDepth);
            
            if (path && path.length > 1) {
                const citations = [];
                
                for (let i = 0; i < path.length - 1; i++) {
                    const sourceId = path[i];
                    const targetId = path[i + 1];
                    
                    const edges = this.graph.adjacencyList.get(sourceId) || [];
                    const edge = edges.find(e => e.targetId === targetId);
                    
                    const sourceNode = this.graph.nodes.get(sourceId);
                    const targetNode = this.graph.nodes.get(targetId);
                    
                    citations.push({
                        from: this.formatNodeBrief(sourceNode),
                        to: this.formatNodeBrief(targetNode),
                        relation: edge?.edgeType || 'unknown',
                        context: edge?.context || ''
                    });
                }

                chain.push({
                    seedNode: this.formatNodeBrief(seed.node),
                    pathLength: path.length,
                    citations,
                    confidence: 1.0 - (path.length - 1) * 0.2
                });
            }
        }

        return chain;
    }

    formatNodeBrief(node) {
        if (!node) return { id: 'unknown', label: 'Unknown' };
        
        const props = node.properties;
        let label = node.id;
        
        if (node.type === 'law') label = props.name || node.id;
        else if (node.type === 'case') label = props.title || node.id;
        else if (node.type === 'issue') label = props.name || node.id;
        else if (node.type === 'judge') label = props.name || node.id;
        else if (node.type === 'court') label = props.name || node.id;
        
        return { id: node.id, type: node.type, label };
    }

    // ========== Main Retrieval Pipeline ==========
    retrieve(query, options = {}) {
        const {
            topK = 5,
            maxHops = 2,
            nodeTypes = ['law', 'case', 'issue'],
            alpha = 0.7,
            includeCitationChain = true
        } = options;

        this.defaultTopK = topK;
        this.maxHops = maxHops;

        const seeds = this.selectSeeds(query, nodeTypes);
        
        const expanded = this.multiHopDiffusion(seeds, maxHops);
        
        const allResults = [
            ...seeds.map(s => ({ ...s, depth: 0, viaEdge: 'seed' })),
            ...expanded
        ];
        
        const reranked = this.rerank(allResults, query, alpha);
        
        const topResults = reranked.slice(0, topK);
        
        let citationChains = null;
        if (includeCitationChain && topResults.length > 0) {
            citationChains = this.generateCitationChain(
                topResults[0].node,
                seeds.slice(0, 3),
                maxHops
            );
        }

        return {
            query,
            seeds: seeds.map(s => this.formatNodeBrief(s.node)),
            topResults: topResults.map(r => ({
                node: this.formatNodeBrief(r.node),
                score: r.finalScore,
                originalScore: r.score,
                depth: r.depth,
                reason: r.reason
            })),
            citationChains,
            stats: {
                totalSeeds: seeds.length,
                totalExpanded: expanded.length,
                totalResults: allResults.length
            }
        };
    }

    retrieveForJudge(query, judgeId, options = {}) {
        const judgeNode = this.graph.nodes.get(`judge-${judgeId}`);
        if (!judgeNode) {
            return this.retrieve(query, options);
        }

        const judgeCases = this.graph.getNeighbors(`judge-${judgeId}`, 'decides');
        
        const caseIds = judgeCases.map(jc => jc.node.id);
        
        const baseResults = this.retrieve(query, options);
        
        const boostedResults = baseResults.topResults.map(result => {
            if (caseIds.includes(result.node.id)) {
                return { ...result, score: result.score * 1.3, reason: result.reason + ' (法官相關案件)' };
            }
            return result;
        }).sort((a, b) => b.score - a.score);

        return {
            ...baseResults,
            topResults: boostedResults,
            judgeContext: {
                judgeId,
                judgeName: judgeNode.properties.name,
                relatedCasesCount: caseIds.length
            }
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GraphRAGRetriever };
}
