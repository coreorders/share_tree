"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ExternalLink, TrendingUp, TrendingDown, Users, Building2, User, Banknote, GripHorizontal, RefreshCw, AlertTriangle, Send } from "lucide-react";

interface NodeInfoPopupProps {
    data: any;
    position: { x: number; y: number };
    onClose: () => void;
    onNavigate: (nodeId: string, label: string) => void;
}

function formatNumber(n: number | null | undefined): string {
    if (!n) return "-";
    if (n >= 1_0000_0000_0000) return `${(n / 1_0000_0000_0000).toFixed(1)}조`;
    if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
    if (n >= 1_0000) return `${(n / 1_0000).toFixed(1)}만`;
    return n.toLocaleString();
}

function formatWon(n: number | null | undefined): string {
    if (!n) return "-";
    return `₩${formatNumber(n)}`;
}

function formatValueShort(n: number, estimated: boolean = false): string {
    const prefix = estimated ? "≈ " : "";
    if (n >= 1_0000_0000_0000) return `${prefix}약 ${(n / 1_0000_0000_0000).toFixed(1)}조원`;
    if (n >= 1_0000_0000) return `${prefix}약 ${(n / 1_0000_0000).toFixed(0)}억원`;
    if (n >= 1_0000) return `${prefix}약 ${(n / 1_0000).toFixed(0)}만원`;
    return `${prefix}${n.toLocaleString()}원`;
}

function formatDate(d: string | null | undefined): string {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export default function NodeInfoPopup({ data, position, onClose, onNavigate }: NodeInfoPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [isReporting, setIsReporting] = useState(false);
    const [reportMsg, setReportMsg] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Center on screen
    useEffect(() => {
        if (typeof window !== "undefined") {
            const w = Math.min(384, window.innerWidth - 32);
            setPos({
                x: (window.innerWidth - w) / 2,
                y: Math.max(16, (window.innerHeight - 500) / 2),
            });
        }
    }, [data]);

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    }, [pos]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        setIsDragging(true);
        const touch = e.touches[0];
        dragOffset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    }, [pos]);

    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setPos({
                x: clientX - dragOffset.current.x,
                y: clientY - dragOffset.current.y,
            });
        };
        const handleUp = () => setIsDragging(false);
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        window.addEventListener("touchmove", handleMove);
        window.addEventListener("touchend", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("touchmove", handleMove);
            window.removeEventListener("touchend", handleUp);
        };
    }, [isDragging]);

    if (!data) return null;

    const isCompany = data.type === "company";
    const naverSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(data.name)}`;
    const dartUrl = isCompany
        ? `https://dart.fss.or.kr/dsab001/main.do?autoSearch=true&textCrpNm=${encodeURIComponent(data.name)}`
        : null;
    const naverFinanceUrl = isCompany && data.stock_code
        ? `https://finance.naver.com/item/main.naver?code=${data.stock_code}`
        : null;

    const effectivePrice = data.close_price;
    const totalValue = data.totalListedValue + data.totalEstimatedValue;

    const handleReport = async () => {
        if (!reportMsg.trim()) return;
        setIsSubmitting(true);
        try {
            const url = process.env.NEXT_PUBLIC_GAS_URL;
            if (!url) {
                alert("구글 서비스 URL이 설정되지 않았습니다.");
                return;
            }
            await fetch(url, {
                method: "POST",
                mode: "no-cors", // Required for GAS
                body: JSON.stringify({
                    action: "report",
                    nodeName: data.name,
                    nodeId: data.id,
                    message: reportMsg
                })
            });
            alert("신고가 접수되었습니다. 감사합니다!");
            setIsReporting(false);
            setReportMsg("");
        } catch (err) {
            console.error(err);
            alert("전송 중 오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div
                ref={popupRef}
                className="fixed z-50 rounded-2xl shadow-2xl border border-slate-500/30 w-[calc(100vw-2rem)] sm:w-96 max-h-[80vh] overflow-hidden flex flex-col"
                style={{
                    left: pos.x,
                    top: pos.y,
                    backgroundColor: "rgba(15, 23, 42, 0.85)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                }}
            >
                {/* Header */}
                <div
                    className="p-3 sm:p-4 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <GripHorizontal className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        {isCompany ? (
                            <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        ) : (
                            <User className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        )}
                        <h2 className="text-base sm:text-lg font-bold truncate">
                            {data.name}
                            {data.isListed && data.market && (
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${data.market === 'KOSPI' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                    {data.market}
                                </span>
                            )}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsReporting(!isReporting); }}
                            className={`p-1.5 rounded-lg transition-colors ${isReporting ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/10 text-slate-400'}`}
                            title="오류 신고"
                        >
                            <AlertTriangle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1.5 hover:bg-white/10 text-slate-400 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div >

                {/* Content */}
                <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 text-sm relative">
                    {isReporting && (
                        <div className="absolute inset-0 bg-slate-900/95 z-20 p-4 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2 mb-3 text-red-400">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-bold">데이터 분석 오류 신고</span>
                            </div>
                            <p className="text-slate-300 text-xs mb-3 leading-relaxed">
                                노드의 동명이인 꼬임, 잘못된 지분 정보 등을 적어주시면 확인 후 수정하겠습니다.
                            </p>
                            <textarea
                                autoFocus
                                value={reportMsg}
                                onChange={(e) => setReportMsg(e.target.value)}
                                placeholder="신고 내용을 적어주세요. (예: 지분율 오류, 동명이인 등)"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none mb-3"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setIsReporting(false); setReportMsg(""); }}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleReport}
                                    disabled={isSubmitting || !reportMsg.trim()}
                                    className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            신고 보내기
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                    {
                        isCompany ? (
                            <>
                                {/* Static Price Banner */}
                                {
                                    data.stock_code && (
                                        <div className="bg-slate-800/60 rounded-lg p-3 mb-3 flex items-center justify-between border border-slate-600/30">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 mb-0.5">
                                                        당일 종가 (업데이트 기준)
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-lg text-white">
                                                            ₩{(data.close_price || 0).toLocaleString()}
                                                        </p>
                                                        {data.price_change !== undefined && (
                                                            <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${data.price_change > 0 ? 'text-red-400 bg-red-400/10' : data.price_change < 0 ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 bg-slate-400/10'}`}>
                                                                {data.price_change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : data.price_change < 0 ? <TrendingDown className="w-3 h-3 mr-1" /> : null}
                                                                {data.price_change > 0 && "+"}
                                                                {data.price_change.toLocaleString()} ({data.change_rate > 0 && "+"}{data.change_rate.toFixed(1)}%)
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">시가총액</p>
                                        <p className="font-bold text-blue-300 text-sm">{data.isListed ? formatWon(data.market_cap) : "비상장"}</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">발행 주식수</p>
                                        <p className="font-bold text-sm">{formatNumber(data.shares_outstanding)}주</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">종목코드</p>
                                        <p className="font-bold font-mono text-sm">{data.stock_code || "비상장"}</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">마지막 갱신</p>
                                        <p className="font-bold text-xs">{formatDate(data.last_updated)}</p>
                                    </div>
                                </div>

                                {
                                    data.holdingsCount > 0 && (
                                        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2.5">
                                            <p className="text-emerald-400 text-xs mb-0.5">보유 지분 총 가치</p>
                                            <p className="font-bold text-emerald-300">
                                                {data.totalListedValue > 0 ? formatWon(data.totalListedValue) : ""}
                                                {data.totalEstimatedValue > 0 && (
                                                    <span className="text-yellow-400 text-xs ml-1">
                                                        {data.totalListedValue > 0 ? '+ ' : ''}≈ {formatValueShort(data.totalEstimatedValue)}
                                                    </span>
                                                )}
                                                {data.hasUnlisted && <span className="text-slate-500 text-xs ml-1">+α(비상장)</span>}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">{data.holdingsCount}개 기업 보유</p>
                                        </div>
                                    )
                                }

                                {
                                    data.shareholders && data.shareholders.length > 0 && (
                                        <div>
                                            <h3 className="text-slate-300 font-medium mb-1.5 flex items-center gap-1 text-xs">
                                                <Users className="w-3.5 h-3.5" /> 주주 목록 ({data.shareholderCount}명)
                                            </h3>
                                            <div className="space-y-0.5 max-h-28 overflow-y-auto">
                                                {data.shareholders.map((s: any, i: number) => (
                                                    <button
                                                        key={i}
                                                        className="flex w-full justify-between items-center px-2 py-1 hover:bg-white/10 rounded text-xs transition-colors"
                                                        onClick={() => onNavigate(s.shareholder_name, s.shareholder_name)}
                                                    >
                                                        <span className="truncate flex-1 text-left">{s.shareholder_name}</span>
                                                        <span className="text-blue-300 font-mono ml-2">{s.share_rate}%</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }

                                {
                                    data.holdings && data.holdings.length > 0 && (
                                        <div>
                                            <h3 className="text-slate-300 font-medium mb-1.5 flex items-center gap-1 text-xs">
                                                <TrendingUp className="w-3.5 h-3.5" /> 보유 지분 ({data.holdingsCount}건)
                                            </h3>
                                            <div className="space-y-0.5 max-h-28 overflow-y-auto">
                                                {data.holdings.map((h: any, i: number) => (
                                                    <button
                                                        key={i}
                                                        className="flex justify-between items-center px-2 py-1 hover:bg-white/10 rounded text-xs w-full text-left gap-1"
                                                        onClick={() => onNavigate(h.corp_code, h.corp_name)}
                                                    >
                                                        <span className="truncate flex-1 min-w-0">{h.corp_name}</span>
                                                        <span className="text-emerald-300 font-mono whitespace-nowrap">{h.share_rate}%</span>
                                                        <span className={`font-mono whitespace-nowrap text-[10px] ${h.isEstimated ? 'text-yellow-400' : 'text-slate-400'}`}>
                                                            {!h.isListed
                                                                ? "비상장"
                                                                : h.value > 0
                                                                    ? formatValueShort(h.value, h.isEstimated)
                                                                    : ""}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">총 보유 주식수</p>
                                        <p className="font-bold text-sm">{data.totalShares > 0 ? `${formatNumber(data.totalShares)}주` : "-"}</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">보유주식 총 가치</p>
                                        <p className="font-bold text-emerald-300 text-sm">
                                            {data.totalListedValue > 0 ? formatWon(data.totalListedValue) : ""}
                                            {data.totalEstimatedValue > 0 && (
                                                <span className="text-yellow-400 text-xs">
                                                    {data.totalListedValue > 0 ? ' + ' : ''}≈ {formatValueShort(data.totalEstimatedValue)}
                                                </span>
                                            )}
                                            {data.totalListedValue === 0 && data.totalEstimatedValue === 0 && "-"}
                                        </p>
                                        {data.hasUnlisted && (
                                            <p className="text-slate-500 text-[10px]">+α (비상장 포함)</p>
                                        )}
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">보유 기업 수</p>
                                        <p className="font-bold text-sm">{data.holdingsCount}개</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                                        <p className="text-slate-400 text-xs mb-0.5">데이터 기준</p>
                                        <p className="font-bold text-xs">DB 저장 기준</p>
                                    </div>
                                </div>

                                {data.holdings && data.holdings.length > 0 && (
                                    <div>
                                        <h3 className="text-slate-300 font-medium mb-1.5 flex items-center gap-1 text-xs">
                                            <Banknote className="w-3.5 h-3.5" /> 보유 지분 상세
                                        </h3>
                                        <div className="space-y-0.5 max-h-44 overflow-y-auto">
                                            {data.holdings.map((h: any, i: number) => (
                                                <button
                                                    key={i}
                                                    className="flex justify-between items-center px-2 py-1.5 hover:bg-white/10 rounded text-xs w-full text-left gap-1"
                                                    onClick={() => onNavigate(h.corp_code, h.corp_name)}
                                                >
                                                    <span className="truncate flex-1 min-w-0">{h.corp_name}</span>
                                                    <span className="text-blue-300 font-mono whitespace-nowrap">{h.share_rate}%</span>
                                                    <span className={`font-mono whitespace-nowrap text-[10px] ${h.isEstimated ? 'text-yellow-400' : 'text-slate-400'}`}>
                                                        {!h.isListed
                                                            ? "비상장"
                                                            : h.value > 0
                                                                ? formatValueShort(h.value, h.isEstimated)
                                                                : ""}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                </div >

                {/* Footer Links */}
                < div className="p-2.5 sm:p-3 border-t border-slate-700/50 flex gap-2 flex-shrink-0 flex-wrap" >
                    <a href={naverSearchUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/80 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors">
                        <ExternalLink className="w-3 h-3" /> 네이버 검색
                    </a>
                    {
                        naverFinanceUrl && (
                            <a href={naverFinanceUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-xs font-medium transition-colors">
                                <TrendingUp className="w-3 h-3" /> 네이버 금융
                            </a>
                        )
                    }
                    {
                        dartUrl && (
                            <a href={dartUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 rounded-lg text-xs font-medium transition-colors">
                                <ExternalLink className="w-3 h-3" /> DART 공시
                            </a>
                        )
                    }
                </div >
            </div >
        </>
    );
}
