import React, { useState } from 'react';
import { Student, Language, ReportCard } from '../types';
import { Button } from '../components/Button';
import { showToast } from '../components/Toast';
import AdmissionForm from '../components/AdmissionForm';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  ArrowLeft, 
  MessageSquare, 
  Edit, 
  CalendarDays, 
  Award, 
  FileText, 
  Plus, 
  X,
  Download,
  Share2,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ChevronRight,
  ChevronDown,
  QrCode,
  Shield,
  Printer,
  Settings,
  Check
} from 'lucide-react';

interface StudentProfileProps {
  student: Student;
  language: Language;
  onBack: () => void;
  onEditProfile?: (studentId: string) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({ student, language, onBack, onEditProfile }) => {
  const isRTL = language === Language.AR;
  
  const [reports, setReports] = useState<ReportCard[]>(student.reportCards || []);
  const [viewMode, setViewMode] = useState<'profile' | 'report-card' | 'transcript-generator'>('profile');
  const [viewingDocument, setViewingDocument] = useState<ReportCard | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [transcriptSettings, setTranscriptSettings] = useState({
    includeQR: true,
    displayGPA: true,
    applySeal: true,
    isOfficial: false
  });
  const [newDocData, setNewDocData] = useState({
    title: '',
    type: 'Certificate' as ReportCard['type'],
    gradeAverage: '',
    academicYear: '2023-2024'
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(true);

  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageContent, setMessageContent] = useState('');


  const handleAssign = () => {
    if (!newDocData.title || !newDocData.gradeAverage) return;
    const newDoc: ReportCard = {
      id: Date.now().toString(),
      title: newDocData.title,
      type: newDocData.type,
      gradeAverage: newDocData.gradeAverage,
      academicYear: newDocData.academicYear,
      issueDate: new Date().toISOString().split('T')[0]
    };
    setReports([newDoc, ...reports]);
    setIsAssigning(false);
    setNewDocData({ title: '', type: 'Certificate', gradeAverage: '', academicYear: '2023-2024' });
  };

  const handleDownload = (doc: ReportCard) => {
    // Simulate download
    const content = `Official ${doc.type}: ${doc.title}
Student: ${student.name}
Grade: ${student.grade}
Date: ${doc.issueDate}
Result: ${doc.gradeAverage}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.title.replace(/\s+/g, '_')}_${student.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (doc: ReportCard) => {
    if (navigator.share) {
      navigator.share({
        title: doc.title,
        text: `Check out ${student.name}'s ${doc.type}: ${doc.title}`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      showToast(`Sharing link for ${doc.title} copied to clipboard!`, 'success');
    }
  };

  const handlePublish = (doc: ReportCard) => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      showToast(`${doc.title} has been published to the student's Space!`, 'success');
      const updatedReports = reports.map(r => r.id === doc.id ? { ...r, status: 'Released' as const } : r);
      setReports(updatedReports);
      if (viewingDocument?.id === doc.id) {
        setViewingDocument({ ...viewingDocument, status: 'Released' as const });
      }
    }, 1500);
  };

  const getGradeColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-100';
    if (score >= 70) return 'text-fuchsia-600 bg-violet-50 border-violet-100';
    return 'text-rose-600 bg-red-50 border-red-100';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp size={14} className="text-green-500" />;
    if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  const filteredReports = reports.filter(r => 
    r.title.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
    r.type.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  const labels = {
    back: isRTL ? 'رجوع' : 'Back',
    overview: {
      gpa: isRTL ? 'المعدل التراكمي' : 'GPA',
      attendance: isRTL ? 'نسبة الحضور' : 'سجل الحضور',
      behavior: isRTL ? 'نقاط السلوك' : 'Behavior Pts'
    }
  };

  const totalFees = student.fees.reduce((sum, f) => sum + f.amount, 0);
  const paidFees = student.fees.filter(f => f.status === 'Paid').reduce((sum, f) => sum + f.amount, 0);

  const performanceData = [
    { subject: 'رياضيات', student: student.performance, average: 78 },
    { subject: 'علوم', student: Math.min(100, student.performance + 5), average: 80 },
    { subject: 'عربي', student: Math.max(50, student.performance - 5), average: 82 },
    { subject: 'إنجليزي', student: student.performance, average: 75 },
  ];

  if (viewMode === 'transcript-generator') {
    const transcript = student.transcript;
    
    if (!transcript) {
      return (
        <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
          <div className="flex justify-between items-center">
            <button onClick={() => setViewMode('profile')} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
              <ArrowLeft size={20} /> {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
            </button>
          </div>
          <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">No Transcript Data Available</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              This student does not have a multi-year academic history recorded in the system yet.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
        <div className="flex justify-between items-center">
          <button onClick={() => setViewMode('profile')} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
            <ArrowLeft size={20} /> {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
          </button>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex items-center gap-2" onClick={() => window.print()}>
              <Printer size={18} /> {isRTL ? 'طباعة' : 'Print'}
            </Button>
            <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200" onClick={() => setTranscriptSettings({...transcriptSettings, isOfficial: true})}>
              <Shield size={18} /> {isRTL ? 'إصدار نسخة رسمية' : 'Issue Official PDF'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">إعدادات المُصدر</h3>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-white transition-all" onClick={() => setTranscriptSettings({...transcriptSettings, includeQR: !transcriptSettings.includeQR})}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${transcriptSettings.includeQR ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                      {transcriptSettings.includeQR && <Check size={14} />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">تضمين رمز التحقق (QR)</span>
                  </div>
                  <QrCode size={18} className="text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-white transition-all" onClick={() => setTranscriptSettings({...transcriptSettings, displayGPA: !transcriptSettings.displayGPA})}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${transcriptSettings.displayGPA ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                      {transcriptSettings.displayGPA && <Check size={14} />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">عرض المعدل التراكمي</span>
                  </div>
                  <TrendingUp size={18} className="text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-white transition-all" onClick={() => setTranscriptSettings({...transcriptSettings, applySeal: !transcriptSettings.applySeal})}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${transcriptSettings.applySeal ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'}`}>
                      {transcriptSettings.applySeal && <Check size={14} />}
                    </div>
                    <span className="text-sm font-bold text-gray-700">إضافة ختم المدرسة</span>
                  </div>
                  <Award size={18} className="text-gray-400" />
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">ملاحظة أمنية</p>
                <div className="flex items-start gap-3 bg-violet-50 p-4 rounded-2xl border border-violet-100">
                  <AlertCircle size={18} className="text-violet-600 mt-0.5" />
                  <p className="text-xs text-violet-800 leading-relaxed font-medium">
                    تحتوي المعاينة الرقمية على علامة مائية. الشهادات الرسمية مزودة بتوقيع مشفر.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Preview */}
          <div className="lg:col-span-8">
            <div className="bg-white shadow-2xl rounded-sm border border-gray-200 min-h-[1100px] p-12 relative overflow-hidden font-serif text-gray-900 print:shadow-none print:border-none">
              {!transcriptSettings.isOfficial && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 overflow-hidden">
                  <div className="text-[120px] font-black text-gray-100/50 -rotate-45 uppercase tracking-[2rem] whitespace-nowrap">
                    Unofficial Preview
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-gray-900 pb-8 mb-10">
                <div className="flex items-center gap-6">
                  {transcriptSettings.applySeal ? (
                    <div className="w-24 h-24 bg-indigo-900 rounded-full flex items-center justify-center text-white shadow-xl">
                      <Award size={48} />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-full"></div>
                  )}
                  <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter"><span className="text-black">Talia</span><span className="text-violet-600">Learn</span> Academy</h1>
                    <p className="text-sm font-bold text-gray-500">السجل الأكاديمي الرسمي</p>
                    <p className="text-xs text-gray-400">123 Education St, Knowledge City</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">الطالب Bio</p>
                  <p className="text-xl font-black">{student.name}</p>
                  <p className="text-sm">تاريخ الميلاد: {student.dob || 'N/A'}</p>
                  <p className="text-sm">الرقم الجامعي: {student.id}</p>
                  <p className="text-sm">National الرقم الجامعي: {student.nationalId || 'N/A'}</p>
                  <p className="text-sm">تاريخ الالتحاق: {student.enrollmentDate || 'N/A'}</p>
                </div>
              </div>

              {/* Academic تاريخ */}
              <div className="space-y-10">
                {transcript?.years.map((year) => (
                  <div key={year.year}>
                    <div className="bg-gray-900 text-white px-4 py-2 flex justify-between items-center mb-4">
                      <span className="font-bold uppercase tracking-widest text-xs">العام الدراسي: {year.year}</span>
                      <span className="font-bold uppercase tracking-widest text-xs">{year.gradeLevel}</span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          <th className="pb-2 w-24">الرمز</th>
                          <th className="pb-2">اسم المقرر</th>
                          <th className="pb-2 text-center w-20">الساعات</th>
                          <th className="pb-2 text-center w-20">التقدير</th>
                          <th className="pb-2 text-right w-20">النقاط</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {year.courses.map((course) => (
                          <tr key={course.code} className="text-sm">
                            <td className="py-3 font-mono text-xs">{course.code}</td>
                            <td className="py-3 font-bold">{course.title}</td>
                            <td className="py-3 text-center">{course.credits.toFixed(1)}</td>
                            <td className="py-3 text-center font-bold">{course.grade}</td>
                            <td className="py-3 text-right font-mono">{course.points.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="mt-16 pt-8 border-t-2 border-gray-900">
                <div className="grid grid-cols-3 gap-8 mb-12">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">إجمالي الساعات</p>
                    <p className="text-2xl font-black">{transcript?.totalCreditsEarned} / {transcript?.requiredCredits}</p>
                  </div>
                  {transcriptSettings.displayGPA && (
                    <div className="text-center border-x border-gray-200">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">المعدل التراكمي</p>
                      <p className="text-4xl font-black text-indigo-900">{transcript?.cumulativeGPA}</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">الدرجة الممنوحة</p>
                    <p className="text-sm font-bold">{transcript?.degreeConferred}</p>
                    <p className="text-xs text-gray-500">{transcript?.conferredDate}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                        <Shield size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">توقيع رقمي</p>
                        <p className="text-sm font-serif italic text-gray-600">Registrar: Dr. Elias Vance</p>
                        <p className="text-[8px] font-mono text-gray-400">SHA-256: 8f3e...a1b2</p>
                      </div>
                    </div>
                    {transcriptSettings.includeQR && (
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-white border border-gray-200 p-1 flex items-center justify-center">
                          <QrCode size={64} className="text-gray-900" />
                        </div>
                        <div className="max-w-[150px]">
                          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">التحقق من صحة المستند</p>
                          <p className="text-[7px] text-gray-500 leading-tight">
                            Scan this code to verify document authenticity on our secure portal.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="w-48 border-b border-gray-900 mb-2"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">توقيع مدير المدرسة</p>
                    <p className="text-[8px] text-gray-400">Issued on: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'report-card') {
    const activeReport = reports.find(r => r.type === 'Report Card') || reports[0];
    
    return (
      <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
        <div className="flex justify-between items-center">
          <button onClick={() => setViewMode('profile')} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
            <ArrowLeft size={20} /> {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => handleDownload(activeReport)}>
              <Download size={18} /> {isRTL ? 'تحميل' : 'Download'}
            </Button>
            <Button variant="secondary" onClick={() => handleShare(activeReport)}>
              <Share2 size={18} /> {isRTL ? 'مشاركة' : 'Share'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden flex flex-col font-sans border border-gray-100 min-h-screen">
          {/* Digital Report Card Header */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 lg:p-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
              <div className="flex items-center gap-8">
                <div className="relative">
                  <img 
                    src={student.avatar || `https://ui-avatars.com/api/?name=${student.name}&background=9333ea&color=fff&size=128`} 
                    alt={student.name}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-3xl ring-4 ring-white/10 shadow-2xl"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full border-2 border-gray-800 shadow-lg">
                    تم الترفيع
                  </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tight mb-1">{student.name}</h2>
                  <p className="text-gray-400 font-medium text-lg">{student.grade} • {activeReport.academicYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">المعدل التراكمي العام</p>
                  <div className="flex items-center gap-2">
                    <span className="text-5xl font-black text-violet-400">{activeReport.gradeAverage}</span>
                    <div className="bg-violet-400/20 text-violet-400 p-1.5 rounded-xl">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                </div>
                <div className="h-16 w-px bg-white/10 mx-2"></div>
                <div className="flex flex-col gap-2">
                  {activeReport.status === 'Draft' ? (
                    <Button variant="primary" className="bg-violet-500 hover:bg-violet-600 border-none shadow-xl shadow-violet-500/30 px-8 py-3 rounded-2xl" onClick={() => handlePublish(activeReport)} disabled={isPublishing}>
                      {isPublishing ? 'جاري النشر...' : 'نشر في مساحة الطالب'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 bg-green-500/20 text-green-400 px-6 py-3 rounded-2xl border border-green-500/30 shadow-lg shadow-green-500/10">
                      <CheckCircle2 size={20} />
                      <span className="text-sm font-black uppercase tracking-widest">{isRTL ? 'تم الإصدار' : 'Released'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Ribbon */}
            <div className="mt-12 flex items-center gap-6 overflow-x-auto pb-4 no-scrollbar">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                <div key={q} className="flex items-center gap-6 shrink-0">
                  <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${activeReport.term === q ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-50'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 shadow-inner ${activeReport.term === q ? 'bg-violet-500 border-violet-500 text-white shadow-violet-400/50' : 'border-gray-600 text-gray-400'}`}>
                      {q}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{i === 0 ? 'الحالي' : 'قادم'}</span>
                  </div>
                  {i < 3 && <div className="w-16 h-0.5 bg-gray-700/50 rounded-full"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-12 bg-gray-50/30">
            {/* Main Content: Subject Cards */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">الأداء الأكاديمي</h3>
                <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-200"></div> Excellent</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-sm shadow-violet-200"></div> Meeting</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-200"></div> Attention</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeReport.subjectGrades?.map((sub) => (
                  <div key={sub.subject} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img src={sub.teacherAvatar} alt={sub.teacher} referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-50 shadow-sm" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                          <p className="text-lg font-black text-gray-900 leading-tight">{sub.subject}</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{sub.teacher}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-2xl border text-base font-black flex items-center gap-2 shadow-sm ${getGradeColor(sub.score)}`}>
                        {sub.grade}
                        {getTrendIcon(sub.trend)}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">مستوى الإتقان</span>
                        <span className="text-lg font-black text-gray-900">{sub.score}%</span>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${sub.score >= 90 ? 'bg-green-500' : sub.score >= 70 ? 'bg-violet-500' : 'bg-red-500'}`}
                          style={{ width: `${sub.score}%` }}
                        ></div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setExpandedSubject(expandedSubject === sub.subject ? null : sub.subject)}
                      className="w-full mt-6 pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] font-black text-gray-400 hover:text-violet-600 transition-colors uppercase tracking-widest"
                    >
                      تفاصيل الأداء
                      {expandedSubject === sub.subject ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {expandedSubject === sub.subject && (
                      <div className="mt-6 space-y-3 animate-fadeIn">
                        {sub.breakdown.map((item) => (
                          <div key={item.category} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-xs font-bold text-gray-600">{item.category}</span>
                            <span className="text-xs font-black text-gray-900">{item.score}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* الملاحظات السلوكية */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-inner">
                    <MessageSquare size={28} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 tracking-tight">ملاحظات المعلم</h4>
                    <p className="text-sm text-gray-400 font-medium">التقييم النوعي للربع {activeReport.term.replace('Q', '')}</p>
                  </div>
                </div>
                <div className="space-y-8 relative z-10">
                  <div className="relative">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">الملاحظات السلوكية</p>
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 italic text-gray-600 leading-relaxed text-lg">
                      "{activeReport.behavioralComments}"
                    </div>
                  </div>
                  <div className="p-6 bg-violet-50 rounded-3xl border border-violet-100 shadow-sm">
                    <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <TrendingUp size={16} /> خطوات التحسين القادمة
                    </p>
                    <p className="text-lg text-violet-900 font-bold leading-snug">{activeReport.nextSteps}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar: Insights & سجل الحضور */}
            <div className="space-y-8">
              {/* Skills Radar */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <h4 className="text-sm font-black text-gray-900 mb-8 uppercase tracking-widest text-center">توازن الكفاءات</h4>
                <div className="h-[250px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={activeReport.skills}>
                      <PolarGrid stroke="#f3f4f6" />
                      <PolarAngleAxis dataKey="category" tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 700}} />
                      <Radar name="الطالب" dataKey="score" stroke="#9333ea" fill="#9333ea" fillOpacity={0.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* سجل الحضور Heatmap Snapshot */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">سجل الحضور</h4>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">{activeReport.term}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="text-center p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-inner">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">الإجمالي</p>
                    <p className="text-2xl font-black text-gray-900">{activeReport.attendance?.totalDays}</p>
                  </div>
                  <div className="text-center p-4 bg-violet-50 rounded-3xl border border-violet-100 shadow-inner">
                    <p className="text-[10px] font-black text-rose-400 uppercase mb-1">غياب</p>
                    <p className="text-2xl font-black text-rose-600">{activeReport.attendance?.absences}</p>
                  </div>
                  <div className="text-center p-4 bg-fuchsia-50 rounded-3xl border border-fuchsia-100 shadow-inner">
                    <p className="text-[10px] font-black text-fuchsia-400 uppercase mb-1">تأخير</p>
                    <p className="text-2xl font-black text-fuchsia-600">{activeReport.attendance?.tardies}</p>
                  </div>
                </div>
                
                {/* Simplified Heatmap */}
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">نمط الحضور</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({length: 28}).map((_, i) => (
                    <div 
                      key={i} 
                      className={`aspect-square rounded-md shadow-sm ${
                        i === 12 || i === 18 ? 'bg-fuchsia-400' : 
                        i === 5 ? 'bg-violet-500' : 
                        'bg-violet-200'
                      }`}
                    ></div>
                  ))}
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <div className="flex gap-2.5">
                     <div className="w-3 h-3 rounded-full bg-green-100 shadow-sm"></div>
                     <div className="w-3 h-3 rounded-full bg-violet-400 shadow-sm"></div>
                     <div className="w-3 h-3 rounded-full bg-red-400 shadow-sm"></div>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">الأحد - الخميس</span>
                </div>
              </div>

              {/* Benchmark */}
              <div className="bg-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <h4 className="text-sm font-black mb-6 uppercase tracking-widest relative z-10">مؤشر الأداء الصفي</h4>
                <div className="space-y-6 relative z-10">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-indigo-300 font-medium">الطالب Rank</span>
                    <span className="text-3xl font-black">أفضل 5%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-indigo-400 w-[95%] rounded-full shadow-lg shadow-indigo-400/50"></div>
                  </div>
                  <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                    <AlertCircle size={18} className="text-indigo-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                      Performing significantly above the class average of 78%. Maintain current study habits for final exams.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action */}
              <Button variant="primary" className="w-full py-5 rounded-[2rem] bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-sm transition-all border-none">توقيع التقرير
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-10" dir="rtl">
      
      {/* Assign Modal */}
      
      {/* مراسلة Modal */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" dir="rtl">
            <h2 className="text-xl font-bold text-slate-800 mb-4">إرسال رسالة إلى {student.name}</h2>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[150px] mb-4 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="اكتب رسالتك هنا..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsMessageModalOpen(false)}
                className="px-6 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-bold"
              >
                إلغاء
              </button>
              <button 
                onClick={() => {
                  showToast('تم إرسال الرسالة بنجاح', 'success');
                  setIsMessageModalOpen(false);
                  setMessageContent('');
                }}
                className="px-6 py-2 rounded-xl text-white bg-violet-600 hover:bg-violet-700 transition-colors font-bold"
              >
                إرسال
              </button>
            </div>
          </div>
        </div>
      )}

      {isAssigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn p-6">
            <h3 className="font-bold text-xl mb-4 text-gray-900">Issue New Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-500"
                  value={newDocData.type}
                  onChange={(e) => setNewDocData({...newDocData, type: e.target.value as any})}
                >
                  <option value="Certificate">Certificate</option>
                  <option value="Report Card">Report Card</option>
                  <option value="Transcript">Transcript</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                <input 
                  type="text"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g., علوم Fair Winner"
                  value={newDocData.title}
                  onChange={(e) => setNewDocData({...newDocData, title: e.target.value})}
                />
              </div>
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grade / Score</label>
                <input 
                  type="text"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g., 95%"
                  value={newDocData.gradeAverage}
                  onChange={(e) => setNewDocData({...newDocData, gradeAverage: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setIsAssigning(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleAssign}>Issue</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
          <div className="w-full max-w-3xl relative animate-scaleIn">
             <div className="absolute -top-14 right-0 flex gap-4">
                <button onClick={() => handleDownload(viewingDocument)} className="text-white hover:text-violet-400 flex items-center gap-2 font-bold text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                  <Download size={18} /> DOWNLOAD
                </button>
                <button onClick={() => handleShare(viewingDocument)} className="text-white hover:text-violet-400 flex items-center gap-2 font-bold text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                  <Share2 size={18} /> SHARE
                </button>
                <button onClick={() => setViewingDocument(null)} className="text-white hover:text-rose-400 flex items-center gap-2 font-bold text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                  <X size={18} /> CLOSE
                </button>
             </div>

             {viewingDocument.type === 'Certificate' ? (
               <div className="bg-[#fffdf5] p-12 rounded-lg shadow-2xl border-[16px] border-double border-[#b45309] text-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-32 h-32 bg-violet-100 rounded-full blur-3xl opacity-50"></div>
                 <h1 className="text-5xl font-serif text-[#78350f] mb-4">Certificate of Achievement</h1>
                 <p className="font-serif text-lg text-[#92400e] italic mb-8">Proudly Presented To</p>
                 <h2 className="text-4xl font-bold text-gray-900 border-b-2 border-[#d97706] inline-block pb-2 mb-8 px-10">{student.name}</h2>
                 <p className="text-gray-600 mb-2">For outstanding performance in</p>
                 <h3 className="text-2xl font-bold text-[#b45309]">{viewingDocument.title}</h3>
                 <div className="mt-12 flex justify-between px-10">
                    <div className="text-center"><div className="border-t border-[#78350f] w-32 pt-2">Principal</div></div>
                    <div className="text-center"><div className="border-t border-[#78350f] w-32 pt-2">{viewingDocument.issueDate}</div></div>
                 </div>
               </div>
             ) : viewingDocument.type === 'Report Card' && viewingDocument.subjectGrades ? (
                <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col font-sans border border-gray-100 max-h-[90vh] overflow-y-auto">
                  {/* Digital Report Card Header */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <img 
                            src={student.avatar || `https://ui-avatars.com/api/?name=${student.name}&background=9333ea&color=fff&size=128`} 
                            alt={student.name}
                            referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-2xl ring-4 ring-white/10"
                          />
                          <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-gray-800">
                            تم الترفيع
                          </div>
                        </div>
                        <div>
                          <h2 className="text-3xl font-black tracking-tight">{student.name}</h2>
                          <p className="text-gray-400 font-medium">{student.grade} • {viewingDocument.academicYear}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">المعدل التراكمي العام</p>
                          <div className="flex items-center gap-2">
                            <span className="text-4xl font-black text-violet-400">{viewingDocument.gradeAverage}</span>
                            <div className="bg-violet-400/20 text-violet-400 p-1 rounded-lg">
                              <TrendingUp size={16} />
                            </div>
                          </div>
                        </div>
                        <div className="h-12 w-px bg-white/10 mx-2"></div>
                        <div className="flex flex-col gap-2">
                          {viewingDocument.status === 'Draft' ? (
                            <Button variant="primary" className="bg-violet-500 hover:bg-violet-600 border-none shadow-lg shadow-violet-500/20" onClick={() => handlePublish(viewingDocument)} disabled={isPublishing}>
                              {isPublishing ? 'جاري النشر...' : 'نشر في مساحة الطالب'}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-xl border border-green-500/30">
                              <CheckCircle2 size={16} />
                              <span className="text-sm font-bold uppercase tracking-wider">{isRTL ? 'تم الإصدار' : 'Released'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Ribbon */}
                    <div className="mt-10 flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                        <div key={q} className="flex items-center gap-4 shrink-0">
                          <div className={`flex flex-col items-center gap-2 ${viewingDocument.term === q ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${viewingDocument.term === q ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-600 text-gray-400'}`}>
                              {q}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">{i === 0 ? 'الحالي' : 'قادم'}</span>
                          </div>
                          {i < 3 && <div className="w-12 h-0.5 bg-gray-700"></div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-gray-50/50">
                    {/* Main Content: Subject Cards */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">الأداء الأكاديمي</h3>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Excellent</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500"></div> Meeting</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Attention</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {viewingDocument.subjectGrades.map((sub) => (
                          <div key={sub.subject} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                <img src={sub.teacherAvatar} alt={sub.teacher} referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover ring-2 ring-gray-50" />
                                <div>
                                  <p className="text-sm font-black text-gray-900">{sub.subject}</p>
                                  <p className="text-[10px] text-gray-400 font-medium">{sub.teacher}</p>
                                </div>
                              </div>
                              <div className={`px-3 py-1 rounded-xl border text-sm font-black flex items-center gap-1.5 ${getGradeColor(sub.score)}`}>
                                {sub.grade}
                                {getTrendIcon(sub.trend)}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-end">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</span>
                                <span className="text-sm font-black text-gray-900">{sub.score}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${sub.score >= 90 ? 'bg-green-500' : sub.score >= 70 ? 'bg-violet-500' : 'bg-red-500'}`}
                                  style={{ width: `${sub.score}%` }}
                                ></div>
                              </div>
                            </div>

                            <button 
                              onClick={() => setExpandedSubject(expandedSubject === sub.subject ? null : sub.subject)}
                              className="w-full mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] font-bold text-gray-400 hover:text-violet-600 transition-colors uppercase tracking-widest"
                            >
                              تفاصيل الأداء
                              {expandedSubject === sub.subject ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>

                            {expandedSubject === sub.subject && (
                              <div className="mt-4 space-y-2 animate-fadeIn">
                                {sub.breakdown.map((item) => (
                                  <div key={item.category} className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                                    <span className="text-xs font-medium text-gray-600">{item.category}</span>
                                    <span className="text-xs font-bold text-gray-900">{item.score}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* الملاحظات السلوكية */}
                      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                            <MessageSquare size={20} />
                          </div>
                          <h4 className="text-lg font-black text-gray-900 tracking-tight">ملاحظات المعلم</h4>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">الملاحظات السلوكية</p>
                            <p className="text-gray-600 leading-relaxed italic">"{viewingDocument.behavioralComments}"</p>
                          </div>
                          <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100">
                            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <TrendingUp size={14} /> خطوات التحسين القادمة
                            </p>
                            <p className="text-sm text-violet-800 font-medium">{viewingDocument.nextSteps}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sidebar: Insights & سجل الحضور */}
                    <div className="space-y-8">
                      {/* Skills Radar */}
                      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                        <h4 className="text-sm font-black text-gray-900 mb-6 uppercase tracking-widest">توازن الكفاءات</h4>
                        <div className="h-[200px] w-full" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={viewingDocument.skills}>
                              <PolarGrid stroke="#f3f4f6" />
                              <PolarAngleAxis dataKey="category" tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 600}} />
                              <Radar name="الطالب" dataKey="score" stroke="#9333ea" fill="#9333ea" fillOpacity={0.6} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* سجل الحضور Heatmap Snapshot */}
                      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">سجل الحضور</h4>
                          <span className="text-[10px] font-bold text-gray-400">{viewingDocument.term} Snapshot</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                          <div className="text-center p-2 bg-gray-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">الإجمالي</p>
                            <p className="text-lg font-black text-gray-900">{viewingDocument.attendance?.totalDays}</p>
                          </div>
                          <div className="text-center p-2 bg-rose-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">غياب</p>
                            <p className="text-lg font-black text-rose-600">{viewingDocument.attendance?.absences}</p>
                          </div>
                          <div className="text-center p-2 bg-fuchsia-50 rounded-2xl">
                            <p className="text-[10px] font-bold text-fuchsia-400 uppercase mb-1">تأخير</p>
                            <p className="text-lg font-black text-fuchsia-600">{viewingDocument.attendance?.tardies}</p>
                          </div>
                        </div>
                        
                        {/* Simplified Heatmap */}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">نمط الحضور</p>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({length: 28}).map((_, i) => (
                            <div 
                              key={i} 
                              className={`aspect-square rounded-sm ${
                                i === 12 || i === 18 ? 'bg-fuchsia-400' : 
                        i === 5 ? 'bg-violet-500' : 
                        'bg-violet-200'
                              }`}
                            ></div>
                          ))}
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                          <div className="flex gap-2">
                             <div className="w-2 h-2 rounded-full bg-green-100"></div>
                             <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                             <div className="w-2 h-2 rounded-full bg-red-400"></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400">الأحد - الخميس</span>
                        </div>
                      </div>

                      {/* Benchmark */}
                      <div className="bg-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                        <h4 className="text-sm font-black mb-4 uppercase tracking-widest relative z-10">مؤشر الأداء الصفي</h4>
                        <div className="space-y-4 relative z-10">
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-indigo-300">الطالب Rank</span>
                            <span className="text-xl font-black">أفضل 5%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 w-[95%] rounded-full"></div>
                          </div>
                          <p className="text-[10px] text-indigo-300 leading-relaxed">
                            Performing significantly above the class average of 78%.
                          </p>
                        </div>
                      </div>

                      {/* Action */}
                      <Button variant="primary" className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest text-xs transition-all border-none">توقيع التقرير
                      </Button>
                    </div>
                  </div>
                </div>
             ) : viewingDocument.type === 'Transcript' ? (
                <div className="bg-white rounded-lg shadow-2xl overflow-hidden min-h-[600px] flex flex-col font-sans">
                  <div className="bg-indigo-900 text-white p-8 flex justify-between items-center">
                    <div>
                      <h2 className="text-3xl font-black tracking-tighter uppercase italic">Official Transcript</h2>
                      <p className="text-indigo-200 text-sm">Academic Record of Excellence</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold"><span className="text-black">Talia</span><span className="text-violet-600">Learn</span> Academy</p>
                      <p className="text-xs opacity-70 italic">Verified Document الرقم الجامعي: {viewingDocument.id}</p>
                    </div>
                  </div>
                  <div className="p-10 flex-1">
                    <div className="grid grid-cols-2 gap-8 mb-10 border-b border-gray-100 pb-8">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">الطالب Information</p>
                        <p className="text-xl font-bold text-gray-900">{student.name}</p>
                        <p className="text-sm text-gray-500">الطالب الرقم الجامعي: {student.id}</p>
                        <p className="text-sm text-gray-500">Current Grade: {student.grade}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Academic Summary</p>
                        <p className="text-xl font-bold text-indigo-600">GPA: {viewingDocument.gradeAverage}</p>
                        <p className="text-sm text-gray-500">Year: {viewingDocument.academicYear}</p>
                        <p className="text-sm text-gray-500">Issued: {viewingDocument.issueDate}</p>
                      </div>
                    </div>

                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                          <th className="pb-4">اسم المقرر</th>
                          <th className="pb-4">الساعات</th>
                          <th className="pb-4">التقدير</th>
                          <th className="pb-4 text-right">النقاط</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          { subject: 'الرياضيات المتقدمة', credits: 4, grade: 'A', points: 4.0 },
                          { subject: 'الفيزياء 2', credits: 4, grade: 'A-', points: 3.7 },
                          { subject: 'الأدب الإنجليزي', credits: 3, grade: 'B+', points: 3.3 },
                          { subject: 'تاريخ العالم', credits: 3, grade: 'A', points: 4.0 },
                          { subject: 'علوم الحاسب', credits: 4, grade: 'A+', points: 4.0 },
                          { subject: 'التربية البدنية', credits: 1, grade: 'P', points: '--' },
                        ].map((row, i) => (
                          <tr key={i} className="text-sm">
                            <td className="py-4 font-bold text-gray-800">{row.subject}</td>
                            <td className="py-4 text-gray-500">{row.credits}</td>
                            <td className="py-4 font-mono font-bold text-indigo-600">{row.grade}</td>
                            <td className="py-4 text-right font-mono">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-gray-50 p-8 border-t border-gray-200 flex justify-between items-center italic text-xs text-gray-400">
                    <p>This is an official document generated by the أكاديمية تاليا 360 الطالب Information System.</p>
                    <div className="w-16 h-16 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-300">
                      <Award size={32} />
                    </div>
                  </div>
                </div>
             ) : (
               <div className="bg-white rounded-lg shadow-2xl overflow-hidden min-h-[500px] flex flex-col">
                 <div className="bg-gray-900 text-white p-6 flex justify-between">
                   <h2 className="text-2xl font-bold"><span>Talia</span><span className="text-violet-500">Learn</span> Academy</h2>
                   <div className="text-right"><p className="text-sm opacity-70">Official Report</p><p>{viewingDocument.academicYear}</p></div>
                 </div>
                 <div className="p-8 flex-1">
                    <h3 className="text-xl font-bold mb-4">{student.name} <span className="text-gray-400 text-sm font-normal">| {student.grade}</span></h3>
                    <table className="w-full text-left mb-6">
                      <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500">
                        <tr><th className="p-3">Subject</th><th className="p-3">التقدير</th><th className="p-3">Remarks</th></tr>
                      </thead>
                      <tbody>
                        <tr><td className="p-3 font-bold">رياضيات</td><td className="p-3">A</td><td className="p-3 text-sm text-gray-500">Excellent</td></tr>
                        <tr><td className="p-3 font-bold">علوم</td><td className="p-3">A-</td><td className="p-3 text-sm text-gray-500">Very Good</td></tr>
                        <tr><td className="p-3 font-bold">تاريخ</td><td className="p-3">B+</td><td className="p-3 text-sm text-gray-500">Good</td></tr>
                      </tbody>
                    </table>
                 </div>
                 <div className="bg-gray-50 p-6 flex justify-between items-center border-t border-gray-200">
                   <span className="font-bold text-gray-500 uppercase text-xs">المعدل التراكمي العام</span>
                   <span className="text-3xl font-bold text-violet-600">{viewingDocument.gradeAverage}</span>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
        <ArrowLeft size={20} /> {labels.back}
      </button>

      {/* Main Profile Header */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
        {/* RIGHT SIDE (Avatar + Name) */}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
             <img 
                src={student.avatar || `https://ui-avatars.com/api/?name=${student.name}&background=9333ea&color=fff&size=128`} 
                alt={student.name}
                referrerPolicy="no-referrer"
                className="w-32 h-32 rounded-full ring-4 ring-violet-50 object-cover"
             />
             <span className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-white ${student.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          </div>
          <div className="text-center md:text-start space-y-2">
             <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{student.name}</h1>
             <p className="text-lg text-gray-500 font-medium">{student.id} • {student.grade}</p>
          </div>
        </div>
        
        {/* LEFT SIDE (Stats + Buttons) */}
        <div className="flex flex-col items-center md:items-end gap-6 w-full md:w-auto">
          <div className="flex gap-8">
             <div className="text-center">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
                 <CalendarDays size={14} /> {labels.overview.attendance}
               </p>
               <p className="text-3xl font-black text-gray-900">{student.attendance}%</p>
             </div>
             <div className="text-center">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-center gap-1">
                 <Award size={14} /> {labels.overview.gpa}
               </p>
               <p className="text-3xl font-black text-violet-600">{(student.performance / 25).toFixed(2)}</p>
             </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center md:justify-end">
             <Button variant="primary" className="px-6 py-2 text-xs bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 border-none text-white rounded-xl" onClick={() => setViewMode('report-card')}>
               <FileText size={16} /> {isRTL ? 'التقرير الدراسي' : 'Report Card'}
             </Button>
             <Button variant="secondary" className="px-6 py-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm rounded-xl" onClick={() => setViewMode('transcript-generator')}>
               <Award size={16} /> {isRTL ? 'السجل الأكاديمي' : 'Transcript'}
             </Button>
             <Button variant="secondary" className="px-4 py-2 text-xs shadow-sm bg-white border border-gray-200 rounded-xl" onClick={() => setIsMessageModalOpen(true)}>
               <MessageSquare size={16} /> مراسلة
             </Button>
             <Button variant="secondary" className="px-4 py-2 text-xs shadow-sm bg-white border border-gray-200 rounded-xl" onClick={() => onEditProfile?.(student.id)}>
               <Edit size={16} /> تعديل الملف
             </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Academic Chart */}
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg text-gray-900 mb-6">الأداء الأكاديمي</h3>
            <div className="h-[300px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} barGap={12}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                  <Tooltip cursor={{fill: '#fff7ed'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Legend />
                  <Bar name="الطالب" dataKey="student" fill="#9333ea" radius={[6, 6, 0, 0]} barSize={32} />
                  <Bar name="المتوسط" dataKey="average" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* المستندات */}
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-gray-900">المستندات</h3>
               <div className="flex gap-2">
                  <button onClick={() => setIsAssigning(true)} className="text-violet-600 hover:bg-violet-50 p-2 rounded-full transition-colors">
                    <Plus size={20} />
                  </button>
               </div>
            </div>

            <div className="relative mb-4">
               <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} size={14} />
               <input 
                 type="text"
                 placeholder={isRTL ? 'بحث...' : 'Search docs...'}
                 className={`w-full bg-gray-50 border border-gray-100 rounded-xl py-2 ${isRTL ? 'pr-9' : 'pl-9'} pr-4 text-xs outline-none focus:ring-2 focus:ring-violet-500`}
                 value={docSearchQuery}
                 onChange={(e) => setDocSearchQuery(e.target.value)}
               />
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
               {filteredReports.map(r => (
                 <div key={r.id} className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md hover:scale-[1.02] transition-all border border-transparent hover:border-gray-100 cursor-pointer" 
                   onClick={() => {
                     if (r.type === 'Report Card') {
                       setViewMode('report-card');
                     } else if (r.type === 'Transcript') {
                       setViewMode('transcript-generator');
                     } else {
                       setViewingDocument(r);
                     }
                   }}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      r.type === 'Certificate' ? 'bg-violet-100 text-violet-600' : 
                      r.type === 'Transcript' ? 'bg-indigo-100 text-indigo-600' : 
                      'bg-blue-100 text-blue-600'
                    }`}>
                       {r.type === 'Certificate' ? <Award size={24} /> : 
                        r.type === 'Transcript' ? <FileText size={24} /> : 
                        <FileText size={24} />}
                    </div>
                    <div className="flex-1">
                       <p className="font-bold text-gray-900 text-sm">{r.title}</p>
                       <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.type === 'Certificate' ? 'bg-violet-50 text-violet-700' : 
                            r.type === 'Transcript' ? 'bg-indigo-50 text-indigo-700' : 
                            'bg-blue-50 text-blue-700'
                          }`}>{r.type}</span>
                          <p className="text-[10px] text-gray-400">{r.issueDate}</p>
                       </div>
                    </div>
                 </div>
               ))}
               {filteredReports.length === 0 && (
                 <div className="text-center py-8 text-gray-400 text-sm italic">No documents found</div>
               )}
            </div>
         </div>
      </div>

      {/* Fees */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 w-full">
         <div className="flex justify-between items-end mb-8 relative z-10">
            <div>
               <p className="text-sm text-slate-500 font-medium mb-1">الحالة المالية</p>
               <h3 className="text-2xl font-bold text-slate-800">الرسوم الدراسية</h3>
            </div>
            <div className="text-right">
               <p className="text-slate-400 text-xs uppercase mb-1">المتبقي</p>
               <p className="text-4xl font-extrabold text-violet-700">
                  {new Intl.NumberFormat(isRTL ? 'ar-LY' : 'en-LY', { style: 'currency', currency: 'LYD' }).format(totalFees - paidFees)}
               </p>
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
            {student.installmentPlans?.[0]?.installments.map((ins, i) => (
               <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="flex justify-between items-center text-sm mb-3">
                     <span className="text-slate-500 font-medium">قسط {i+1}</span>
                     <span className={ins.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full text-sm inline-block w-fit' : 'bg-violet-50 text-violet-700 font-bold px-3 py-1 rounded-full text-sm inline-block w-fit'}>{ins.status === 'Paid' ? (isRTL ? 'مدفوع' : 'Paid') : ins.status === 'Pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') : ins.status}</span>
                  </div>
                  <p className="font-mono text-xl font-bold text-slate-800">{new Intl.NumberFormat(isRTL ? 'ar-LY' : 'en-LY', {style: 'currency', currency: 'LYD'}).format(ins.amount)}</p>
                  <p className="text-sm text-slate-500 mt-1">{ins.dueDate}</p>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};
