import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UserRole, Language } from '../types';
import { showToast } from '../components/Toast';
import {
  getScheduleSettings, updateScheduleSettings, ScheduleSettings,
  getScheduleBreaks, addScheduleBreak, deleteScheduleBreak, ScheduleBreak,
  getAllTeachersWithCodes, getClassSections,
  getFullSchedule, ScheduleEntry, importSchedule, ScheduleImportRow, ScheduleImportResult,
  getTeacherAbsences, addTeacherAbsence, deleteTeacherAbsence, TeacherAbsence,
  getAffectedPeriodsForAbsence, assignSubstitute, AffectedPeriod,
} from '../services/supabaseData';
import {
  Settings as SettingsIcon,
  Upload,
  CalendarDays,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  X,
  UserX,
} from 'lucide-react';

interface ScheduleProps {
  role: UserRole;
  language: Language;
}

type ScheduleSection = 'settings' | 'upload' | 'calendar' | 'substitution';
type CalendarView = 'day' | 'week' | 'month' | 'term';

const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS: Record<string, { ar: string; en: string }> = {
  Sunday: { ar: 'الأحد', en: 'Sun' },
  Monday: { ar: 'الإثنين', en: 'Mon' },
  Tuesday: { ar: 'الثلاثاء', en: 'Tue' },
  Wednesday: { ar: 'الأربعاء', en: 'Wed' },
  Thursday: { ar: 'الخميس', en: 'Thu' },
  Friday: { ar: 'الجمعة', en: 'Fri' },
  Saturday: { ar: 'السبت', en: 'Sat' },
};

export const Schedule: React.FC<ScheduleProps> = ({ role, language }) => {
  const isRTL = language === Language.AR;
  const t = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeSection, setActiveSection] = useState<ScheduleSection>('calendar');

  // ============ الإعدادات ============
  const [settings, setSettings] = useState<ScheduleSettings>({ id: '', periodsPerDay: 7, periodDurationMinutes: 45, dayStartTime: '08:00' });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [breaks, setBreaks] = useState<ScheduleBreak[]>([]);
  const [newBreakAfter, setNewBreakAfter] = useState('');
  const [newBreakDuration, setNewBreakDuration] = useState('30');

  const refreshSettings = () => {
    setIsLoadingSettings(true);
    Promise.all([getScheduleSettings(), getScheduleBreaks()]).then(([s, b]) => {
      setSettings(s);
      setBreaks(b);
      setIsLoadingSettings(false);
    });
  };
  useEffect(() => { refreshSettings(); }, []);

  const handleAddBreak = async () => {
    const after = Number(newBreakAfter);
    const dur = Number(newBreakDuration);
    if (!after || !dur) return;
    const ok = await addScheduleBreak({ afterPeriod: after, durationMinutes: dur });
    if (ok) {
      setNewBreakAfter('');
      setNewBreakDuration('30');
      refreshSettings();
    }
  };

  const handleDeleteBreak = async (id: string) => {
    const ok = await deleteScheduleBreak(id);
    if (ok) refreshSettings();
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const ok = await updateScheduleSettings(settings);
    setIsSavingSettings(false);
    showToast(ok ? t('تم حفظ إعدادات الجدول.', 'Schedule settings saved.') : t('حصل خطأ أثناء الحفظ.', 'Error saving.'), ok ? 'success' : 'error');
  };

  // ============ الرفع من الإكسيل ============
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ScheduleImportResult | null>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      t('كود الفصل', 'Class Code'),
      t('اليوم (Sunday..Saturday)', 'Day (Sunday..Saturday)'),
      t('وقت البداية (HH:MM)', 'Start Time (HH:MM)'),
      t('وقت النهاية (HH:MM)', 'End Time (HH:MM)'),
      t('المادة', 'Subject'),
      t('كود المعلم', 'Teacher Code'),
      t('القاعة (اختياري)', 'Room (optional)'),
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, t('قالب_جدول_الحصص.xlsx', 'schedule_template.xlsx'));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
        setImportRows(rows);
      } catch (err) {
        showToast(t('حصل خطأ أثناء قراءة الملف. تأكدي إنه ملف Excel صحيح.', 'Error reading the file. Make sure it is a valid Excel file.'), 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartImport = async () => {
    if (importRows.length === 0) return;
    setIsImporting(true);
    const rows: ScheduleImportRow[] = importRows.map((r: any) => ({
      classCode: String(r[t('كود الفصل', 'Class Code')] || '').trim(),
      day: String(r[t('اليوم (Sunday..Saturday)', 'Day (Sunday..Saturday)')] || '').trim(),
      startTime: String(r[t('وقت البداية (HH:MM)', 'Start Time (HH:MM)')] || '').trim(),
      endTime: String(r[t('وقت النهاية (HH:MM)', 'End Time (HH:MM)')] || '').trim(),
      subject: String(r[t('المادة', 'Subject')] || '').trim(),
      teacherCode: String(r[t('كود المعلم', 'Teacher Code')] || '').trim(),
      room: String(r[t('القاعة (اختياري)', 'Room (optional)')] || '').trim(),
    }));
    const result = await importSchedule(rows);
    setImportResult(result);
    setIsImporting(false);
    if (result.success) {
      showToast(t(`تم رفع ${result.insertedCount} حصة بنجاح.`, `${result.insertedCount} periods uploaded successfully.`), 'success');
      setImportRows([]);
      setImportFileName('');
      refreshCalendar();
    }
  };

  // ============ عرض التقويم ============
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [fullSchedule, setFullSchedule] = useState<ScheduleEntry[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [allTeachers, setAllTeachers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [filterTeacher, setFilterTeacher] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());

  const refreshCalendar = () => {
    setIsLoadingCalendar(true);
    Promise.all([getFullSchedule(), getAllTeachersWithCodes(), getClassSections()]).then(([schedule, teachers, classes]) => {
      setFullSchedule(schedule);
      setAllTeachers(teachers);
      setAllClasses(classes.map((c: any) => ({ id: c.id, name: c.name })));
      setIsLoadingCalendar(false);
    });
  };
  useEffect(() => { refreshCalendar(); }, []);

  const filteredSchedule = fullSchedule
    .filter(e => filterTeacher === 'ALL' || e.teacherId === filterTeacher)
    .filter(e => filterClass === 'ALL' || e.sectionId === filterClass);

  const goToday = () => setCurrentDate(new Date());
  const navigateDate = (dir: 1 | -1) => {
    const d = new Date(currentDate);
    if (calendarView === 'day') d.setDate(d.getDate() + dir);
    else if (calendarView === 'week') d.setDate(d.getDate() + dir * 7);
    else if (calendarView === 'month') d.setMonth(d.getMonth() + dir);
    else d.setMonth(d.getMonth() + dir * 3);
    setCurrentDate(d);
  };

  const currentDayName = DAYS_ORDER[currentDate.getDay()];

  const navTabs: { id: ScheduleSection; ar: string; en: string; icon: React.ReactNode }[] = [
    { id: 'calendar', ar: 'عرض الجدول', en: 'View Schedule', icon: <CalendarDays size={18} /> },
    { id: 'upload', ar: 'إدخال الجدول', en: 'Import Schedule', icon: <Upload size={18} /> },
    { id: 'substitution', ar: 'الاحتياطي وغياب المعلمين', en: 'Substitution & Absences', icon: <UserX size={18} /> },
    { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  // ============ غياب المعلمين والاحتياطي ============
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [absences, setAbsences] = useState<TeacherAbsence[]>([]);
  const [isLoadingAbsences, setIsLoadingAbsences] = useState(true);
  const [isAddingAbsence, setIsAddingAbsence] = useState(false);
  const [newAbsenceTeacherId, setNewAbsenceTeacherId] = useState('');
  const [newAbsenceReason, setNewAbsenceReason] = useState('');
  const [expandedAbsenceId, setExpandedAbsenceId] = useState<string | null>(null);
  const [affectedPeriods, setAffectedPeriods] = useState<Record<string, AffectedPeriod[]>>({});

  const refreshAbsences = () => {
    setIsLoadingAbsences(true);
    getTeacherAbsences(absenceDate, absenceDate).then((rows) => { setAbsences(rows); setIsLoadingAbsences(false); });
  };
  useEffect(() => { refreshAbsences(); }, [absenceDate]);

  const handleAddAbsence = async () => {
    if (!newAbsenceTeacherId) return;
    const teacher = allTeachers.find(tch => tch.id === newAbsenceTeacherId);
    const id = await addTeacherAbsence({ teacherId: newAbsenceTeacherId, absenceDate, reason: newAbsenceReason, recordedBy: t('المشرف', 'Admin') });
    if (id) {
      setNewAbsenceTeacherId('');
      setNewAbsenceReason('');
      setIsAddingAbsence(false);
      refreshAbsences();
      showToast(t('تم تسجيل الغياب.', 'Absence recorded.'), 'success');
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    const ok = await deleteTeacherAbsence(id);
    if (ok) refreshAbsences();
  };

  const toggleExpandAbsence = async (absence: TeacherAbsence) => {
    if (expandedAbsenceId === absence.id) {
      setExpandedAbsenceId(null);
      return;
    }
    setExpandedAbsenceId(absence.id);
    if (!affectedPeriods[absence.id]) {
      const periods = await getAffectedPeriodsForAbsence(absence.teacherId, absence.absenceDate);
      setAffectedPeriods(prev => ({ ...prev, [absence.id]: periods }));
    }
  };

  const handleAssignSubstitute = async (absence: TeacherAbsence, periodId: string, substituteTeacherId: string) => {
    if (!substituteTeacherId) return;
    const ok = await assignSubstitute(periodId, absence.absenceDate, substituteTeacherId);
    if (ok) {
      const periods = await getAffectedPeriodsForAbsence(absence.teacherId, absence.absenceDate);
      setAffectedPeriods(prev => ({ ...prev, [absence.id]: periods }));
      showToast(t('تم تعيين المعلم الاحتياطي.', 'Substitute teacher assigned.'), 'success');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('جدول الحصص', 'Class Schedule')}</h1>
        <p className="text-gray-500">{t('إدارة وعرض جدول الحصص الدراسي للمدرسة كلها.', "Manage and view the school's class timetable.")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {navTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeSection === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {isRTL ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* ============ الإعدادات ============ */}
      {activeSection === 'settings' && (
        <div className="max-w-2xl bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
          {isLoadingSettings ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('جاري التحميل...', 'Loading...')}</p>
          ) : (
            <>
              <div>
                <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                  <span>{t('عدد الحصص في اليوم', 'Periods per Day')}</span>
                  <span className="text-violet-600">{settings.periodsPerDay}</span>
                </label>
                <input
                  type="range" min="1" max="12" step="1"
                  value={settings.periodsPerDay}
                  onChange={(e) => setSettings({ ...settings, periodsPerDay: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                  <span>{t('مدة الحصة (دقيقة)', 'Period Duration (minutes)')}</span>
                  <span className="text-violet-600">{settings.periodDurationMinutes} {t('دقيقة', 'min')}</span>
                </label>
                <input
                  type="range" min="20" max="90" step="5"
                  value={settings.periodDurationMinutes}
                  onChange={(e) => setSettings({ ...settings, periodDurationMinutes: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">{t('اليوم بيبدأ الساعة كام؟ (أول حصة)', 'What time does the day start? (1st period)')}</label>
                <input
                  type="time"
                  value={settings.dayStartTime}
                  onChange={(e) => setSettings({ ...settings, dayStartTime: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-violet-600" /> {t('وقت الراحة', 'Break Time')}
                </h3>
                <p className="text-xs text-gray-400 mb-3">{t('تقدري تضيفي أكتر من فترة راحة في اليوم.', 'You can add more than one break in the day.')}</p>

                <div className="space-y-2 mb-4">
                  {breaks.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-700">{t(`بعد الحصة ${b.afterPeriod} — لمدة ${b.durationMinutes} دقيقة`, `After period ${b.afterPeriod} — ${b.durationMinutes} min`)}</p>
                      <button onClick={() => handleDeleteBreak(b.id)} className="text-gray-300 hover:text-red-500">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {breaks.length === 0 && <p className="text-sm text-gray-400">{t('مفيش فترات راحة متضافة لسه.', 'No breaks added yet.')}</p>}
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('بعد الحصة رقم', 'After Period #')}</label>
                    <input
                      type="number" min="1" max={settings.periodsPerDay}
                      value={newBreakAfter}
                      onChange={(e) => setNewBreakAfter(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('المدة (دقيقة)', 'Duration (min)')}</label>
                    <input
                      type="number" min="5" max="90"
                      value={newBreakDuration}
                      onChange={(e) => setNewBreakDuration(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <button onClick={handleAddBreak} className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-1">
                    <Plus size={16} /> {t('إضافة', 'Add')}
                  </button>
                </div>
              </div>

              {/* ملخص واضح للقراءة */}
              <div className="p-5 bg-violet-50 border border-violet-100 rounded-2xl">
                <p className="text-sm font-bold text-violet-800 mb-2">{t('الملخص', 'Summary')}</p>
                <p className="text-sm text-violet-700 leading-relaxed">
                  {t(
                    `اليوم الدراسي بيبدأ الساعة ${settings.dayStartTime} وفيه ${settings.periodsPerDay} حصص، كل حصة ${settings.periodDurationMinutes} دقيقة${breaks.length > 0 ? '، وفيه ' + breaks.length + ' فترة راحة' : ''}.`,
                    `The school day starts at ${settings.dayStartTime} and has ${settings.periodsPerDay} periods, each ${settings.periodDurationMinutes} minutes long${breaks.length > 0 ? `, with ${breaks.length} break(s)` : ''}.`
                  )}
                </p>
              </div>

              <button onClick={handleSaveSettings} disabled={isSavingSettings} className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold">
                {isSavingSettings ? t('جاري الحفظ...', 'Saving...') : t('حفظ الإعدادات', 'Save Settings')}
              </button>
            </>
          )}
        </div>
      )}

      {/* ============ إدخال الجدول ============ */}
      {activeSection === 'upload' && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-2">{t('الخطوة 1: نزّلي القالب', 'Step 1: Download the Template')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t(
                'القالب فيه الأعمدة المطلوبة بالظبط. كود الفصل بيبقى اسم الفصل زي ما هو مسجّل في النظام (مثال: 10-A)، وكود المعلم بتلاقيه في صفحة "المستخدمين → المعلمون".',
                'The template has exactly the columns needed. The Class Code is the class name as registered in the system (e.g. 10-A), and the Teacher Code can be found in "People → Teachers".'
              )}
            </p>
            <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold">
              <Download size={16} /> {t('تنزيل القالب', 'Download Template')}
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-2">{t('الخطوة 2: ارفعي الملف بعد التعبئة', 'Step 2: Upload the Filled File')}</h3>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
              <input type="file" id="schedule-upload" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelected} />
              <label htmlFor="schedule-upload" className="inline-block px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold cursor-pointer">
                {t('اختاري ملف Excel', 'Choose Excel File')}
              </label>
              {importFileName && <p className="text-xs text-gray-500 mt-3">{importFileName} — {importRows.length} {t('صف', 'rows')}</p>}
            </div>

            {importRows.length > 0 && (
              <button onClick={handleStartImport} disabled={isImporting} className="mt-4 w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold">
                {isImporting ? t('جاري الرفع والتحقق...', 'Uploading & validating...') : t(`رفع ${importRows.length} صف`, `Upload ${importRows.length} rows`)}
              </button>
            )}

            {importResult && (
              <div className={`mt-4 p-4 rounded-2xl border ${importResult.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? <CheckCircle2 size={18} className="text-green-600" /> : <AlertCircle size={18} className="text-red-600" />}
                  <p className={`font-bold text-sm ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {importResult.success
                      ? t(`تم رفع ${importResult.insertedCount} حصة بنجاح.`, `${importResult.insertedCount} periods uploaded successfully.`)
                      : t('في مشاكل لازم تتصلح قبل الرفع:', 'Issues need fixing before upload:')}
                  </p>
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="text-xs text-red-700 space-y-1 list-disc pl-5">
                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ عرض التقويم ============ */}
      {activeSection === 'calendar' && (
        <div className="space-y-4">
          {/* شريط التحكم */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
              {(['day', 'week', 'month', 'term'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${calendarView === v ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v === 'day' ? t('يوم', 'Day') : v === 'week' ? t('أسبوع', 'Week') : v === 'month' ? t('شهر', 'Month') : t('ترم', 'Term')}
                </button>
              ))}
            </div>

            {calendarView !== 'term' && (
              <div className="flex items-center gap-1">
                <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight size={16} className={isRTL ? '' : 'rotate-180'} />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg">{t('النهاردة', 'Today')}</button>
                <button onClick={() => navigateDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft size={16} className={isRTL ? '' : 'rotate-180'} />
                </button>
                <span className="text-sm font-bold text-gray-800 px-2">
                  {calendarView === 'day' && currentDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {calendarView === 'week' && currentDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                  {calendarView === 'month' && currentDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}

            <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500">
              <option value="ALL">{t('كل المعلمين', 'All Teachers')}</option>
              {allTeachers.map(tch => <option key={tch.id} value={tch.id}>{tch.name} ({tch.code})</option>)}
            </select>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-violet-500">
              <option value="ALL">{t('كل الفصول', 'All Classes')}</option>
              {allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {isLoadingCalendar ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400 text-sm">{t('جاري التحميل...', 'Loading...')}</div>
          ) : filteredSchedule.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400 text-sm">{t('مفيش جدول متعمل لسه — روحي تاب "إدخال الجدول".', 'No schedule set up yet — go to the "Import Schedule" tab.')}</div>
          ) : (
            <>
              {/* عرض اليوم */}
              {calendarView === 'day' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                  {filteredSchedule.filter(e => e.day === currentDayName).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                    <div key={e.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="w-24 shrink-0 text-center">
                        <p className="text-sm font-bold text-violet-700">{e.startTime}</p>
                        <p className="text-xs text-gray-400">{e.endTime}</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{e.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{e.sectionName} • {e.teacherName || t('بدون معلم', 'No teacher')}{e.room ? ` • ${e.room}` : ''}</p>
                      </div>
                    </div>
                  ))}
                  {filteredSchedule.filter(e => e.day === currentDayName).length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">{t('مفيش حصص في اليوم ده.', 'No periods on this day.')}</p>
                  )}
                </div>
              )}

              {/* عرض الأسبوع + الترم (نفس الجدول الأسبوعي المتكرر) */}
              {(calendarView === 'week' || calendarView === 'term') && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  {calendarView === 'term' && (
                    <p className="text-xs text-gray-400 p-4 pb-0">{t('النمط الأسبوعي ده بيتكرر طول الترم.', 'This weekly pattern repeats throughout the term.')}</p>
                  )}
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {DAYS_ORDER.map(day => (
                          <th key={day} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{isRTL ? DAY_LABELS[day].ar : DAY_LABELS[day].en}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {DAYS_ORDER.map(day => (
                          <td key={day} className="align-top p-2 border-r border-gray-50 last:border-0 min-w-[160px]">
                            <div className="space-y-2">
                              {filteredSchedule.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(e => (
                                <div key={e.id} className="p-2.5 bg-violet-50 border border-violet-100 rounded-xl">
                                  <p className="text-[11px] font-bold text-violet-700">{e.startTime}</p>
                                  <p className="text-xs font-bold text-gray-900 mt-0.5">{e.subject}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{e.sectionName}</p>
                                  <p className="text-[10px] text-gray-400">{e.teacherName}{e.room ? ` • ${e.room}` : ''}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* عرض الشهر */}
              {calendarView === 'month' && (() => {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const firstDay = new Date(year, month, 1);
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const startOffset = firstDay.getDay();
                const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {DAYS_ORDER.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase">{isRTL ? DAY_LABELS[day].ar : DAY_LABELS[day].en}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {cells.map((dayNum, idx) => {
                        if (dayNum === null) return <div key={idx} />;
                        const dateObj = new Date(year, month, dayNum);
                        const dayName = DAYS_ORDER[dateObj.getDay()];
                        const count = filteredSchedule.filter(e => e.day === dayName).length;
                        const isToday = dateObj.toDateString() === new Date().toDateString();
                        return (
                          <button
                            key={idx}
                            onClick={() => { setCurrentDate(dateObj); setCalendarView('day'); }}
                            className={`aspect-square p-2 rounded-xl border text-left flex flex-col justify-between hover:border-violet-300 transition-colors ${isToday ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-100'}`}
                          >
                            <span className={`text-xs font-bold ${isToday ? 'text-violet-700' : 'text-gray-600'}`}>{dayNum}</span>
                            {count > 0 && <span className="text-[10px] text-violet-600 font-bold">{count} {t('حصة', 'periods')}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ============ الاحتياطي وغياب المعلمين ============ */}
      {activeSection === 'substitution' && (
        <div className="max-w-4xl space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <label className="text-sm font-bold text-gray-700">{t('التاريخ', 'Date')}</label>
            <input
              type="date"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{t('المعلمون الغائبون في هذا اليوم', 'Teachers Absent on This Day')}</h3>
              <button onClick={() => setIsAddingAbsence(!isAddingAbsence)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Plus size={16} /> {t('تسجيل غياب', 'Record Absence')}
              </button>
            </div>

            {isAddingAbsence && (
              <div className="p-4 bg-gray-50 rounded-2xl mb-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('المعلم', 'Teacher')}</label>
                  <select
                    value={newAbsenceTeacherId}
                    onChange={(e) => setNewAbsenceTeacherId(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">{t('اختاري معلم...', 'Select a teacher...')}</option>
                    {allTeachers.map(tch => <option key={tch.id} value={tch.id}>{tch.name} ({tch.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('سبب الغياب (اختياري)', 'Reason (optional)')}</label>
                  <input
                    type="text"
                    value={newAbsenceReason}
                    onChange={(e) => setNewAbsenceReason(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddAbsence} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold">{t('حفظ', 'Save')}</button>
                  <button onClick={() => setIsAddingAbsence(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-sm font-bold">{t('إلغاء', 'Cancel')}</button>
                </div>
              </div>
            )}

            {isLoadingAbsences ? (
              <p className="text-gray-400 text-sm text-center py-8">{t('جاري التحميل...', 'Loading...')}</p>
            ) : absences.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{t('مفيش معلمين غايبين في اليوم ده.', 'No teachers absent on this day.')}</p>
            ) : (
              <div className="space-y-3">
                {absences.map(absence => (
                  <div key={absence.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => toggleExpandAbsence(absence)}
                      className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-100 text-red-700 rounded-full flex items-center justify-center shrink-0">
                          <UserX size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 text-sm">{absence.teacherName}</p>
                          {absence.reason && <p className="text-xs text-gray-500">{absence.reason}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span onClick={(e) => { e.stopPropagation(); handleDeleteAbsence(absence.id); }} className="text-gray-400 hover:text-red-500 p-1">
                          <X size={16} />
                        </span>
                        <ChevronRight size={16} className={`text-gray-400 transition-transform ${expandedAbsenceId === absence.id ? 'rotate-90' : (isRTL ? '' : '')}`} />
                      </div>
                    </button>
                    {expandedAbsenceId === absence.id && (
                      <div className="p-4 space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">{t('الحصص المتأثرة — عيّني معلم احتياطي لكل واحدة', 'Affected Periods — Assign a Substitute for Each')}</p>
                        {(affectedPeriods[absence.id] || []).length === 0 ? (
                          <p className="text-sm text-gray-400">{t('مفيش حصص لهذا المعلم في هذا اليوم.', 'No periods for this teacher on this day.')}</p>
                        ) : (
                          (affectedPeriods[absence.id] || []).map(p => (
                            <div key={p.periodId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                              <div className="w-28 shrink-0">
                                <p className="text-xs font-bold text-gray-700">{p.startTime}</p>
                                <p className="text-[10px] text-gray-400">{p.endTime}</p>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-900">{p.subject}</p>
                                <p className="text-xs text-gray-500">{p.sectionName}</p>
                              </div>
                              <select
                                value={p.substituteTeacherId || ''}
                                onChange={(e) => handleAssignSubstitute(absence, p.periodId, e.target.value)}
                                className={`px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500 ${p.substituteTeacherId ? 'bg-green-50 border-green-200 text-green-800 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}
                              >
                                <option value="">{t('عيّني احتياطي...', 'Assign substitute...')}</option>
                                {allTeachers.filter(tch => tch.id !== absence.teacherId).map(tch => (
                                  <option key={tch.id} value={tch.id}>{tch.name} ({tch.code})</option>
                                ))}
                              </select>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
