"use client";

import React, { useState, useEffect } from "react";
import classNames from "classnames";
import { Search, Loader2, Building2, User, ChevronDown, ChevronUp, Shuffle } from "lucide-react";

interface FilterPanelProps {
    onSearch: (id: string, name: string, type: string) => void;
    onRandom: () => void;
    minShare: number;
    setMinShare: (val: number) => void;
    maxDepth: number;
    setMaxDepth: (val: number) => void;
    sizeMode: "share" | "market_cap";
    setSizeMode: (val: "share" | "market_cap") => void;
    hideNps: boolean;
    setHideNps: (val: boolean) => void;
    unlistedFilter: "hide" | "1-degree" | "2-degree";
    setUnlistedFilter: (val: "hide" | "1-degree" | "2-degree") => void;
    nodeTypeFilter: "all" | "person" | "company";
    setNodeTypeFilter: (val: "all" | "person" | "company") => void;
    hidePerson: boolean;
    setHidePerson: (val: boolean) => void;
    currentCenterName: string;
    allNodesMap: Map<string, any>;
}

export default function FilterPanel({
    onSearch,
    onRandom,
    minShare,
    setMinShare,
    maxDepth,
    setMaxDepth,
    sizeMode,
    setSizeMode,
    hideNps,
    setHideNps,
    unlistedFilter,
    setUnlistedFilter,
    nodeTypeFilter,
    setNodeTypeFilter,
    hidePerson,
    setHidePerson,
    currentCenterName,
    allNodesMap,
}: FilterPanelProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (query.trim().length > 1) {
            const q = query.toLowerCase().trim();
            const nodesArray = Array.from(allNodesMap.values());

            // Search locally in memory
            const matched = nodesArray.filter(n =>
                n.label.toLowerCase().includes(q) ||
                n.id.includes(q) ||
                (n.stock_code && n.stock_code.includes(q))
            ).slice(0, 50); // Limit to top 50 results

            setResults(matched);
        } else {
            setResults([]);
        }
    }, [query, allNodesMap]);

    return (
        <div
            className="absolute top-3 left-3 sm:top-6 sm:left-6 w-[calc(100vw-1.5rem)] sm:w-80 z-10 rounded-2xl p-3 sm:p-4 flex flex-col gap-3 text-sm border border-slate-500/20"
            style={{
                backgroundColor: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
            }}
        >
            {/* Header + Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500">
                        🌳 지분나무
                    </h1>
                    <p className="text-slate-400 text-[10px] sm:text-xs">기업 지분 구조 시각화</p>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors sm:hidden"
                >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Search + Random */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        placeholder="기업명 또는 인물 검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsExpanded(true)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && results.length > 0) {
                                const r = results[0];
                                onSearch(r.id, r.label, r.type);
                                setQuery("");
                                setResults([]);
                            }
                        }}
                    />
                    {results.length > 0 && (
                        <div
                            className="absolute top-full left-0 w-full mt-1 rounded-lg max-h-48 overflow-y-auto z-20 shadow-2xl py-1 border border-slate-600/30"
                            style={{
                                backgroundColor: "rgba(15, 23, 42, 0.92)",
                                backdropFilter: "blur(16px)",
                            }}
                        >
                            {results.map((r: any, i: number) => (
                                <button
                                    key={i}
                                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-slate-700/50 last:border-0 flex items-center gap-2 group transition-colors"
                                    onClick={() => {
                                        onSearch(r.id, r.label, r.type);
                                        setQuery("");
                                        setResults([]);
                                    }}
                                >
                                    {r.type === "company" ? (
                                        <Building2 className="w-4 h-4 text-slate-500 group-hover:text-blue-400 shrink-0" />
                                    ) : (
                                        <User className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-slate-200 truncate">{r.label}</div>
                                        <div className="text-[10px] text-slate-500 flex gap-2">
                                            {r.type === "company" ? `코드: ${r.stock_code || "N/A"}` : "개인/기관"}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={onRandom}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-purple-600/50 hover:border-purple-500/50 transition-all flex-shrink-0"
                    title="랜덤 기업"
                >
                    <Shuffle className="w-4 h-4" />
                </button>
            </div>

            {/* Center name */}
            {currentCenterName && (
                <div className="px-3 py-2 bg-slate-800/30 rounded-lg flex items-center justify-between border border-slate-700/20 text-xs">
                    <span className="text-slate-400">중심</span>
                    <span className="font-bold text-yellow-400 truncate ml-2">{currentCenterName}</span>
                </div>
            )}

            {/* Collapsible filters */}
            <div className={classNames(
                "flex flex-col gap-3 overflow-hidden transition-all duration-300",
                isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 sm:max-h-[600px] sm:opacity-100"
            )}>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-medium text-xs">최소 지분%</label>
                        <select value={minShare} onChange={(e) => setMinShare(Number(e.target.value))} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors text-xs">
                            <option value="0">전체 (0%)</option>
                            <option value="1">1% 이상</option>
                            <option value="5">5% 이상</option>
                            <option value="10">10% 이상</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-slate-300 font-medium text-xs">연결 촌수</label>
                        <select value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors text-xs">
                            <option value="20">전체</option>
                            <option value="1">1촌</option>
                            <option value="2">2촌</option>
                            <option value="3">3촌</option>
                            <option value="4">4촌</option>
                            <option value="5">5촌</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-medium text-xs">원 크기 기준</label>
                    <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
                        <button onClick={() => setSizeMode("share")} className={classNames("flex-1 py-1.5 text-xs transition-colors", sizeMode === "share" ? "bg-blue-600 font-medium" : "bg-slate-800/50 hover:bg-slate-700/50")}>지분율</button>
                        <button onClick={() => setSizeMode("market_cap")} className={classNames("flex-1 py-1.5 text-xs transition-colors", sizeMode === "market_cap" ? "bg-blue-600 font-medium" : "bg-slate-800/50 hover:bg-slate-700/50")}>시가총액</button>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-medium text-xs">비상장 기업</label>
                    <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-slate-700/50">
                        <button onClick={() => setUnlistedFilter("hide")} className={classNames("py-1.5 text-xs transition-colors", unlistedFilter === "hide" ? "bg-pink-700 font-medium" : "bg-slate-800/50 hover:bg-slate-700/50")}>숨기기</button>
                        <button onClick={() => setUnlistedFilter("1-degree")} className={classNames("py-1.5 text-xs transition-colors border-x border-slate-700/50", unlistedFilter === "1-degree" ? "bg-pink-600 font-medium" : "bg-slate-800/50 hover:bg-slate-700/50")}>1촌</button>
                        <button onClick={() => setUnlistedFilter("2-degree")} className={classNames("py-1.5 text-xs transition-colors", unlistedFilter === "2-degree" ? "bg-pink-500 font-medium" : "bg-slate-800/50 hover:bg-slate-700/50")}>2촌</button>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-slate-700/20 mt-1">
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer w-full hover:text-white transition-colors">
                        <div className="relative flex items-center">
                            <input type="checkbox" className="sr-only" checked={hidePerson} onChange={(e) => setHidePerson(e.target.checked)} />
                            <div className={classNames("block w-7 h-4 rounded-full transition-colors", hidePerson ? "bg-emerald-500" : "bg-slate-700")}></div>
                            <div className={classNames("absolute left-[2px] bg-white w-3 h-3 rounded-full transition-transform", hidePerson ? "transform translate-x-3" : "")}></div>
                        </div>
                        <span className="flex-1">개인(초록색 원) 숨기기</span>
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer w-full hover:text-white transition-colors">
                        <div className="relative flex items-center">
                            <input type="checkbox" className="sr-only" checked={hideNps} onChange={(e) => setHideNps(e.target.checked)} />
                            <div className={classNames("block w-7 h-4 rounded-full transition-colors", hideNps ? "bg-emerald-500" : "bg-slate-700")}></div>
                            <div className={classNames("absolute left-[2px] bg-white w-3 h-3 rounded-full transition-transform", hideNps ? "transform translate-x-3" : "")}></div>
                        </div>
                        <span className="flex-1">국민연금 등 초대형 노드 숨기기</span>
                    </label>
                </div>

                <div className="text-[10px] text-slate-500 space-y-1 border-t border-slate-700/20 pt-2">
                    <div className="flex flex-wrap gap-x-2">
                        <span>🔴 상장</span>
                        <span>🩷 비상장</span>
                        <span>🟢 개인</span>
                        <span>🟠 기관/재단</span>
                        <span>🟡 중심</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                        <span>➡️ 🔵 1촌(보유)</span>
                        <span>🟡 2촌</span>
                        <span>🟠 3촌+</span>
                        <span>🟢 종속/출자</span>
                        <span>➰ 상호</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
