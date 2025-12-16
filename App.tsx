
import React, { useState, useMemo } from 'react';
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
  Quote
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

const App: React.FC = () => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [reports, setReports] = useState<Record<string, AnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 自動化批量分析 (上載後立即觸發)
  const startBatchAnalysis = async (data: StudentData[]) => {
    if (data.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setReports({});
    
    const CONCURRENCY_LIMIT = 10; 
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

  // 2. 排名計算邏輯
  const getRankings = (id: string) => {
    const report = reports[id];
    if (!report) return null;

    const allScores = Object.values(reports)
      .map(r => r.rankingScore)
      .sort((a, b) => b - a);
    const globalRank = allScores.indexOf(report.rankingScore) + 1;

    const student = students.find(s => s.id === id);
    const classStudentIds = students
      .filter(s => s.grade === student?.grade)
      .map(s => s.id);
    const classScores = Object.entries(reports)
      .filter(([sid]) => classStudentIds.includes(sid))
      .map(([, r]) => r.rankingScore)
      .sort((a, b) => b - a);
    const classRank = classScores.indexOf(report.rankingScore) + 1;

    return { 
      globalRank, 
      totalGlobal: allScores.length,
      classRank,
      totalClass: classScores.length
    };
  };

  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).sort(), [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchGrade = filterGrade === 'all' || s.grade === filterGrade;
      const matchSearch = s.name.includes(searchTerm) || s.studentId.includes(searchTerm);
      return matchGrade && matchSearch;
    });
  }, [students, filterGrade, searchTerm]);

  // 3. 批量 PDF 打包功能
  const downloadAllReports = async () => {
    const toDownload = filteredStudents.filter(s => reports[s.id]);
    if (toDownload.length === 0) return;
    
    setIsDownloadingAll(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    for (let i = 0; i < toDownload.length; i++) {
      const s = toDownload[i];
      setSelectedId(s.id); // 切換預覽以確保 DOM 渲染
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
    pdf.save(`化地瑪體測報告彙總-${filterGrade}.pdf`);
    setIsDownloadingAll(false);
  };

  const downloadPDF = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student || !reports[id]) return;
    const element = document.getElementById(`report-${id}`);
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`體測報告-${student.name}.pdf`);
    } catch (err) {
      alert("生成 PDF 失敗");
    }
  };

  const selectedStudent = students.find(s => s.id === selectedId);
  const selectedReport = selectedId ? reports[selectedId] : null;
  const rankings = selectedId ? getRankings(selectedId) : null;

  // 雷達圖：肌力與柔韌性已加入
  const radarData = selectedStudent ? [
    { subject: '爆發力', A: Math.min(100, (selectedStudent.standingLongJump || 0) / 2.5) },
    { subject: '體成分', A: Math.max(0, 100 - Math.abs((selectedStudent.bmi || 22) - 22) * 8) },
    { subject: '柔韌性', A: Math.min(100, (selectedStudent.sitAndReach || 0) * 4) },
    { subject: '心肺', A: Math.min(100, (selectedStudent.shuttleRun || 0) * 2.5) },
    { subject: '肌力', A: Math.min(100, (selectedStudent.handgrip || 0) * 2) },
  ] : [];

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* 智能分析進度遮罩 */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] bg-[#0c2a66]/95 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-10">
          <div className="relative mb-12">
            <RefreshCw size={100} className="animate-spin text-yellow-400 opacity-20" />
            <Activity size={50} className="absolute inset-0 m-auto text-yellow-400 animate-pulse" />
          </div>
          <h2 className="text-5xl font-black mb-6 tracking-tighter uppercase">AI 體質數據深度分析中</h2>
          <p className="text-blue-200 font-bold mb-12 text-2xl tracking-widest uppercase opacity-80">每秒分析 1 位學生 · 正在計算各項指標與排名</p>
          <div className="w-full max-w-3xl bg-white/10 h-8 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
            <div 
              className="bg-yellow-400 h-full transition-all duration-500 relative" 
              style={{ width: `${analysisProgress}%` }}
            >
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
              <p className="text-[10px] text-blue-300 font-black tracking-[0.4em] uppercase mt-1">Smart Physical Analysis System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={generateTemplate} className="flex items-center gap-2 text-[11px] text-white/50 hover:text-yellow-400 font-black transition-all uppercase tracking-widest">
              <FileSpreadsheet size={16} /> 下載數據模板
            </button>
            <label className="flex items-center gap-3 bg-yellow-400 hover:bg-yellow-300 text-[#0c2a66] px-10 py-4 rounded-2xl cursor-pointer shadow-xl text-sm font-black transition-all active:scale-95 border-b-4 border-[#b88a00]">
              <PlusCircle size={22} /> 匯入 Excel 數據
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1700px] mx-auto w-full flex overflow-hidden p-8 gap-8">
        {/* 左側管理面板 */}
        <div className="w-[440px] flex flex-col gap-6 no-print shrink-0 h-full">
          <div className="bg-white rounded-[2.5rem] border border-blue-100 shadow-2xl overflow-hidden flex flex-col h-full">
            <div className="p-8 bg-slate-50 border-b border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="text-blue-900" size={24} />
                  <span className="font-black text-blue-900 uppercase tracking-tight text-xl">學生名錄</span>
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="搜尋姓名、學號..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:border-blue-900 transition-all shadow-inner"
                />
              </div>

              <div className="flex gap-4">
                <select 
                  value={filterGrade} 
                  onChange={(e) => setFilterGrade(e.target.value)} 
                  className="flex-1 bg-white border-2 border-slate-100 rounded-2xl py-4 px-6 text-sm font-black text-blue-900 focus:outline-none"
                >
                  <option value="all">所有年級</option>
                  {grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <button 
                onClick={downloadAllReports} 
                disabled={isDownloadingAll || filteredStudents.length === 0}
                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black text-sm shadow-2xl flex items-center justify-center gap-4 transition-all border-b-8 border-slate-700 disabled:opacity-50 uppercase tracking-[0.2em]"
              >
                {isDownloadingAll ? <Loader2 size={24} className="animate-spin" /> : <Files size={24} />}
                打包 A4 報告 ({filteredStudents.filter(s => reports[s.id]).length} 份)
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
              {filteredStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <LayoutDashboard size={80} className="mb-6" />
                  <p className="text-2xl font-black">等待數據匯入</p>
                </div>
              ) : (
                filteredStudents.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all border ${selectedId === s.id ? 'bg-blue-900 text-white border-blue-900 shadow-2xl scale-[1.03] z-10' : 'bg-white hover:bg-blue-50 border-slate-100 text-slate-700'}`}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-black text-base">{s.name}</span>
                      <span className={`text-[11px] font-bold tracking-widest ${selectedId === s.id ? 'text-blue-300' : 'text-slate-400'}`}>{s.grade} · {s.studentId}</span>
                    </div>
                    {reports[s.id] && (
                      <div className={`px-4 py-1.5 rounded-xl text-xs font-black ${selectedId === s.id ? 'bg-yellow-400 text-blue-900 shadow-lg' : 'bg-blue-50 text-blue-800'}`}>
                        {reports[s.id].rankingScore} 分
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右側報告預覽區 */}
        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          {!selectedStudent || !reports[selectedId!] ? (
            <div className="h-full bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-200 text-center p-20">
               <Activity size={120} className="mb-10 opacity-5" />
               <h3 className="text-4xl font-black tracking-tighter uppercase opacity-30">請在左側選擇學生以預覽報告</h3>
            </div>
          ) : (
            <div className="space-y-12 max-w-[210mm] mx-auto animate-in fade-in slide-in-from-bottom-10 duration-500">
              {/* 標準 A4 報告實體 */}
              <div id={`report-${selectedId}`} className="bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] w-full min-h-[297mm] flex flex-col relative print:shadow-none">
                
                {/* 報表頭部 */}
                <div className="p-14 bg-[#0c2a66] text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-yellow-400 opacity-10 blur-[150px] -translate-y-1/2 translate-x-1/2"></div>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-6">
                      <div className="bg-yellow-400 text-[#0c2a66] px-5 py-2 rounded-full text-[11px] font-black w-fit tracking-[0.2em] uppercase shadow-2xl border-2 border-white/20">
                        {selectedStudent.grade} 體質智能分析報告
                      </div>
                      <h2 className="text-7xl font-black tracking-tighter uppercase leading-none">{selectedStudent.name}</h2>
                      <div className="flex gap-6 items-center">
                        <p className="text-blue-300 font-black tracking-[0.3em] text-xl uppercase">{selectedStudent.studentId}</p>
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                        <p className="text-blue-200 font-black text-xl">{selectedStudent.gender === 'M' ? '男' : '女'} · {selectedStudent.age} 歲</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="bg-white p-8 rounded-[3rem] text-[#0c2a66] shadow-2xl border-t-[12px] border-yellow-400 min-w-[160px]">
                        <div className="text-[11px] font-black opacity-30 uppercase tracking-[0.3em] mb-2">綜合素質得分</div>
                        <div className="text-7xl font-black leading-none">{reports[selectedId!].rankingScore}</div>
                        <div className="mt-4 text-xs font-black text-green-600 bg-green-50 px-4 py-1.5 rounded-full uppercase tracking-tighter inline-block">{reports[selectedId!].fitnessLevel}</div>
                      </div>
                    </div>
                  </div>

                  {/* 七大指標數據欄位 */}
                  <div className="mt-16 grid grid-cols-7 gap-4">
                    {[
                      { l: '身高', v: `${selectedStudent.height} cm` },
                      { l: '體重', v: `${selectedStudent.weight} kg` },
                      { l: 'BMI', v: selectedStudent.bmi },
                      { l: '手握力', v: `${selectedStudent.handgrip} kg` },
                      { l: '柔韌度', v: `${selectedStudent.sitAndReach} cm` },
                      { l: '跳遠', v: `${selectedStudent.standingLongJump} cm` },
                      { l: '心肺', v: `${selectedStudent.shuttleRun} 次` },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/10 p-4 rounded-[1.5rem] border border-white/15 text-center backdrop-blur-md">
                        <div className="text-[9px] font-black text-yellow-400 mb-2 uppercase opacity-80 tracking-tighter">{item.l}</div>
                        <div className="text-base font-black whitespace-nowrap">{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 報表內容 */}
                <div className="flex-1 p-14 space-y-14">
                  {/* 排名榮譽與對比 */}
                  <div className="grid grid-cols-2 gap-10">
                    <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex items-center justify-between group relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">班級內排名 ({selectedStudent.grade})</h4>
                        <div className="flex items-baseline gap-3">
                          <span className="text-6xl font-black text-blue-900 leading-none">{rankings?.classRank}</span>
                          <span className="text-lg text-slate-400 font-bold">/ {rankings?.totalClass} 人</span>
                        </div>
                      </div>
                      <Trophy size={70} className="text-yellow-400 opacity-10 absolute -right-4 -bottom-4 rotate-12" />
                    </div>
                    <div className="bg-[#0c2a66]/5 p-10 rounded-[3rem] border border-blue-100 flex items-center justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">全校總排名</h4>
                        <div className="flex items-baseline gap-3">
                          <span className="text-6xl font-black text-[#0c2a66] leading-none">{rankings?.globalRank}</span>
                          <span className="text-lg text-slate-400 font-bold">/ {rankings?.totalGlobal} 人</span>
                        </div>
                      </div>
                      <Award size={70} className="text-blue-900 opacity-10 absolute -right-4 -bottom-4 -rotate-12" />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-14">
                    {/* 左側：圖表與標準 */}
                    <div className="col-span-5 space-y-12">
                       <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-blue-900/5">
                          <h4 className="text-[11px] font-black text-slate-300 text-center uppercase tracking-[0.5em] mb-10">體能維度分析</h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#f1f5f9" strokeWidth={2} />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#0c2a66', fontSize: 11, fontWeight: 900 }} />
                                <Radar name="Score" dataKey="A" stroke="#0c2a66" strokeWidth={4} fill="#facc15" fillOpacity={0.65} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="flex items-center gap-3 text-blue-900 font-black text-base uppercase tracking-tight">
                            <CheckCircle2 size={22} className="text-green-500" /> 權威標準對比
                          </div>
                          <div className="text-[13px] font-bold text-slate-600 leading-relaxed bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-5">
                             <div>
                                <span className="text-blue-900 font-black uppercase tracking-[0.2em] block text-[10px] mb-2">澳門體質標準 (2020)</span>
                                <p className="leading-relaxed">{selectedReport?.comparisonMacau}</p>
                             </div>
                             <div className="pt-4 border-t border-slate-200">
                                <span className="text-[#b88a00] font-black uppercase tracking-[0.2em] block text-[10px] mb-2">國家學生體質標準 (2014)</span>
                                <p className="leading-relaxed">{selectedReport?.comparisonChina}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* 右側：總結與建議 */}
                    <div className="col-span-7 space-y-12">
                       <div>
                          <h3 className="text-2xl font-black text-blue-900 flex items-center gap-4 mb-6 uppercase tracking-tighter">
                            <TrendingUp size={28} className="text-yellow-500" /> 專業評核總結
                          </h3>
                          <div className="bg-blue-50 p-10 rounded-[2.5rem] border border-blue-100 relative">
                             <Quote size={50} className="absolute -top-6 -left-6 text-blue-200 opacity-40" />
                             <p className="text-slate-800 font-black leading-relaxed italic text-base">"{selectedReport?.summary}"</p>
                          </div>
                       </div>

                       <div className="space-y-10">
                          <div>
                            <h4 className="font-black text-blue-900 text-base mb-5 flex items-center gap-4 uppercase tracking-tight">
                              <span className="w-2.5 h-7 bg-yellow-400 rounded-full shadow-lg"></span> 個性化運動處方
                            </h4>
                            <div className="space-y-4">
                              {selectedReport?.exerciseSuggestions.map((s, i) => (
                                <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl text-[13px] font-bold text-slate-600 flex gap-5 shadow-sm hover:border-yellow-200 transition-all transform hover:translate-x-1">
                                  <span className="text-blue-900 font-black text-lg leading-none">{i+1}</span> {s}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-black text-blue-900 text-base mb-5 flex items-center gap-4 uppercase tracking-tight">
                              <span className="w-2.5 h-7 bg-blue-900 rounded-full shadow-lg"></span> 膳食與營養建議
                            </h4>
                            <div className="space-y-4">
                              {selectedReport?.nutritionSuggestions.map((s, i) => (
                                <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl text-[13px] font-bold text-slate-600 flex gap-5 shadow-sm hover:border-blue-200 transition-all transform hover:translate-x-1">
                                  <span className="text-yellow-600 font-black text-lg leading-none">{i+1}</span> {s}
                                </div>
                              ))}
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                {/* 報表底部 */}
                <div className="p-12 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-[0.5em]">
                  <div className="flex items-center gap-3"><Activity size={16} className="text-yellow-500" /> 化地瑪學生體質數據分析中心</div>
                  <div className="flex items-center gap-12">
                    <span>ID: {selectedStudent.studentId}</span>
                    <span>ISSUED: {new Date().toLocaleDateString('zh-HK')}</span>
                  </div>
                </div>
              </div>

              {/* 單獨下載按鈕 (預覽模式) */}
              <div className="flex gap-6 no-print pb-24">
                <button 
                  onClick={() => downloadPDF(selectedId!)} 
                  className="flex-1 bg-[#0c2a66] text-yellow-400 py-7 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-black transition-all border-b-[10px] border-[#06183a] flex items-center justify-center gap-5 uppercase tracking-tighter"
                >
                  <Download size={32} /> 下載個人 A4 報告 (PDF)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
