"use client";

import React from "react";
import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface NoticeDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NoticeDialog({ isOpen, onClose }: NoticeDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog Content */}
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            📢 서비스 공지사항
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6 text-sm leading-relaxed">
                        {/* Issue Section */}
                        <section className="bg-slate-800/40 rounded-xl p-4 border border-amber-500/20">
                            <h3 className="flex items-center gap-2 text-amber-400 font-semibold mb-3">
                                <AlertCircle className="w-4 h-4" /> 현재 지연/장애 안내 (외부 요인)
                            </h3>
                            <ul className="space-y-2 text-slate-300 list-disc list-inside marker:text-amber-500/50">
                                <li>
                                    <span className="font-medium text-slate-200">시가총액 및 최근 주가:</span> 한국거래소(KRX) 시스템 개편으로 인해 종목별 시가총액 정보의 실시간 갱신이 일시 중단된 상태입니다. (노드 크기가 최신 시총을 반영하지 못할 수 있습니다.)
                                </li>
                                <li>
                                    <span className="font-medium text-slate-200">KOSPI / KOSDAQ 구분:</span> 신규 데이터의 시장 구분 라벨 표시가 지연되고 있습니다.
                                </li>
                            </ul>
                        </section>

                        {/* Normal Section */}
                        <section className="bg-slate-800/40 rounded-xl p-4 border border-emerald-500/20">
                            <h3 className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
                                <CheckCircle2 className="w-4 h-4" /> 정상 작동 안내
                            </h3>
                            <ul className="space-y-2 text-slate-300 list-disc list-inside marker:text-emerald-500/50">
                                <li>
                                    <span className="font-medium text-slate-200">지분 정보 데이터:</span> 인물 및 기업 간의 지분율, 관계 데이터는 <span className="text-emerald-300">DART(전자공시) API를 통해 매일 정상적으로 업데이트</span>되고 있습니다.
                                </li>
                                <li>
                                    <span className="font-medium text-slate-200">검색 및 시각화:</span> 기업 검색 및 지분 구조 마인드맵 탐색 기능은 평소와 다름없이 이용 가능합니다.
                                </li>
                            </ul>
                        </section>

                        <p className="text-slate-400 text-xs italic text-center">
                            외부 라이브러리 및 거래소 시스템 안정화 이후 즉시 복구될 예정입니다.<br />
                            이용에 불편을 드려 죄송합니다.
                        </p>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-xl transition-all shadow-lg active:scale-95"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
