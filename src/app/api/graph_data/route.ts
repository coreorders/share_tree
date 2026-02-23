import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

function normalizeName(name: string) {
    return name.replace(/\(주\)|㈜|주식회사/g, '').replace(/\s+/g, '').trim();
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const centerNode = searchParams.get('center_node');
    const minShare = parseFloat(searchParams.get('min_share') || '5');
    const maxDepth = parseInt(searchParams.get('max_depth') || '2', 10);

    if (!centerNode) {
        return NextResponse.json({ error: 'center_node required' }, { status: 400 });
    }

    try {
        const allCompanies = await queryDb('SELECT corp_code, corp_name, market_cap, close_price, stock_code FROM companies');
        const corpCodeToCompany = new Map<string, any>();
        const normalizedNameToCorpCode = new Map<string, string>();
        const originalNameToCorpCode = new Map<string, string>();

        for (const comp of allCompanies) {
            corpCodeToCompany.set(comp.corp_code, comp);
            normalizedNameToCorpCode.set(normalizeName(comp.corp_name), comp.corp_code);
            originalNameToCorpCode.set(comp.corp_name, comp.corp_code);
        }

        const visitedEdges = new Set<string>();
        const nodes = new Map<string, any>();
        const edges: any[] = [];

        let currentDepthNodes = new Set<string>();

        if (corpCodeToCompany.has(centerNode)) {
            currentDepthNodes.add(centerNode);
            const c = corpCodeToCompany.get(centerNode);
            nodes.set(centerNode, {
                id: centerNode,
                label: c.corp_name,
                market_cap: c.market_cap,
                depth: 0,
                isCompany: true,
                isListed: !!(c.stock_code && c.close_price > 0),
                isCenter: true
            });
        } else {
            currentDepthNodes.add(centerNode);
            nodes.set(centerNode, {
                id: centerNode,
                label: centerNode,
                market_cap: 0,
                depth: 0,
                isCompany: false,
                isCenter: true
            });
        }

        const resolveId = (name: string) => {
            if (originalNameToCorpCode.has(name)) return originalNameToCorpCode.get(name)!;
            const norm = normalizeName(name);
            if (normalizedNameToCorpCode.has(norm)) return normalizedNameToCorpCode.get(norm)!;
            return name;
        };

        const resolveLabel = (id: string) => {
            if (corpCodeToCompany.has(id)) return corpCodeToCompany.get(id).corp_name;
            return id;
        };

        const resolveMarketCap = (id: string) => {
            if (corpCodeToCompany.has(id)) return corpCodeToCompany.get(id).market_cap || 0;
            return 0;
        };

        // Load all shareholders (not just above min_share) for personal asset calculation
        const allShareholders = await queryDb(
            'SELECT * FROM shareholders WHERE shareholder_name != ?',
            ['계']
        );

        // Build personal asset map: shareholder_name -> total value of holdings
        // value = shares_count * close_price of the target company
        const personalAssetMap = new Map<string, number>();
        for (const row of allShareholders) {
            const ownerId = resolveId(row.shareholder_name);
            if (!corpCodeToCompany.has(ownerId)) {
                // This is a person/entity, not a company
                const targetCompany = corpCodeToCompany.get(row.target_corp_code);
                if (targetCompany && row.shares_count > 0 && targetCompany.close_price > 0) {
                    const holdingValue = row.shares_count * targetCompany.close_price;
                    personalAssetMap.set(ownerId, (personalAssetMap.get(ownerId) || 0) + holdingValue);
                }
            }
        }

        // Filter relevant shareholders for graph edges
        const relevantShareholders = allShareholders.filter((row: any) => row.share_rate >= minShare);

        const outgoing = new Map<string, any[]>();
        const incoming = new Map<string, any[]>();

        for (const row of relevantShareholders) {
            const ownerId = resolveId(row.shareholder_name);
            const targetId = row.target_corp_code;
            const shareRate = row.share_rate;

            if (!outgoing.has(ownerId)) outgoing.set(ownerId, []);
            outgoing.get(ownerId)!.push({ targetId, shareRate });

            if (!incoming.has(targetId)) incoming.set(targetId, []);
            incoming.get(targetId)!.push({ ownerId, shareRate });
        }

        // BFS
        for (let depth = 1; depth <= maxDepth; depth++) {
            const nextDepthNodes = new Set<string>();

            for (const currId of currentDepthNodes) {
                if (outgoing.has(currId)) {
                    for (const rel of outgoing.get(currId)!) {
                        const edgeKey = `${currId}_${rel.targetId}`;
                        if (!visitedEdges.has(edgeKey)) {
                            visitedEdges.add(edgeKey);
                            edges.push({
                                source: currId,
                                target: rel.targetId,
                                value: rel.shareRate,
                                direction: 'outgoing'
                            });
                            nextDepthNodes.add(rel.targetId);

                            if (!nodes.has(rel.targetId)) {
                                const isCompany = corpCodeToCompany.has(rel.targetId);
                                nodes.set(rel.targetId, {
                                    id: rel.targetId,
                                    label: resolveLabel(rel.targetId),
                                    market_cap: isCompany
                                        ? resolveMarketCap(rel.targetId)
                                        : (personalAssetMap.get(rel.targetId) || 0),
                                    depth,
                                    isCompany,
                                    isListed: isCompany ? !!(corpCodeToCompany.get(rel.targetId)?.stock_code && corpCodeToCompany.get(rel.targetId)?.close_price > 0) : false,
                                    isCenter: false
                                });
                            }
                        }
                    }
                }

                if (incoming.has(currId)) {
                    for (const rel of incoming.get(currId)!) {
                        const edgeKey = `${rel.ownerId}_${currId}`;
                        if (!visitedEdges.has(edgeKey)) {
                            visitedEdges.add(edgeKey);
                            edges.push({
                                source: rel.ownerId,
                                target: currId,
                                value: rel.shareRate,
                                direction: 'incoming'
                            });
                            nextDepthNodes.add(rel.ownerId);

                            if (!nodes.has(rel.ownerId)) {
                                const isCompany = corpCodeToCompany.has(rel.ownerId);
                                nodes.set(rel.ownerId, {
                                    id: rel.ownerId,
                                    label: resolveLabel(rel.ownerId),
                                    market_cap: isCompany
                                        ? resolveMarketCap(rel.ownerId)
                                        : (personalAssetMap.get(rel.ownerId) || 0),
                                    depth,
                                    isCompany,
                                    isListed: isCompany ? !!(corpCodeToCompany.get(rel.ownerId)?.stock_code && corpCodeToCompany.get(rel.ownerId)?.close_price > 0) : false,
                                    isCenter: false
                                });
                            }
                        }
                    }
                }
            }

            currentDepthNodes = nextDepthNodes;
        }

        // Update center node market_cap if it's a person
        const centerNodeData = nodes.get(centerNode);
        if (centerNodeData && !centerNodeData.isCompany && personalAssetMap.has(centerNode)) {
            centerNodeData.market_cap = personalAssetMap.get(centerNode)!;
        }

        return NextResponse.json({
            nodes: Array.from(nodes.values()),
            links: edges,
            centerNodeId: centerNode
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
