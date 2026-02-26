"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, AlertCircle, Trash2, CheckCircle2, RefreshCw, LogOut, ChevronRight, MessageSquare, Link2Off, Link2 } from "lucide-react";

export default function AdminPage() {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [reports, setReports] = useState<any[]>([]);
    const [overrides, setOverrides] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [manualSource, setManualSource] = useState("");
    const [manualTarget, setManualTarget] = useState("");

    // Alias states
    const [aliases, setAliases] = useState<any[]>([]);
    const [aliasName, setAliasName] = useState("");
    const [canonicalId, setCanonicalId] = useState("");

    const gasUrl = process.env.NEXT_PUBLIC_GAS_URL;

    const fetchAliases = async () => { }; // REMOVED (No longer using local API)

    const fetchAdminData = async () => {
        if (!gasUrl || !password) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${gasUrl}?action=get_data&password=${password}`);
            const data = await res.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            setReports(data.reports || []);
            const allOverrides = data.overrides || [];
            setOverrides(allOverrides.filter((o: any) => o[1] !== 'MERGE_ALIAS'));
            setAliases(allOverrides.filter((o: any) => o[1] === 'MERGE_ALIAS'));
        } catch (err) {
            console.error(err);
            setError("데이터를 불러오는 데 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gasUrl) return;
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch(`${gasUrl}?action=get_data&password=${password}`);
            const data = await res.json();

            if (data.error === "Invalid password" || data.error === "비밀번호가 틀렸습니다.") {
                setError("비밀번호가 올바르지 않습니다.");
                return;
            }

            if (data.reports || data.overrides) {
                setReports(data.reports || []);
                const allOverrides = data.overrides || [];
                setOverrides(allOverrides.filter((o: any) => o[1] !== 'MERGE_ALIAS'));
                setAliases(allOverrides.filter((o: any) => o[1] === 'MERGE_ALIAS'));
                setIsAuthenticated(true);
            } else {
                setError("데이터를 불러올 수 없습니다. GAS 설정을 확인하세요.");
            }
        } catch (err) {
            console.error(err);
            setError("접속 실패. 네트워크나 GAS URL을 확인하세요.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleProcessReport = async (report: any) => {
        if (!window.confirm(`'${report[1]}'에 대한 신고를 처리하시겠습니까? (Overrides에 등록됩니다)`)) return;
        setIsLoading(true);
        try {
            await fetch(gasUrl!, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    action: "fix_report",
                    password: password,
                    reportId: report[2], // nodeId
                    type: "DELETE_LINK", // 기본적으로 연결 끊기 제안
                    source: report[1],
                    target: "Unknown",
                    reason: `User Report: ${report[3]}`
                })
            });
            alert("처리되었습니다. (시트 반영 완료)");
            fetchAdminData();
        } catch (err) {
            alert("처리 중 에러가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualSource || !manualTarget) return;
        setIsLoading(true);
        try {
            await fetch(gasUrl!, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    action: "add_override",
                    password: password,
                    type: "DELETE_LINK",
                    source: manualSource,
                    target: manualTarget,
                    reason: "Manual correction"
                })
            });
            alert("규칙이 추가되었습니다.");
            setManualSource("");
            setManualTarget("");
            fetchAdminData();
        } catch (err) {
            alert("추가 중 오류 발생");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteOverride = async (index: number) => {
        // GAS URL에 index 정보를 보내서 삭제하거나, 사용자에게 시트를 안내
        if (!window.confirm("이 규칙을 관리하시겠습니까?")) return;
        alert("구글 시트의 'Overrides' 탭에서 해당 행을 직접 관리하거나 삭제해 주세요.\n(데이터 안전을 위해 현재 UI에서의 삭제는 지원되지 않으며 시트에서 직접 삭제하면 다음 업데이트 때 반영됩니다)");
    };

    const handleAddAlias = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aliasName || !canonicalId) return;
        setIsLoading(true);
        try {
            await fetch(gasUrl!, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify({
                    action: "add_override",
                    password: password,
                    type: "MERGE_ALIAS",
                    source: aliasName,
                    target: canonicalId,
                    reason: "표기명 병합 (자동 처리)"
                })
            });
            alert("이름 병합 규칙이 구글 시트에 추가되었습니다.");
            setAliasName("");
            setCanonicalId("");
            fetchAdminData();
        } catch (err) {
            alert("이름 병합 오류");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAlias = async (index: number) => {
        if (!window.confirm("이 병합 규칙을 관리하시겠습니까?")) return;
        alert("구글 시트의 'Overrides' 탭에서 해당 행을 직접 관리하거나 삭제해 주세요.\n(시트에서 직접 삭제하면 다음 업데이트 때 반영됩니다)");
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                            <Lock className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">ShareGraph Admin</h1>
                        <p className="text-slate-400 text-sm mt-2 text-center leading-relaxed">
                            지분나무 관리자 페이지입니다.<br />비밀번호(10자)를 입력하세요.
                        </p>
                        <div className="mt-4 text-[10px] font-mono text-center">
                            {!gasUrl ? (
                                <span className="text-red-500 font-bold animate-pulse">⚠️ GAS URL 미설정 (Secrets 확인 필요)</span>
                            ) : (
                                <span className="text-slate-600 truncate inline-block max-w-[200px]">GAS: {gasUrl.substring(0, 30)}...</span>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••"
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center text-2xl text-white tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                            접속하기
                        </button>
                        {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-sm font-bold uppercase tracking-wider">Authenticated</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                        {!gasUrl && <p className="text-red-500 text-[10px] mt-1 uppercase font-bold tracking-widest animate-pulse">GAS URL NOT CONFIGURED</p>}
                        {gasUrl && <p className="text-slate-600 text-[8px] mt-1 truncate max-w-[200px]">GAS: {gasUrl.substring(0, 30)}...</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchAdminData}
                            className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-all"
                            title="새로고침"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => setIsAuthenticated(false)}
                            className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 text-red-400 transition-all"
                            title="로그아웃"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Reports Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <MessageSquare className="w-5 h-5 text-amber-400" />
                            <h2 className="text-xl font-bold">오류 신고 내역 ({reports.length})</h2>
                        </div>
                        {reports.length === 0 ? (
                            <div className="bg-slate-900/40 border border-slate-800/50 border-dashed rounded-3xl p-12 text-center text-slate-500">
                                접수된 신고가 없습니다.
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {reports.map((r, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl hover:border-slate-700 transition-all">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-white text-lg truncate flex items-center gap-2">
                                                    {r[1]}
                                                    <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-mono">{r[2]}</span>
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(r[0]).toLocaleString()}</p>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${r[4] === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {r[4]}
                                            </div>
                                        </div>
                                        <p className="bg-slate-950/50 rounded-2xl p-4 text-sm text-slate-300 mb-4 whitespace-pre-wrap italic">
                                            "{r[3]}"
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleProcessReport(r)}
                                                disabled={r[4] === 'Resolved'}
                                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                처리 완료 (연결 해제 등록)
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Overrides Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-xl font-bold">적용된 보정 규칙 ({overrides.length})</h2>
                        </div>
                        {/* Manual Add Form */}
                        <form onSubmit={handleAddOverride} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3 mb-6">
                            <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">수동 연결 끊기 규칙 추가</p>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    placeholder="인물/기업명 (Source)"
                                    value={manualSource}
                                    onChange={(e) => setManualSource(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    placeholder="대상 기업명 (Target)"
                                    value={manualTarget}
                                    onChange={(e) => setManualTarget(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !manualSource || !manualTarget}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <Link2Off className="w-4 h-4" />
                                이 연결 끊기 규칙 추가
                            </button>
                            <p className="text-[10px] text-slate-500 text-center uppercase">주의: 이름이 공시 데이터와 정확히 일치해야 합니다.</p>
                        </form>

                        {overrides.length === 0 ? (
                            <div className="bg-slate-900/40 border border-slate-800/50 border-dashed rounded-3xl p-12 text-center text-slate-500">
                                적용된 규칙이 없습니다.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {overrides.map((o, i) => (
                                    <div key={i} className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                                                {o[1] === 'DELETE_LINK' ? <Link2Off className="w-5 h-5 text-red-400" /> : <Link2 className="w-5 h-5 text-blue-400" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white">{o[2]}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-600" />
                                                    <span className="text-slate-400 text-sm">{o[3]}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{o[4]}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteOverride(i)}
                                            className="p-2 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Aliases Section (Full width) */}
                <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <MessageSquare className="w-5 h-5 text-purple-400" />
                        <h2 className="text-xl font-bold">표기명 병합/파편화 해결 ({aliases.length})</h2>
                    </div>
                    {/* Manual Add Alias Form */}
                    <form onSubmit={handleAddAlias} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3 mb-6">
                        <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">새로운 병합 규칙 (별명 -&gt; 진짜 이름)</p>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                placeholder="파편화된 이름 (예: ㈜원익홀딩스)"
                                value={aliasName}
                                onChange={(e) => setAliasName(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                                placeholder="진짜 합쳐질 이름/ID (예: 원익홀딩스)"
                                value={canonicalId}
                                onChange={(e) => setCanonicalId(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !aliasName || !canonicalId}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-purple-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                        >
                            <Link2 className="w-4 h-4" />
                            병합 규칙 저장
                        </button>
                    </form>

                    {aliases.length === 0 ? (
                        <div className="bg-slate-900/40 border border-slate-800/50 border-dashed rounded-3xl p-12 text-center text-slate-500">
                            적용된 병합 규칙이 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {aliases.map((o, i) => (
                                <div key={i} className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <Link2 className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-red-400">{o[2]}</span>
                                                <ChevronRight className="w-3 h-3 text-slate-600" />
                                                <span className="font-bold text-emerald-400">{o[3]}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">병합/정규화 처리됨 (Google 시트)</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteAlias(i)}
                                        className="p-2 text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
