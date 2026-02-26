"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import FilterPanel from "./FilterPanel";
import NodeInfoPopup from "./NodeInfoPopup";
import classNames from "classnames";
import dynamic from "next/dynamic";
import { Search, Loader2, Building2, User, ChevronDown, ChevronUp, Shuffle, Share2, Camera } from "lucide-react";

// Types
type Link = { source: string; target: string; value: number; label?: string; isSubsidiary?: boolean; direction?: string; isMutual?: boolean; edgeColor?: string };
type Node = { id: string; label: string; stock_code?: string; market_cap?: number; close_price?: number; price_change?: number; change_rate?: number; isCompany: boolean; isListed: boolean; market?: string; depth?: number; isCenter?: boolean; position?: string; executives?: any[]; insiderTrades?: any[]; companyPosition?: string; positions?: Array<{ company: string; position: string }> };

const DynamicNetworkGraph = dynamic(() => import("./NetworkGraph"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>마인드맵 렌더링 준비 중...</p>
        </div>
    ),
});

function normalizeName(name: string) {
    if (!name) return "";
    return name.replace(/\(주\)|㈜|주식회사/g, '').replace(/\s+/g, '').trim();
}

export default function GraphInterface() {
    // Top-level Static Data state
    const [allNodesMap, setAllNodesMap] = useState<Map<string, Node>>(new Map());
    const [allLinks, setAllLinks] = useState<Link[]>([]);
    const [nameToCorpCode, setNameToCorpCode] = useState<Map<string, string>>(new Map());
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const [minShare, setMinShare] = useState<number>(1);
    const [maxDepth, setMaxDepth] = useState<number>(3);
    const [sizeMode, setSizeMode] = useState<"share" | "market_cap">("share");
    const [hideNps, setHideNps] = useState<boolean>(true);
    const [unlistedFilter, setUnlistedFilter] = useState<"hide" | "1-degree" | "2-degree">("hide");
    const [nodeTypeFilter, setNodeTypeFilter] = useState<"all" | "person" | "company">("all");
    const [cohesion, setCohesion] = useState<number>(30); // Default to 30
    const [hidePerson, setHidePerson] = useState<boolean>(false); // New: Hide personal nodes

    const [centerCorpCode, setCenterCorpCode] = useState<string>("");
    const [centerName, setCenterName] = useState<string>("");
    const [centerNodeId, setCenterNodeId] = useState<string>("");

    const [graphData, setGraphData] = useState<{ nodes: Node[], links: Link[] }>({ nodes: [], links: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [isScreenshotting, setIsScreenshotting] = useState(false);

    // Popup state
    const [popupData, setPopupData] = useState<any>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    // 1. Initial Data Fetch (data.json) - Runs ONLY ONCE on mount
    useEffect(() => {
        const fetchStaticData = async () => {
            try {
                const res = await fetch('data.json');
                const data = await res.json();

                const nodesMap = new Map<string, Node>();
                const nameMap = new Map<string, string>();

                if (data.nodes) {
                    data.nodes.forEach((n: Node) => {
                        nodesMap.set(n.id, n);
                        nameMap.set(normalizeName(n.label), n.id);
                        nameMap.set(n.label, n.id);
                        if (n.stock_code) {
                            nameMap.set(n.stock_code, n.id);
                        }
                    });
                }

                setAllNodesMap(nodesMap);
                setAllLinks(data.links || []);
                setNameToCorpCode(nameMap);

                // Initial setup from URL or default using raw window.location
                const searchParams = new URLSearchParams(window.location.search);
                const urlCorp = searchParams.get('corp');
                const urlMin = searchParams.get('min');
                const urlDepth = searchParams.get('depth');
                const urlSize = searchParams.get('size');
                const urlUnlisted = searchParams.get('unlisted');
                const urlHidePerson = searchParams.get('hidePerson');
                const urlHideNps = searchParams.get('hideNps');
                const urlSub = searchParams.get('subsidiaries');

                if (urlMin) setMinShare(Number(urlMin));
                if (urlDepth) setMaxDepth(Number(urlDepth));
                if (urlSize === 'share' || urlSize === 'market_cap') setSizeMode(urlSize);
                if (urlUnlisted === 'hide' || urlUnlisted === '1-degree' || urlUnlisted === '2-degree') setUnlistedFilter(urlUnlisted);
                if (urlHidePerson !== null) setHidePerson(urlHidePerson === 'true');
                if (urlHideNps !== null) setHideNps(urlHideNps === 'true');
                if (urlCorp && nodesMap.has(urlCorp)) {
                    setCenterCorpCode(urlCorp);
                    setCenterName(nodesMap.get(urlCorp)?.label || "");
                } else if (nodesMap.has('00126380')) {
                    setCenterCorpCode('00126380');
                    setCenterName('삼성전자');
                } else if (data.nodes.length > 0) {
                    setCenterCorpCode(data.nodes[0].id);
                    setCenterName(data.nodes[0].label);
                }

                setIsDataLoaded(true);

            } catch (err) {
                console.error("Failed to load static data:", err);
            }
        };
        fetchStaticData();
    }, []);
    // Dependency is EMPTY, so it only runs once!

    // 2. Update URL when states change (Silent Update)
    useEffect(() => {
        if (!isDataLoaded) return;

        const params = new URLSearchParams();
        if (centerCorpCode) params.set('corp', centerCorpCode);
        params.set('min', minShare.toString());
        params.set('depth', maxDepth.toString());
        params.set('size', sizeMode);
        params.set('unlisted', unlistedFilter);
        params.set('hidePerson', hidePerson.toString());
        params.set('hideNps', hideNps.toString());

        const newSearch = params.toString();
        const currentSearch = window.location.search.replace(/^\?/, '');

        // Only update if something actually changed to avoid overhead
        if (newSearch !== currentSearch) {
            const newUrl = `${window.location.pathname}?${newSearch}`;
            window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
        }
    }, [centerCorpCode, minShare, maxDepth, sizeMode, unlistedFilter, hidePerson, hideNps, isDataLoaded]);



    const loadRandomCompany = useCallback(() => {
        if (!isDataLoaded || allNodesMap.size === 0) return;
        const listedCompanies = Array.from(allNodesMap.values()).filter(n => n.isListed && n.market_cap && n.market_cap > 0);
        if (listedCompanies.length > 0) {
            const randomNode = listedCompanies[Math.floor(Math.random() * listedCompanies.length)];
            setCenterCorpCode(randomNode.id);
            setCenterName(randomNode.label);
        }
    }, [isDataLoaded, allNodesMap]);

    const resolveId = useCallback((name: string) => {
        if (allNodesMap.has(name)) return name;
        if (nameToCorpCode.has(name)) return nameToCorpCode.get(name)!;
        const norm = normalizeName(name);
        if (nameToCorpCode.has(norm)) return nameToCorpCode.get(norm)!;
        return name;
    }, [allNodesMap, nameToCorpCode]);

    // 2. Client-side BFS Logic
    const computeGraphData = useCallback(() => {
        if (!isDataLoaded || !centerCorpCode) return;
        setIsLoading(true);

        setTimeout(() => {
            try {
                const resolvedCenter = resolveId(centerCorpCode);
                const visitedEdges = new Set<string>();
                const resultNodes = new Map<string, Node>();
                const resultEdges: Link[] = [];

                let currentDepthNodes = new Set<string>([resolvedCenter]);

                if (allNodesMap.has(resolvedCenter)) {
                    const c = allNodesMap.get(resolvedCenter)!;
                    resultNodes.set(resolvedCenter, { ...c, depth: 0, isCenter: true });
                } else {
                    resultNodes.set(resolvedCenter, { id: resolvedCenter, label: centerName || centerCorpCode, isCompany: false, isListed: false, depth: 0, isCenter: true });
                }

                let activeLinks = allLinks;
                if (hideNps) {
                    const npsNameId = resolveId('국민연금공단');
                    activeLinks = activeLinks.filter(l => resolveId(l.source) !== npsNameId);
                }

                const outgoing = new Map<string, Link[]>();
                const incoming = new Map<string, Link[]>();

                for (const link of activeLinks) {
                    if (link.value < minShare) continue;
                    const ownerId = resolveId(link.source);
                    const targetId = link.target;
                    if (!outgoing.has(ownerId)) outgoing.set(ownerId, []);
                    outgoing.get(ownerId)!.push(link);
                    if (!incoming.has(targetId)) incoming.set(targetId, []);
                    incoming.get(targetId)!.push(link);
                }

                for (let depth = 1; depth <= maxDepth; depth++) {
                    const nextDepthNodes = new Set<string>();

                    for (const currId of currentDepthNodes) {
                        // Outgoing processing
                        if (outgoing.has(currId)) {
                            for (const rel of outgoing.get(currId)!) {
                                const relTargetId = rel.target;
                                const edgeKey = `${currId}_${relTargetId}`;
                                if (!visitedEdges.has(edgeKey)) {
                                    const nodeData = allNodesMap.get(relTargetId) || { id: relTargetId, label: relTargetId, isCompany: false, isListed: false };

                                    // Unlisted filter logic
                                    const isUnlisted = nodeData.isCompany && !nodeData.isListed;
                                    let shouldAdd = true;
                                    if (isUnlisted) {
                                        if (unlistedFilter === "hide") shouldAdd = false;
                                        else if (unlistedFilter === "1-degree" && depth > 1) shouldAdd = false;
                                        else if (unlistedFilter === "2-degree" && depth > 2) shouldAdd = false;
                                    }

                                    if (shouldAdd) {
                                        visitedEdges.add(edgeKey);
                                        resultEdges.push({ source: currId, target: relTargetId, value: rel.value, label: rel.label });
                                        if (!resultNodes.has(relTargetId)) {
                                            resultNodes.set(relTargetId, { ...nodeData, depth, isCenter: false });
                                        }
                                        nextDepthNodes.add(relTargetId);
                                    }
                                }
                            }
                        }

                        // Incoming processing
                        if (incoming.has(currId)) {
                            for (const rel of incoming.get(currId)!) {
                                const relOwnerId = resolveId(rel.source);
                                const edgeKey = `${relOwnerId}_${currId}`;
                                if (!visitedEdges.has(edgeKey)) {
                                    const nodeData = allNodesMap.get(relOwnerId) || { id: relOwnerId, label: relOwnerId, isCompany: false, isListed: false };

                                    // Unlisted filter logic
                                    const isUnlisted = nodeData.isCompany && !nodeData.isListed;
                                    let shouldAdd = true;
                                    if (isUnlisted) {
                                        if (unlistedFilter === "hide") shouldAdd = false;
                                        else if (unlistedFilter === "1-degree" && depth > 1) shouldAdd = false;
                                        else if (unlistedFilter === "2-degree" && depth > 2) shouldAdd = false;
                                    }

                                    if (shouldAdd) {
                                        visitedEdges.add(edgeKey);
                                        resultEdges.push({ source: relOwnerId, target: currId, value: rel.value, label: rel.label });
                                        if (!resultNodes.has(relOwnerId)) {
                                            resultNodes.set(relOwnerId, { ...nodeData, depth, isCenter: false });
                                        }
                                        nextDepthNodes.add(relOwnerId);
                                    }
                                }
                            }
                        }
                    }
                    currentDepthNodes = nextDepthNodes;
                }

                const finalNodes = Array.from(resultNodes.values()).map(n => {
                    // Pre-calculate total value for sizing (even for people)
                    let totalVal = 0;
                    if (n.market_cap) {
                        totalVal = n.market_cap;
                    } else {
                        // For people/unlisted, sum up their listed holdings
                        const nodeHoldings = allLinks.filter(l => l.source === n.id);
                        nodeHoldings.forEach(l => {
                            const targetNode = allNodesMap.get(l.target);
                            if (targetNode && targetNode.isListed && targetNode.market_cap) {
                                totalVal += (targetNode.market_cap * l.value) / 100;
                            }
                        });
                    }

                    return { ...n, totalListedValue: totalVal };
                }).filter(n => {
                    if (hidePerson && !n.isCompany) return false;
                    return true;
                });

                setGraphData({ nodes: finalNodes, links: resultEdges });
                setCenterNodeId(resolvedCenter);
            } catch (err) {
                console.error("BFS computation error:", err);
            } finally {
                setIsLoading(false);
            }
        }, 0);
    }, [isDataLoaded, centerCorpCode, minShare, maxDepth, hideNps, hidePerson, unlistedFilter, allNodesMap, allLinks, resolveId, centerName]);

    useEffect(() => {
        computeGraphData();
    }, [computeGraphData]);

    const handleSearch = (id: string, name: string, type: string) => {
        setCenterCorpCode(id);
        setCenterName(name);
        setPopupData(null);
    };

    const handleNodeClick = useCallback((nodeId: string, event: { x: number; y: number }) => {
        const resolvedId = resolveId(nodeId);
        const nodeData = allNodesMap.get(resolvedId);

        if (nodeData) {
            const getSourceId = (lnk: any) => typeof lnk.source === 'object' ? lnk.source.id : lnk.source;
            const getTargetId = (lnk: any) => typeof lnk.target === 'object' ? lnk.target.id : lnk.target;

            const incomingLinks = allLinks.filter(l => getTargetId(l) === resolvedId);
            const outgoingLinks = allLinks.filter(l => resolveId(getSourceId(l)) === resolvedId);

            const shareholders = incomingLinks.map(l => ({
                shareholder_name: allNodesMap.get(resolveId(getSourceId(l)))?.label || getSourceId(l),
                share_rate: l.value
            })).sort((a, b) => b.share_rate - a.share_rate);

            const holdings = outgoingLinks.map(l => {
                const trgId = getTargetId(l);
                const targetNode = allNodesMap.get(trgId);
                const isListed = targetNode ? !!targetNode.isListed : false;
                const value = (isListed && targetNode && targetNode.market_cap)
                    ? targetNode.market_cap * (l.value / 100)
                    : 0;
                return {
                    corp_code: trgId,
                    corp_name: targetNode ? targetNode.label : trgId,
                    share_rate: l.value,
                    isListed: isListed,
                    isEstimated: !isListed,
                    value: value
                };
            }).sort((a, b) => b.value - a.value);

            const totalListedValue = holdings.filter(h => h.isListed).reduce((acc, h) => acc + h.value, 0);
            const totalShares = outgoingLinks.reduce((acc, l: any) => acc + (l.shares_count || 0), 0);
            const hasUnlisted = holdings.some(h => !h.isListed);

            const enrichedData = {
                ...nodeData,
                type: nodeData.isCompany ? 'company' : 'person',
                name: nodeData.label,
                holdingsCount: holdings.length,
                shareholderCount: shareholders.length,
                shareholders,
                holdings,
                totalShares,
                totalListedValue,
                totalEstimatedValue: 0,
                hasUnlisted,
                // Use positions array from node data for accurate position display
                companyPosition: !nodeData.isCompany ? (
                    (() => {
                        const positions = nodeData.positions as Array<{ company: string; position: string }> | undefined;
                        if (positions && positions.length > 0) {
                            // Show all company+position pairs
                            return positions.map((p: { company: string; position: string }) => `${p.company} ${p.position}`).join(', ');
                        }
                        return nodeData.position || "";
                    })()
                ) : undefined
            };

            setPopupData(enrichedData);
            setPopupPosition({ x: event.x, y: event.y });
        }
    }, [allNodesMap, allLinks, resolveId]);

    const handleNodeDoubleClick = useCallback((nodeId: string, nodeLabel: string) => {
        setCenterCorpCode(nodeId);
        setCenterName(nodeLabel);
        setPopupData(null);
    }, []);

    const handlePopupNavigate = useCallback((nodeId: string, label: string) => {
        setCenterCorpCode(nodeId);
        setCenterName(label);
        setPopupData(null);
    }, []);

    const handleShareLink = useCallback(() => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert("🔗 현재 지분나무 주소(링크)가 복사되었습니다!\n원하시는 곳에 붙여넣기 해보세요.");
        }).catch(err => {
            console.error('Failed to copy link: ', err);
            alert("링크 복사에 실패했습니다.");
        });
    }, []);

    const handleScreenshot = useCallback(async () => {
        setIsScreenshotting(true);
        // Wait for React to re-render to hide UI overlays just in case (though not strictly needed since we grab the canvas directly)
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const container = document.getElementById("graph-container");
            if (!container) return;

            // Find the canvas element created by react-force-graph
            const sourceCanvas = container.querySelector('canvas');
            if (!sourceCanvas) {
                throw new Error("Graph canvas not found.");
            }

            // Create an offscreen canvas specifically for composing the final image
            const canvas = document.createElement('canvas');
            canvas.width = sourceCanvas.width;
            canvas.height = sourceCanvas.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error("Could not initialize 2D context.");
            }

            // 1. Draw the background color (critical since force-graph might leave it transparent)
            ctx.fillStyle = "#0f172a"; // Match slate-900
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Draw the actual graph canvas on top
            ctx.drawImage(sourceCanvas, 0, 0);

            // 3. Add metadata watermark text
            const width = canvas.width;
            const height = canvas.height;
            const padding = 40;

            // --- Top Banner (holdertree.kr) ---
            const topGradient = ctx.createLinearGradient(0, 0, 0, 100);
            topGradient.addColorStop(0, "rgba(15, 23, 42, 0.9)");
            topGradient.addColorStop(1, "rgba(15, 23, 42, 0)");
            ctx.fillStyle = topGradient;
            ctx.fillRect(0, 0, width, 100);

            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "bold 32px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText("holdertree.kr", width / 2, padding / 2);

            // --- Bottom Banner (Filter Info) ---
            const bottomGradient = ctx.createLinearGradient(0, height - 150, 0, height);
            bottomGradient.addColorStop(0, "rgba(15, 23, 42, 0)");
            bottomGradient.addColorStop(0.5, "rgba(15, 23, 42, 0.7)");
            bottomGradient.addColorStop(1, "rgba(15, 23, 42, 0.95)");
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(0, height - 150, width, 150);

            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "bold 26px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            const filterDesc = [
                `${maxDepth}촌까지`,
                `${minShare}% 이상`,
                unlistedFilter === "hide" ? "비상장 숨김" : (unlistedFilter === "1-degree" ? "비상장 1촌만" : ""),
                hideNps ? "국민연금 숨김" : "",
                hidePerson ? "개인 숨김" : "",
                sizeMode === "market_cap" ? "크기:시총" : "크기:지분"
            ].filter(Boolean).join(" · ");

            const title = `🌳 ${centerName} 지분관계도 (${filterDesc})`;
            ctx.fillText(title, width / 2, height - padding);

            // Trigger download
            const image = canvas.toDataURL("image/png", 1.0);
            const link = document.createElement("a");
            link.href = image;
            link.download = `ShareGraph_${centerName}_${new Date().toISOString().slice(0, 10)}.png`;
            link.click();

            // Clean up
            link.remove();
        } catch (error) {
            console.error("Screenshot failed:", error);
            alert("스크린샷 캡처에 실패했습니다.");
        } finally {
            setIsScreenshotting(false);
        }
    }, [centerName, maxDepth, minShare, unlistedFilter, hideNps, hidePerson, sizeMode]);

    // Keyboard Shortcuts (Desktop Only)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if active element is an input, textarea, or select
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement
            ) {
                return;
            }

            const key = e.key.toLowerCase();

            if (key === 'r') {
                e.preventDefault();
                loadRandomCompany();
            } else if (key === 's') {
                e.preventDefault();
                handleScreenshot();
            } else if (key === 'c') {
                e.preventDefault();
                handleShareLink();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [loadRandomCompany, handleScreenshot, handleShareLink]);

    return (
        <div id="graph-container" className="relative w-screen h-screen bg-slate-900 overflow-hidden text-slate-100">
            <div className="absolute top-0 left-0 w-full h-full">
                {isLoading && graphData.nodes.length > 0 && (
                    <div className="absolute top-6 right-6 z-20 flex items-center gap-2 glass px-4 py-2 rounded-full text-blue-400 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" /> 데이터를 다시 불러오는 중
                    </div>
                )}
                <DynamicNetworkGraph
                    data={graphData}
                    sizeMode={sizeMode}
                    nodeTypeFilter={nodeTypeFilter}
                    centerNodeId={centerNodeId}
                    cohesion={cohesion}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onBackgroundClick={() => setPopupData(null)}
                />
            </div>

            {!isScreenshotting && (
                <FilterPanel
                    onSearch={handleSearch}
                    onRandom={loadRandomCompany}
                    minShare={minShare}
                    setMinShare={setMinShare}
                    maxDepth={maxDepth}
                    setMaxDepth={setMaxDepth}
                    sizeMode={sizeMode}
                    setSizeMode={setSizeMode}
                    hideNps={hideNps}
                    setHideNps={setHideNps}
                    unlistedFilter={unlistedFilter}
                    setUnlistedFilter={setUnlistedFilter}
                    nodeTypeFilter={nodeTypeFilter}
                    setNodeTypeFilter={setNodeTypeFilter}
                    hidePerson={hidePerson}
                    setHidePerson={setHidePerson}
                    currentCenterName={centerName}
                    allNodesMap={allNodesMap}
                />
            )}

            {(!isScreenshotting && popupData) && (
                <NodeInfoPopup
                    data={popupData}
                    position={popupPosition}
                    onClose={() => setPopupData(null)}
                    onNavigate={handlePopupNavigate}
                />
            )}

            {!isScreenshotting && (
                <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-50 flex flex-col gap-2 pointer-events-auto">
                    <button
                        onClick={handleScreenshot}
                        className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md rounded-full flex items-center justify-center text-slate-200 border border-slate-600/50 shadow-lg hover:shadow-cyan-500/20 hover:border-cyan-500/50 transition-all group"
                        title="화면 캡처 (단축키: S)"
                    >
                        <Camera className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                    </button>
                    <button
                        onClick={handleShareLink}
                        className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600/90 hover:bg-blue-500 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all group"
                        title="현재 설정 링크 복사 (단축키: C)"
                    >
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            )}

            {/* Desktop Keyboard Shortcuts Guide */}
            {!isScreenshotting && (
                <div className="hidden sm:flex fixed bottom-6 right-6 z-40 text-[11px] text-slate-500/60 flex-col items-end gap-1 pointer-events-none drop-shadow-md font-medium tracking-wide">
                    <p>단축키 가이드</p>
                    <div className="flex gap-3 mt-1">
                        <span><kbd className="font-sans border border-slate-600/40 rounded px-1 min-w-[18px] inline-block text-center mr-1 pb-0.5">R</kbd>랜덤 기업</span>
                        <span><kbd className="font-sans border border-slate-600/40 rounded px-1 min-w-[18px] inline-block text-center mr-1 pb-0.5">S</kbd>스크린샷</span>
                        <span><kbd className="font-sans border border-slate-600/40 rounded px-1 min-w-[18px] inline-block text-center mr-1 pb-0.5">C</kbd>링크 복사</span>
                    </div>
                    <div className="flex gap-2">
                        <span><kbd className="font-sans border border-slate-600/40 rounded px-1 min-w-[18px] inline-block text-center mr-1 pb-0.5">Q</kbd>종토방</span>
                        <span><kbd className="font-sans border border-slate-600/40 rounded px-1 min-w-[18px] inline-block text-center mr-1 pb-0.5">1-5</kbd>팝업 탭 이동</span>
                    </div>
                </div>
            )}

            {!isScreenshotting && (
                <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-0.5 w-max pointer-events-auto">
                    <span className="text-[9px] text-slate-600/50">이 데이터는 DART 전자공시 데이터를 기반으로 합니다.</span>
                    <div className="text-[10px] text-slate-500/80 flex items-center gap-1.5">
                        <span>제작자 :</span>
                        <a href="https://mindaesik.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-200 transition-colors underline">민대식</a>
                        <span>|</span>
                        <span>ddokddogi@gmail.com</span>
                    </div>
                </div>
            )}
        </div>
    );
}
