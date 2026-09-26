"use client";

import React from "react";
import { X, CheckCircle2, ChevronRight } from "lucide-react";

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
                        <section className="bg-slate-800/40 rounded-xl p-4 border border-emerald-500/20">
                            <h3 className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
                                <CheckCircle2 className="w-4 h-4" /> 데이터 업데이트 안내
                            </h3>
                            <ul className="space-y-2 text-slate-300 list-disc list-inside marker:text-emerald-500/50">
                                <li>
                                    <span className="font-medium text-slate-200">주가 및 시가총액:</span> 거래소 인증 문제로 갱신이 지연될 수 있습니다. 기업 정보의 마지막 갱신일을 확인해 주세요.
                                </li>
                                <li>
                                    <span className="font-medium text-slate-200">공시 데이터:</span> 임원·주요주주 소유 보고와 정기보고서 기반 정보는 주간 수집합니다. 공시 접수일과 보고서 기준에 따라 반영 시점이 다릅니다.
                                </li>
                                <li>
                                    <span className="font-medium text-slate-200">검색 및 시각화:</span> 기업 검색 및 지분 구조 마인드맵 탐색 기능은 평소와 다름없이 이용 가능합니다.
                                </li>
                            </ul>
                        </section>

                        <p className="text-slate-400 text-xs italic text-center">
                            지분나무를 이용해 주셔서 감사합니다.
                        </p>

                        {/* Community Section */}
                        <div className="pt-4 border-t border-slate-800">
                            <p className="text-slate-400 text-xs mb-2">지분나무 사용자 분들과 의견을 나누고 싶다면?</p>
                            <a
                                href="https://open.kakao.com/o/pr23abji"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/20 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs">
                                        톡
                                    </div>
                                    <div className="text-left">
                                        <div className="text-slate-200 font-semibold text-sm">지분나무 사용자 모임 오픈톡</div>
                                        <div className="text-yellow-400/80 text-[11px]">함께 서비스를 만들어가는 소통 공간</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                            </a>
                        </div>
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
