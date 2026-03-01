// Legal Graph Schema v0 - 節點與邊定義
// Node Types: 法條/爭點/人物/行為/結果/法院/法官
// Edge Types: 引用/構成要件/因果/相似

const GRAPH_SCHEMA = {
    nodes: {
        law: {
            label: "法條",
            properties: ["id", "name", "category", "chapter", "content", "lastAmended"],
            description: "法律條文，包含民法、刑法、行政法等"
        },
        issue: {
            label: "爭點",
            properties: ["id", "name", "type", "description", "legalElements"],
            description: "案件爭點，如過失責任、損害賠償金額等"
        },
        person: {
            label: "人物",
            properties: ["id", "name", "role", "type"],
            description: "案件相關人物，包含原告、被告、證人等"
        },
        action: {
            label: "行為",
            properties: ["id", "name", "type", "description", "intent"],
            description: "法律行為，如過失行為、侵權行為等"
        },
        result: {
            label: "結果",
            properties: ["id", "name", "type", "description", "damages"],
            description: "法律結果，如財產損失、身體傷害等"
        },
        court: {
            label: "法院",
            properties: ["id", "name", "level", "jurisdiction"],
            description: "司法機關，如最高法院、高等法院等"
        },
        judge: {
            label: "法官",
            properties: ["id", "name", "court", "specialty", "seniority"],
            description: "法官個人資訊與專業領域"
        }
    },
    edges: {
        cites: {
            label: "引用",
            source: ["law", "case"],
            target: ["law", "case"],
            properties: ["context", "relevance"],
            description: "法條引用關係"
        },
        hasElement: {
            label: "構成要件",
            source: ["law", "issue"],
            target: ["action", "result"],
            properties: ["element", "required"],
            description: "法律構成要件關係"
        },
        causes: {
            label: "因果",
            source: ["action"],
            target: ["result"],
            properties: ["causation", "proximateCause", "degree"],
            description: "因果關係"
        },
        similarTo: {
            label: "相似",
            source: ["case", "issue"],
            target: ["case", "issue"],
            properties: ["similarity", "keyFactors"],
            description: "案件或爭點相似關係"
        },
        decides: {
            label: "裁決",
            source: ["judge", "court"],
            target: ["case"],
            properties: ["date", "verdict", "reasoning"],
            description: "法官裁決案件"
        },
        handles: {
            label: "審理",
            source: ["court"],
            target: ["case"],
            properties: ["stage", "date"],
            description: "法院審理案件"
        }
    }
};

const NODE_TYPES = GRAPH_SCHEMA.nodes;
const EDGE_TYPES = GRAPH_SCHEMA.edges;

function getNodeProperties(type) {
    return NODE_TYPES[type]?.properties || [];
}

function getEdgeTypes() {
    return Object.keys(EDGE_TYPES);
}

function getNodeTypes() {
    return Object.keys(NODE_TYPES);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GRAPH_SCHEMA, NODE_TYPES, EDGE_TYPES, getNodeProperties, getEdgeTypes, getNodeTypes };
}
