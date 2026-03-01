// Graph Builder - 從法規與判例建構知識圖譜
// 將法律資料轉換為 Graph-RAG 可用的圖結構

class LegalGraphBuilder {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this.adjacencyList = new Map();
    }

    clear() {
        this.nodes.clear();
        this.edges = [];
        this.adjacencyList.clear();
    }

    addNode(id, type, properties) {
        if (!this.nodes.has(id)) {
            this.nodes.set(id, { id, type, properties, embeddings: null });
            this.adjacencyList.set(id, []);
        }
        return this.nodes.get(id);
    }

    addEdge(sourceId, targetId, edgeType, properties = {}) {
        const edge = { sourceId, targetId, edgeType, properties };
        this.edges.push(edge);
        
        const sourceEdges = this.adjacencyList.get(sourceId) || [];
        sourceEdges.push({ targetId, edgeType, properties });
        this.adjacencyList.set(sourceId, sourceEdges);
        
        const targetEdges = this.adjacencyList.get(targetId) || [];
        targetEdges.push({ sourceId, edgeType: `rev:${edgeType}`, properties });
        this.adjacencyList.set(targetId, targetEdges);
    }

    buildFromLaws(lawsData) {
        Object.values(lawsData).forEach(categoryLaws => {
            categoryLaws.forEach(law => {
                this.addNode(law.id, 'law', {
                    name: law.name,
                    category: law.category,
                    chapter: law.chapter,
                    content: law.content,
                    lastAmended: law.lastAmended
                });
            });
        });

        Object.values(lawsData).forEach(categoryLaws => {
            categoryLaws.forEach(law => {
                if (law.relatedLaws) {
                    law.relatedLaws.forEach(relatedLawId => {
                        if (this.nodes.has(relatedLawId)) {
                            this.addEdge(law.id, relatedLawId, 'similarTo', { 
                                context: '同一類型法條', 
                                relevance: 0.8 
                            });
                        }
                    });
                }
            });
        });

        return this;
    }

    buildFromCases(casesData) {
        casesData.forEach(caseItem => {
            this.addNode(caseItem.id, 'case', {
                title: caseItem.title,
                summary: caseItem.summary,
                court: caseItem.court,
                year: caseItem.year,
                type: caseItem.type,
                result: caseItem.result,
                date: caseItem.date
            });

            caseItem.relatedLaws.forEach(lawName => {
                const lawNode = Array.from(this.nodes.values())
                    .find(n => n.properties.name === lawName || n.properties.name.includes(lawName));
                if (lawNode) {
                    this.addEdge(caseItem.id, lawNode.id, 'cites', {
                        context: caseItem.summary,
                        relevance: 0.9
                    });
                }
            });

            caseItem.keywords.forEach((keyword, idx) => {
                const issueId = `issue-${keyword}`;
                this.addNode(issueId, 'issue', {
                    name: keyword,
                    type: '關鍵詞爭點',
                    description: `與${keyword}相關的法律爭點`
                });
                this.addEdge(caseItem.id, issueId, 'similarTo', {
                    similarity: 1.0 - (idx * 0.1),
                    keyFactors: [keyword]
                });
            });
        });

        return this;
    }

    addIssueNode(issue) {
        const issueId = `issue-${issue.id}`;
        this.addNode(issueId, 'issue', issue);
        return issueId;
    }

    addPersonNode(person) {
        const personId = `person-${person.id}`;
        this.addNode(personId, 'person', person);
        return personId;
    }

    addActionNode(action) {
        const actionId = `action-${action.id}`;
        this.addNode(actionId, 'action', action);
        return actionId;
    }

    addResultNode(result) {
        const resultId = `result-${result.id}`;
        this.addNode(resultId, 'result', result);
        return resultId;
    }

    addCourtNode(court) {
        const courtId = `court-${court.id}`;
        this.addNode(courtId, 'court', court);
        return courtId;
    }

    addJudgeNode(judge) {
        const judgeId = `judge-${judge.id}`;
        this.addNode(judgeId, 'judge', judge);
        return judgeId;
    }

    getNeighbors(nodeId, edgeType = null, depth = 1) {
        if (depth === 0) return [];
        
        const neighbors = [];
        const visited = new Set([nodeId]);
        const queue = [{ nodeId, depth: 0 }];

        while (queue.length > 0) {
            const { nodeId: currentId, depth: currentDepth } = queue.shift();
            
            if (currentDepth >= depth) continue;

            const edges = this.adjacencyList.get(currentId) || [];
            for (const edge of edges) {
                if (edgeType && edge.edgeType !== edgeType && edge.edgeType !== `rev:${edgeType}`) continue;
                
                if (!visited.has(edge.targetId)) {
                    visited.add(edge.targetId);
                    const targetNode = this.nodes.get(edge.targetId);
                    if (targetNode) {
                        neighbors.push({
                            node: targetNode,
                            edge: { edgeType: edge.edgeType, ...edge.properties },
                            depth: currentDepth + 1
                        });
                        queue.push({ nodeId: edge.targetId, depth: currentDepth + 1 });
                    }
                }
            }
        }

        return neighbors;
    }

    getNodeById(id) {
        return this.nodes.get(id);
    }

    getNodesByType(type) {
        return Array.from(this.nodes.values()).filter(n => n.type === type);
    }

    getEdges() {
        return this.edges;
    }

    getStats() {
        const typeCount = {};
        for (const [id, node] of this.nodes) {
            typeCount[node.type] = (typeCount[node.type] || 0) + 1;
        }
        
        const edgeCount = {};
        for (const edge of this.edges) {
            edgeCount[edge.edgeType] = (edgeCount[edge.edgeType] || 0) + 1;
        }

        return {
            totalNodes: this.nodes.size,
            totalEdges: this.edges.length,
            nodesByType: typeCount,
            edgesByType: edgeCount
        };
    }

    export() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
            stats: this.getStats()
        };
    }

    findPath(startId, endId, maxDepth = 3) {
        const queue = [[startId]];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];

            if (currentId === endId) {
                return path;
            }

            if (path.length >= maxDepth) continue;

            const edges = this.adjacencyList.get(currentId) || [];
            for (const edge of edges) {
                if (!visited.has(edge.targetId)) {
                    visited.add(edge.targetId);
                    queue.push([...path, edge.targetId]);
                }
            }
        }

        return null;
    }
}

const graphBuilder = new LegalGraphBuilder();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LegalGraphBuilder, graphBuilder };
}
