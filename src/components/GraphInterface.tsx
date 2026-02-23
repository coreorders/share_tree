"use client";

import React, { useState, useEffect, useCallback } from "react";
import FilterPanel from "./FilterPanel";
import NodeInfoPopup from "./NodeInfoPopup";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const DynamicNetworkGraph = dynamic(() => import("./NetworkGraph"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p>마인드맵 렌더링 준비 중...</p>
        </div>
    ),
});

export default function GraphInterface() {
    const [minShare, setMinShare] = useState<number>(1);
    const [maxDepth, setMaxDepth] = useState<number>(3);
    const [sizeMode, setSizeMode] = useState<"share" | "market_cap">("share");
    const [directionFilter, setDirectionFilter] = useState<"all" | "outgoing" | "incoming">("all");

    const [centerCorpCode, setCenterCorpCode] = useState<string>("");
    const [centerName, setCenterName] = useState<string>("");
    const [centerNodeId, setCenterNodeId] = useState<string>("");

    const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
    const [isLoading, setIsLoading] = useState(false);

    // Popup state
    const [popupData, setPopupData] = useState<any>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    // Load random company on first visit
    useEffect(() => {
        loadRandomCompany();
    }, []);

    const loadRandomCompany = async () => {
        try {
            const res = await fetch('/api/random_company');
            const data = await res.json();
            if (data && data.id) {
                setCenterCorpCode(data.id);
                setCenterName(data.name);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGraphData = useCallback(async () => {
        if (!centerCorpCode) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/graph_data?center_node=${encodeURIComponent(centerCorpCode)}&min_share=${minShare}&max_depth=${maxDepth}`);
            const data = await res.json();
            if (data && data.nodes) {
                setGraphData({ nodes: data.nodes, links: data.links });
                setCenterNodeId(data.centerNodeId || centerCorpCode);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [centerCorpCode, minShare, maxDepth]);

    useEffect(() => {
        fetchGraphData();
    }, [fetchGraphData]);

    const handleSearch = (id: string, name: string, type: string) => {
        setCenterCorpCode(id);
        setCenterName(name);
        setPopupData(null);
    };

    // Single click: show info popup
    const handleNodeClick = useCallback(async (nodeId: string, event: { x: number; y: number }) => {
        try {
            const res = await fetch(`/api/node_info?id=${encodeURIComponent(nodeId)}`);
            const info = await res.json();
            if (info && !info.error) {
                setPopupData(info);
                setPopupPosition({ x: event.x, y: event.y });
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    // Double click: make node the new center
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

    return (
        <div className="relative w-screen h-screen bg-slate-900 overflow-hidden text-slate-100">
            <div className="absolute top-0 left-0 w-full h-full">
                {isLoading && graphData.nodes.length > 0 && (
                    <div className="absolute top-6 right-6 z-20 flex items-center gap-2 glass px-4 py-2 rounded-full text-blue-400 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" /> 데이터를 다시 불러오는 중
                    </div>
                )}
                <DynamicNetworkGraph
                    data={graphData}
                    sizeMode={sizeMode}
                    directionFilter={directionFilter}
                    centerNodeId={centerNodeId}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                />
            </div>

            <FilterPanel
                onSearch={handleSearch}
                onRandom={loadRandomCompany}
                minShare={minShare}
                setMinShare={setMinShare}
                maxDepth={maxDepth}
                setMaxDepth={setMaxDepth}
                sizeMode={sizeMode}
                setSizeMode={setSizeMode}
                directionFilter={directionFilter}
                setDirectionFilter={setDirectionFilter}
                currentCenterName={centerName}
            />

            {popupData && (
                <NodeInfoPopup
                    data={popupData}
                    position={popupPosition}
                    onClose={() => setPopupData(null)}
                    onNavigate={handlePopupNavigate}
                />
            )}

            {/* Footer */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-600 flex items-center gap-1">
                <span>제작자 :</span>
                <a href="https://mindaesik.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-200 transition-colors underline">민대식</a>
                <span>|</span>
                <span>ddokddogi@gmail.com</span>
            </div>
        </div>
    );
}
