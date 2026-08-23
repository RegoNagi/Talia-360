import React, { useState } from 'react';
import { UserRole, Language, User } from '../types';
import { Button } from '../components/Button';
import { 
  Settings, 
  BarChart3, 
  List, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare,
  ChevronDown,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Users
} from 'lucide-react';
import { getStudents, getClassSections, saveAttendanceSession, getPeriods, getAttendanceSettings, saveAttendanceSettings, getAttendanceForDate, getTeachers, getEarlyWarningCriteria, updateEarlyWarningCriteria, EarlyWarningCriteria, getGradeLevels, getClassesAttendanceOverview, ClassAttendanceOverview, getAttendanceLogsForDate, AttendanceLogRow, getLateStudentsForDate, saveLateReason, LateStudentRow, getExcusedStudentsForDate, saveExcuseDetails, uploadExcuseFile, ExcusedStudentRow } from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { Teacher } from '../types';
import { Student, ClassSection } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AttendanceProps {
  role: UserRole;
  language: Language;
  user: User;
  permissions?: string[];
}

export const Attendance: React.FC<AttendanceProps> = ({ role, language, user, permissions = [] }) => {
  // لو مفيش صلاحيات محددة (حسابات الديمو) نسيب كل حاجة متاحة زي ما كانت
  const canTakeAttendance = permissions.length === 0 || permissions.includes('attendance_take');
  const canEditSettings = permissions.length === 0 || permissions.includes('attendance_settings');
  const [activeTab, setActiveTab] = useState<'teacher' | 'admin'>('admin');
  const [adminView, setAdminView] = useState<'dashboard' | 'setup'>('setup');
  
  // Setup State
  const [attendanceMode, setAttendanceMode] = useState<'Daily' | 'Period'>('Daily');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [maxLateCount, setMaxLateCount] = useState(5);
  const [smsOnAbsent, setSmsOnAbsent] = useState(true);
  const [smsOnLate, setSmsOnLate] = useState(false);
  
  const [statuses, setStatuses] = useState([
    { id: 'present', label: 'حاضر', color: 'bg-green-500' },
    { id: 'absent', label: 'غائب', color: 'bg-red-500' },
    { id: 'late', label: 'متأخر', color: 'bg-yellow-500' },
    { id: 'excused', label: 'معذور', color: 'bg-blue-500' }
  ]);
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('bg-purple-500');

  const availableColors = ['bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-violet-500', 'bg-teal-500'];

  const handleAddStatus = () => {
    if (newStatusLabel.trim()) {
      setStatuses([...statuses, { 
        id: newStatusLabel.toLowerCase().replace(/\s+/g, '-'), 
        label: newStatusLabel.trim(), 
        color: newStatusColor 
      }]);
      setNewStatusLabel('');
      setIsAddingStatus(false);
    }
  };

  const handleDeleteStatus = (id: string) => {
    setStatuses(statuses.filter(s => s.id !== id));
  };

  // Teacher State
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [realTeachers, setRealTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  // attendanceData بقى منظم حسب الحصة، عشان تسجيل حصة معينة ميأثرش على حصة تانية
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, string>>>({});
  const [realClasses, setRealClasses] = useState<ClassSection[]>([]);
  const [realStudents, setRealStudents] = useState<Student[]>([]);
  const [realPeriods, setRealPeriods] = useState<{ id: string; subject: string; day: string; startTime: string; endTime: string }[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);
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
    if (isToday) return; // مينفعش نتحرك لقدام أكتر من النهاردة، لحد ما اليوم الجديد يبدأ فعليًا
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
    if (activeTab === 'teacher') {
      Promise.all([getClassSections(), getStudents(), getTeachers()]).then(([classesData, studentsData, teachersData]) => {
        setRealClasses(classesData);
        setRealStudents(studentsData);
        setRealTeachers(teachersData);
      });
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (selectedClass && attendanceMode === 'Period') {
      getPeriods(selectedClass).then(p => {
        setRealPeriods(p);
        setSelectedPeriodId(p.length > 0 ? p[0].id : null);
      });
    }
  }, [selectedClass, attendanceMode]);

  // تحميل بيانات الحضور المسجّلة فعليًا (أو الفاضية) لليوم المختار — بيحل محل أي بيانات قديمة
  React.useEffect(() => {
    if (selectedClass) {
      getAttendanceForDate(selectedClass, selectedDate).then(setAttendanceData);
    }
  }, [selectedClass, selectedDate]);

  const [warningCriteria, setWarningCriteria] = useState<EarlyWarningCriteria | null>(null);
  const [isSavingWarningCriteria, setIsSavingWarningCriteria] = useState(false);
  React.useEffect(() => {
    getEarlyWarningCriteria().then(setWarningCriteria);
  }, []);
  const handleSaveWarningCriteria = async () => {
    if (!warningCriteria) return;
    setIsSavingWarningCriteria(true);
    const ok = await updateEarlyWarningCriteria({
      id: warningCriteria.id,
      criticalAttendance: warningCriteria.criticalAttendance,
      warningAttendance: warningCriteria.warningAttendance,
    });
    setIsSavingWarningCriteria(false);
    showToast(ok ? 'تم حفظ معايير التحذير المبكر.' : 'حصل خطأ أثناء الحفظ.', ok ? 'success' : 'error');
  };

  const handleSaveSettings = async () => {
    if (!canEditSettings) {
      showToast('معندكش صلاحية تعديل إعدادات الحضور.', 'error');
      return;
    }
    const ok = await saveAttendanceSettings(attendanceMode, lateThreshold, maxLateCount);
    if (ok) {
      showToast('تم حفظ إعدادات الحضور بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء حفظ الإعدادات. تأكد إنك شغّلت كود إنشاء جدول attendance_settings في Supabase.', 'error');
    }
  };

  const saveAttendance = async () => {
    if (!canTakeAttendance) {
      showToast('معندكش صلاحية تسجيل الحضور.', 'error');
      return;
    }
    if (!isToday) {
      showToast('مينفعش تسجّل أو تعدّل حضور يوم فات أو يوم لسه ماجاش.', 'error');
      return;
    }
    if (!selectedClass) return;
    if (attendanceMode === 'Period' && !selectedPeriodId) {
      showToast('اختار حصة الأول قبل ما تحفظ الحضور.', 'error');
      return;
    }
    setIsSavingAttendance(true);
    const classStudents = realStudents.filter(s => realClasses.find(c => c.id === selectedClass)?.students.includes(s.id));
    const statusMap: Record<string, string> = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
    const records = classStudents.map(s => ({
      studentId: s.id,
      status: statusMap[currentAttendance[s.id]] || 'Absent',
    }));
    const periodSubject = attendanceMode === 'Period' ? realPeriods.find(p => p.id === selectedPeriodId)?.subject : 'يوم كامل';
    const sessionId = await saveAttendanceSession({
      sectionId: selectedClass,
      date: selectedDate,
      subject: periodSubject,
      periodId: attendanceMode === 'Period' ? selectedPeriodId : null,
      records,
    });
    setIsSavingAttendance(false);
    if (sessionId) {
      setAttendanceSaved(true);
      setTimeout(() => setAttendanceSaved(false), 3000);
    } else {
      showToast('حصل خطأ أثناء حفظ الحضور. تأكد إنك شغّلت كود إنشاء جداول الحضور في Supabase.', 'error');
    }
  };

  // Admin State
  const [logSearch, setLogSearch] = useState('');
  const [filterDate, setFilterDate] = useState('اليوم');
  const [filterGrade, setFilterGrade] = useState('جميع الصفوف');
  const [filterClass, setFilterClass] = useState('جميع الفصول');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  // بيانات حقيقية للوحة المشرف
  const [realGradeLevels, setRealGradeLevels] = useState<{ id: string; name: string }[]>([]);
  const [classesOverview, setClassesOverview] = useState<ClassAttendanceOverview[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogRow[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const adminSelectedDate = filterDate === 'الأمس'
    ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })()
    : todayStr;

  const [lateStudents, setLateStudents] = useState<LateStudentRow[]>([]);
  const [editingLateReasonId, setEditingLateReasonId] = useState<string | null>(null);
  const [lateReasonDraft, setLateReasonDraft] = useState('');

  const [excusedStudents, setExcusedStudents] = useState<ExcusedStudentRow[]>([]);
  const [editingExcuseId, setEditingExcuseId] = useState<string | null>(null);
  const [excuseReasonDraft, setExcuseReasonDraft] = useState('');
  const [excuseFileDraft, setExcuseFileDraft] = useState<File | null>(null);
  const [isSavingExcuse, setIsSavingExcuse] = useState(false);

  const refreshAdminDashboard = () => {
    setIsLoadingDashboard(true);
    Promise.all([
      getClassesAttendanceOverview(adminSelectedDate, attendanceMode),
      getAttendanceLogsForDate(adminSelectedDate),
      getLateStudentsForDate(adminSelectedDate),
      getExcusedStudentsForDate(adminSelectedDate),
    ]).then(([overview, logs, late, excused]) => {
      setClassesOverview(overview);
      setAttendanceLogs(logs);
      setLateStudents(late);
      setExcusedStudents(excused);
      setIsLoadingDashboard(false);
    });
  };

  const handleSaveExcuse = async (recordId: string) => {
    setIsSavingExcuse(true);
    let fileUrl: string | null = null;
    if (excuseFileDraft) {
      fileUrl = await uploadExcuseFile(recordId, excuseFileDraft);
      if (!fileUrl) {
        showToast('حصل خطأ أثناء رفع الملف.', 'error');
        setIsSavingExcuse(false);
        return;
      }
    }
    const ok = await saveExcuseDetails(recordId, excuseReasonDraft.trim(), fileUrl);
    setIsSavingExcuse(false);
    if (ok) {
      setExcusedStudents(prev => prev.map(e => e.recordId === recordId ? { ...e, reason: excuseReasonDraft.trim(), fileUrl: fileUrl || e.fileUrl } : e));
      setEditingExcuseId(null);
      setExcuseFileDraft(null);
      showToast('تم حفظ تفاصيل العذر.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحفظ.', 'error');
    }
  };

  const handleSaveLateReason = async (recordId: string) => {
    const ok = await saveLateReason(recordId, lateReasonDraft.trim());
    if (ok) {
      setLateStudents(prev => prev.map(l => l.recordId === recordId ? { ...l, reason: lateReasonDraft.trim() } : l));
      setEditingLateReasonId(null);
      showToast('تم حفظ سبب التأخير.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحفظ.', 'error');
    }
  };

  React.useEffect(() => {
    getGradeLevels().then(setRealGradeLevels);
  }, []);

  React.useEffect(() => {
    if (activeTab === 'admin' && adminView === 'dashboard') {
      refreshAdminDashboard();
    }
  }, [activeTab, adminView, adminSelectedDate, attendanceMode]);

  const hasActiveFilters = filterDate !== 'اليوم' || filterGrade !== 'جميع الصفوف' || filterClass !== 'جميع الفصول' || filterStatuses.length > 0;

  const clearFilters = () => {
    setFilterDate('اليوم');
    setFilterGrade('جميع الصفوف');
    setFilterClass('جميع الفصول');
    setFilterStatuses([]);
    setCurrentPage(1);
  };

  const toggleStatusFilter = (status: string) => {
    setFilterStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setCurrentPage(1);
  };

  const filteredLogs = attendanceLogs.filter(log => {
    const matchesSearch = log.studentName.toLowerCase().includes(logSearch.toLowerCase()) ||
                          log.className.toLowerCase().includes(logSearch.toLowerCase()) ||
                          log.teacherName.toLowerCase().includes(logSearch.toLowerCase()) ||
                          log.status.toLowerCase().includes(logSearch.toLowerCase());
    
    const matchesGrade = filterGrade === 'جميع الصفوف' || log.gradeLevel === filterGrade;
    const matchesClass = filterClass === 'جميع الفصول' || log.className === filterClass;
    const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(log.status);

    return matchesSearch && matchesGrade && matchesClass && matchesStatus;
  });

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  // الفصول الحقيقية المتاحة حسب الصف المختار
  const availableClasses = filterGrade === 'جميع الصفوف' 
    ? Array.from(new Set(attendanceLogs.map(l => l.className)))
    : Array.from(new Set(attendanceLogs.filter(l => l.gradeLevel === filterGrade).map(l => l.className)));

  // حساب معدل الحضور الحقيقي لكل صف من السجلات الفعلية
  const filteredGradeData = (() => {
    const grades = filterGrade === 'جميع الصفوف' ? realGradeLevels.map(g => g.name) : [filterGrade];
    return grades.map(gradeName => {
      const gradeLogs = attendanceLogs.filter(l => l.gradeLevel === gradeName);
      const presentCount = gradeLogs.filter(l => l.status === 'حاضر' || l.status === 'متأخر').length;
      const attendance = gradeLogs.length > 0 ? Math.round((presentCount / gradeLogs.length) * 100) : 0;
      return { name: gradeName, attendance };
    }).filter(g => attendanceLogs.some(l => l.gradeLevel === g.name));
  })();

  // إحصائيات اليوم الحقيقية
  const todayStats = {
    attendanceRate: attendanceLogs.length > 0 ? Math.round((attendanceLogs.filter(l => l.status === 'حاضر' || l.status === 'متأخر').length / attendanceLogs.length) * 100) : 0,
    absentCount: attendanceLogs.filter(l => l.status === 'غائب').length,
    pendingClasses: classesOverview.filter(c => c.status !== 'complete').length,
    totalClasses: classesOverview.length,
  };

  const handleStatusChange = (studentId: string, status: string) => {
    if (!isToday || !canTakeAttendance) return;
    setAttendanceData(prev => ({
      ...prev,
      [activeKey]: { ...(prev[activeKey] || {}), [studentId]: status },
    }));
  };

  const markAllPresent = () => {
    if (!isToday || !canTakeAttendance) return;
    const classStudentIds = realClasses.find(c => c.id === selectedClass)?.students || [];
    const updated: Record<string, string> = { ...(attendanceData[activeKey] || {}) };
    realStudents.filter(s => classStudentIds.includes(s.id)).forEach(student => {
      updated[student.id] = 'present';
    });
    setAttendanceData(prev => ({ ...prev, [activeKey]: updated }));
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20" dir="rtl">
      {/* Header & Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الحضور</h1>
          <p className="text-gray-500">تتبع وإدارة حضور الطلاب.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('teacher')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'teacher' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            عرض المعلم
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            عرض الإدارة
          </button>
        </div>
      </div>

      {activeTab === 'admin' && (
        <div className="space-y-6">
          {/* Admin Sub-navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setAdminView('dashboard')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                adminView === 'dashboard' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              لوحة القيادة والسجلات
            </button>
            <button
              onClick={() => setAdminView('setup')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                adminView === 'setup' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              إعدادات التكوين
            </button>
          </div>

          {adminView === 'setup' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-2xl p-4">
                  <p className="text-sm text-violet-800 font-bold">{settingsLoaded ? 'الإعدادات محمّلة من قاعدة البيانات' : 'جاري تحميل الإعدادات...'}</p>
                  <Button onClick={handleSaveSettings} disabled={!canEditSettings} className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">حفظ الإعدادات</Button>
                </div>
                {/* Frequency & Mode */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings size={20} className="text-violet-600" />
                    Attendance Frequency
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      onClick={() => setAttendanceMode('Daily')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${attendanceMode === 'Daily' ? 'border-violet-500 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <Calendar size={24} className={`mb-2 ${attendanceMode === 'Daily' ? 'text-violet-600' : 'text-gray-400'}`} />
                      <h4 className="font-bold text-gray-900">مرة يومياً</h4>
                      <p className="text-xs text-gray-500 mt-1">الأفضل للمرحلة الابتدائية. يُسجل مرة واحدة صباحاً.</p>
                    </div>
                    <div 
                      onClick={() => setAttendanceMode('Period')}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${attendanceMode === 'Period' ? 'border-violet-500 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <Clock size={24} className={`mb-2 ${attendanceMode === 'Period' ? 'text-violet-600' : 'text-gray-400'}`} />
                      <h4 className="font-bold text-gray-900">حسب المادة/الحصة</h4>
                      <p className="text-xs text-gray-500 mt-1">الأفضل للمرحلة الثانوية. يُسجل في بداية كل حصة.</p>
                    </div>
                  </div>
                </div>

                {/* Grace Period & Automation */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertCircle size={20} className="text-violet-600" />
                    Rules & Automation
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                        <span>فترة السماح (دقائق التأخير)</span>
                        <span className="text-violet-600">{lateThreshold} دقيقة</span>
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
                      <p className="text-xs text-gray-500 mt-2">الطلاب الذين يسجلون حضورهم بعد {lateThreshold} دقيقة سيتم اعتبارهم 'متأخرين' تلقائياً.</p>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                        <span>الحد الأقصى لمرات التأخير المسموحة للطالب</span>
                        <span className="text-violet-600">{maxLateCount} مرة</span>
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
                      <p className="text-xs text-gray-500 mt-2">لو الطالب تعدّى {maxLateCount} مرة تأخير، هيظهر تنبيه للمشرف في لوحة الحضور.</p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">رسالة نصية فورية عند الغياب</p>
                          <p className="text-xs text-gray-500">إشعار أولياء الأمور فوراً عند تسجيل غياب الطالب.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={smsOnAbsent} onChange={() => setSmsOnAbsent(!smsOnAbsent)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">رسالة نصية فورية عند التأخير</p>
                          <p className="text-xs text-gray-500">إشعار أولياء الأمور فوراً عند تسجيل تأخير الطالب.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={smsOnLate} onChange={() => setSmsOnLate(!smsOnLate)} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Early Warning Radar — معايير الحضور */}
                {warningCriteria && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <AlertCircle size={20} className="text-violet-600" />
                    معايير التحذير المبكر — الحضور
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">تحدد نسبة الحضور اللي بتصنّف الطالب "حرج" أو "تحذير" في رادار التحذير المبكر بـ Talia Learn.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-red-600 mb-2 block">حالة حرجة: نسبة الحضور أقل من (%)</label>
                      <input
                        type="number"
                        value={warningCriteria.criticalAttendance}
                        onChange={(e) => setWarningCriteria({ ...warningCriteria, criticalAttendance: Number(e.target.value) })}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-amber-600 mb-2 block">تحذير: نسبة الحضور أقل من (%)</label>
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
                    {isSavingWarningCriteria ? 'جاري الحفظ...' : 'حفظ المعايير'}
                  </button>
                </div>
                )}
              </div>

              {/* Custom Statuses */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <List size={20} className="text-violet-600" />
                    Custom Statuses
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
                      <button onClick={() => handleDeleteStatus(status.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  {isAddingStatus && (
                    <div className="p-4 border border-violet-200 rounded-xl bg-violet-50 space-y-4 animate-fadeIn">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">اسم الحالة</label>
                        <input 
                          type="text" 
                          value={newStatusLabel}
                          onChange={(e) => setNewStatusLabel(e.target.value)}
                          placeholder="مثال: رحلة ميدانية"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">اللون</label>
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
                        <Button variant="secondary" className="flex-1 py-1.5 text-xs" onClick={() => setIsAddingStatus(false)}>إلغاء</Button>
                        <Button className="flex-1 py-1.5 text-xs" onClick={handleAddStatus}>حفظ</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dashboard Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium mb-1">نسبة حضور اليوم</p>
                  <div className="flex items-end gap-2">
                    <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : `${todayStats.attendanceRate}%`}</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium mb-1">إجمالي الغائبين</p>
                  <div className="flex items-end gap-2">
                    <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : todayStats.absentCount}</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium mb-1">فصول قيد الانتظار</p>
                  <div className="flex items-end gap-2">
                    <h3 className="text-3xl font-bold text-gray-900">{isLoadingDashboard ? '...' : todayStats.pendingClasses}</h3>
                    <span className="text-sm text-gray-500 mb-1">/ {todayStats.totalClasses}</span>
                  </div>
                </div>
              </div>

              {/* نظرة عامة على الفصول — مين خد الحضور ومين لسه */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">حالة الحضور لكل فصل اليوم</h3>
                {isLoadingDashboard ? (
                  <p className="text-sm text-gray-400 text-center py-8">جاري التحميل...</p>
                ) : classesOverview.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">مفيش فصول متعملة لسه.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {classesOverview.map(cls => (
                      <div key={cls.sectionId} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{cls.sectionName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{cls.gradeLevel} • {cls.teacherName || 'بدون معلم'}</p>
                          <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cls.status === 'complete' ? 'bg-green-100 text-green-700' :
                            cls.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {cls.status === 'complete' ? 'اتاخد الحضور' : cls.status === 'partial' ? `جزئي (${cls.takenCount}/${cls.expectedCount})` : 'لسه ماخدش'}
                          </span>
                        </div>
                        {cls.status !== 'complete' && (
                          <button
                            onClick={() => {
                              const fullClass = realClasses.find(c => c.id === cls.sectionId);
                              setSelectedTeacherId(fullClass?.teacherId || null);
                              setSelectedClass(cls.sectionId);
                              setActiveTab('teacher');
                            }}
                            className="text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors shrink-0"
                          >
                            خد الحضور
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* حالات التأخير اليوم */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">حالات التأخير اليوم</h3>
                {isLoadingDashboard ? (
                  <p className="text-sm text-gray-400 text-center py-8">جاري التحميل...</p>
                ) : lateStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">مفيش حالات تأخير النهاردة.</p>
                ) : (
                  <div className="space-y-2">
                    {lateStudents.map(l => (
                      <div key={l.recordId} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center shrink-0">
                              <Clock size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{l.studentName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{l.className} • {l.time}</p>
                            </div>
                          </div>
                          {l.totalLateCount > maxLateCount && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold shrink-0">
                              <AlertCircle size={11} /> تعدّى الحد ({l.totalLateCount} مرة)
                            </span>
                          )}
                        </div>
                        <div className="mt-3">
                          {editingLateReasonId === l.recordId ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={lateReasonDraft}
                                onChange={(e) => setLateReasonDraft(e.target.value)}
                                placeholder="سبب التأخير..."
                                className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button onClick={() => handleSaveLateReason(l.recordId)} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold">حفظ</button>
                              <button onClick={() => setEditingLateReasonId(null)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold">إلغاء</button>
                            </div>
                          ) : l.reason ? (
                            <button onClick={() => { setEditingLateReasonId(l.recordId); setLateReasonDraft(l.reason || ''); }} className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full text-right hover:border-violet-300">
                              {l.reason}
                            </button>
                          ) : (
                            <button onClick={() => { setEditingLateReasonId(l.recordId); setLateReasonDraft(''); }} className="text-xs text-violet-600 font-bold hover:underline">
                              + إضافة سبب التأخير
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* حالات العذر — للمراجعة */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">حالات العذر اليوم — للمراجعة</h3>
                {isLoadingDashboard ? (
                  <p className="text-sm text-gray-400 text-center py-8">جاري التحميل...</p>
                ) : excusedStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">مفيش حالات عذر النهاردة.</p>
                ) : (
                  <div className="space-y-2">
                    {excusedStudents.map(ex => (
                      <div key={ex.recordId} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center shrink-0">
                            <MessageSquare size={16} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">{ex.studentName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{ex.className} • {ex.time}</p>
                          </div>
                          {ex.fileUrl && (
                            <a href={ex.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-violet-600 hover:underline shrink-0">
                              عرض المستند
                            </a>
                          )}
                        </div>
                        <div className="mt-3">
                          {editingExcuseId === ex.recordId ? (
                            <div className="space-y-2">
                              <input
                                autoFocus
                                type="text"
                                value={excuseReasonDraft}
                                onChange={(e) => setExcuseReasonDraft(e.target.value)}
                                placeholder="سبب العذر..."
                                className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  onChange={(e) => setExcuseFileDraft(e.target.files?.[0] || null)}
                                  className="flex-1 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-600 file:text-xs file:font-bold"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleSaveExcuse(ex.recordId)} disabled={isSavingExcuse} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
                                  {isSavingExcuse ? 'جاري الحفظ...' : 'حفظ'}
                                </button>
                                <button onClick={() => { setEditingExcuseId(null); setExcuseFileDraft(null); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold">إلغاء</button>
                              </div>
                            </div>
                          ) : ex.reason ? (
                            <button onClick={() => { setEditingExcuseId(ex.recordId); setExcuseReasonDraft(ex.reason || ''); }} className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full text-right hover:border-violet-300">
                              {ex.reason}
                            </button>
                          ) : (
                            <button onClick={() => { setEditingExcuseId(ex.recordId); setExcuseReasonDraft(''); }} className="text-xs text-violet-600 font-bold hover:underline">
                              + مراجعة العذر وإضافة السبب
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Global Filter Bar */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    <select 
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option>اليوم</option>
                      <option>الأمس</option>
                      <option>هذا الأسبوع</option>
                      <option>تاريخ مخصص</option>
                    </select>

                    <select 
                      value={filterGrade}
                      onChange={(e) => {
                        setFilterGrade(e.target.value);
                        setFilterClass('جميع الفصول'); // Reset class when grade changes
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option>جميع الصفوف</option>
                      {realGradeLevels.map(g => <option key={g.id}>{g.name}</option>)}
                    </select>

                    <select 
                      value={filterClass}
                      onChange={(e) => {
                        setFilterClass(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option>جميع الفصول</option>
                      {availableClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      {['حاضر', 'غائب', 'متأخر'].map(status => (
                        <button
                          key={status}
                          onClick={() => toggleStatusFilter(status)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                            filterStatuses.includes(status) 
                              ? status === 'حاضر' ? 'bg-green-100 text-green-800' :
                                status === 'غائب' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              : 'text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <Button variant="secondary" onClick={clearFilters} className="text-xs py-2">
                      Clear Filters
                    </Button>
                  )}
                </div>

                {/* Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">معدل الحضور حسب الصف</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredGradeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={-10} domain={[0, 100]} />
                        <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="attendance" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Audit Logs Table */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold text-gray-900">سجلات التدقيق</h3>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="البحث في السجلات..." 
                        value={logSearch}
                        onChange={(e) => {
                          setLogSearch(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm w-full md:w-64"
                      />
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-sm text-gray-500">
                          <th className="pb-3 font-medium">الطالب</th>
                          <th className="pb-3 font-medium">الفصل</th>
                          <th className="pb-3 font-medium">المعلم</th>
                          <th className="pb-3 font-medium">الوقت</th>
                          <th className="pb-3 font-medium">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.length > 0 ? paginatedLogs.map(log => (
                          <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 text-sm font-bold text-gray-900">{log.student}</td>
                            <td className="py-3 text-sm text-gray-600">{log.class}</td>
                            <td className="py-3 text-sm text-gray-600">{log.teacher}</td>
                            <td className="py-3 text-sm text-gray-500">{log.time}</td>
                            <td className="py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                log.status === 'حاضر' ? 'bg-green-100 text-green-800' : 
                                log.status === 'متأخر' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                              No logs found matching your filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500">
                        عرض <span className="font-bold text-gray-900">{(currentPage - 1) * logsPerPage + 1}</span> إلى <span className="font-bold text-gray-900">{Math.min(currentPage * logsPerPage, filteredLogs.length)}</span> من إجمالي <span className="font-bold text-gray-900">{filteredLogs.length}</span> نتيجة
                      </p>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="secondary" 
                          className="px-3 py-1.5 text-sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                                currentPage === i + 1 ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <Button 
                          variant="secondary" 
                          className="px-3 py-1.5 text-sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teacher' && (
        <div className="space-y-6">
          {!selectedTeacherId ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center max-w-lg mx-auto mt-10">
              <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">أنت مين؟</h2>
              <p className="text-gray-500 mb-6">اختار اسمك عشان نعرضلك بس الفصول المعيّن عليها.</p>

              <div className="space-y-3">
                {realTeachers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacherId(t.id)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-violet-500 hover:bg-violet-50 transition-all text-right"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.specialization}</p>
                    </div>
                    <ChevronDown size={20} className="text-gray-400 -rotate-90" />
                  </button>
                ))}
                {realTeachers.length === 0 && (
                  <p className="text-sm text-gray-400">مفيش معلمين مسجّلين لسه في قاعدة البيانات.</p>
                )}
              </div>
            </div>
          ) : !selectedClass ? (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center max-w-lg mx-auto mt-10">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setSelectedTeacherId(null)} className="text-sm text-violet-600 font-bold hover:underline">
                  تغيير المعلم
                </button>
                <span className="text-sm text-gray-500">{realTeachers.find(t => t.id === selectedTeacherId)?.name}</span>
              </div>
              <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">اختر فصلاً</h2>
              <p className="text-gray-500 mb-6">اختر فصلاً لبدء تسجيل حضور اليوم.</p>
              
              <div className="space-y-3">
                {realClasses.filter(cls => cls.teacherId === selectedTeacherId).map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.id)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-violet-500 hover:bg-violet-50 transition-all text-right"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{cls.name}</p>
                      <p className="text-xs text-gray-500">{cls.gradeLevel} • {cls.students.length} طلاب</p>
                    </div>
                    <ChevronDown size={20} className="text-gray-400 -rotate-90" />
                  </button>
                ))}
                {realClasses.filter(cls => cls.teacherId === selectedTeacherId).length === 0 && (
                  <p className="text-sm text-gray-400">المعلم ده مش معيّن كمعلم رئيسي على أي فصل لسه.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedClass(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ChevronDown size={24} className="rotate-90 text-slate-600" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{realClasses.find(c => c.id === selectedClass)?.name}</h2>
                    <p className="text-slate-500">تسجيل الحضور {attendanceMode === 'Period' ? `لـ${realPeriods.find(p => p.id === selectedPeriodId)?.subject || 'حصة'}` : '(يومي)'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                  <button onClick={goPrevDay} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="اليوم السابق">
                    <ChevronDown size={18} className="rotate-90 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 min-w-[110px] text-center">
                    {isToday ? 'النهاردة' : new Date(selectedDate).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <button onClick={goNextDay} disabled={isToday} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="اليوم التالي">
                    <ChevronDown size={18} className="-rotate-90 text-slate-600" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="البحث عن طلاب..." 
                      className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm w-64"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  </div>
                  <Button onClick={markAllPresent} disabled={!isToday || !canTakeAttendance} className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
                    <CheckCircle2 size={16} className="mr-2" /> تحديد الكل كحاضر
                  </Button>
                  <Button onClick={saveAttendance} disabled={isSavingAttendance || !isToday || !canTakeAttendance} className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
                    {isSavingAttendance ? 'جاري الحفظ...' : attendanceSaved ? 'تم الحفظ ✓' : !isToday ? 'للعرض فقط' : 'حفظ الحضور'}
                  </Button>
                </div>
              </div>

              {!isToday && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
                  إنت بتعرض سجل حضور {new Date(selectedDate) < new Date(todayStr) ? 'يوم فات' : 'يوم لسه ما جاش'} — التسجيل والتعديل متاح بس للنهاردة.
                </div>
              )}

              {/* Period Selector Bar (وضع "حسب الحصة" فقط) — الحصص دي بتتنشئ من تاب "الجدول الزمني" جوه الفصل */}
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
                    <p className="text-sm text-gray-400">مفيش حصص للفصل ده لسه — روح لتاب "الجدول الزمني" جوه صفحة الفصل عشان تضيف الحصص أولًا.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {realStudents.filter(s => (realClasses.find(c => c.id === selectedClass)?.students || []).includes(s.id) && s.name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => {
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
                        <button className="text-gray-400 hover:text-violet-600 transition-colors p-2 hover:bg-gray-50 rounded-full">
                          <MessageSquare size={18} />
                        </button>
                      </div>
                      
                      <div className="flex bg-gray-50 p-1 rounded-xl">
                        <button
                          onClick={() => handleStatusChange(student.id, 'present')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'present' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'present' && <CheckCircle2 size={14} />} Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'absent')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'absent' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'absent' && <XCircle size={14} />} Absent
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, 'late')}
                          disabled={!isToday || !canTakeAttendance}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed ${
                            status === 'late' ? 'bg-yellow-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 disabled:hover:bg-transparent'
                          }`}
                        >
                          {status === 'late' && <Clock size={14} />} Late
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
    </div>
  );
};
