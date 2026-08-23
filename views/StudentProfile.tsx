import React, { useState, useEffect } from 'react';
import { Student, Language, ReportCard } from '../types';
import { 
  getStudentGrades, StudentSubjectGrade, getTerms, getStudentAttendanceForTerm, getSchoolSettings, SchoolSettings, getStudentTranscript, StudentTranscript,
  getMessagesLog, addMessageLog, StudentMessageLog, updateStudent,
  getMedicalInfo, updateMedicalInfo, StudentMedicalInfo, getClinicVisits, addClinicVisit, deleteClinicVisit, ClinicVisit,
  getBehaviorIncidents, addBehaviorIncident, deleteBehaviorIncident, BehaviorIncident,
  getAdminActions, addAdminAction, deleteAdminAction, AdminAction,
  getWarnings, addWarning, StudentWarning,
  getGuardianSummons, addGuardianSummon, GuardianSummon,
  getStudentAttendanceSummary, StudentAttendanceSummary,
} from '../services/supabaseData';
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
  Check,
  Printer
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
  const [subjectGrades, setSubjectGrades] = useState<StudentSubjectGrade[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  useEffect(() => {
    setIsLoadingGrades(true);
    getStudentGrades(student.id, student.grade).then((grades) => {
      setSubjectGrades(grades);
      setIsLoadingGrades(false);
    });
  }, [student.id, student.grade]);

  const gradedSubjects = subjectGrades.filter((s) => s.grade !== null);
  const overallAverage = gradedSubjects.length > 0
    ? Math.round(gradedSubjects.reduce((sum, s) => sum + (s.grade || 0), 0) / gradedSubjects.length)
    : null;

  const [reportTerms, setReportTerms] = useState<{ id: string; name: string; startDate: string; endDate: string; status: string }[]>([]);
  const [reportTermId, setReportTermId] = useState<string | null>(null);
  const [reportSubjectGrades, setReportSubjectGrades] = useState<StudentSubjectGrade[]>([]);
  const [reportAttendance, setReportAttendance] = useState(0);
  const [schoolBranding, setSchoolBranding] = useState<SchoolSettings | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);

  useEffect(() => {
    getTerms().then((terms) => {
      setReportTerms(terms);
      if (terms.length > 0) setReportTermId(terms[terms.length - 1].id);
    });
    getSchoolSettings().then(setSchoolBranding);
  }, []);

  useEffect(() => {
    if (!reportTermId) return;
    const term = reportTerms.find((t) => t.id === reportTermId);
    if (!term) return;
    setIsLoadingReport(true);
    Promise.all([
      getStudentGrades(student.id, student.grade, reportTermId),
      getStudentAttendanceForTerm(student.id, term.startDate, term.endDate),
    ]).then(([grades, attendance]) => {
      setReportSubjectGrades(grades);
      setReportAttendance(attendance);
      setIsLoadingReport(false);
    });
  }, [reportTermId, reportTerms, student.id, student.grade]);

  const reportGraded = reportSubjectGrades.filter((s) => s.grade !== null);
  const reportOverallAverage = reportGraded.length > 0
    ? Math.round(reportGraded.reduce((sum, s) => sum + (s.grade || 0), 0) / reportGraded.length)
    : null;

  const [transcript, setTranscript] = useState<StudentTranscript | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(true);
  useEffect(() => {
    setIsLoadingTranscript(true);
    getStudentTranscript(student.id, student.grade).then((t) => {
      setTranscript(t);
      setIsLoadingTranscript(false);
    });
  }, [student.id, student.grade]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newDocData, setNewDocData] = useState({
    title: '',
    type: 'Certificate' as ReportCard['type'],
    gradeAverage: '',
    academicYear: '2023-2024'
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(true);

  // ============ التابات: البيانات الأساسية | الطبية | الأكاديمي | السلوكي | التواصل | الإجراءات الإدارية | الحضور ============
  const [activeSection, setActiveSection] = useState<'basic' | 'medical' | 'academic' | 'behavioral' | 'communication' | 'admin' | 'attendance'>('academic');
  const currentUserName = isRTL ? 'المشرف' : 'Admin';

  // عنصر مساعد: يعرض القيمة للقراءة، أو حقل إدخال واضح للتعديل — بيتكرر في كل أقسام البيانات الأساسية والطبية
  const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; editing: boolean; type?: string; full?: boolean; options?: string[] }> = ({ label, value, onChange, editing, type = 'text', full, options }) => (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {editing ? (
        options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">{isRTL ? 'اختاري...' : 'Select...'}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
        )
      ) : (
        <p className="font-bold text-gray-900">{value || '—'}</p>
      )}
    </div>
  );

  const NATIONALITIES = ['Egyptian', 'American', 'British', 'Canadian', 'Australian', 'French', 'German', 'Other'];
  const YES_NO = ['Yes', 'No'];
  const GRADE_LEVELS_LIST = ['FS1', 'FS2', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];

  // ---- تعديل البيانات الأساسية ----
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [basicDraft, setBasicDraft] = useState({
    identityInfo: { ...student.identityInfo },
    fatherInfo: { ...student.fatherInfo },
    motherInfo: { ...student.motherInfo },
    legalGuardian: student.legalGuardian || '',
    guardianRelationship: student.guardianRelationship || '',
    emergencyContact1: { ...student.emergencyContact1 },
    emergencyContact2: { ...student.emergencyContact2 },
    homeAddress: { ...student.homeAddress },
    additionalInfo: { ...student.additionalInfo },
    dob: student.dob || '',
    nationalId: student.nationalId || '',
    enrollmentDate: student.enrollmentDate || '',
  });
  const [isSavingBasic, setIsSavingBasic] = useState(false);

  const handleSaveBasicInfo = async () => {
    setIsSavingBasic(true);
    const ok = await updateStudent({
      studentId: student.id,
      userId: (student as any).userId,
      name: student.name,
      grade: student.grade,
      dob: basicDraft.dob,
      status: student.status,
      fatherInfo: basicDraft.fatherInfo,
      motherInfo: basicDraft.motherInfo,
      legalGuardian: basicDraft.legalGuardian,
      guardianRelationship: basicDraft.guardianRelationship,
      identityInfo: basicDraft.identityInfo,
      emergencyContact1: basicDraft.emergencyContact1,
      emergencyContact2: basicDraft.emergencyContact2,
      homeAddress: basicDraft.homeAddress,
      additionalInfo: basicDraft.additionalInfo,
    });
    setIsSavingBasic(false);
    if (ok) {
      setIsEditingBasic(false);
      showToast(isRTL ? 'تم حفظ البيانات.' : 'Information saved.', 'success');
    } else {
      showToast(isRTL ? 'حصل خطأ أثناء الحفظ.' : 'Error saving.', 'error');
    }
  };

  // ---- الملف الطبي ----
  const [medicalInfo, setMedicalInfo] = useState<StudentMedicalInfo>({ bloodType: '', allergies: '', chronicConditions: '', doctorName: '', doctorPhone: '', insuranceProvider: '', insuranceNumber: '' });
  const [isLoadingMedical, setIsLoadingMedical] = useState(true);
  const [isSavingMedical, setIsSavingMedical] = useState(false);
  const [clinicVisits, setClinicVisits] = useState<ClinicVisit[]>([]);
  const [newVisit, setNewVisit] = useState({ visitDate: '', reason: '', notes: '' });
  const [isAddingVisit, setIsAddingVisit] = useState(false);

  const refreshMedical = () => {
    setIsLoadingMedical(true);
    Promise.all([getMedicalInfo(student.id), getClinicVisits(student.id)]).then(([info, visits]) => {
      if (info) setMedicalInfo(info);
      setClinicVisits(visits);
      setIsLoadingMedical(false);
    });
  };
  useEffect(() => { refreshMedical(); }, [student.id]);

  const handleSaveMedical = async () => {
    setIsSavingMedical(true);
    const ok = await updateMedicalInfo(student.id, medicalInfo);
    setIsSavingMedical(false);
    showToast(ok ? (isRTL ? 'تم حفظ الملف الطبي.' : 'Medical file saved.') : (isRTL ? 'حصل خطأ.' : 'Error.'), ok ? 'success' : 'error');
  };

  const handleAddVisit = async () => {
    if (!newVisit.visitDate) return;
    const ok = await addClinicVisit(student.id, { ...newVisit, recordedBy: currentUserName });
    if (ok) {
      setNewVisit({ visitDate: '', reason: '', notes: '' });
      setIsAddingVisit(false);
      refreshMedical();
      showToast(isRTL ? 'تم تسجيل الزيارة.' : 'Visit recorded.', 'success');
    }
  };

  const handleDeleteVisit = async (id: string) => {
    const ok = await deleteClinicVisit(id);
    if (ok) refreshMedical();
  };

  // ---- السجل السلوكي الهيكلي ----
  const [behaviorIncidents, setBehaviorIncidents] = useState<BehaviorIncident[]>([]);
  const [isLoadingBehavior, setIsLoadingBehavior] = useState(true);
  const [isAddingIncident, setIsAddingIncident] = useState(false);
  const [newIncident, setNewIncident] = useState({ incidentDate: '', incidentTime: '', problemTitle: '', description: '', actionTaken: '' });
  const [isSavingIncident, setIsSavingIncident] = useState(false);

  const refreshBehaviorIncidents = () => {
    setIsLoadingBehavior(true);
    getBehaviorIncidents(student.id).then((rows) => { setBehaviorIncidents(rows); setIsLoadingBehavior(false); });
  };
  useEffect(() => { refreshBehaviorIncidents(); }, [student.id]);

  const handleAddIncident = async () => {
    if (!newIncident.incidentDate || !newIncident.problemTitle.trim()) return;
    setIsSavingIncident(true);
    const ok = await addBehaviorIncident(student.id, { ...newIncident, recordedBy: currentUserName });
    setIsSavingIncident(false);
    if (ok) {
      setNewIncident({ incidentDate: '', incidentTime: '', problemTitle: '', description: '', actionTaken: '' });
      setIsAddingIncident(false);
      refreshBehaviorIncidents();
      showToast(isRTL ? 'تم تسجيل الواقعة.' : 'Incident recorded.', 'success');
    } else {
      showToast(isRTL ? 'حصل خطأ أثناء الحفظ.' : 'Error saving.', 'error');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    const ok = await deleteBehaviorIncident(id);
    if (ok) refreshBehaviorIncidents();
  };

  // ---- الإجراءات الإدارية + استدعاء ولي الأمر ----
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [guardianSummons, setGuardianSummons] = useState<GuardianSummon[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [newAction, setNewAction] = useState({ actionDate: '', actionType: '', reason: '' });
  const [isAddingSummon, setIsAddingSummon] = useState(false);
  const [newSummon, setNewSummon] = useState({ summonDate: '', reason: '', outcome: '' });

  const refreshAdminTab = () => {
    setIsLoadingAdmin(true);
    Promise.all([getAdminActions(student.id), getGuardianSummons(student.id)]).then(([actions, summons]) => {
      setAdminActions(actions);
      setGuardianSummons(summons);
      setIsLoadingAdmin(false);
    });
  };
  useEffect(() => { refreshAdminTab(); }, [student.id]);

  const handleAddAdminAction = async () => {
    if (!newAction.actionDate || !newAction.actionType.trim()) return;
    const ok = await addAdminAction(student.id, { ...newAction, issuedBy: currentUserName });
    if (ok) {
      setNewAction({ actionDate: '', actionType: '', reason: '' });
      setIsAddingAction(false);
      refreshAdminTab();
      showToast(isRTL ? 'تم تسجيل الإجراء.' : 'Action recorded.', 'success');
    }
  };

  const handleDeleteAdminAction = async (id: string) => {
    const ok = await deleteAdminAction(id);
    if (ok) refreshAdminTab();
  };

  const handleAddSummon = async () => {
    if (!newSummon.summonDate) return;
    const ok = await addGuardianSummon(student.id, { ...newSummon, attendedBy: currentUserName });
    if (ok) {
      setNewSummon({ summonDate: '', reason: '', outcome: '' });
      setIsAddingSummon(false);
      refreshAdminTab();
      showToast(isRTL ? 'تم تسجيل الاستدعاء.' : 'Summon recorded.', 'success');
    }
  };

  // ---- الحضور والإنذارات ----
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary>({ attendanceRate: 0, absentCount: 0, lateCount: 0, totalSessions: 0 });
  const [warnings, setWarnings] = useState<StudentWarning[]>([]);
  const [isLoadingAttendanceTab, setIsLoadingAttendanceTab] = useState(true);
  const [isAddingWarning, setIsAddingWarning] = useState(false);
  const [newWarning, setNewWarning] = useState({ warningDate: '', reason: '' });

  const refreshAttendanceTab = () => {
    setIsLoadingAttendanceTab(true);
    Promise.all([getStudentAttendanceSummary(student.id), getWarnings(student.id)]).then(([summary, w]) => {
      setAttendanceSummary(summary);
      setWarnings(w);
      setIsLoadingAttendanceTab(false);
    });
  };
  useEffect(() => { refreshAttendanceTab(); }, [student.id]);

  const handleAddWarning = async () => {
    if (!newWarning.warningDate || !newWarning.reason.trim()) return;
    const ok = await addWarning(student.id, { ...newWarning, issuedBy: currentUserName });
    if (ok) {
      setNewWarning({ warningDate: '', reason: '' });
      setIsAddingWarning(false);
      refreshAttendanceTab();
      showToast(isRTL ? 'تم إصدار الإنذار.' : 'Warning issued.', 'success');
    }
  };

  const [messagesLog, setMessagesLog] = useState<StudentMessageLog[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageContent, setMessageContent] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const refreshMessagesLog = () => {
    setIsLoadingMessages(true);
    getMessagesLog(student.id).then((msgs) => { setMessagesLog(msgs); setIsLoadingMessages(false); });
  };
  useEffect(() => { refreshMessagesLog(); }, [student.id]);

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;
    setIsSendingMessage(true);
    const ok = await addMessageLog(student.id, { senderName: isRTL ? 'المشرف' : 'Admin', content: messageContent.trim() });
    setIsSendingMessage(false);
    if (ok) {
      setMessageContent('');
      refreshMessagesLog();
      showToast(isRTL ? 'تم حفظ الرسالة في السجل.' : 'Message saved to log.', 'success');
    } else {
      showToast(isRTL ? 'حصل خطأ أثناء الحفظ.' : 'Error saving.', 'error');
    }
  };


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

  if (viewMode === 'transcript-generator') {
    return (
      <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-transcript, .printable-transcript * { visibility: visible; }
            .printable-transcript { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
          }
        `}</style>
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setViewMode('profile')} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
            <ArrowLeft size={20} /> {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
          </button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={18} /> {isRTL ? 'طباعة' : 'Print'}
          </Button>
        </div>

        <div className="printable-transcript bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 p-10 lg:p-14">
          {/* Header بهوية المدرسة */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-8 mb-8">
            <div className="flex items-center gap-4">
              {schoolBranding?.logoUrl && <img src={schoolBranding.logoUrl} alt="Logo" className="h-14 object-contain" />}
              <div>
                <h2 className="text-xl font-black text-gray-900">{schoolBranding?.schoolName || (isRTL ? 'اسم المدرسة' : 'School Name')}</h2>
                <p className="text-sm text-gray-400">{isRTL ? 'السجل الأكاديمي الشامل' : 'Academic Transcript'}</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-gray-900">{student.name}</p>
              <p className="text-sm text-gray-400">{student.grade} • {student.studentCode || student.id}</p>
            </div>
          </div>

          {isLoadingTranscript ? (
            <p className="text-center text-gray-400 py-16">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : !transcript || transcript.subjects.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText size={40} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">{isRTL ? 'مفيش سجل أكاديمي متاح' : 'No Transcript Data Available'}</h3>
              <p className="text-gray-500 max-w-md mx-auto text-sm">{isRTL ? 'لسه مفيش درجات مسجّلة لأي ترم لهذا الطالب.' : 'No graded terms recorded for this student yet.'}</p>
            </div>
          ) : (
            <>
              <div className="mb-10 flex justify-center">
                <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: `${schoolBranding?.primaryColor || '#7c3aed'}12` }}>
                  <p className="text-4xl font-black" style={{ color: schoolBranding?.primaryColor || '#7c3aed' }}>
                    {transcript.cumulativeAverage !== null ? `${transcript.cumulativeAverage}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-bold uppercase">{isRTL ? 'المعدل التراكمي' : 'Cumulative Average'}</p>
                </div>
              </div>

              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="py-3 text-xs font-bold text-gray-400 uppercase">{isRTL ? 'المادة' : 'Subject'}</th>
                    {transcript.terms.map((t) => (
                      <th key={t.id} className="py-3 text-xs font-bold text-gray-400 uppercase text-center">{t.name}</th>
                    ))}
                    <th className="py-3 text-xs font-bold text-gray-400 uppercase text-left">{isRTL ? 'المعدل' : 'Average'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transcript.subjects.map((s) => (
                    <tr key={s.subject} className="border-b border-gray-50">
                      <td className="py-4 font-bold text-gray-800">{s.subject}</td>
                      {s.termGrades.map((g, idx) => (
                        <td key={idx} className="py-4 text-center text-gray-600">{g !== null ? `${g}%` : '—'}</td>
                      ))}
                      <td className="py-4 text-left font-black" style={{ color: s.average !== null ? (schoolBranding?.primaryColor || '#7c3aed') : '#d1d5db' }}>
                        {s.average !== null ? `${s.average}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    );
  }

  if (viewMode === 'report-card') {
    return (
      <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .printable-report, .printable-report * { visibility: visible; }
            .printable-report { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
          }
        `}</style>
        <div className="flex justify-between items-center no-print">
          <button onClick={() => setViewMode('profile')} className="flex items-center gap-2 text-gray-500 hover:text-violet-600 font-bold transition-colors">
            <ArrowLeft size={20} /> {isRTL ? 'العودة للملف الشخصي' : 'Back to Profile'}
          </button>
          <div className="flex items-center gap-4">
            {reportTerms.length > 0 && (
              <select
                value={reportTermId || ''}
                onChange={(e) => setReportTermId(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
              >
                {reportTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={18} /> {isRTL ? 'طباعة' : 'Print'}
            </Button>
          </div>
        </div>

        <div className="printable-report bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 p-10 lg:p-14">
          {/* Header بهوية المدرسة */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-8 mb-8">
            <div className="flex items-center gap-4">
              {schoolBranding?.logoUrl && <img src={schoolBranding.logoUrl} alt="Logo" className="h-14 object-contain" />}
              <div>
                <h2 className="text-xl font-black text-gray-900">{schoolBranding?.schoolName || (isRTL ? 'اسم المدرسة' : 'School Name')}</h2>
                <p className="text-sm text-gray-400">{isRTL ? 'سجل الدرجات' : 'Report Card'}</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-gray-900">{student.name}</p>
              <p className="text-sm text-gray-400">{student.grade} • {student.studentCode || student.id}</p>
            </div>
          </div>

          {isLoadingReport ? (
            <p className="text-center text-gray-400 py-16">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : (
            <>
              {/* ملخص */}
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="text-center p-6 rounded-2xl" style={{ backgroundColor: `${schoolBranding?.primaryColor || '#7c3aed'}12` }}>
                  <p className="text-4xl font-black" style={{ color: schoolBranding?.primaryColor || '#7c3aed' }}>
                    {reportOverallAverage !== null ? `${reportOverallAverage}%` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-bold uppercase">{isRTL ? 'المعدل العام' : 'Overall Average'}</p>
                </div>
                <div className="text-center p-6 rounded-2xl bg-gray-50">
                  <p className="text-4xl font-black text-gray-900">{reportAttendance}%</p>
                  <p className="text-xs text-gray-500 mt-1 font-bold uppercase">{isRTL ? 'نسبة الحضور' : 'Attendance'}</p>
                </div>
                <div className="text-center p-6 rounded-2xl bg-gray-50">
                  <p className="text-4xl font-black text-gray-900">{reportSubjectGrades.filter(s => s.grade !== null).length}</p>
                  <p className="text-xs text-gray-500 mt-1 font-bold uppercase">{isRTL ? 'مواد مُقيَّمة' : 'Graded Subjects'}</p>
                </div>
              </div>

              {/* جدول الدرجات */}
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="py-3 text-xs font-bold text-gray-400 uppercase">{isRTL ? 'المادة' : 'Subject'}</th>
                    <th className="py-3 text-xs font-bold text-gray-400 uppercase text-left">{isRTL ? 'الدرجة' : 'Grade'}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSubjectGrades.map((s) => (
                    <tr key={s.subject} className="border-b border-gray-50">
                      <td className="py-4 font-bold text-gray-800">{s.subject}</td>
                      <td className="py-4 text-left font-black" style={{ color: s.grade !== null ? (schoolBranding?.primaryColor || '#7c3aed') : '#d1d5db' }}>
                        {s.grade !== null ? `${s.grade}%` : (isRTL ? 'لا توجد بيانات' : 'No data')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportSubjectGrades.length === 0 && (
                <p className="text-center text-gray-400 py-10">{isRTL ? 'مفيش مواد مسجّلة لصف الطالب.' : 'No subjects registered for this grade.'}</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-10" dir="rtl">
      
      {/* Assign Modal */}
      
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
                        <p className="text-sm text-gray-500">الطالب الرقم الجامعي: {student.studentCode || student.id}</p>
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
             <p className="text-lg text-gray-500 font-medium">{student.studentCode || student.id} • {student.grade}</p>
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
               <p className="text-3xl font-black text-violet-600">{overallAverage !== null ? `${overallAverage}%` : '—'}</p>
             </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center md:justify-end">
             <Button variant="primary" className="px-6 py-2 text-xs bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 border-none text-white rounded-xl" onClick={() => setViewMode('report-card')}>
               <FileText size={16} /> {isRTL ? 'التقرير الدراسي' : 'Report Card'}
             </Button>
             <Button variant="secondary" className="px-6 py-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm rounded-xl" onClick={() => setViewMode('transcript-generator')}>
               <Award size={16} /> {isRTL ? 'السجل الأكاديمي' : 'Transcript'}
             </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-8">
        {([
          { id: 'basic', ar: 'البيانات الأساسية', en: 'Basic Info' },
          { id: 'medical', ar: 'البيانات الطبية', en: 'Medical' },
          { id: 'academic', ar: 'الأكاديمي', en: 'Academic' },
          { id: 'behavioral', ar: 'السلوكي', en: 'Behavioral' },
          { id: 'attendance', ar: 'الحضور والإنذارات', en: 'Attendance & Warnings' },
          { id: 'admin', ar: 'الإجراءات الإدارية', en: 'Administrative Actions' },
          { id: 'communication', ar: 'التواصل', en: 'Communication' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeSection === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {isRTL ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* ============ البيانات الأساسية ============ */}
      {activeSection === 'basic' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            {isEditingBasic ? (
              <div className="flex gap-2">
                <button onClick={() => { setIsEditingBasic(false); setBasicDraft({ identityInfo: { ...student.identityInfo }, fatherInfo: { ...student.fatherInfo }, motherInfo: { ...student.motherInfo }, legalGuardian: student.legalGuardian || '', guardianRelationship: student.guardianRelationship || '', emergencyContact1: { ...student.emergencyContact1 }, emergencyContact2: { ...student.emergencyContact2 }, homeAddress: { ...student.homeAddress }, additionalInfo: { ...student.additionalInfo }, dob: student.dob || '', nationalId: student.nationalId || '', enrollmentDate: student.enrollmentDate || '' }); }} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={handleSaveBasicInfo} disabled={isSavingBasic} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold">{isSavingBasic ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}</button>
              </div>
            ) : (
              <button onClick={() => setIsEditingBasic(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 text-sm font-bold">
                <Edit size={16} /> {isRTL ? 'تعديل البيانات' : 'Edit Information'}
              </button>
            )}
          </div>

          {/* الهوية */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'الهوية' : 'Identity'}</h3>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{isRTL ? 'الاسم بالعربي (رباعي)' : 'Arabic Name (4 parts)'}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأول' : 'First'} value={basicDraft.identityInfo.firstNameAr || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, firstNameAr: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الثاني' : 'Second'} value={basicDraft.identityInfo.secondNameAr || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, secondNameAr: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الثالث' : 'Third'} value={basicDraft.identityInfo.thirdNameAr || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, thirdNameAr: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'اسم العائلة' : 'Last'} value={basicDraft.identityInfo.lastNameAr || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, lastNameAr: v } })} />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{isRTL ? 'الاسم بالإنجليزي (رباعي)' : 'English Name (4 parts)'}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأول' : 'First'} value={basicDraft.identityInfo.firstName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, firstName: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الثاني' : 'Second'} value={basicDraft.identityInfo.secondName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, secondName: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'الاسم الثالث' : 'Third'} value={basicDraft.identityInfo.thirdName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, thirdName: v } })} />
                  <Field editing={isEditingBasic} label={isRTL ? 'اسم العائلة' : 'Last'} value={basicDraft.identityInfo.lastName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, lastName: v } })} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-2">
                <Field editing={isEditingBasic} options={['Male', 'Female']} label={isRTL ? 'الجنس' : 'Gender'} value={basicDraft.identityInfo.gender || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, gender: v } })} />
                <Field editing={isEditingBasic} options={['Muslim', 'Christian']} label={isRTL ? 'الديانة' : 'Religion'} value={basicDraft.identityInfo.religion || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, religion: v } })} />
                <Field editing={isEditingBasic} options={NATIONALITIES} label={isRTL ? 'الجنسية' : 'Nationality'} value={basicDraft.identityInfo.nationality || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, nationality: v } })} />
                <Field editing={isEditingBasic} options={['None', ...NATIONALITIES]} label={isRTL ? 'الجنسية الثانية' : '2nd Nationality'} value={basicDraft.identityInfo.secondNationality || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, secondNationality: v } })} />
                <Field editing={isEditingBasic} options={['Arabic', 'English']} label={isRTL ? 'اللغة الأم' : 'Native Language'} value={basicDraft.identityInfo.nativeLanguage || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, nativeLanguage: v } })} />
                <Field editing={isEditingBasic} options={['English', 'French', 'German', 'None']} label={isRTL ? 'اللغة الثانية' : '2nd Language'} value={basicDraft.identityInfo.secondLanguage || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, secondLanguage: v } })} />
                <Field editing={isEditingBasic} label={isRTL ? 'إجادة الإنجليزية' : 'English Proficiency'} value={basicDraft.identityInfo.englishProficiency || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, englishProficiency: v } })} />
                <Field editing={isEditingBasic} label={isRTL ? 'العام الدراسي' : 'Academic Year'} value={basicDraft.identityInfo.academicYear || ''} onChange={(v) => setBasicDraft({ ...basicDraft, identityInfo: { ...basicDraft.identityInfo, academicYear: v } })} />
                <Field editing={isEditingBasic} type="date" label={isRTL ? 'تاريخ الميلاد' : 'Date of Birth'} value={basicDraft.dob} onChange={(v) => setBasicDraft({ ...basicDraft, dob: v })} />
                <Field editing={isEditingBasic} label={isRTL ? 'الرقم القومي' : 'National ID'} value={basicDraft.nationalId} onChange={(v) => setBasicDraft({ ...basicDraft, nationalId: v })} />
                <Field editing={isEditingBasic} type="date" label={isRTL ? 'تاريخ الالتحاق' : 'Enrollment Date'} value={basicDraft.enrollmentDate} onChange={(v) => setBasicDraft({ ...basicDraft, enrollmentDate: v })} />
              </div>
            </div>
          </div>

          {/* الأب */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'بيانات الأب' : "Father's Information"}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأول' : 'First Name'} value={basicDraft.fatherInfo.firstName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, fatherInfo: { ...basicDraft.fatherInfo, firstName: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأخير' : 'Last Name'} value={basicDraft.fatherInfo.lastName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, fatherInfo: { ...basicDraft.fatherInfo, lastName: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الموبايل' : 'Mobile'} value={basicDraft.fatherInfo.mobile || ''} onChange={(v) => setBasicDraft({ ...basicDraft, fatherInfo: { ...basicDraft.fatherInfo, mobile: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'البريد الإلكتروني' : 'Email'} value={basicDraft.fatherInfo.email || ''} onChange={(v) => setBasicDraft({ ...basicDraft, fatherInfo: { ...basicDraft.fatherInfo, email: v } })} />
            </div>
          </div>

          {/* الأم */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'بيانات الأم' : "Mother's Information"}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأول' : 'First Name'} value={basicDraft.motherInfo.firstName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, motherInfo: { ...basicDraft.motherInfo, firstName: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأخير' : 'Last Name'} value={basicDraft.motherInfo.lastName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, motherInfo: { ...basicDraft.motherInfo, lastName: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الموبايل' : 'Mobile'} value={basicDraft.motherInfo.mobile || ''} onChange={(v) => setBasicDraft({ ...basicDraft, motherInfo: { ...basicDraft.motherInfo, mobile: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'البريد الإلكتروني' : 'Email'} value={basicDraft.motherInfo.email || ''} onChange={(v) => setBasicDraft({ ...basicDraft, motherInfo: { ...basicDraft.motherInfo, email: v } })} />
            </div>
          </div>

          {/* ولي الأمر */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'ولي الأمر' : 'Legal Guardian'}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field editing={isEditingBasic} label={isRTL ? 'الاسم' : 'Name'} value={basicDraft.legalGuardian} onChange={(v) => setBasicDraft({ ...basicDraft, legalGuardian: v })} />
              <Field editing={isEditingBasic} label={isRTL ? 'صلة القرابة' : 'Relationship'} value={basicDraft.guardianRelationship} onChange={(v) => setBasicDraft({ ...basicDraft, guardianRelationship: v })} />
            </div>
          </div>

          {/* جهات اتصال الطوارئ */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'جهات اتصال الطوارئ' : 'Emergency Contacts'}</h3>
            <div className="space-y-6">
              {[1, 2].map((n) => {
                const key = n === 1 ? 'emergencyContact1' : 'emergencyContact2';
                const c: any = (basicDraft as any)[key] || {};
                return (
                  <div key={n}>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">{isRTL ? `جهة اتصال ${n}` : `Contact ${n}`}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأول' : 'First Name'} value={c.firstName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, [key]: { ...c, firstName: v } } as any)} />
                      <Field editing={isEditingBasic} label={isRTL ? 'الاسم الأخير' : 'Last Name'} value={c.lastName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, [key]: { ...c, lastName: v } } as any)} />
                      <Field editing={isEditingBasic} label={isRTL ? 'صلة القرابة' : 'Relation'} value={c.relativity || ''} onChange={(v) => setBasicDraft({ ...basicDraft, [key]: { ...c, relativity: v } } as any)} />
                      <Field editing={isEditingBasic} label={isRTL ? 'الموبايل' : 'Mobile'} value={c.mobile || ''} onChange={(v) => setBasicDraft({ ...basicDraft, [key]: { ...c, mobile: v } } as any)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* العنوان */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'العنوان' : 'Home Address'}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field editing={isEditingBasic} label={isRTL ? 'المدينة' : 'City'} value={basicDraft.homeAddress.city || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, city: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'المنطقة' : 'Area'} value={basicDraft.homeAddress.area || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, area: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الشارع' : 'Street'} value={basicDraft.homeAddress.street || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, street: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'المبنى' : 'Building'} value={basicDraft.homeAddress.building || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, building: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الشقة' : 'Apartment'} value={basicDraft.homeAddress.apartment || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, apartment: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الأرضي' : 'Landline'} value={basicDraft.homeAddress.landline || ''} onChange={(v) => setBasicDraft({ ...basicDraft, homeAddress: { ...basicDraft.homeAddress, landline: v } })} />
            </div>
          </div>

          {/* معلومات إضافية */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'معلومات إضافية' : 'Additional Information'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field editing={isEditingBasic} options={YES_NO} label={isRTL ? 'خدمة الباص' : 'Bus Service'} value={basicDraft.additionalInfo.busService || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, busService: v } })} />
              <Field editing={isEditingBasic} options={YES_NO} label={isRTL ? 'إخوة بالمدرسة' : 'Has Siblings'} value={basicDraft.additionalInfo.hasSiblings || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, hasSiblings: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'اسم الأخ/الأخت' : 'Sibling Name'} value={basicDraft.additionalInfo.siblingName || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, siblingName: v } })} />
              <Field editing={isEditingBasic} options={GRADE_LEVELS_LIST} label={isRTL ? 'صف الأخ/الأخت' : 'Sibling Grade'} value={basicDraft.additionalInfo.siblingYearGroup || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, siblingYearGroup: v } })} />
              <Field editing={isEditingBasic} options={YES_NO} label={isRTL ? 'تقدّم من قبل' : 'Applied Before'} value={basicDraft.additionalInfo.appliedBefore || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, appliedBefore: v } })} />
              <Field editing={isEditingBasic} label={isRTL ? 'الهوايات' : 'Hobbies'} value={basicDraft.additionalInfo.hobbies || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, hobbies: v } })} />
              <Field editing={isEditingBasic} options={['Social Media', 'Friends/Family', 'Search Engine', 'Advertisement', 'Other']} label={isRTL ? 'مصدر المعرفة بالمدرسة' : 'Marketing Source'} value={basicDraft.additionalInfo.marketing || ''} onChange={(v) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, marketing: v } })} />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-400 text-xs mb-1">{isRTL ? 'ملاحظات إضافية' : 'Additional Notes'}</p>
              {isEditingBasic ? (
                <textarea
                  value={basicDraft.additionalInfo.additionalNotes || ''}
                  onChange={(e) => setBasicDraft({ ...basicDraft, additionalInfo: { ...basicDraft.additionalInfo, additionalNotes: e.target.value } })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[80px]"
                />
              ) : (
                <p className="text-gray-700 text-sm">{basicDraft.additionalInfo.additionalNotes || '—'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ البيانات الطبية ============ */}
      {activeSection === 'medical' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'الملف الطبي' : 'Medical File'}</h3>
              <button onClick={handleSaveMedical} disabled={isSavingMedical} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold">
                {isSavingMedical ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </button>
            </div>
            {isLoadingMedical ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field editing={true} label={isRTL ? 'فصيلة الدم' : 'Blood Type'} value={medicalInfo.bloodType} onChange={(v) => setMedicalInfo({ ...medicalInfo, bloodType: v })} />
              <Field editing={true} label={isRTL ? 'الحساسية' : 'Allergies'} value={medicalInfo.allergies} onChange={(v) => setMedicalInfo({ ...medicalInfo, allergies: v })} />
              <Field editing={true} full label={isRTL ? 'أمراض مزمنة / حالات طبية' : 'Chronic Conditions'} value={medicalInfo.chronicConditions} onChange={(v) => setMedicalInfo({ ...medicalInfo, chronicConditions: v })} />
              <Field editing={true} label={isRTL ? 'اسم الطبيب المتابع' : "Doctor's Name"} value={medicalInfo.doctorName} onChange={(v) => setMedicalInfo({ ...medicalInfo, doctorName: v })} />
              <Field editing={true} label={isRTL ? 'رقم الطبيب' : "Doctor's Phone"} value={medicalInfo.doctorPhone} onChange={(v) => setMedicalInfo({ ...medicalInfo, doctorPhone: v })} />
              <Field editing={true} label={isRTL ? 'شركة التأمين' : 'Insurance Provider'} value={medicalInfo.insuranceProvider} onChange={(v) => setMedicalInfo({ ...medicalInfo, insuranceProvider: v })} />
              <Field editing={true} label={isRTL ? 'رقم التأمين' : 'Insurance Number'} value={medicalInfo.insuranceNumber} onChange={(v) => setMedicalInfo({ ...medicalInfo, insuranceNumber: v })} />
            </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'زيارات العيادة' : 'Clinic Visits'}</h3>
              <button onClick={() => setIsAddingVisit(!isAddingVisit)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {isRTL ? 'إضافة زيارة' : 'Add Visit'}
              </button>
            </div>
            {isAddingVisit && (
              <div className="p-4 bg-gray-50 rounded-2xl mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field editing={true} type="date" label={isRTL ? 'تاريخ الزيارة' : 'Visit Date'} value={newVisit.visitDate} onChange={(v) => setNewVisit({ ...newVisit, visitDate: v })} />
                  <Field editing={true} label={isRTL ? 'السبب' : 'Reason'} value={newVisit.reason} onChange={(v) => setNewVisit({ ...newVisit, reason: v })} />
                </div>
                <textarea value={newVisit.notes} onChange={(e) => setNewVisit({ ...newVisit, notes: e.target.value })} placeholder={isRTL ? 'ملاحظات...' : 'Notes...'} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                <div className="flex gap-2">
                  <button onClick={handleAddVisit} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold">{isRTL ? 'حفظ' : 'Save'}</button>
                  <button onClick={() => setIsAddingVisit(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            )}
            {clinicVisits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش زيارات مسجّلة لسه.' : 'No visits recorded yet.'}</p>
            ) : (
              <div className="space-y-2">
                {clinicVisits.map(v => (
                  <div key={v.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{v.reason || (isRTL ? 'بدون سبب مسجّل' : 'No reason noted')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{v.visitDate}</p>
                      {v.notes && <p className="text-sm text-gray-600 mt-2">{v.notes}</p>}
                      <p className="text-[11px] text-gray-400 mt-2">{v.recordedBy}</p>
                    </div>
                    <button onClick={() => handleDeleteVisit(v.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ السلوكي ============ */}
      {activeSection === 'behavioral' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'تسجيل واقعة سلوكية' : 'Record Behavioral Incident'}</h3>
              <button onClick={() => setIsAddingIncident(!isAddingIncident)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {isRTL ? 'إضافة واقعة' : 'Add Incident'}
              </button>
            </div>
            {isAddingIncident && (
              <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field editing={true} type="date" label={isRTL ? 'التاريخ' : 'Date'} value={newIncident.incidentDate} onChange={(v) => setNewIncident({ ...newIncident, incidentDate: v })} />
                  <Field editing={true} type="time" label={isRTL ? 'الوقت' : 'Time'} value={newIncident.incidentTime} onChange={(v) => setNewIncident({ ...newIncident, incidentTime: v })} />
                </div>
                <Field editing={true} label={isRTL ? 'المشكلة' : 'Problem'} value={newIncident.problemTitle} onChange={(v) => setNewIncident({ ...newIncident, problemTitle: v })} />
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'الوصف' : 'Description'}</p>
                  <textarea value={newIncident.description} onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'الإجراء المُتخذ' : 'Action Taken'}</p>
                  <textarea value={newIncident.actionTaken} onChange={(e) => setNewIncident({ ...newIncident, actionTaken: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[60px]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddIncident} disabled={isSavingIncident} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold">{isSavingIncident ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</button>
                  <button onClick={() => setIsAddingIncident(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'السجل السلوكي' : 'Behavioral History'}</h3>
            {isLoadingBehavior ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : behaviorIncidents.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش وقائع مسجّلة لسه.' : 'No incidents recorded yet.'}</p>
            ) : (
              <div className="space-y-3">
                {behaviorIncidents.map(inc => (
                  <div key={inc.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{inc.problemTitle}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{inc.incidentDate} {inc.incidentTime ? `• ${inc.incidentTime}` : ''}</p>
                      </div>
                      <button onClick={() => handleDeleteIncident(inc.id)} className="text-gray-300 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                    {inc.description && <p className="text-sm text-gray-700 mt-2">{inc.description}</p>}
                    {inc.actionTaken && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الإجراء المُتخذ' : 'Action Taken'}</p>
                        <p className="text-sm text-gray-700">{inc.actionTaken}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">{inc.recordedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ التواصل ============ */}
      {activeSection === 'communication' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? `إرسال رسالة إلى ${student.name}` : `Send a message to ${student.name}`}</h3>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder={isRTL ? 'اكتبي رسالتك هنا...' : 'Write your message here...'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 min-h-[100px] mb-3 outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
            <Button onClick={handleSendMessage} disabled={isSendingMessage || !messageContent.trim()} className="px-6">
              {isSendingMessage ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ في السجل' : 'Save to Log')}
            </Button>
            <p className="text-[11px] text-gray-400 mt-2">{isRTL ? 'ملحوظة: الرسالة دلوقتي بتتحفظ كسجل بس، مفيش توصيل فعلي لولي الأمر لسه.' : 'Note: messages are currently saved as a log only — no live delivery yet.'}</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isRTL ? 'سجل الرسائل' : 'Message Log'}</h3>
            {isLoadingMessages ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : messagesLog.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش رسائل متبعتة لسه.' : 'No messages sent yet.'}</p>
            ) : (
              <div className="space-y-3">
                {messagesLog.map(msg => (
                  <div key={msg.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-sm text-gray-800">{msg.content}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{msg.senderName} • {new Date(msg.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ الحضور والإنذارات ============ */}
      {activeSection === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-1">{isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</p>
              <h3 className="text-3xl font-bold text-gray-900">{isLoadingAttendanceTab ? '...' : `${attendanceSummary.attendanceRate}%`}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-1">{isRTL ? 'إجمالي الغياب' : 'Total Absences'}</p>
              <h3 className="text-3xl font-bold text-red-600">{isLoadingAttendanceTab ? '...' : attendanceSummary.absentCount}</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-1">{isRTL ? 'إجمالي التأخير' : 'Total Late Arrivals'}</p>
              <h3 className="text-3xl font-bold text-yellow-600">{isLoadingAttendanceTab ? '...' : attendanceSummary.lateCount}</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'الإنذارات' : 'Warnings'}</h3>
              <button onClick={() => setIsAddingWarning(!isAddingWarning)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {isRTL ? 'إصدار إنذار' : 'Issue Warning'}
              </button>
            </div>
            {isAddingWarning && (
              <div className="p-4 bg-gray-50 rounded-2xl mb-4 space-y-3">
                <Field editing={true} type="date" label={isRTL ? 'تاريخ الإنذار' : 'Warning Date'} value={newWarning.warningDate} onChange={(v) => setNewWarning({ ...newWarning, warningDate: v })} />
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'السبب' : 'Reason'}</p>
                  <textarea value={newWarning.reason} onChange={(e) => setNewWarning({ ...newWarning, reason: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddWarning} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold">{isRTL ? 'إصدار' : 'Issue'}</button>
                  <button onClick={() => setIsAddingWarning(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            )}
            {isLoadingAttendanceTab ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : warnings.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش إنذارات سابقة.' : 'No previous warnings.'}</p>
            ) : (
              <div className="space-y-2">
                {warnings.map(w => (
                  <div key={w.id} className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-xs font-bold text-red-600">{w.warningDate}</p>
                    <p className="text-sm text-gray-800 mt-1">{w.reason}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{w.issuedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ الإجراءات الإدارية ============ */}
      {activeSection === 'admin' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'الإجراءات الإدارية / العقوبات' : 'Administrative Actions / Penalties'}</h3>
              <button onClick={() => setIsAddingAction(!isAddingAction)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {isRTL ? 'إضافة إجراء' : 'Add Action'}
              </button>
            </div>
            {isAddingAction && (
              <div className="p-4 bg-gray-50 rounded-2xl mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field editing={true} type="date" label={isRTL ? 'التاريخ' : 'Date'} value={newAction.actionDate} onChange={(v) => setNewAction({ ...newAction, actionDate: v })} />
                  <Field editing={true} label={isRTL ? 'نوع الإجراء' : 'Action Type'} value={newAction.actionType} onChange={(v) => setNewAction({ ...newAction, actionType: v })} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'السبب' : 'Reason'}</p>
                  <textarea value={newAction.reason} onChange={(e) => setNewAction({ ...newAction, reason: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddAdminAction} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold">{isRTL ? 'حفظ' : 'Save'}</button>
                  <button onClick={() => setIsAddingAction(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            )}
            {isLoadingAdmin ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : adminActions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش إجراءات مسجّلة.' : 'No actions recorded.'}</p>
            ) : (
              <div className="space-y-2">
                {adminActions.map(a => (
                  <div key={a.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{a.actionType}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.actionDate}</p>
                      {a.reason && <p className="text-sm text-gray-600 mt-2">{a.reason}</p>}
                      <p className="text-[11px] text-gray-400 mt-2">{a.issuedBy}</p>
                    </div>
                    <button onClick={() => handleDeleteAdminAction(a.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{isRTL ? 'استدعاء ولي الأمر' : 'Guardian Summons'}</h3>
              <button onClick={() => setIsAddingSummon(!isAddingSummon)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {isRTL ? 'تسجيل استدعاء' : 'Record Summon'}
              </button>
            </div>
            {isAddingSummon && (
              <div className="p-4 bg-gray-50 rounded-2xl mb-4 space-y-3">
                <Field editing={true} type="date" label={isRTL ? 'تاريخ الاستدعاء' : 'Summon Date'} value={newSummon.summonDate} onChange={(v) => setNewSummon({ ...newSummon, summonDate: v })} />
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'سبب الاستدعاء' : 'Reason for Summon'}</p>
                  <textarea value={newSummon.reason} onChange={(e) => setNewSummon({ ...newSummon, reason: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[60px]" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">{isRTL ? 'اللي تم في الاجتماع' : 'What Was Discussed'}</p>
                  <textarea value={newSummon.outcome} onChange={(e) => setNewSummon({ ...newSummon, outcome: e.target.value })} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSummon} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold">{isRTL ? 'حفظ' : 'Save'}</button>
                  <button onClick={() => setIsAddingSummon(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            )}
            {isLoadingAdmin ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : guardianSummons.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{isRTL ? 'مفيش استدعاءات مسجّلة.' : 'No summons recorded.'}</p>
            ) : (
              <div className="space-y-2">
                {guardianSummons.map(s => (
                  <div key={s.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-500">{s.summonDate}</p>
                    {s.reason && <p className="text-sm font-bold text-gray-900 mt-1">{s.reason}</p>}
                    {s.outcome && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'اللي تم' : 'Outcome'}</p>
                        <p className="text-sm text-gray-700">{s.outcome}</p>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">{s.attendedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ الأكاديمي ============ */}
      {activeSection === 'academic' && (
      <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Academic Chart */}
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-lg text-gray-900 mb-6">{isRTL ? 'الأداء الأكاديمي' : 'Academic Performance'}</h3>
            {isLoadingGrades ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : gradedSubjects.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm text-center px-8">
                {isRTL ? 'مفيش درجات مسجّلة لأي مادة لسه — الدرجات بتظهر هنا أول ما يتسجّل نظام تقييم معتمد وتُدخل درجات فعلية.' : 'No grades recorded for any subject yet — grades will appear here once an approved grading system is set up and real scores are entered.'}
              </div>
            ) : (
            <div className="h-[300px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradedSubjects.map((s) => ({ subject: s.subject, grade: s.grade }))} barGap={12}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} domain={[0, 100]} />
                  <Tooltip cursor={{fill: '#fff7ed'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Bar name="الدرجة" dataKey="grade" fill="#9333ea" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
         </div>

         {/* المستندات */}
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-gray-900">{isRTL ? 'المستندات' : 'Documents'}</h3>
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
               <p className="text-sm text-slate-500 font-medium mb-1">{isRTL ? 'الحالة المالية' : 'Financial Status'}</p>
               <h3 className="text-2xl font-bold text-slate-800">{isRTL ? 'الرسوم الدراسية' : 'Tuition Fees'}</h3>
            </div>
            <div className="text-right">
               <p className="text-slate-400 text-xs uppercase mb-1">{isRTL ? 'المتبقي' : 'Remaining'}</p>
               <p className="text-4xl font-extrabold text-violet-700">
                  {new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-US', { style: 'currency', currency: 'EGP' }).format(totalFees - paidFees)}
               </p>
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
            {student.installmentPlans?.[0]?.installments.map((ins, i) => (
               <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="flex justify-between items-center text-sm mb-3">
                     <span className="text-slate-500 font-medium">{isRTL ? 'قسط' : 'Installment'} {i+1}</span>
                     <span className={ins.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full text-sm inline-block w-fit' : 'bg-violet-50 text-violet-700 font-bold px-3 py-1 rounded-full text-sm inline-block w-fit'}>{ins.status === 'Paid' ? (isRTL ? 'مدفوع' : 'Paid') : ins.status === 'Pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') : ins.status}</span>
                  </div>
                  <p className="font-mono text-xl font-bold text-slate-800">{new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-US', {style: 'currency', currency: 'EGP'}).format(ins.amount)}</p>
                  <p className="text-sm text-slate-500 mt-1">{ins.dueDate}</p>
               </div>
            ))}
         </div>
      </div>
      </div>
      )}
    </div>
  );
};
