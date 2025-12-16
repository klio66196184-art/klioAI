
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Users, 
  Activity, 
  Download, 
  FileText, 
  Loader2, 
  PlusCircle, 
  CheckCircle2, 
  TrendingUp, 
  BrainCircuit, 
  Files, 
  Zap, 
  Trophy, 
  Award, 
  BarChart3, 
  ChevronDown,
  RefreshCw,
  Search,
  LayoutDashboard,
  Quote,
  AlertCircle,
  Key
} from 'lucide-react';
import { StudentData, AnalysisResult } from './types';
import { parseExcel, generateTemplate } from './services/excelService';
import { analyzeStudent } from './services/geminiService';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  ResponsiveContainer 
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 擴展 window 型別以支持可能存在的 AI Studio 工具
// 修復：單獨定義 AIStudio 介面並在 Window 中使用，以解決後續屬性宣告衝突
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [reports, setReports] = useState<Record<string, AnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showKeyWarning, setShowKeyWarning] = useState(false);

  // 檢查 API KEY
  useEffect(() => {
    const checkKey = async () => {
      const hasKey = !!process.env.API_KEY;
      if (!hasKey) {
        if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          if (!selected) setShowKeyWarning(true);
        } else {
          setShowKeyWarning(true);
        }
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setShowKeyWarning(false);
    } else {
      alert("請在環境變數中設定 API_KEY 以使用 AI 分析功能。");
    }
  };

  const startBatchAnalysis = async (data: StudentData[]) => {
    if (data.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setReports({});
    
    const CONCURRENCY_LIMIT = 5; 
    let completedCount = 0;

    for (let i = 0; i < data.length; i += CONCURRENCY_LIMIT) {
      const chunk = data.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(chunk.map(async (student) => {
        try {
          const result = await analyzeStudent(student);
          setReports(prev => ({ ...prev, [student.id]: result }));
        } catch (err) {
          console.error(`分析失敗: ${student.name}`, err);
        } finally {
          completedCount++;
          setAnalysisProgress(Math.round((completedCount / data.length) * 100));
        }
      }));
    }
    setIsAnalyzing(false);
    if (data.length > 0) setSelectedId(data[0].id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseExcel(file);
      setStudents(data);
      startBatchAnalysis(data);
    } catch (err) {
      alert("Excel 文件解析失敗。");
    }
  };

  const getRankings = (id: string) => {
    const report = reports[id];
    if (!report) return null;
    const allScores = Object.values(reports).map(r => r.rankingScore).sort((a, b) => b - a);
    const globalRank = allScores.indexOf(report.rankingScore) + 1;
    const student = students.find(s => s.id === id);
    const classStudentIds = students.filter(s => s.grade === student?.grade).map(s => s.id);
    const classScores = Object.entries(reports).filter(([sid]) => classStudentIds.includes(sid)).map(([, r]) => r.rankingScore).sort((a, b) => b - a);
    const classRank = classScores.indexOf(report.rankingScore) + 1;
    return { globalRank, totalGlobal: allScores.length, classRank, totalClass: classScores.length };
  };

  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort(), [students]);
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchGrade = filterGrade === 'all' || s.grade === filterGrade;
      const matchSearch = s.name.includes(searchTerm) || s.studentId.includes(searchTerm);
      return matchGrade && matchSearch;
    });
  }, [students, filterGrade, searchTerm]);

  const downloadAllReports = async () => {
    const toDownload = filteredStudents.filter(s => reports[s.id]);
    if (toDownload.length === 0) return;
    setIsDownloadingAll(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    for (let i = 0; i < toDownload.length; i++) {
      const s = toDownload[i];
      setSelectedId(s.id);
      await new Promise(r => setTimeout(r, 600)); 
      const element = document.getElementById(`report-${s.id}`);
      if (element) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(element, { scale: 1.5, useCORS: true });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      }
    }
    pdf.save(`化地瑪體測報告彙總.pdf`);
    setIsDownloadingAll(false);
  };

  const downloadPDF = async (id: string) => {
    const student = students.find(s => s.id === id);
    const element = document.getElementById(`report-${id}`);
    if (!student || !element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`體測報告-${student.name}.pdf`);
    } catch (err) { alert("PDF 生成失敗"); }
  };

  const selectedStudent = students.find(s => s.id === selectedId);
  const selectedReport = selectedId ? reports[selectedId] : null;
  const rankings = selectedId ? getRankings(selectedId) : null;

  const radarData = selectedStudent ? [
    { subject: '爆發力', A: Math.min(100, (selectedStudent.standingLongJump || 0) / 2.5) },
    { subject: '體成分', A: Math.max(0, 100 - Math.abs((selectedStudent.bmi || 22) - 22) * 8) },
    { subject: '柔韌性', A: Math.min(100, (selectedStudent.sitAndReach || 0) * 4) },
    { subject: '心肺', A: Math.min(100, (selectedStudent.shuttleRun || 0) * 2.5) },
    { subject: '肌力', A: Math.min(100, (selectedStudent.handgrip || 0) * 2) },
  ] : [];

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* 遺失 API KEY 警告 */}
      {showKeyWarning && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full text-center shadow-2xl border-t-8 border-yellow-400">
            <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Key size={40} className="text-yellow-600" />
            </div>
            <h2 className="text-3xl font-black text-blue-900 mb-4 uppercase tracking-tighter">尚未設定 API 金鑰</h2>
            <p className="text-slate-500 font-bold mb-8 leading-relaxed">
              為了使用 AI 體質分析功能，您需要設定 Google Gemini API 金鑰。如果是部署在 GitHub Pages，請點擊下方按鈕進行授權。
            </p>
            <button 
              onClick={handleOpenKeySelector}
              className="w-full bg-[#0c2a66] text-yellow-400 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 uppercase"
            >
              <Zap size={24} /> 立即設定金鑰
            </button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block mt-6 text-xs font-bold text-blue-400 hover:underline">
              瞭解更多關於 API 計費資訊
            </a>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-[#0c2a66]/95 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-10">
          <div className="relative mb-12">
            <RefreshCw size={100} className="animate-spin text-yellow-400 opacity-20" />
            <Activity size={50} className="absolute inset-0 m-auto text-yellow-400 animate-pulse" />
          </div>
          <h2 className="text-5xl font-black mb-6 tracking-tighter uppercase">AI 數據運算中</h2>
          <div className="w-full max-w-3xl bg-white/10 h-8 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
            <div className="bg-yellow-400 h-full transition-all duration-500 relative" style={{ width: `${analysisProgress}%` }}>
              <div className="absolute inset-0 bg-white/40 animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
          <div className="mt-8 text-5xl font-black text-yellow-400">{analysisProgress}%</div>
        </div>
      )}

      <header className="bg-[#0c2a66] border-b-4 border-yellow-400 shrink-0 shadow-2xl z-50 no-print">
        <div className="max-w-[1700px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-yellow-400 p-3 rounded-2xl shadow-xl border-2 border-white transform rotate-3">
              <BrainCircuit className="text-[#0c2a66] w-9 h-9" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">化地瑪體測中心</h1>
              <p className="text-[10px] text-blue-300 font-black tracking-[0.4em] uppercase mt-1">Smart Physical Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={generateTemplate} className="text-[11px] text-white/50 hover:text-yellow-400 font-black uppercase tracking-widest flex items-center gap-2 transition-all">
              <FileSpreadsheet size={16} /> 下載模板
            </button>
            <label className="flex items-center gap-3 bg-yellow-400 hover:bg-yellow-300 text-[#0c2a66] px-10 py-4 rounded-2xl cursor-pointer shadow-xl text-sm font-black transition-all border-b-4 border-[#b88a00]">
              <PlusCircle size={22} /> 匯入數據
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1700px] mx-auto w-full flex overflow-hidden p-8 gap-8">
        <div className="w-[440px] flex flex-col gap-6 no-print shrink-0 h-full">
          <div className="bg-white rounded-[2.5rem] border border-blue-100 shadow-2xl overflow-hidden flex flex-col h-full">
            <div className="p-8 bg-slate-50 border-b border-slate-100 space-y-6">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" placeholder="搜尋姓名、學號..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-blue-900 transition-all shadow-inner"
                />
              </div>
              <select 
                value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} 
                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 px-6 text-sm font-black text-blue-900"
              >
                <option value="all">所有年級</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button 
                onClick={downloadAllReports} disabled={isDownloadingAll || filteredStudents.length === 0}
                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-sm shadow-2xl flex items-center justify-center gap-4 transition-all border-b-8 border-slate-700 disabled:opacity-50 uppercase tracking-widest"
              >
                {isDownloadingAll ? <Loader2 size={24} className="animate-spin" /> : <Files size={24} />}
                批量打包 PDF ({filteredStudents.filter(s => reports[s.id]).length} 份)
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredStudents.map(s => (
                <button 
                  key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all border ${selectedId === s.id ? 'bg-blue-900 text-white border-blue-900 shadow-2xl scale-[1.03]' : 'bg-white hover:bg-blue-50 border-slate-100'}`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-black text-base">{s.name}</span>
                    <span className={`text-[11px] font-bold ${selectedId === s.id ? 'text-blue-300' : 'text-slate-400'}`}>{s.grade} · {s.studentId}</span>
                  </div>
                  {reports[s.id] && <div className="px-4 py-1.5 bg-yellow-400 text-blue-900 rounded-xl text-xs font-black">{reports[s.id].rankingScore} 分</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {!selectedStudent || !reports[selectedId!] ? (
            <div className="h-full bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-200 text-center">
               <Activity size={120} className="mb-10 opacity-5" />
               <h3 className="text-4xl font-black tracking-tighter uppercase opacity-30">請選擇學生預覽報告</h3>
            </div>
          ) : (
            <div className="space-y-12 max-w-[210mm] mx-auto">
              <div id={`report-${selectedId}`} className="bg-white shadow-2xl w-full min-h-[297mm] flex flex-col">
                <div className="p-14 bg-[#0c2a66] text-white relative overflow-hidden">
                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-6">
                      <div className="bg-yellow-400 text-[#0c2a66] px-5 py-2 rounded-full text-[11px] font-black w-fit tracking-[0.2em] uppercase">智能體質分析報告</div>
                      <h2 className="text-7xl font-black tracking-tighter uppercase">{selectedStudent.name}</h2>
                      <p className="text-blue-300 font-black tracking-[0.3em] text-xl">{selectedStudent.studentId}</p>
                    </div>
                    <div className="text-right">
                      <div className="bg-white p-8 rounded-[3rem] text-[#0c2a66] shadow-2xl border-t-[12px] border-yellow-400">
                        <div className="text-[11px] font-black opacity-30 uppercase mb-2">綜合得分</div>
                        <div className="text-7xl font-black">{reports[selectedId!].rankingScore}</div>
                        <div className="mt-4 text-xs font-black text-green-600 bg-green-50 px-4 py-1.5 rounded-full uppercase">{reports[selectedId!].fitnessLevel}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-16 grid grid-cols-7 gap-4">
                    {[
                      { l: '身高', v: `${selectedStudent.height}cm` },
                      { l: '體重', v: `${selectedStudent.weight}kg` },
                      { l: 'BMI', v: selectedStudent.bmi },
                      { l: '手握力', v: `${selectedStudent.handgrip}kg` },
                      { l: '柔韌度', v: `${selectedStudent.sitAndReach}cm` },
                      { l: '跳遠', v: `${selectedStudent.standingLongJump}cm` },
                      { l: '心肺', v: `${selectedStudent.shuttleRun}次` },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/10 p-4 rounded-[1.5rem] border border-white/15 text-center">
                        <div className="text-[9px] font-black text-yellow-400 mb-2 uppercase opacity-80">{item.l}</div>
                        <div className="text-base font-black">{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-14 space-y-14">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex items-center justify-between">
                      <div><h4 className="text-[11px] font-black text-slate-400 mb-3">班級排名 ({selectedStudent.grade})</h4><span className="text-6xl font-black text-blue-900">{rankings?.classRank}</span></div>
                      <Trophy size={60} className="text-yellow-400 opacity-20" />
                    </div>
                    <div className="bg-blue-50/50 p-10 rounded-[3rem] border border-blue-100 flex items-center justify-between">
                      <div><h4 className="text-[11px] font-black text-slate-400 mb-3">全校排名</h4><span className="text-6xl font-black text-[#0c2a66]">{rankings?.globalRank}</span></div>
                      <Award size={60} className="text-blue-900 opacity-20" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-14">
                    <div className="col-span-5 space-y-12">
                       <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl">
                          <h4 className="text-[11px] font-black text-slate-300 text-center uppercase tracking-widest mb-8">體能維度</h4>
                          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fill: '#0c2a66', fontSize: 10, fontWeight: 900 }} /><Radar dataKey="A" stroke="#0c2a66" strokeWidth={3} fill="#facc15" fillOpacity={0.6} /></RadarChart></ResponsiveContainer></div>
                       </div>
                       <div className="text-[13px] font-bold text-slate-600 leading-relaxed bg-slate-50 p-8 rounded-[2rem] space-y-5">
                          <div><span className="text-blue-900 font-black block text-[10px] mb-2 uppercase">澳門 2020 標準</span>{selectedReport?.comparisonMacau}</div>
                          <div className="pt-4 border-t"><span className="text-[#b88a00] font-black block text-[10px] mb-2 uppercase">國家 2014 標準</span>{selectedReport?.comparisonChina}</div>
                       </div>
                    </div>
                    <div className="col-span-7 space-y-10">
                       <div className="bg-blue-50 p-10 rounded-[2.5rem] border border-blue-100 relative"><Quote size={40} className="absolute -top-4 -left-4 text-blue-200" /><p className="text-slate-800 font-black leading-relaxed italic">"{selectedReport?.summary}"</p></div>
                       <div className="space-y-8">
                          <div><h4 className="font-black text-blue-900 text-base mb-4 flex items-center gap-3 uppercase"><span className="w-2.5 h-6 bg-yellow-400 rounded-full"></span> 運動處方</h4><div className="space-y-3">{selectedReport?.exerciseSuggestions.map((s, i) => <div key={i} className="bg-white border p-4 rounded-xl text-xs font-bold shadow-sm">{s}</div>)}</div></div>
                          <div><h4 className="font-black text-blue-900 text-base mb-4 flex items-center gap-3 uppercase"><span className="w-2.5 h-6 bg-blue-900 rounded-full"></span> 膳食建議</h4><div className="space-y-3">{selectedReport?.nutritionSuggestions.map((s, i) => <div key={i} className="bg-white border p-4 rounded-xl text-xs font-bold shadow-sm">{s}</div>)}</div></div>
                       </div>
                    </div>
                  </div>
                </div>
                <div className="p-10 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-3"><Activity size={16} className="text-yellow-500" /> 化地瑪學生體質分析中心</div>
                  <span>學號: {selectedStudent.studentId} | 日期: {new Date().toLocaleDateString('zh-HK')}</span>
                </div>
              </div>
              <div className="pb-24"><button onClick={() => downloadPDF(selectedId!)} className="w-full bg-[#0c2a66] text-yellow-400 py-7 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-5 uppercase"><Download size={32} /> 下載個人報告 (PDF)</button></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
