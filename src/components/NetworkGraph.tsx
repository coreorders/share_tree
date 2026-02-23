"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3-force";

interface Node {
    id: string;
    label: string;
    market_cap: number;
    depth: number;
    isCompany: boolean;
    isCenter?: boolean;
    x?: number;
    y?: number;
    val?: number;
    color?: string;
    degree?: number;
    outgoingShares?: number;
}

interface Link {
    source: string | Node;
    target: string | Node;
    value: number;
    direction?: string;
    isMutual?: boolean;
    edgeColor?: string;
}

interface NetworkGraphProps {
    data: { nodes: Node[]; links: Link[] };
    sizeMode: "share" | "market_cap";
    directionFilter: "all" | "outgoing" | "incoming";
    centerNodeId: string;
    onNodeClick?: (nodeId: string, event: { x: number; y: number }) => void;
    onNodeDoubleClick?: (nodeId: string, nodeLabel: string) => void;
}

function getColor(degree: number, maxDegree: number) {
    if (maxDegree === 0) return `rgb(56, 189, 248)`;
    const ratio = Math.min(degree / maxDegree, 1);
    const r = Math.round(56 + ratio * (239 - 56));
    const g = Math.round(189 + ratio * (68 - 189));
    const b = Math.round(248 + ratio * (68 - 248));
    return `rgb(${r}, ${g}, ${b})`;
}

export default function NetworkGraph({ data, sizeMode, directionFilter, centerNodeId, onNodeClick, onNodeDoubleClick }: NetworkGraphProps) {
    const fgRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
    const clickedNodeRef = useRef<any>(null);

    useEffect(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const { processedNodes, processedLinks } = useMemo(() => {
        let filteredLinks = data.links;
        if (directionFilter === "outgoing") {
            filteredLinks = data.links.filter(l => l.direction === 'outgoing');
        } else if (directionFilter === "incoming") {
            filteredLinks = data.links.filter(l => l.direction === 'incoming');
        }

        const nodesMap = new Map<string, Node>();
        data.nodes.forEach(n => {
            nodesMap.set(n.id, { ...n, degree: 0, outgoingShares: 0 });
        });

        const edgePairs = new Set<string>();
        filteredLinks.forEach(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            edgePairs.add(`${sourceId}_${targetId}`);
        });

        const processedLinksList: Link[] = filteredLinks.map(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;

            if (nodesMap.has(sourceId)) {
                nodesMap.get(sourceId)!.degree! += 1;
                nodesMap.get(sourceId)!.outgoingShares! += l.value;
            }
            if (nodesMap.has(targetId)) {
                nodesMap.get(targetId)!.degree! += 1;
            }

            const reverseKey = `${targetId}_${sourceId}`;
            const isMutual = edgePairs.has(reverseKey);

            let edgeColor: string;
            if (isMutual) {
                edgeColor = "rgba(250, 204, 21, 0.8)";
            } else if (l.direction === 'outgoing') {
                edgeColor = "rgba(52, 211, 153, 0.6)";
            } else {
                edgeColor = "rgba(251, 146, 60, 0.6)";
            }

            return { ...l, isMutual, edgeColor };
        });

        const connectedNodeIds = new Set<string>();
        processedLinksList.forEach(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            connectedNodeIds.add(sourceId);
            connectedNodeIds.add(targetId);
        });

        const nodesArr = Array.from(nodesMap.values()).filter(
            n => connectedNodeIds.has(n.id) || n.depth === 0 || n.id === centerNodeId
        );

        const maxDegree = Math.max(...nodesArr.map(n => n.degree || 0), 1);
        const maxMarketCap = Math.max(...nodesArr.map(n => n.market_cap || 0), 1);
        const maxShares = Math.max(...nodesArr.map(n => n.outgoingShares || 0), 1);

        nodesArr.forEach(n => {
            // Center node = yellow, person = green, company = degree-based
            if (n.id === centerNodeId) {
                n.color = "rgb(250, 204, 21)"; // bright yellow
            } else if (!n.isCompany) {
                n.color = "rgb(52, 211, 153)"; // emerald green for persons
            } else {
                n.color = getColor(n.degree || 0, maxDegree);
            }

            if (sizeMode === "market_cap") {
                n.val = Math.max(1, ((n.market_cap || 0) / maxMarketCap) * 30 + 1);
            } else {
                n.val = Math.max(1, ((n.outgoingShares || 0) / maxShares) * 20 + 2);
            }
        });

        return { processedNodes: nodesArr, processedLinks: processedLinksList };
    }, [data, sizeMode, directionFilter, centerNodeId]);

    useEffect(() => {
        const fg = fgRef.current;
        if (fg) {
            fg.d3Force('charge', d3.forceManyBody().strength(-200));
            fg.d3Force('link', d3.forceLink().distance(60));
            fg.d3Force('center', d3.forceCenter(0, 0));

            if (sizeMode === "market_cap") {
                const maxMarketCap = Math.max(1, ...processedNodes.map((n: any) => n.market_cap || 0));
                fg.d3Force('capGravity', d3.forceRadial(0, 0, 0).strength((d: any) => {
                    return ((d.market_cap || 0) / maxMarketCap) * 0.1;
                }));
            } else {
                fg.d3Force('capGravity', null);
            }
            fg.d3ReheatSimulation();
        }
    }, [processedNodes, sizeMode]);

    // Handle single click (show info) vs double click (re-center)
    const lastClickEvent = useRef<MouseEvent | null>(null);

    const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
        lastClickEvent.current = event;
        if (clickTimerRef.current) {
            // This is a double click
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
            if (onNodeDoubleClick) {
                onNodeDoubleClick(node.id, node.label);
            }
        } else {
            // Wait to see if it's a double click
            clickedNodeRef.current = node;
            clickTimerRef.current = setTimeout(() => {
                clickTimerRef.current = null;
                if (onNodeClick && lastClickEvent.current) {
                    onNodeClick(node.id, {
                        x: lastClickEvent.current.clientX,
                        y: lastClickEvent.current.clientY
                    });
                }
            }, 300);
        }
    }, [onNodeClick, onNodeDoubleClick]);

    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y, val, color, label, id } = node;
        const r = Math.sqrt(val) * 4;
        const isCenterNode = id === centerNodeId;

        // Glow effect for center node
        if (isCenterNode) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4 / globalScale, 0, 2 * Math.PI, false);
            ctx.fillStyle = "rgba(250, 204, 21, 0.2)";
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isCenterNode ? "rgba(250, 204, 21, 1)" : "rgba(255,255,255,0.8)";
        ctx.lineWidth = isCenterNode ? 3 / globalScale : 1.5 / globalScale;
        ctx.stroke();

        const fontSize = Math.max(4, 12 / globalScale);
        ctx.font = `${isCenterNode ? 'bold ' : ''}${fontSize}px Pretendard, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isCenterNode ? "#facc15" : "#ffffff";
        ctx.fillText(label, x, y + r + fontSize);
    }, [centerNodeId]);

    const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const start = link.source;
        const end = link.target;
        const linkColor = link.edgeColor || "rgba(96, 165, 250, 0.4)";

        const baseThickness = link.isMutual
            ? Math.max(1.5, (link.value / 100) * 12)
            : Math.max(0.5, (link.value / 100) * 8);
        const thickness = baseThickness / globalScale;

        if (link.isMutual) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const cpOffset = 18 / globalScale;
            const nx = -dy / dist * cpOffset;
            const ny = dx / dist * cpOffset;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.quadraticCurveTo(
                (start.x + end.x) / 2 + nx,
                (start.y + end.y) / 2 + ny,
                end.x, end.y
            );
            ctx.strokeStyle = linkColor;
            ctx.lineWidth = thickness;
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = linkColor;
            ctx.lineWidth = thickness;
            ctx.stroke();
        }

        // Arrow
        const arrowLen = 5 / globalScale;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const endNodeR = Math.sqrt(end.val || 1) * 4;
        const arrowX = end.x - Math.cos(angle) * endNodeR;
        const arrowY = end.y - Math.sin(angle) * endNodeR;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLen * Math.cos(angle - Math.PI / 6), arrowY - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - arrowLen * Math.cos(angle + Math.PI / 6), arrowY - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = linkColor;
        ctx.fill();

        // Percentage label
        if (globalScale > 0.8) {
            let midX: number, midY: number;
            if (link.isMutual) {
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const cpOffset = 18 / globalScale;
                const nx = -dy / dist * cpOffset;
                const ny = dx / dist * cpOffset;
                midX = (start.x + end.x) / 2 + nx * 0.5;
                midY = (start.y + end.y) / 2 + ny * 0.5;
            } else {
                midX = (start.x + end.x) / 2;
                midY = (start.y + end.y) / 2;
            }
            const fontSize = Math.max(3, 10 / globalScale);

            ctx.save();
            ctx.translate(midX, midY);
            const textAngle = Math.atan2(end.y - start.y, end.x - start.x);
            ctx.rotate(textAngle > Math.PI / 2 || textAngle < -Math.PI / 2 ? textAngle + Math.PI : textAngle);

            ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;
            ctx.fillStyle = link.isMutual ? "#facc15" : (link.direction === 'outgoing' ? "#34d399" : "#fb923c");
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(`${link.value.toFixed(1)}%`, 0, -2 / globalScale);
            ctx.restore();
        }
    }, []);

    if (processedNodes.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-500 flex-col gap-3">
                <p className="text-lg">검색 창에서 기업 또는 인물을 선택하세요.</p>
                <p className="text-sm text-slate-600">지분율 트리가 마인드맵으로 표시됩니다.</p>
            </div>
        );
    }

    return (
        <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes: processedNodes, links: processedLinks }}
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick}
            linkDirectionalArrowLength={0}
            backgroundColor="#0f172a"
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            warmupTicks={100}
            cooldownTime={2000}
        />
    );
}
