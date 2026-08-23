import React, { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { getPeriods, createPeriod, getTeachersBySubject, getTeachers } from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { Teacher } from '../types';

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const WEEK_DAY_MAP = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const SUBJECTS = ['رياضيات', 'علوم', 'لغة عربية', 'لغة إنجليزية', 'تاريخ', 'فنون'];
const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
const todayArabicDay = () => WEEK_DAY_MAP[new Date().getDay()];

// عنصر اختيار موحّد بثيم النظام (بنفسجي، حواف دائرية) لكن مبني على select عادي عشان يفضل موثوق 100%
const ThemedSelect = ({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) => (
  <div className="relative">
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
);

// المودال ده معمول كـ component مستقل بحالته الخاصة، عشان الكتابة أو الاختيار جواه
// ميعملش إعادة رسم للجدول اللي وراه كله (وده اللي كان بيسبب اهتزاز الخلفية).
const AddPeriodModal: React.FC<{
  sectionId: string;
  defaultTeacherId?: string;
  initialDay: string;
  initialStartTime: string;
  initialEndTime: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ sectionId, defaultTeacherId, initialDay, initialStartTime, initialEndTime, onClose, onSaved }) => {
  const [formSubject, setFormSubject] = useState(SUBJECTS[0]);
  const [formDay, setFormDay] = useState(initialDay);
  const [formStartTime, setFormStartTime] = useState(initialStartTime);
  const [formEndTime, setFormEndTime] = useState(initialEndTime);
  const [formTeacherId, setFormTeacherId] = useState(defaultTeacherId || '');
  const [realTeachers, setRealTeachers] = useState<Teacher[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (!formSubject) { setRealTeachers([]); return; }
    getTeachersBySubject(formSubject).then(teachers => {
      setRealTeachers(teachers);
      if (defaultTeacherId && teachers.some(t => t.id === defaultTeacherId)) {
        setFormTeacherId(defaultTeacherId);
      } else {
        setFormTeacherId(teachers.length > 0 ? teachers[0].id : '');
      }
    });
  }, [formSubject]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await createPeriod({
      sectionId,
      subject: formSubject,
      day: formDay,
      startTime: formStartTime,
      endTime: formEndTime,
      teacherId: formTeacherId || null,
    });
    setIsSaving(false);
    if (result.conflict) {
      showToast(`في تعارض في الميعاد ده — يوم ${formDay} من ${formStartTime} لـ ${formEndTime} محجوز أصلًا لحصة "${result.conflictSubject}". اختار ميعاد تاني.`, 'error');
      return;
    }
    if (result.id) {
      onSaved();
      onClose();
    } else {
      showToast('حصل خطأ أثناء حفظ الحصة. تأكد إنك شغّلت كود إنشاء جدول class_periods في Supabase.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold text-slate-900 mb-6">{t('إضافة حصة جديدة', 'Add New Period')}</h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('المادة', 'Subject')}</label>
            <ThemedSelect value={formSubject} onChange={setFormSubject} options={SUBJECTS.map(s => ({ value: s, label: s }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('المعلم', 'Teacher')}</label>
            <ThemedSelect
              value={formTeacherId}
              onChange={setFormTeacherId}
              options={[{ value: '', label: t('بدون معلم محدد', 'No teacher assigned') }, ...realTeachers.map(t => ({ value: t.id, label: t.name }))]}
            />
            {realTeachers.length === 0 ? (
              <p className="text-xs text-amber-600 mt-1">مفيش معلمين مسجّلين على مادة "{formSubject}" لسه في قاعدة البيانات.</p>
            ) : defaultTeacherId && formTeacherId === defaultTeacherId ? (
              <p className="text-xs text-slate-400 mt-1">المعلم الأساسي المعيّن على الفصل ده — تقدر تغيّره لو الحصة دي لمعلم بديل.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('اليوم', 'Day')}</label>
            <ThemedSelect value={formDay} onChange={setFormDay} options={ARABIC_DAYS.map(d => ({ value: d, label: d }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('الوقت', 'Time')}</label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={formStartTime}
                onChange={e => setFormStartTime(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"
              />
              <span className="text-slate-400 font-medium">-</span>
              <input
                type="time"
                value={formEndTime}
                onChange={e => setFormEndTime(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {t('إلغاء', 'Cancel')}
          </button>
          <button
            disabled={isSaving || !formSubject}
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? t('جاري الحفظ...', 'Saving...') : t('حفظ الحصة', 'Save Period')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ClassCalendar = ({ sectionId, defaultTeacherId, isRTL = false }: { sectionId: string; defaultTeacherId?: string; isRTL?: boolean }) => {
  const t = (ar: string, en: string) => (isRTL ? ar : en);
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({ day: ARABIC_DAYS[0], startTime: '09:00', endTime: '09:45' });
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);

  // الحصص الحقيقية بتاعة الفصل ده — بتتحمّل من قاعدة البيانات
  const [sessions, setSessions] = useState<{ id: string; subject: string; day: string; startTime: string; endTime: string; teacherId: string | null; color: string }[]>([]);

  const loadPeriods = () => {
    if (!sectionId) return;
    getPeriods(sectionId).then(periods => {
      setSessions(periods.map(p => ({ ...p, color: 'blue' })));
    });
  };

  React.useEffect(() => {
    if (!sectionId) return;
    Promise.all([getPeriods(sectionId), getTeachers()]).then(([periods, teachersData]) => {
      setSessions(periods.map(p => ({ ...p, color: 'blue' })));
      setAllTeachers(teachersData);
    });
  }, [sectionId]);

  const days = ARABIC_DAYS;
  const times = TIMES;

  const colorMap: Record<string, string> = {
    blue: 'bg-violet-100 border-l-4 border-violet-600 text-violet-800',
  };

  const teacherName = (id: string | null) => allTeachers.find(t => t.id === id)?.name;

  const openAddModal = (day: string, time?: string) => {
    let endTime = '09:45';
    if (time) {
      const nextTimeIndex = times.indexOf(time) + 1;
      endTime = nextTimeIndex < times.length ? times[nextTimeIndex] : '15:00';
    }
    setModalDefaults({ day, startTime: time || '09:00', endTime });
    setIsModalOpen(true);
  };

  const renderWeekOrDay = () => {
    const activeDays = view === 'Day' ? [todayArabicDay()] : days;

    return (
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white">
        <div className="min-w-[600px]">
          <div className={`grid ${view === 'Day' ? 'grid-cols-2' : 'grid-cols-6'} border-b border-slate-200 bg-slate-50 sticky top-0 z-10`}>
            <div className="p-4 border-r border-slate-200 text-center text-sm font-medium text-slate-500">{t('الوقت', 'Time')}</div>
            {activeDays.map(day => (
              <div key={day} className="p-4 border-r border-slate-200 text-center text-sm font-bold text-slate-700 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          {times.map(time => (
            <div key={time} className={`grid ${view === 'Day' ? 'grid-cols-2' : 'grid-cols-6'} border-b border-slate-100 last:border-b-0`}>
              <div className="p-4 border-r border-slate-200 text-center text-xs font-medium text-slate-500 bg-slate-50/50">
                {time}
              </div>
              {activeDays.map(day => {
                const session = sessions.find(s => s.day === day && s.startTime === time);
                return (
                  <div
                    key={`${day}-${time}`}
                    onClick={() => !session && openAddModal(day, time)}
                    className={`p-2 border-r border-slate-100 last:border-r-0 h-24 transition-colors relative group ${!session ? 'hover:bg-violet-50 cursor-pointer' : ''}`}
                  >
                    {!session && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Plus size={24} className="text-violet-400" />
                      </div>
                    )}
                    {session && (
                      <div className={`h-full w-full rounded p-3 ${colorMap[session.color]} flex flex-col shadow-sm`}>
                        <span className="text-sm font-bold">{session.subject}</span>
                        <span className="text-xs opacity-80 mt-1">{session.startTime} - {session.endTime}</span>
                        {teacherName(session.teacherId) && <span className="text-xs opacity-70 mt-1">{teacherName(session.teacherId)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const monthLabel = monthCursor.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toDateString();

    return (
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
          <button onClick={() => setMonthCursor(new Date(year, month - 1, 1))} className="px-3 py-1 text-sm rounded-lg hover:bg-slate-100">السابق</button>
          <span className="font-bold text-slate-800 text-sm">{monthLabel}</span>
          <button onClick={() => setMonthCursor(new Date(year, month + 1, 1))} className="px-3 py-1 text-sm rounded-lg hover:bg-slate-100">التالي</button>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEK_DAY_MAP.map(d => (
            <div key={d} className="p-2 border-r border-slate-200 text-center text-xs font-bold text-slate-600 last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - firstWeekday + 1;
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const cellDate = new Date(year, month, dayNum);
            const isToday = isCurrentMonth && cellDate.toDateString() === todayStr;
            const weekdayName = WEEK_DAY_MAP[cellDate.getDay()];
            const daySessions = isCurrentMonth ? sessions.filter(s => s.day === weekdayName) : [];
            return (
              <div
                key={i}
                onClick={() => isCurrentMonth && openAddModal(weekdayName)}
                className={`min-h-[90px] p-2 border-r border-b border-slate-100 last:border-r-0 ${isCurrentMonth ? 'hover:bg-violet-50 cursor-pointer' : 'bg-slate-50/50'}`}
              >
                <span className={`text-xs font-bold ${isToday ? 'bg-violet-600 text-white rounded-full px-1.5 py-0.5' : 'text-slate-500'}`}>
                  {isCurrentMonth ? dayNum : ''}
                </span>
                <div className="mt-1 space-y-1">
                  {daySessions.slice(0, 2).map(s => (
                    <div key={s.id} className="text-[10px] font-bold bg-violet-100 text-violet-800 rounded px-1 py-0.5 truncate">
                      {s.subject} · {s.startTime}
                    </div>
                  ))}
                  {daySessions.length > 2 && <div className="text-[10px] text-slate-400">+{daySessions.length - 2} {t('كمان', 'more')}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex-1 flex flex-col animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">{t('الجدول الزمني', 'Schedule')}</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
            {(['Day', 'Week', 'Month'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 md:flex-none px-4 py-1.5 text-sm rounded-md transition-all ${view === v ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                {v === 'Day' ? t('اليوم', 'Day') : v === 'Week' ? t('الأسبوع', 'Week') : t('الشهر', 'Month')}
              </button>
            ))}
          </div>
          <button
            onClick={() => openAddModal(view === 'Month' ? todayArabicDay() : days[0])}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={18} /> {t('إضافة حصة', 'Add Period')} +
          </button>
        </div>
      </div>

      {view === 'Month' ? renderMonth() : renderWeekOrDay()}

      {isModalOpen && (
        <AddPeriodModal
          sectionId={sectionId}
          defaultTeacherId={defaultTeacherId}
          initialDay={modalDefaults.day}
          initialStartTime={modalDefaults.startTime}
          initialEndTime={modalDefaults.endTime}
          onClose={() => setIsModalOpen(false)}
          onSaved={loadPeriods}
        />
      )}
    </div>
  );
};
