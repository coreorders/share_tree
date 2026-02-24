"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3-force";

interface Node {
    id: string;
    label: string;
    market_cap?: number;
    depth?: number;
    isCompany: boolean;
    isListed?: boolean;
    market?: string;
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
    isSubsidiary?: boolean;
    label?: string;
}

interface NetworkGraphProps {
    data: { nodes: Node[]; links: Link[] };
    sizeMode: "share" | "market_cap";
    directionFilter: "all" | "outgoing" | "incoming";
    nodeTypeFilter: "all" | "person" | "company";
    showSubsidiaries: boolean;
    centerNodeId: string;
    onNodeClick?: (nodeId: string, event: { x: number; y: number }) => void;
    onNodeDoubleClick?: (nodeId: string, nodeLabel: string) => void;
    onBackgroundClick?: () => void;
}

function getColor(degree: number, maxDegree: number) {
    if (maxDegree === 0) return `rgb(56, 189, 248)`;
    const ratio = Math.min(degree / maxDegree, 1);
    const r = Math.round(56 + ratio * (239 - 56));
    const g = Math.round(189 + ratio * (68 - 189));
    const b = Math.round(248 + ratio * (68 - 248));
    return `rgb(${r}, ${g}, ${b})`;
}

export default function NetworkGraph({ data, sizeMode, directionFilter, nodeTypeFilter, showSubsidiaries, centerNodeId, onNodeClick, onNodeDoubleClick, onBackgroundClick }: NetworkGraphProps) {
    const fgRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const clickTimerRef = useRef<number>(0);
    const clickTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
    const clickedNodeRef = useRef<any>(null);

    useEffect(() => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const { processedNodes, processedLinks } = useMemo(() => {
        // First, apply nodeTypeFilter to data.nodes
        let typeFilteredNodes = data.nodes;
        if (nodeTypeFilter === "person") {
            typeFilteredNodes = data.nodes.filter(n => !n.isCompany || n.id === centerNodeId);
        } else if (nodeTypeFilter === "company") {
            typeFilteredNodes = data.nodes.filter(n => n.isCompany || n.id === centerNodeId);
        }
        const typeFilteredNodeIds = new Set(typeFilteredNodes.map(n => n.id));

        // Filter links to only include those between visible nodes
        let filteredLinks = data.links.filter(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return typeFilteredNodeIds.has(sourceId) && typeFilteredNodeIds.has(targetId);
        });

        if (!showSubsidiaries) {
            filteredLinks = filteredLinks.filter(l => !l.isSubsidiary);
        }

        if (directionFilter === "outgoing") {
            filteredLinks = filteredLinks.filter(l => l.direction === 'outgoing');
        } else if (directionFilter === "incoming") {
            filteredLinks = filteredLinks.filter(l => l.direction === 'incoming');
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
            const isGov = /정부|재단|기금|조합|위원회|공단|학교|학원|대학교|대학/.test(n.label);

            if (n.id === centerNodeId) {
                n.color = "rgb(250, 204, 21)"; // bright yellow (노란색 - 중심)
            } else if (!n.isCompany) {
                n.color = "rgb(52, 211, 153)"; // emerald green (초록색 - 개인)
            } else if (isGov) {
                n.color = "rgb(251, 146, 60)"; // orange (주황색 - 정부/재단)
            } else if (n.isListed) {
                n.color = "rgb(239, 68, 68)"; // red (빨간색 - 상장기업)
            } else {
                n.color = "rgb(244, 114, 182)"; // pink (분홍색 - 비상장기업)
            }

            if (sizeMode === "market_cap") {
                n.val = Math.max(1, ((n.market_cap || 0) / maxMarketCap) * 30 + 1);
            } else {
                n.val = Math.max(1, ((n.outgoingShares || 0) / maxShares) * 20 + 2);
            }
        });

        return { processedNodes: nodesArr, processedLinks: processedLinksList };
    }, [data, sizeMode, directionFilter, nodeTypeFilter, showSubsidiaries, centerNodeId]);

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

    const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
        const now = Date.now();
        if (clickedNodeRef.current?.id === node.id && now - clickTimerRef.current < 400) {
            // 더블클릭 발생 (같은 노드를 400ms 내에 다시 클릭)
            clickTimerRef.current = 0;
            if (clickTimeoutIdRef.current) {
                clearTimeout(clickTimeoutIdRef.current);
                clickTimeoutIdRef.current = null;
            }
            if (onNodeDoubleClick) {
                onNodeDoubleClick(node.id, node.label);
            }
        } else {
            // 단일 클릭 처리 (더블클릭 판별을 위한 250ms 대기)
            clickedNodeRef.current = node;
            clickTimerRef.current = now;

            if (clickTimeoutIdRef.current) {
                clearTimeout(clickTimeoutIdRef.current);
            }

            clickTimeoutIdRef.current = setTimeout(() => {
                if (onNodeClick) {
                    onNodeClick(node.id, {
                        x: event.clientX,
                        y: event.clientY
                    });
                }
            }, 250);
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

        // Ink bleed effect for insider trading signals (drawn BEFORE main circle for layering)
        const signal = node.insiderSignal;
        if (signal && r > 2 && isFinite(x) && isFinite(y) && isFinite(r)) {
            const t = Date.now() / 3000; // slow rotation
            const inkR = r * 0.6;
            const inkDist = r * 0.55;

            const drawInk = (angleOffset: number, rgba: string) => {
                const angle = t + angleOffset;
                const ix = x + Math.cos(angle) * inkDist;
                const iy = y + Math.sin(angle) * inkDist;

                if (!isFinite(ix) || !isFinite(iy) || !isFinite(inkR) || inkR <= 0) return;

                try {
                    const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, inkR);
                    grad.addColorStop(0, rgba);
                    grad.addColorStop(0.4, rgba.replace(/[\d.]+\)$/, "0.15)"));
                    grad.addColorStop(1, rgba.replace(/[\d.]+\)$/, "0)"));
                    ctx.beginPath();
                    ctx.arc(ix, iy, inkR, 0, 2 * Math.PI);
                    ctx.fillStyle = grad;
                    ctx.fill();
                } catch (e) {
                    console.error("Radial gradient error:", e);
                }
            };

            if (signal === "buy" || signal === "both") {
                drawInk(0, "rgba(239, 68, 68, 0.35)"); // red ink
            }
            if (signal === "sell" || signal === "both") {
                drawInk(Math.PI, "rgba(59, 130, 246, 0.35)"); // blue ink
            }
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

        // KOSPI / KOSDAQ Badge (Centered on node)
        if (node.isCompany && node.isListed && node.market) {
            const markerFontSize = Math.max(4, r * 1.2);
            ctx.font = `bold ${markerFontSize}px Pretendard, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.fillText(node.market === "KOSPI" ? "P" : "Q", x, y);
        }
    }, [centerNodeId]);

    const nodePointerAreaPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const { x, y, val } = node;
        const r = Math.sqrt(val) * 4;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r * 2.5, 15), 0, 2 * Math.PI, false);
        ctx.fill();
    }, []);

    const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const start = link.source;
        const end = link.target;

        let linkColor = link.edgeColor || "rgba(96, 165, 250, 0.4)";
        if (link.isSubsidiary) {
            linkColor = "rgba(34, 197, 94, 0.6)"; // Green for subsidiaries
        }

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
        const arrowLen = 10 / globalScale;
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

            // Subsidiary reason logic
            if (link.isSubsidiary && link.label && link.label.includes('[')) {
                ctx.save();
                ctx.translate(midX, midY);
                // Adjust text placement below the percentage text
                ctx.rotate(textAngle > Math.PI / 2 || textAngle < -Math.PI / 2 ? textAngle + Math.PI : textAngle);

                const reasonFontSize = Math.max(2, 7 / globalScale);
                ctx.font = `${reasonFontSize}px Pretendard, sans-serif`;
                ctx.fillStyle = "rgba(167, 243, 208, 0.9)"; // light green
                ctx.textAlign = "center";
                ctx.textBaseline = "top";

                // Extract reason from label, assuming format: [Reason] 40.0%
                const reasonMatch = link.label.match(/\[(.*?)\]/);
                if (reasonMatch && reasonMatch[1]) {
                    ctx.fillText(reasonMatch[1], 0, 2 / globalScale);
                }
                ctx.restore();
            }
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
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick}
            onBackgroundClick={onBackgroundClick}
            linkDirectionalArrowLength={0}
            backgroundColor="#0f172a"
        />
    );
}
