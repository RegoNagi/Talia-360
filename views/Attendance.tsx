import React, { useState } from 'react';
import { UserRole, Language, User } from '../types';
import { Button } from '../components/Button';
import { 
  Settings as SettingsIcon, 
  List, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  LayoutDashboard,
  ClipboardList,
  FileWarning,
  Sliders
} from 'lucide-react';
import { getStudents, getClassSections, saveAttendanceSession, getPeriods, getAttendanceSettings, saveAttendanceSettings, getAttendanceForDate, getTeachers, getEarlyWarningCriteria, updateEarlyWarningCriteria, EarlyWarningCriteria, getGradeLevels, getClassesAttendanceOverview, ClassAttendanceOverview, getAttendanceLogsForDateRange, AttendanceLogRow, getLateStudentsForDateRange, LateStudentRow, getExcusedStudentsForDateRange, saveExcuseDetails, uploadExcuseFile, unexcuseAttendanceRecord, ExcusedStudentRow,
  getCustomAttendanceStatuses, addCustomAttendanceStatus, deleteCustomAttendanceStatus, CustomAttendanceStatus } from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Teacher } from '../types';
import { Student, ClassSection } from '../types';

interface AttendanceProps {
  role: UserRole;
  language: Language;
  user: User;
  permissions?: string[];
}

type AttendanceSection = 'dashboard' | 'status' | 'late' | 'excuse' | 'settings';

export const Attendance: React.FC<AttendanceProps> = ({ role, language, user, permissions = [] }) => {
  const isRTL = language === Language.AR;
  const t = (ar: string, en: string) => (isRTL ? ar : en);

  // لو مفيش صلاحيات محددة (حسابات الديمو) نسيب كل حاجة متاحة زي ما كانت
  const canTakeAttendance = permissions.length === 0 || permissions.includes('attendance_take');
  const canEditSettings = permissions.length === 0 || permissions.includes('attendance_settings');

  const [activeSection, setActiveSection] = useState<AttendanceSection>('dashboard');

  // Setup State
  const [attendanceMode, setAttendanceMode] = useState<'Daily' | 'Period'>('Daily');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [maxLateCount, setMaxLateCount] = useState(5);
  const [smsOnAbsent, setSmsOnAbsent] = useState(true);
  const [smsOnLate, setSmsOnLate] = useState(false);
  
  const [statuses, setStatuses] = useState([
    { id: 'present', label: t('حاضر', 'Present'), color: 'bg-green-500' },
    { id: 'absent', label: t('غائب', 'Absent'), color: 'bg-red-500' },
    { id: 'late', label: t('متأخر', 'Late'), color: 'bg-yellow-500' },
  ]);

  // تسميات الحالات الافتراضية بتتحدث تلقائي لو اللغة اتغيّرت — الحالات المخصّصة (اللي المستخدم ضافها بنفسه) مبتتلمسش
  const DEFAULT_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
    present: { ar: 'حاضر', en: 'Present' },
    absent: { ar: 'غائب', en: 'Absent' },
    late: { ar: 'متأخر', en: 'Late' },
  };
  const [customStatuses, setCustomStatuses] = useState<CustomAttendanceStatus[]>([]);
  const [isLoadingCustomStatuses, setIsLoadingCustomStatuses] = useState(true);

  const refreshCustomStatuses = () => {
    setIsLoadingCustomStatuses(true);
    getCustomAttendanceStatuses().then((rows) => {
      setCustomStatuses(rows);
      setIsLoadingCustomStatuses(false);
    });
  };
  React.useEffect(() => { refreshCustomStatuses(); }, []);

  React.useEffect(() => {
    setStatuses(prev => prev.map(s => DEFAULT_STATUS_LABELS[s.id] ? { ...s, label: isRTL ? DEFAULT_STATUS_LABELS[s.id].ar : DEFAULT_STATUS_LABELS[s.id].en } : s));
  }, [isRTL]);

  // قائمة الحالات الكاملة للعرض: الافتراضية + المخصّصة الحقيقية من قاعدة البيانات
  const allStatuses = [
    ...statuses,
    ...customStatuses.map(cs => ({ id: cs.id, label: isRTL ? cs.labelAr : cs.labelEn, color: cs.color })),
  ];

  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('bg-purple-500');
  const [isSavingCustomStatus, setIsSavingCustomStatus] = useState(false);

  const availableColors = ['bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-violet-500', 'bg-teal-500'];

  const handleAddStatus = async () => {
    if (!newStatusLabel.trim()) return;
    setIsSavingCustomStatus(true);
    const id = await addCustomAttendanceStatus({
      labelAr: isRTL ? newStatusLabel.trim() : newStatusLabel.trim(),
      labelEn: isRTL ? newStatusLabel.trim() : newStatusLabel.trim(),
      color: newStatusColor,
    });
    setIsSavingCustomStatus(false);
    if (id) {
      setNewStatusLabel('');
      setIsAddingStatus(false);
      refreshCustomStatuses();
      showToast(t('تم إضافة الحالة.', 'Status added.'), 'success');
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const handleDeleteStatus = async (id: string) => {
    const ok = await deleteCustomAttendanceStatus(id);
    if (ok) refreshCustomStatuses();
  };

  // Take-attendance state (شاشة "حالة الحضور" وقت ما تدخلي فصل بعينه)
  const [takingAttendanceForClass, setTakingAttendanceForClass] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, string>>>({});
  const [realClasses, setRealClasses] = useState<ClassSection[]>([]);
  const [realStudents, setRealStudents] = useState<Student[]>([]);
  const [realTeachers, setRealTeachers] = useState<Teacher[]>([]);
  const [realPeriods, setRealPeriods] = useState<{ id: string; subject: string; day: string; startTime: string; endTime: string }[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [isLoadingAttendanceData, setIsLoadingAttendanceData] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  // مفتاح "الحصة الحالية" اللي بيتم تسجيل الحضور تحته — في وضع "يومي" مفيش حصص، فبنستخدم مفتاح ثابت
  const activeKey = attendanceMode === 'Daily' ? 'daily' : (selectedPeriodId || '');
  const currentAttendance = attendanceData[activeKey] || {};

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const goNextDay = () => {
    if (isToday) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  React.useEffect(() => {
    Promise.all([getClassSections(), getStudents(), getTeachers(), getAttendanceSettings()]).then(([classesData, studentsData, teachersData, settings]) => {
      setRealClasses(classesData);
      setRealStudents(studentsData);
      setRealTeachers(teachersData);
      setAttendanceMode(settings.mode);
      setLateThreshold(settings.lateThreshold);
      setMaxLateCount(settings.maxLateCount);
      setSettingsLoaded(true);
    });
  }, []);

  React.useEffect(() => {
    if (takingAttendanceForClass && attendanceMode === 'Period') {
      getPeriods(takingAttendanceForClass).then(p => {
        setRealPeriods(p);
        setSelectedPeriodId(p.length > 0 ? p[0].id : null);
      });
    }
  }, [takingAttendanceForClass, attendanceMode]);

  React.useEffect(() => {
    if (takingAttendanceForClass) {
      setIsLoadingAttendanceData(true);
      getAttendanceForDate(takingAttendanceForClass, selectedDate).then((fetched) => {
        setAttendanceData(fetched);
        setIsLoadingAttendanceData(false);
      });
    }
  }, [takingAttendanceForClass, selectedDate]);

  const [warningCriteria, setWarningCriteria] = useState<EarlyWarningCriteria | null>(null);
  const [isSavingWarningCriteria, setIsSavingWarningCriteria] = useState(false);
  React.useEffect(() => { getEarlyWarningCriteria().then(setWarningCriteria); }, []);
  const handleSaveWarningCriteria = async () => {
    if (!warningCriteria) return;
    setIsSavingWarningCriteria(true);
    const ok = await updateEarlyWarningCriteria({
      id: warningCriteria.id,
      criticalAttendance: warningCriteria.criticalAttendance,
      warningAttendance: warningCriteria.warningAttendance,
    });
    setIsSavingWarningCriteria(false);
    showToast(ok ? t('تم حفظ معايير التحذير المبكر.', 'Early warning criteria saved.') : t('حصل خطأ أثناء الحفظ.', 'Error saving.'), ok ? 'success' : 'error');
  };

  const handleSaveSettings = async () => {
    if (!canEditSettings) {
      showToast(t('معندكش صلاحية تعديل إعدادات الحضور.', "You don't have permission to edit attendance settings."), 'error');
      return;
    }
    const ok = await saveAttendanceSettings(attendanceMode, lateThreshold, maxLateCount);
    if (ok) {
      showToast(t('تم حفظ إعدادات الحضور بنجاح.', 'Attendance settings saved successfully.'), 'success');
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const saveAttendance = async () => {
    if (!canTakeAttendance) {
      showToast(t('معندكش صلاحية تسجيل الحضور.', "You don't have permission to take attendance."), 'error');
      return;
    }
    if (!isToday) {
      showToast(t('مينفعش تسجّل أو تعدّل حضور يوم فات أو يوم لسه ماجاش.', "You can only record or edit today's attendance."), 'error');
      return;
    }
    if (!takingAttendanceForClass) return;
    if (isLoadingAttendanceData) {
      showToast(t('استنّي لحد ما بيانات الحضور تخلص تحميل.', 'Please wait for attendance data to finish loading.'), 'error');
      return;
    }
    if (attendanceMode === 'Period' && !selectedPeriodId) {
      showToast(t('اختار حصة الأول قبل ما تحفظ الحضور.', 'Pick a period first before saving attendance.'), 'error');
      return;
    }
    setIsSavingAttendance(true);
    const classStudents = realStudents.filter(s => realClasses.find(c => c.id === takingAttendanceForClass)?.students.includes(s.id));
    const statusMap: Record<string, string> = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
    const records = classStudents.map(s => ({
      studentId: s.id,
      status: statusMap[currentAttendance[s.id]] || 'Absent',
    }));
    const period = realPeriods.find(p => p.id === selectedPeriodId);
    const sessionId = await saveAttendanceSession({
      sectionId: takingAttendanceForClass,
      date: selectedDate,
      subject: period?.subject,
      periodId: attendanceMode === 'Period' ? selectedPeriodId : null,
      records,
    });
    setIsSavingAttendance(false);
    if (sessionId) {
      setAttendanceSaved(true);
      showToast(t('تم حفظ الحضور بنجاح.', 'Attendance saved successfully.'), 'success');
      refreshAdminDashboard();
      setTimeout(() => setAttendanceSaved(false), 2500);
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    if (!isToday || !canTakeAttendance) return;
    if (isLoadingAttendanceData) return;
    if (attendanceMode === 'Period' && !selectedPeriodId) return;
    setAttendanceData(prev => ({
      ...prev,
      [activeKey]: { ...(prev[activeKey] || {}), [studentId]: status },
    }));
  };

  const markAllPresent = () => {
    if (!isToday || !canTakeAttendance) return;
    if (isLoadingAttendanceData) return;
    if (attendanceMode === 'Period' && !selectedPeriodId) return;
    const classStudentIds = realClasses.find(c => c.id === takingAttendanceForClass)?.students || [];
    const updated: Record<string, string> = { ...(attendanceData[activeKey] || {}) };
    realStudents.filter(s => classStudentIds.includes(s.id)).forEach(student => {
      updated[student.id] = 'present';
    });
    setAttendanceData(prev => ({ ...prev, [activeKey]: updated }));
  };

  // بيانات حقيقية للوحة المشرف
  const [realGradeLevels, setRealGradeLevels] = useState<{ id: string; name: string }[]>([]);
  const [classesOverview, setClassesOverview] = useState<ClassAttendanceOverview[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogRow[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  // ============ فلتر موحّد: الصف + الفصل + التاريخ — بيُستخدم في كل الصفحات ============
  const [filterGrade, setFilterGrade] = useState('ALL');
  const [filterClassName, setFilterClassName] = useState('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [statusSearch, setStatusSearch] = useState('');

  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const weekAgoStr = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();

  const [rangeStart, rangeEnd] = dateFilterMode === 'today' ? [todayStr, todayStr]
    : dateFilterMode === 'yesterday' ? [yesterdayStr, yesterdayStr]
    : dateFilterMode === 'week' ? [weekAgoStr, todayStr]
    : [customStartDate, customEndDate];

  // "حالة الحضور لكل فصل" بتاعة يوم واحد بس — بنستخدم آخر يوم في المدى المختار
  const statusOverviewDate = rangeEnd;

  const refreshAdminDashboard = () => {
    setIsLoadingDashboard(true);
    Promise.all([
      getClassesAttendanceOverview(statusOverviewDate, attendanceMode),
      getAttendanceLogsForDateRange(rangeStart, rangeEnd),
      getLateStudentsForDateRange(rangeStart, rangeEnd),
      getExcusedStudentsForDateRange(rangeStart, rangeEnd),
    ]).then(([overview, logs, late, excused]) => {
      setClassesOverview(overview);
      setAttendanceLogs(logs);
      setLateStudents(late);
      setExcusedStudents(excused);
      setIsLoadingDashboard(false);
    });
  };

  React.useEffect(() => {
    getGradeLevels().then(setRealGradeLevels);
  }, []);

  React.useEffect(() => {
    refreshAdminDashboard();
  }, [attendanceMode, dateFilterMode, customStartDate, customEndDate]);

  const todayStats = {
    attendanceRate: attendanceLogs.length > 0 ? Math.round((attendanceLogs.filter(l => l.status === 'حاضر' || l.status === 'متأخر').length / attendanceLogs.length) * 100) : 0,
    absentCount: attendanceLogs.filter(l => l.status === 'غائب').length,
    pendingClasses: classesOverview.filter(c => c.status !== 'complete').length,
    totalClasses: classesOverview.length,
  };

  const availableClassNames = Array.from(new Set(
    (filterGrade === 'ALL' ? attendanceLogs : attendanceLogs.filter(l => l.gradeLevel === filterGrade)).map(l => l.className)
  ));

  const filteredClasses = classesOverview
    .filter(c => filterGrade === 'ALL' || c.gradeLevel === filterGrade)
    .filter(c => filterClassName === 'ALL' || c.sectionName === filterClassName)
    .filter(c => c.sectionName.toLowerCase().includes(statusSearch.toLowerCase()));

  const filteredLogs = attendanceLogs
    .filter(l => filterGrade === 'ALL' || l.gradeLevel === filterGrade)
    .filter(l => filterClassName === 'ALL' || l.className === filterClassName)
    .filter(l => l.studentName.toLowerCase().includes(statusSearch.toLowerCase()) || l.className.toLowerCase().includes(statusSearch.toLowerCase()) || l.teacherName.toLowerCase().includes(statusSearch.toLowerCase()));

  const gradeChartData = realGradeLevels.map(g => {
    const gradeLogs = attendanceLogs.filter(l => l.gradeLevel === g.name);
    const presentCount = gradeLogs.filter(l => l.status === 'حاضر' || l.status === 'متأخر').length;
    return { name: g.name, attendance: gradeLogs.length > 0 ? Math.round((presentCount / gradeLogs.length) * 100) : 0 };
  }).filter(g => attendanceLogs.some(l => l.gradeLevel === g.name));

  const enterTakeAttendance = (sectionId: string) => {
    setTakingAttendanceForClass(sectionId);
    setActiveSection('status');
  };

  // شريط الفلتر الموحّد — بيتكرر في أكتر من صفحة
  const renderFilterBar = () => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
      <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterClassName('ALL'); }} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500">
        <option value="ALL">{t('جميع الصفوف', 'All Grades')}</option>
        {realGradeLevels.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
      </select>
      <select value={filterClassName} onChange={(e) => setFilterClassName(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500">
        <option value="ALL">{t('جميع الفصول', 'All Classes')}</option>
        {availableClassNames.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
        {(['today', 'yesterday', 'week', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setDateFilterMode(mode)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${dateFilterMode === mode ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {mode === 'today' ? t('اليوم', 'Today') : mode === 'yesterday' ? t('الأمس', 'Yesterday') : mode === 'week' ? t('هذا الأسبوع', 'This Week') : t('مخصص', 'Custom')}
          </button>
        ))}
      </div>
      {dateFilterMode === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          <span className="text-gray-400 text-sm">{t('إلى', 'to')}</span>
          <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
      )}
      <div className="relative flex-1 min-w-[180px]">
        <input
          type="text"
          value={statusSearch}
          onChange={(e) => setStatusSearch(e.target.value)}
          placeholder={t('البحث...', 'Search...')}
          className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm`}
        />
        <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} size={16} />
      </div>
    </div>
  );

  // ============ حالات التأخير — بدرِل داون على مستوى الفصل ============
  const [lateStudents, setLateStudents] = useState<LateStudentRow[]>([]);
  const [editingExcuseId, setEditingExcuseId] = useState<string | null>(null);
  const [excuseReasonDraft, setExcuseReasonDraft] = useState('');
  const [excuseFileDraft, setExcuseFileDraft] = useState<File | null>(null);
  const [isSavingExcuse, setIsSavingExcuse] = useState(false);
  const [isUnexcusingId, setIsUnexcusingId] = useState<string | null>(null);
  const [selectedLateClass, setSelectedLateClass] = useState<string | null>(null);

  const filteredLateStudents = lateStudents
    .filter(l => filterGrade === 'ALL' || l.gradeLevel === filterGrade)
    .filter(l => filterClassName === 'ALL' || l.className === filterClassName)
    .filter(l => l.studentName.toLowerCase().includes(statusSearch.toLowerCase()) || l.className.toLowerCase().includes(statusSearch.toLowerCase()));

  const lateByClass = filteredLateStudents.reduce((acc: Record<string, LateStudentRow[]>, row) => {
    if (!acc[row.className]) acc[row.className] = [];
    acc[row.className].push(row);
    return acc;
  }, {});

  // ============ حالات العذر — بدرِل داون على مستوى الفصل ============
  const [excusedStudents, setExcusedStudents] = useState<ExcusedStudentRow[]>([]);
  const [selectedExcuseClass, setSelectedExcuseClass] = useState<string | null>(null);

  const filteredExcusedStudents = excusedStudents
    .filter(e => filterGrade === 'ALL' || e.gradeLevel === filterGrade)
    .filter(e => filterClassName === 'ALL' || e.className === filterClassName)
    .filter(e => e.studentName.toLowerCase().includes(statusSearch.toLowerCase()) || e.className.toLowerCase().includes(statusSearch.toLowerCase()));

  const excuseByClass = filteredExcusedStudents.reduce((acc: Record<string, ExcusedStudentRow[]>, row) => {
    if (!acc[row.className]) acc[row.className] = [];
    acc[row.className].push(row);
    return acc;
  }, {});

  const handleSaveExcuse = async (recordId: string, originalStatus: 'Absent' | 'Late' = 'Absent') => {
    setIsSavingExcuse(true);
    let fileUrl: string | null = null;
    if (excuseFileDraft) {
      fileUrl = await uploadExcuseFile(recordId, excuseFileDraft);
      if (!fileUrl) {
        showToast(t('حصل خطأ أثناء رفع الملف.', 'Error uploading file.'), 'error');
        setIsSavingExcuse(false);
        return;
      }
    }
    const ok = await saveExcuseDetails(recordId, excuseReasonDraft.trim(), fileUrl, originalStatus);
    setIsSavingExcuse(false);
    if (ok) {
      if (originalStatus === 'Late') {
        setLateStudents(prev => prev.map(l => l.recordId === recordId ? { ...l, excuseReason: excuseReasonDraft.trim(), status: 'Excused' as const } : l));
      } else {
        setExcusedStudents(prev => prev.map(e => e.recordId === recordId ? { ...e, reason: excuseReasonDraft.trim(), fileUrl: fileUrl || e.fileUrl, status: 'Excused' as const } : e));
      }
      setEditingExcuseId(null);
      setExcuseFileDraft(null);
      showToast(t('تم حفظ تفاصيل العذر.', 'Excuse details saved.'), 'success');
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const handleUnexcuse = async (recordId: string) => {
    setIsUnexcusingId(recordId);
    const ok = await unexcuseAttendanceRecord(recordId);
    setIsUnexcusingId(null);
    if (ok) {
      setExcusedStudents(prev => prev.map(e => e.recordId === recordId ? { ...e, status: 'Absent' as const, reason: null, fileUrl: null } : e));
      setLateStudents(prev => prev.map(l => l.recordId === recordId ? { ...l, status: 'Late' as const, excuseReason: null } : l));
      if (editingExcuseId === recordId) setEditingExcuseId(null);
      showToast(t('تم إلغاء العذر — رجعت للحالة الأصلية.', 'Excuse removed — reverted to the original status.'), 'success');
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const navTabs: { id: AttendanceSection; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', labelAr: 'لوحة القيادة', labelEn: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'status', labelAr: 'حالة الحضور', labelEn: 'Attendance Status', icon: <ClipboardList size={18} /> },
    { id: 'late', labelAr: 'حالات التأخير', labelEn: 'Late Cases', icon: <Clock size={18} /> },
    { id: 'excuse', labelAr: 'حالات الغياب', labelEn: 'Absent Cases', icon: <FileWarning size={18} /> },
    { id: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: <Sliders size={18} /> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('إدارة الحضور', 'Attendance Management')}</h1>
        <p className="text-gray-500">{t('تتبع وإدارة حضور الطلاب.', "Track and manage students' attendance.")}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-0">
        {navTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeSection === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {isRTL ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* ============ DASHBOARD ============ */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setActiveSection('status')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-violet-300 hover:shadow-md transition-all">
              <p className="text-sm text-gray-500 font-medium mb-1">{t('نسبة الحضور', 'Attendance Rate')}</p>
              <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : `${todayStats.attendanceRate}%`}</h3>
            </button>
            <button onClick={() => setActiveSection('status')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-violet-300 hover:shadow-md transition-all">
              <p className="text-sm text-gray-500 font-medium mb-1">{t('فصول قيد الانتظار (اليوم)', 'Classes Pending (Today)')}</p>
              <div className="flex items-end gap-2">
                <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : todayStats.pendingClasses}</h3>
                <span className="text-sm text-gray-500 mb-1">/ {todayStats.totalClasses}</span>
              </div>
            </button>
            <button onClick={() => setActiveSection('late')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-violet-300 hover:shadow-md transition-all">
              <p className="text-sm text-gray-500 font-medium mb-1">{t('حالات التأخير', 'Late Cases')}</p>
              <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : lateStudents.length}</h3>
            </button>
            <button onClick={() => setActiveSection('excuse')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-violet-300 hover:shadow-md transition-all">
              <p className="text-sm text-gray-500 font-medium mb-1">{t('حالات الغياب — للمراجعة', 'Absent Cases — To Review')}</p>
              <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : excusedStudents.length}</h3>
            </button>
          </div>

          {renderFilterBar()}

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">{t('معدل الحضور حسب الصف', 'Attendance Rate by Grade')}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={isRTL ? 10 : -10} domain={[0, 100]} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="attendance" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('سجل الحضور التفصيلي', 'Detailed Attendance Log')}</h3>
            <div className="overflow-x-auto">
              <table className={`w-full ${isRTL ? 'text-right' : 'text-left'} border-collapse`}>
                <thead>
                  <tr className="border-b border-gray-100 text-sm text-gray-500">
                    <th className="pb-3 font-medium">{t('الطالب', 'Student')}</th>
                    <th className="pb-3 font-medium">{t('الصف', 'Grade')}</th>
                    <th className="pb-3 font-medium">{t('الفصل', 'Class')}</th>
                    <th className="pb-3 font-medium">{t('المعلم', 'Teacher')}</th>
                    <th className="pb-3 font-medium">{t('الوقت', 'Time')}</th>
                    <th className="pb-3 font-medium">{t('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingDashboard ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">{t('جاري التحميل...', 'Loading...')}</td></tr>
                  ) : filteredLogs.length > 0 ? filteredLogs.slice(0, 50).map(log => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 text-sm font-bold text-gray-900">{log.studentName}</td>
                      <td className="py-3 text-sm text-gray-600">{log.gradeLevel}</td>
                      <td className="py-3 text-sm text-gray-600">{log.className}</td>
                      <td className="py-3 text-sm text-gray-600">{log.teacherName}</td>
                      <td className="py-3 text-sm text-gray-500">{log.time}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.status === 'حاضر' ? 'bg-green-100 text-green-800' : 
                          log.status === 'متأخر' ? 'bg-yellow-100 text-yellow-800' :
                          log.status === 'معذور' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm">{t('مفيش سجلات مطابقة للفلتر.', 'No logs matching your filters.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredLogs.length > 50 && (
              <p className="text-xs text-gray-400 mt-4 text-center">{t(`عرض أول 50 من إجمالي ${filteredLogs.length} نتيجة — ضيّقي الفلتر لعرض تفاصيل أكتر.`, `Showing first 50 of ${filteredLogs.length} results — narrow your filters for more detail.`)}</p>
            )}
          </div>
        </div>
      )}

      {/* ============ ATTENDANCE STATUS ============ */}
      {activeSection === 'status' && (
        <div className="space-y-6">
          {!takingAttendanceForClass ? (
            <>
              {renderFilterBar()}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoadingDashboard ? (
                  <p className="text-sm text-gray-400 text-center py-12">{t('جاري التحميل...', 'Loading...')}</p>
                ) : filteredClasses.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">{t('مفيش فصول مطابقة.', 'No matching classes.')}</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                        <th className="px-5 py-3 font-bold">{t('الفصل', 'Class')}</th>
                        <th className="px-5 py-3 font-bold">{t('الصف', 'Grade')}</th>
                        <th className="px-5 py-3 font-bold">{t('المعلم', 'Teacher')}</th>
                        <th className="px-5 py-3 font-bold">{t('الحالة', 'Status')}</th>
                        <th className="px-5 py-3 font-bold">{t('إجراءات', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredClasses.map(cls => (
                        <tr key={cls.sectionId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-bold text-gray-900 text-sm">{cls.sectionName}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{cls.gradeLevel}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{cls.teacherName || t('بدون معلم', 'No teacher')}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              cls.status === 'complete' ? 'bg-green-100 text-green-700' :
                              cls.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {cls.status === 'complete' ? t('اتاخد الحضور', 'Taken') : cls.status === 'partial' ? `${t('جزئي', 'Partial')} (${cls.takenCount}/${cls.expectedCount})` : t('لسه ماخدش', 'Not Taken')}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => enterTakeAttendance(cls.sectionId)}
                              className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${cls.status === 'complete' ? 'text-gray-700 bg-gray-100 hover:bg-gray-200' : 'text-white bg-violet-600 hover:bg-violet-700'}`}
                            >
                              {cls.status === 'complete' ? t('عرض / تعديل', 'View / Edit') : t('خد الحضور', 'Take Attendance')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setTakingAttendanceForClass(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ChevronDown size={24} className={`${isRTL ? 'rotate-90' : '-rotate-90'} text-slate-600`} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{realClasses.find(c => c.id === takingAttendanceForClass)?.name}</h2>
                    <p className="text-slate-500">{t('تسجيل الحضور', 'Recording attendance')} {attendanceMode === 'Period' ? `${t('لـ', 'for')} ${realPeriods.find(p => p.id === selectedPeriodId)?.subject || t('حصة', 'period')}` : t('(يومي)', '(daily)')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                  <button onClick={goPrevDay} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={t('اليوم السابق', 'Previous day')}>
                    <ChevronDown size={18} className="rotate-90 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 min-w-[110px] text-center">
                    {isToday ? t('النهاردة', 'Today') : new Date(selectedDate).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <button onClick={goNextDay} disabled={isToday} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('اليوم التالي', 'Next day')}>
                    <ChevronDown size={18} className="-rotate-90 text-slate-600" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder={t('البحث عن طلاب...', 'Search students...')} 
                      className={`${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm w-64`}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                    <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} size={16} />
                  </div>
                  <Button onClick={markAllPresent} disabled={!isToday || !canTakeAttendance} className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
                    <CheckCircle2 size={16} className={isRTL ? 'ml-2' : 'mr-2'} /> {t('تحديد الكل كحاضر', 'Mark All Present')}
                  </Button>
                  <Button onClick={saveAttendance} disabled={isSavingAttendance || !isToday || !canTakeAttendance} className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
                    {isSavingAttendance ? t('جاري الحفظ...', 'Saving...') : attendanceSaved ? t('تم الحفظ ✓', 'Saved ✓') : !isToday ? t('للعرض فقط', 'View Only') : t('حفظ الحضور', 'Save Attendance')}
                  </Button>
                </div>
              </div>

              {!isToday && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                  {t(
                    `إنت بتعرض سجل حضور ${new Date(selectedDate) < new Date(todayStr) ? 'يوم فات' : 'يوم لسه ما جاش'} — التسجيل والتعديل متاح بس للنهاردة.`,
                    `You're viewing attendance for a ${new Date(selectedDate) < new Date(todayStr) ? 'past' : 'future'} day — recording and editing is only available for today.`
                  )}
                </div>
              )}

              {attendanceMode === 'Period' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                     {realPeriods.map(p => (
                       <button
                         key={p.id}
                         onClick={() => setSelectedPeriodId(p.id)}
                         className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-all ${
                           selectedPeriodId === p.id ? 'bg-violet-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                         }`}
                       >
                         {p.subject}{p.startTime ? ` • ${p.startTime}` : ''}
                       </button>
                     ))}
                  </div>
                  {realPeriods.length === 0 && (
                    <p className="text-sm text-gray-400">{t('مفيش حصص للفصل ده لسه — روح لتاب "الجدول الزمني" جوه صفحة الفصل عشان تضيف الحصص أولًا.', 'This class has no periods yet — go to the "Schedule" tab inside the class page to add periods first.')}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoadingAttendanceData ? (
                  <p className="col-span-full text-center text-gray-400 text-sm py-10">{t('جاري تحميل الحضور المسجّل مسبقًا... استنّي شوية قبل ما تبدئي التسجيل.', 'Loading previously recorded attendance... please wait before marking.')}</p>
                ) : realStudents.filter(s => (realClasses.find(c => c.id === takingAttendanceForClass)?.students || []).includes(s.id) && s.name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => {
                  const status = currentAttendance[student.id];
                  
                  return (
                    <div key={student.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={student.avatar || `https://ui-avatars.com/api/?name=${student.name}&background=random`} alt={student.name} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover" />
                          <div>
                            <p className="font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.id}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex bg-gray-50 p-1 rounded-xl">
                        <button
                          onClick={() => handleStatusChange(student.id, 'present')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'present' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'present' && <CheckCircle2 size={14} />} {t('حاضر', 'Present')}
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'absent')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'absent' && <XCircle size={14} />} {t('غائب', 'Absent')}
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'late')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'late' ? 'bg-yellow-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'late' && <Clock size={14} />} {t('متأخر', 'Late')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ LATE CASES ============ */}
      {activeSection === 'late' && (
        <div className="space-y-6">
          {!selectedLateClass ? (
            <>
            {renderFilterBar()}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{t('الفصول اللي فيها حالات تأخير', 'Classes With Late Cases')}</h3>
              </div>
              {isLoadingDashboard ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('جاري التحميل...', 'Loading...')}</p>
              ) : Object.keys(lateByClass).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('مفيش حالات تأخير في الفترة دي.', 'No late cases in this period.')}</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {Object.entries(lateByClass).map(([className, rows]) => (
                    <button
                      key={className}
                      onClick={() => setSelectedLateClass(className)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center shrink-0">
                          <Clock size={16} />
                        </div>
                        <span className="font-bold text-gray-900">{className}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{rows.length} {t('حالة', 'case(s)')}</span>
                        <ChevronRight size={18} className={`text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center gap-3">
                <button onClick={() => setSelectedLateClass(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                  <ChevronDown size={20} className={`${isRTL ? 'rotate-90' : '-rotate-90'} text-gray-600`} />
                </button>
                <h3 className="text-lg font-bold text-gray-900">{selectedLateClass}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(lateByClass[selectedLateClass] || []).map(l => (
                  <div key={l.recordId} className="p-4">
                    {editingExcuseId === l.recordId ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center shrink-0">
                            <Clock size={16} />
                          </div>
                          <p className="font-bold text-gray-900 text-sm shrink-0 w-32 truncate">{l.studentName}</p>
                          <input
                            autoFocus
                            type="text"
                            value={excuseReasonDraft}
                            onChange={(e) => setExcuseReasonDraft(e.target.value)}
                            placeholder={t('سبب العذر...', 'Reason for excuse...')}
                            className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div className="flex items-center gap-2 pl-12">
                          <button onClick={() => handleSaveExcuse(l.recordId, 'Late')} disabled={isSavingExcuse} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0">
                            {isSavingExcuse ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                          </button>
                          <button onClick={() => setEditingExcuseId(null)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shrink-0">{t('إلغاء', 'Cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center shrink-0">
                          <Clock size={16} />
                        </div>
                        <div className="w-36 shrink-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{l.studentName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{l.time}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingExcuseId(l.recordId); setExcuseReasonDraft(l.excuseReason || ''); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${l.status === 'Excused' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}
                          >
                            {t('بعذر', 'With excuse')}
                          </button>
                          <button
                            onClick={() => handleUnexcuse(l.recordId)}
                            disabled={isUnexcusingId === l.recordId || l.status !== 'Excused'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap disabled:cursor-default ${l.status !== 'Excused' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {isUnexcusingId === l.recordId ? t('جاري...', '...') : t('بدون عذر', 'No excuse')}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          {l.excuseReason && (
                            <p className={`text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                              {l.excuseReason}
                            </p>
                          )}
                        </div>
                        {l.totalLateCount > maxLateCount && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold shrink-0">
                            <AlertCircle size={11} /> {t('تعدّى الحد', 'Over Limit')} ({l.totalLateCount})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ EXCUSE CASES ============ */}
      {activeSection === 'excuse' && (
        <div className="space-y-6">
          {!selectedExcuseClass ? (
            <>
            {renderFilterBar()}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{t('الفصول اللي فيها حالات غياب', 'Classes With Absent Cases')}</h3>
              </div>
              {isLoadingDashboard ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('جاري التحميل...', 'Loading...')}</p>
              ) : Object.keys(excuseByClass).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('مفيش حالات غياب في الفترة دي.', 'No absent cases in this period.')}</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {Object.entries(excuseByClass).map(([className, rows]) => (
                    <button
                      key={className}
                      onClick={() => setSelectedExcuseClass(className)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare size={16} />
                        </div>
                        <span className="font-bold text-gray-900">{className}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{rows.length} {t('حالة', 'case(s)')}</span>
                        <ChevronRight size={18} className={`text-gray-400 ${isRTL ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center gap-3">
                <button onClick={() => setSelectedExcuseClass(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                  <ChevronDown size={20} className={`${isRTL ? 'rotate-90' : '-rotate-90'} text-gray-600`} />
                </button>
                <h3 className="text-lg font-bold text-gray-900">{selectedExcuseClass}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(excuseByClass[selectedExcuseClass] || []).map(ex => (
                  <div key={ex.recordId} className="p-4">
                    {editingExcuseId === ex.recordId ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center shrink-0">
                            <MessageSquare size={16} />
                          </div>
                          <p className="font-bold text-gray-900 text-sm shrink-0 w-32 truncate">{ex.studentName}</p>
                          <input
                            autoFocus
                            type="text"
                            value={excuseReasonDraft}
                            onChange={(e) => setExcuseReasonDraft(e.target.value)}
                            placeholder={t('سبب العذر...', 'Reason for excuse...')}
                            className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        </div>
                        <div className="flex items-center gap-2 pl-12">
                          <input
                            type="file"
                            onChange={(e) => setExcuseFileDraft(e.target.files?.[0] || null)}
                            className="flex-1 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-600 file:text-xs file:font-bold"
                          />
                          <button onClick={() => handleSaveExcuse(ex.recordId)} disabled={isSavingExcuse} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0">
                            {isSavingExcuse ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                          </button>
                          <button onClick={() => { setEditingExcuseId(null); setExcuseFileDraft(null); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shrink-0">{t('إلغاء', 'Cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare size={16} />
                        </div>
                        <div className="w-36 shrink-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{ex.studentName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{ex.time}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingExcuseId(ex.recordId); setExcuseReasonDraft(ex.reason || ''); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${ex.status === 'Excused' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}
                          >
                            {t('بعذر', 'With excuse')}
                          </button>
                          <button
                            onClick={() => handleUnexcuse(ex.recordId)}
                            disabled={isUnexcusingId === ex.recordId || ex.status !== 'Excused'}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap disabled:cursor-default ${ex.status !== 'Excused' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {isUnexcusingId === ex.recordId ? t('جاري...', '...') : t('بدون عذر', 'No excuse')}
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          {ex.reason && (
                            <p className={`text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                              {ex.reason}
                            </p>
                          )}
                        </div>
                        {ex.fileUrl && (
                          <a href={ex.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-violet-600 hover:underline shrink-0">
                            {t('عرض المستند', 'View Document')}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ SETTINGS ============ */}
      {activeSection === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-2xl p-4">
              <p className="text-sm text-violet-800 font-bold">{settingsLoaded ? t('الإعدادات محمّلة من قاعدة البيانات', 'Settings loaded from database') : t('جاري تحميل الإعدادات...', 'Loading settings...')}</p>
              <Button onClick={handleSaveSettings} disabled={!canEditSettings} className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">{t('حفظ الإعدادات', 'Save Settings')}</Button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <SettingsIcon size={20} className="text-violet-600" />
                {t('تكرار تسجيل الحضور', 'Attendance Frequency')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => setAttendanceMode('Daily')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${attendanceMode === 'Daily' ? 'border-violet-500 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <Calendar size={24} className={`mb-2 ${attendanceMode === 'Daily' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <h4 className="font-bold text-gray-900">{t('مرة يومياً', 'Once Daily')}</h4>
                  <p className="text-xs text-gray-500 mt-1">{t('الأفضل للمرحلة الابتدائية. يُسجل مرة واحدة صباحاً.', 'Best for primary school. Recorded once in the morning.')}</p>
                </div>
                <div 
                  onClick={() => setAttendanceMode('Period')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${attendanceMode === 'Period' ? 'border-violet-500 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <Clock size={24} className={`mb-2 ${attendanceMode === 'Period' ? 'text-violet-600' : 'text-gray-400'}`} />
                  <h4 className="font-bold text-gray-900">{t('حسب المادة/الحصة', 'Per Subject/Period')}</h4>
                  <p className="text-xs text-gray-500 mt-1">{t('الأفضل للمرحلة الثانوية. يُسجل في بداية كل حصة.', 'Best for high school. Recorded at the start of each period.')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-violet-600" />
                {t('القواعد والأتمتة', 'Rules & Automation')}
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                    <span>{t('فترة السماح (دقائق التأخير)', 'Grace Period (late minutes)')}</span>
                    <span className="text-violet-600">{lateThreshold} {t('دقيقة', 'min')}</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="60" 
                    step="5"
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <p className="text-xs text-gray-500 mt-2">{t(`الطلاب الذين يسجلون حضورهم بعد ${lateThreshold} دقيقة سيتم اعتبارهم 'متأخرين' تلقائياً.`, `Students checking in after ${lateThreshold} minutes will automatically be marked 'Late'.`)}</p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                    <span>{t('الحد الأقصى لمرات التأخير المسموحة للطالب', 'Max allowed late count per student')}</span>
                    <span className="text-violet-600">{maxLateCount} {t('مرة', 'times')}</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="1"
                    value={maxLateCount}
                    onChange={(e) => setMaxLateCount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <p className="text-xs text-gray-500 mt-2">{t(`لو الطالب تعدّى ${maxLateCount} مرة تأخير، هيظهر تنبيه للمشرف في لوحة الحضور.`, `If a student exceeds ${maxLateCount} late arrivals, an alert will show in the admin's attendance dashboard.`)}</p>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{t('رسالة نصية فورية عند الغياب', 'Instant SMS on absence')}</p>
                      <p className="text-xs text-gray-500">{t('إشعار أولياء الأمور فوراً عند تسجيل غياب الطالب.', 'Notifies parents instantly when a student is marked absent.')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={smsOnAbsent} onChange={() => setSmsOnAbsent(!smsOnAbsent)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{t('رسالة نصية فورية عند التأخير', 'Instant SMS on late arrival')}</p>
                      <p className="text-xs text-gray-500">{t('إشعار أولياء الأمور فوراً عند تسجيل تأخير الطالب.', 'Notifies parents instantly when a student is marked late.')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={smsOnLate} onChange={() => setSmsOnLate(!smsOnLate)} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {warningCriteria && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <AlertCircle size={20} className="text-violet-600" />
                {t('معايير التحذير المبكر — الحضور', 'Early Warning Criteria — Attendance')}
              </h3>
              <p className="text-xs text-gray-500 mb-4">{t('تحدد نسبة الحضور اللي بتصنّف الطالب "حرج" أو "تحذير" في رادار التحذير المبكر بـ Talia Learn.', "Determines the attendance percentage that classifies a student as 'Critical' or 'Warning' in Talia Learn's Early Warning Radar.")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-red-600 mb-2 block">{t('حالة حرجة: نسبة الحضور أقل من (%)', 'Critical: attendance below (%)')}</label>
                  <input
                    type="number"
                    value={warningCriteria.criticalAttendance}
                    onChange={(e) => setWarningCriteria({ ...warningCriteria, criticalAttendance: Number(e.target.value) })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-amber-600 mb-2 block">{t('تحذير: نسبة الحضور أقل من (%)', 'Warning: attendance below (%)')}</label>
                  <input
                    type="number"
                    value={warningCriteria.warningAttendance}
                    onChange={(e) => setWarningCriteria({ ...warningCriteria, warningAttendance: Number(e.target.value) })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveWarningCriteria}
                disabled={isSavingWarningCriteria}
                className="mt-4 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {isSavingWarningCriteria ? t('جاري الحفظ...', 'Saving...') : t('حفظ المعايير', 'Save Criteria')}
              </button>
            </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <List size={20} className="text-violet-600" />
                {t('حالات مخصصة', 'Custom Statuses')}
              </span>
              <Button variant="ghost" className="p-1 h-auto" onClick={() => setIsAddingStatus(true)}><Plus size={18} /></Button>
            </h3>
            
            <div className="space-y-3">
              {statuses.map((status) => (
                <div key={status.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${status.color}`}></div>
                    <span className="font-bold text-gray-900">{status.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{t('أساسية', 'Built-in')}</span>
                </div>
              ))}

              {isLoadingCustomStatuses ? (
                <p className="text-sm text-gray-400 text-center py-3">{t('جاري التحميل...', 'Loading...')}</p>
              ) : customStatuses.map((status) => (
                <div key={status.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${status.color}`}></div>
                    <span className="font-bold text-gray-900">{isRTL ? status.labelAr : status.labelEn}</span>
                  </div>
                  <button onClick={() => handleDeleteStatus(status.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {isAddingStatus && (
                <div className="p-4 border border-violet-200 rounded-xl bg-violet-50 space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">{t('اسم الحالة', 'Status Name')}</label>
                    <input 
                      type="text" 
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      placeholder={t('مثال: رحلة ميدانية', 'e.g. Field Trip')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">{t('اللون', 'Color')}</label>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewStatusColor(color)}
                          className={`w-6 h-6 rounded-full ${color} ${newStatusColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="secondary" className="flex-1 py-1.5 text-xs" onClick={() => setIsAddingStatus(false)}>{t('إلغاء', 'Cancel')}</Button>
                    <Button className="flex-1 py-1.5 text-xs" disabled={isSavingCustomStatus} onClick={handleAddStatus}>{isSavingCustomStatus ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
