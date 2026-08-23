import React, { useState, useEffect } from 'react';
import { UserRole, Language, User, ClassSection, AttendanceSession, AttendanceStatus, CurriculumSystem, Student, Teacher } from '../types';
import { getStudents, getClassSections, getTeachers, createClassSection, saveAttendanceSession, getTodayAttendanceForSection, updateClassSection, deleteClassSection, bulkDeleteClassSections, addEnrollment, removeEnrollment, getGradeLevels, getPeriods, getCurriculumWeeks } from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { ClassCalendar } from './ClassCalendar';
import { 
  Users, 
  Plus, 
  Settings, 
  Calendar, 
  MapPin, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MoreVertical,
  BookOpen,
  Scan,
  Smartphone,
  WifiOff,
  History,
  AlertTriangle,
  RotateCw,
  UserPlus,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ChevronDown,
  FileText,
  Save,
  ArrowRight,
  List,
  Upload,
  Download,
  Info,
  X,
  FileSpreadsheet,
  PlusCircle,
  Calculator,
  Atom,
  Globe,
  ChevronRight,
  ChevronLeft,
  Search,
  Briefcase
} from 'lucide-react';
import { ArrowLeftRight } from 'lucide-react';

// بيجيب الخطة الأكاديمية الحقيقية للأسبوع الحالي، لكل مادة بتتدرّس في الفصل ده فعليًا
async function getWeeklyPlanForClass(gradeLevel: string, sectionId: string): Promise<{ subject: string; weekNumber: number | null; startDate: string; endDate: string; topics: string[] }[]> {
  const periods = await getPeriods(sectionId);
  const subjects = Array.from(new Set(periods.map((p) => p.subject)));
  const today = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(subjects.map(async (subject) => {
    const weeks = await getCurriculumWeeks(gradeLevel, subject);
    const currentWeek = weeks.find((w) => w.startDate && w.endDate && today >= w.startDate && today <= w.endDate);
    if (!currentWeek) return null;
    return {
      subject,
      weekNumber: currentWeek.weekNumber,
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      topics: (currentWeek.topics || []).map((t: any) => typeof t === 'string' ? t : (t.text || '')),
    };
  }));

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

const AcademicPlanAccordion = ({ gradeLevel, sectionId }: { gradeLevel: string; sectionId: string }) => {
  const [plan, setPlan] = useState<{ subject: string; weekNumber: number | null; startDate: string; endDate: string; topics: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    getWeeklyPlanForClass(gradeLevel, sectionId).then((data) => {
      setPlan(data);
      setExpandedSubject(data[0]?.subject || null);
      setIsLoading(false);
    });
  }, [gradeLevel, sectionId]);

  const toggleSubject = (subject: string) => {
    setExpandedSubject((prev) => (prev === subject ? null : subject));
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex-1 overflow-y-auto">
      <div className="mb-6">
        <h3 className="font-bold text-slate-900 text-lg">{t('الخطة الأكاديمية للأسبوع', "This Week's Academic Plan")}</h3>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-slate-400 py-8">{t('جاري التحميل...', 'Loading...')}</p>
      ) : plan.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">{t('مفيش خطة أسبوعية مسجّلة لأي مادة من مواد الفصل ده للأسبوع الحالي.', 'No weekly plan recorded for any subject in this class for the current week.')}</p>
      ) : (
        <div className="space-y-2">
          {plan.map((subjectPlan) => {
            const isExpanded = expandedSubject === subjectPlan.subject;
            return (
              <div key={subjectPlan.subject} className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                <button
                  onClick={() => toggleSubject(subjectPlan.subject)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-600">
                      <BookOpen size={18} />
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block">{subjectPlan.subject}</span>
                      <span className="text-[11px] text-slate-400">
                        {subjectPlan.weekNumber != null && `${t('الأسبوع', 'Week')} ${subjectPlan.weekNumber} · `}
                        {formatDate(subjectPlan.startDate)} - {formatDate(subjectPlan.endDate)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/30">
                    {subjectPlan.topics.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">{t('مفيش مواضيع مسجّلة للأسبوع ده.', 'No topics recorded for this week.')}</p>
                    ) : (
                      <div className="space-y-2 pt-2">
                        {subjectPlan.topics.map((topic, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                            <p className="text-sm text-slate-700">{topic}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// (الصفوف الدراسية بقت بتتجاب حقيقي من قاعدة البيانات، مش قايمة ثابتة هنا)

const EditClassModal: React.FC<{
  cls: ClassSection;
  teachers: Teacher[];
  gradeLevels: string[];
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
}> = ({ cls, teachers, gradeLevels, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: cls.name || '',
    gradeLevel: cls.gradeLevel || gradeLevels[0] || '',
    teacherId: cls.teacherId || '',
    academicYear: cls.academicYear || '',
    capacity: (cls as any).capacity || 25,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">{t('تعديل بيانات الفصل', "Edit Class Information")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t('اسم الفصل', 'Class Name')}</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t('الصف الدراسي', 'Grade Level')}</label>
            <select value={form.gradeLevel} onChange={(e) => setForm({...form, gradeLevel: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t('المعلم الرئيسي', 'Homeroom Teacher')}</label>
            <select value={form.teacherId} onChange={(e) => setForm({...form, teacherId: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">{t('بدون معلم محدد', 'No teacher assigned')}</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t('السعة الاستيعابية', 'Capacity')}</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm({...form, capacity: parseInt(e.target.value) || 0})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>
        <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button variant="primary" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ التعديلات', 'Save Changes')}</Button>
        </div>
      </div>
    </div>
  );
};

interface ClassManagementProps {
  role: UserRole;
  language: Language;
  user: User;
  permissions?: string[];
}

export const ClassManagement: React.FC<ClassManagementProps> = ({ role, language, user, permissions = [] }) => {
  const isRTL = language === Language.AR;
  const t = (ar: string, en: string) => (isRTL ? ar : en);
  const canManageClasses = permissions.length === 0 || permissions.includes('classes_manage');
  // Navigation State
  const [viewState, setViewState] = useState<'list' | 'create' | 'class-detail' | 'scanner'>('list');
  const [activeClass, setActiveClass] = useState<ClassSection | null>(null);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [classesLoading, setClassesLoading] = useState<boolean>(true);
  const [realStudents, setRealStudents] = useState<Student[]>([]);
  const [realTeachers, setRealTeachers] = useState<Teacher[]>([]);
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'attendance'>('name');
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getGradeLevels().then((grades) => setGradeLevels(grades.map(g => g.name)));
  }, []);

  const refreshClasses = () => {
    setClassesLoading(true);
    getClassSections().then((data) => {
      setClasses(data);
      setClassesLoading(false);
    });
  };

  // تعديل وحذف الفصول
  const [editingClass, setEditingClass] = useState<ClassSection | null>(null);
  const [openClassMenu, setOpenClassMenu] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const toggleSelectClass = (id: string) => {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleUpdateClass = async (form: any): Promise<boolean> => {
    if (!editingClass) return false;
    const ok = await updateClassSection({
      sectionId: editingClass.id,
      name: form.name,
      gradeLevel: form.gradeLevel,
      teacherId: form.teacherId,
      academicYear: form.academicYear,
      capacity: form.capacity,
    });
    if (ok) {
      refreshClasses();
      showToast('تم تعديل بيانات الفصل بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء تعديل الفصل.', 'error');
    }
    return ok;
  };

  const handleDeleteClass = async (cls: ClassSection) => {
                    const confirmed = await confirmDialog(t(`متأكد إنك عايز تمسح فصل "${cls.name}"؟ هيتمسح معاه كل تسجيلات الطلاب والحصص وسجلات الحضور المرتبطة بيه.`, `Are you sure you want to delete the class "${cls.name}"? All enrollments, periods, and related attendance records will be deleted too.`), t('حذف', 'Delete'));
    if (!confirmed) return;
    const ok = await deleteClassSection(cls.id);
    if (ok) {
      refreshClasses();
      showToast('تم حذف الفصل.', 'success');
    } else {
      showToast('حصل خطأ أثناء حذف الفصل.', 'error');
    }
  };

  const handleBulkDeleteClasses = async () => {
        const confirmed = await confirmDialog(t(`متأكد إنك عايز تمسح ${selectedClassIds.length} فصل؟ الإجراء ده مينفعش يترجع.`, `Are you sure you want to delete ${selectedClassIds.length} classes? This action cannot be undone.`), t('حذف الكل', 'Delete All'));
    if (!confirmed) return;
    const ok = await bulkDeleteClassSections(selectedClassIds);
    if (ok) {
      refreshClasses();
      setSelectedClassIds([]);
      showToast('تم حذف الفصول المحددة.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف الجماعي.', 'error');
    }
  };

  useEffect(() => {
    setClassesLoading(true);
    Promise.all([getClassSections(), getStudents(), getTeachers()]).then(([classesData, studentsData, teachersData]) => {
      setClasses(classesData);
      setRealStudents(studentsData);
      setRealTeachers(teachersData);
      setClassesLoading(false);
    });
  }, []);

  // بيعيد تحميل الطلاب والمعلمين أول ما تدخل شاشة إنشاء فصل أو تفاصيل فصل،
  // عشان أي طالب أو معلم اتضاف من صفحة تانية (زي إدارة المستخدمين) يظهر فورًا من غير ما تحتاج تعمل refresh للمتصفح
  useEffect(() => {
    if (viewState === 'create' || viewState === 'class-detail') {
      Promise.all([getStudents(), getTeachers()]).then(([studentsData, teachersData]) => {
        setRealStudents(studentsData);
        setRealTeachers(teachersData);
      });
    }
  }, [viewState]);

  // Update activeClass when classes state changes
  useEffect(() => {
    if (activeClass) {
      const updated = classes.find(c => c.id === activeClass.id);
      if (updated) setActiveClass(updated);
    }
  }, [classes]);

  // --- Shared Components ---

  const ClassDetail = ({ role, classData }: { role: UserRole, classData: ClassSection }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'calendar'>('overview');
    const [qrActive, setQrActive] = useState(false);
    const [qrCode, setQrCode] = useState('INIT_TOKEN');
    const [timer, setTimer] = useState(7);
    const [scannedStudents, setScannedStudents] = useState<string[]>([]);
    const [manualAttendance, setManualAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' }));
    const [todayAttendance, setTodayAttendance] = useState<Record<string, 'present' | 'absent'>>({});
    const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
    const [transferTargetClassId, setTransferTargetClassId] = useState<string | null>(null);
    const [isTransferring, setIsTransferring] = useState(false);

    const enrolledStudents = realStudents.filter(s => classData.students.includes(s.id));

    React.useEffect(() => {
      getTodayAttendanceForSection(classData.id).then(setTodayAttendance);
    }, [classData.id]);

    const sortedStudents = [...enrolledStudents].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'attendance') return b.attendance - a.attendance;
      return 0;
    });

    const markAllPresent = () => {
       const updates: Record<string, AttendanceStatus> = {};
       enrolledStudents.forEach(s => {
          updates[s.id] = 'Present';
       });
       setManualAttendance(updates);
       setScannedStudents(enrolledStudents.map(s => s.id));
    };

    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [attendanceSaved, setAttendanceSaved] = useState(false);

    const saveAttendance = async () => {
      setIsSavingAttendance(true);
      const records = enrolledStudents.map(s => ({
        studentId: s.id,
        status: manualAttendance[s.id] || 'Absent',
      }));
      const sessionId = await saveAttendanceSession({
        sectionId: classData.id,
        date: new Date().toISOString().slice(0, 10),
        subject: classData.name,
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

    const toggleStatus = (studentId: string) => {
       const current = manualAttendance[studentId] || 'Absent';
       const states: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];
       const next = states[(states.indexOf(current) + 1) % states.length];
       setManualAttendance(prev => ({ ...prev, [studentId]: next }));
       if (next === 'Present' || next === 'Late') {
         if (!scannedStudents.includes(studentId)) setScannedStudents(prev => [...prev, studentId]);
       } else {
         setScannedStudents(prev => prev.filter(id => id !== studentId));
       }
    };

    const removeStudent = async (studentId: string) => {
          const confirmed = await confirmDialog(t('متأكد إنك عايز تشيل الطالب ده من قائمة الفصل؟', 'Are you sure you want to remove this student from the class list?'), t('شيل', 'Remove'));
      if (confirmed) {
        const ok = await removeEnrollment(studentId, classData.id);
        if (ok) {
          setClasses(prev => prev.map(c => 
            c.id === classData.id 
              ? { ...c, students: c.students.filter(id => id !== studentId) } 
              : c
          ));
          showToast('تم حذف الطالب من الفصل.', 'success');
        } else {
          showToast('حصل خطأ أثناء حذف الطالب من الفصل.', 'error');
        }
      }
    };

    const addStudent = async (studentId: string) => {
      const ok = await addEnrollment(studentId, classData.id);
      if (ok) {
        setClasses(prev => prev.map(c => 
          c.id === classData.id 
            ? { ...c, students: [...c.students, studentId] } 
            : c
        ));
        setIsAddStudentModalOpen(false);
        showToast('تم إضافة الطالب للفصل.', 'success');
      } else {
        showToast('حصل خطأ أثناء إضافة الطالب للفصل.', 'error');
      }
    };

    const otherSameGradeClasses = classes.filter(c => c.id !== classData.id && c.gradeLevel === classData.gradeLevel);

    const handleTransferStudent = async (targetClassId: string) => {
      if (!transferringStudent) return;
      setIsTransferring(true);
      const removeOk = await removeEnrollment(transferringStudent.id, classData.id);
      const addOk = await addEnrollment(transferringStudent.id, targetClassId);
      setIsTransferring(false);
      if (removeOk && addOk) {
        refreshClasses();
        setTransferringStudent(null);
        setTransferTargetClassId(null);
        showToast('تم نقل الطالب للفصل الجديد.', 'success');
      } else {
        showToast('حصل خطأ أثناء النقل.', 'error');
      }
    };

    const handleSwapStudent = async (targetClassId: string, targetStudentId: string) => {
      if (!transferringStudent) return;
      setIsTransferring(true);
      const r1 = await removeEnrollment(transferringStudent.id, classData.id);
      const r2 = await removeEnrollment(targetStudentId, targetClassId);
      const a1 = await addEnrollment(transferringStudent.id, targetClassId);
      const a2 = await addEnrollment(targetStudentId, classData.id);
      setIsTransferring(false);
      if (r1 && r2 && a1 && a2) {
        refreshClasses();
        setTransferringStudent(null);
        setTransferTargetClassId(null);
        showToast('تم استبدال الطالبين بنجاح.', 'success');
      } else {
        showToast('حصل خطأ أثناء الاستبدال.', 'error');
      }
    };


    useEffect(() => {
      if (qrActive) {
        const interval = setInterval(() => {
           setTimer((prev) => {
             if (prev <= 1) {
                setQrCode(`TOKEN_${Date.now()}`); 
                return 7;
             }
             return prev - 1;
           });
        }, 1000);
        return () => clearInterval(interval);
      }
    }, [qrActive]);

    useEffect(() => {
       if (qrActive) {
          const randomScan = setInterval(() => {
             const available = enrolledStudents.filter(s => !scannedStudents.includes(s.id));
             if (available.length > 0 && Math.random() > 0.6) {
                const luckyStudent = available[0];
                setScannedStudents(prev => [...prev, luckyStudent.id]);
                setManualAttendance(prev => ({...prev, [luckyStudent.id]: 'Present'}));
             }
          }, 2000);
          return () => clearInterval(randomScan);
       }
    }, [qrActive, scannedStudents, enrolledStudents]);

    const todaysLesson = {
      title: 'Quadratic Equations',
      objectives: ['Understand standard form', 'Solve by factoring', 'Identify coefficients'],
      materials: ['Graphing Calculator', 'Workbook Pg 45'],
      outline: [
         { duration: '10 min', activity: 'Introduction', description: 'Review of linear equations vs quadratic.' },
         { duration: '20 min', activity: 'Core Concept', description: 'Standard form ax^2 + bx + c = 0 explanation.' },
         { duration: '15 min', activity: 'Practice', description: 'Solving simple examples on whiteboard.' }
      ]
    };

    const presentCount = enrolledStudents.filter(s => todayAttendance[s.id] === 'present').length;
    const absentCount = enrolledStudents.length - presentCount;

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] animate-fadeIn gap-6">
         {/* Header */}
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => setViewState('list')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowRight size={24} className="text-gray-600" />
               </button>
               <div>
                  <h2 className="text-2xl font-bold text-gray-900">{classData.name}</h2>
                  <p className="text-sm text-gray-500">{classData.gradeLevel} • Room {classData.room}</p>
               </div>
            </div>
            
            <div className="flex items-center gap-6">
               <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === 'overview' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    {t('نظرة عامة', 'Overview')}
                  </button>
                  <button 
                    onClick={() => setActiveTab('calendar')}
                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${activeTab === 'calendar' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    {t('الجدول الزمني', 'Schedule')}
                  </button>
               </div>

               <div className="hidden md:flex items-center gap-4">
                  <div className="relative">
                     <button 
                        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                        className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
                     >
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{selectedDate}</span>
                        <ChevronDown size={16} className="text-slate-400" />
                     </button>

                     {isDatePickerOpen && (
                        <div className="absolute top-full left-0 mt-2 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4">
                           <div className="flex items-center justify-between mb-4">
                              <button className="p-1 hover:bg-slate-100 rounded-md text-slate-500"><ChevronLeft size={16} /></button>
                              <span className="text-sm font-bold text-slate-800">April 2026</span>
                              <button className="p-1 hover:bg-slate-100 rounded-md text-slate-500"><ChevronRight size={16} /></button>
                           </div>
                           <div className="grid grid-cols-7 gap-1 mb-2">
                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                 <div key={day} className="text-center text-[10px] font-bold text-slate-400">{day}</div>
                              ))}
                           </div>
                           <div className="grid grid-cols-7 gap-1">
                              {Array.from({ length: 30 }).map((_, i) => {
                                 const date = i + 1;
                                 const isCurrent = date === 13;
                                 return (
                                    <button
                                       key={date}
                                       onClick={() => {
                                          setSelectedDate(`Apr ${date}`);
                                          setIsDatePickerOpen(false);
                                       }}
                                       className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${isCurrent ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                    >
                                       {date}
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                     <div className="text-sm"><span className="text-slate-500">{t('إجمالي الطلاب:', 'Total Students:')}</span> <span className="font-bold text-slate-900">{enrolledStudents.length}</span></div>
                     <div className="w-px h-4 bg-slate-200"></div>
                     <div className="text-sm"><span className="text-slate-500">{t('حاضر:', 'Present:')}</span> <span className="font-bold text-green-600">{presentCount}</span></div>
                     <div className="w-px h-4 bg-slate-200"></div>
                     <div className="text-sm"><span className="text-slate-500">{t('غائب:', 'Absent:')}</span> <span className="font-bold text-red-600">{absentCount}</span></div>
                  </div>
               </div>
               <div className="flex gap-3">
                  {role === UserRole.ADMIN && (
                    <Button className="bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg gap-2" onClick={() => setIsAddStudentModalOpen(true)}>
                       <UserPlus size={18} /> {t('إضافة طالب', 'Add Student')}
                    </Button>
                  )}
                  {role === UserRole.TEACHER && (
                    <Button variant={qrActive ? "danger" : undefined} className={!qrActive ? "bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg" : ""} onClick={() => setQrActive(!qrActive)}>
                       <QrCode size={18} /> {qrActive ? t('إيقاف جلسة QR', 'Stop QR Session') : t('بدء جلسة QR', 'Start QR Session')}
                    </Button>
                  )}
               </div>
            </div>
         </div>

         {activeTab === 'calendar' ? (
            <ClassCalendar sectionId={classData.id} defaultTeacherId={classData.teacherId} isRTL={isRTL} />
         ) : (
            <>
               {/* QR Overlay (Conditional) */}
               {qrActive && role === UserRole.TEACHER && (
                  <div className="bg-gray-900 text-white p-6 rounded-3xl flex items-center justify-between relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-gray-800 to-gray-900 z-0"></div>
                     <div className="relative z-10 flex items-center gap-8">
                        <div className="bg-white p-2 rounded-2xl">
                           <QrCode size={120} className="text-black" />
                        </div>
                        <div>
                           <h3 className="text-2xl font-bold mb-1">Scan to Check-In</h3>
                           <p className="text-gray-400 text-sm mb-4">Token refreshes in {timer}s</p>
                           <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-1 rounded-full w-fit">
                              <MapPin size={12} /> Geo-fencing Active
                           </div>
                        </div>
                     </div>
                     <div className="relative z-10 text-right">
                        <p className="text-4xl font-bold font-mono">{presentCount}/{enrolledStudents.length}</p>
                        <p className="text-gray-400 text-sm uppercase font-bold">{t('حاضر', 'Present')}</p>
                     </div>
                  </div>
               )}

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                  {/* Left Col: Roster & Attendance */}
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
               <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                       <Users size={18} /> {t('قائمة الطلاب', 'Student List')}
                    </h3>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
                       <SlidersHorizontal size={14} className="text-gray-400" />
                       <span className="text-xs text-gray-500">{t('فرز حسب:', 'Sort by:')}</span>
                       <select 
                         value={sortBy} 
                         onChange={(e) => setSortBy(e.target.value as any)}
                         className="text-xs font-bold text-gray-900 outline-none bg-transparent"
                       >
                          <option value="name">Name</option>
                          <option value="attendance">{t('الحضور', 'Attendance')}</option>
                       </select>
                    </div>
                  </div>
                  {role === UserRole.TEACHER && (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" className="text-xs h-8" onClick={markAllPresent}>
                         <CheckCircle2 size={14} /> {t('تسجيل الكل حاضر', 'Mark All Present')}
                      </Button>
                      <Button variant="primary" className="text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white" onClick={saveAttendance} disabled={isSavingAttendance}>
                         {isSavingAttendance ? t('جاري الحفظ...', 'Saving...') : attendanceSaved ? t('تم الحفظ ✓', 'Saved ✓') : t('حفظ الحضور', 'Save Attendance')}
                      </Button>
                    </div>
                  )}
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-white text-xs text-gray-500 uppercase sticky top-0 z-10">
                        <tr>
                           <th className="p-3 border-b border-gray-100">{t('الطالب', 'Student')}</th>
                           <th className="p-3 border-b border-gray-100">{role === UserRole.TEACHER ? t('الحالة', 'Status') : t('الحضور', 'Attendance')}</th>
                           <th className="p-3 border-b border-gray-100 text-right">{t('إجراء', 'Action')}</th>
                        </tr>
                     </thead>
                     <tbody className="text-sm">
                        {sortedStudents.map(student => {
                           const status = manualAttendance[student.id];
                           return (
                              <tr key={student.id} className="hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
                                 <td className="p-3">
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600">
                                          {student.name.charAt(0)}
                                       </div>
                                       <div>
                                          <div className="flex items-center gap-2">
                                             <p className="font-bold text-gray-900">{student.name}</p>
                                             {parseInt(student.id.replace(/\D/g, '')) % 5 === 0 && (
                                                <div className="group relative flex items-center justify-center">
                                                   <PlusCircle size={14} className="text-red-500" />
                                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                                      Medical Condition: Asthma
                                                   </div>
                                                </div>
                                             )}
                                             {parseInt(student.id.replace(/\D/g, '')) % 7 === 0 && (
                                                <div className="group relative flex items-center justify-center">
                                                   <AlertTriangle size={14} className="text-violet-600" />
                                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                                      Behavior Alert: Talkative
                                                   </div>
                                                </div>
                                             )}
                                          </div>
                                          <p className="text-[10px] text-gray-400">{student.id}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="p-3">
                                    {role === UserRole.TEACHER ? (
                                      <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg w-fit border border-gray-100">
                                         <button 
                                            onClick={() => setManualAttendance(prev => ({...prev, [student.id]: 'Present'}))}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${status === 'Present' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                         >
                                            {t('حاضر', 'Present')}
                                         </button>
                                         <button 
                                            onClick={() => setManualAttendance(prev => ({...prev, [student.id]: 'Absent'}))}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${status === 'Absent' || !status ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                         >
                                            {t('غائب', 'Absent')}
                                         </button>
                                         <button 
                                            onClick={() => setManualAttendance(prev => ({...prev, [student.id]: 'Late'}))}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${status === 'Late' ? 'bg-yellow-100 text-yellow-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                         >
                                            {t('متأخر', 'Late')}
                                         </button>
                                         <button 
                                            onClick={() => setManualAttendance(prev => ({...prev, [student.id]: 'Excused'}))}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${status === 'Excused' ? 'bg-gray-200 text-gray-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                         >
                                            {t('عذر', 'Excused')}
                                         </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                         <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px]">
                                            <div className="h-full bg-violet-600" style={{ width: `${student.attendance}%` }}></div>
                                         </div>
                                         <span className="font-bold text-gray-700">{student.attendance}%</span>
                                      </div>
                                    )}
                                 </td>
                                 <td className="p-3 text-right">
                                    {role === UserRole.ADMIN ? (
                                      <div className="flex items-center gap-1 justify-end">
                                        <button
                                          onClick={() => { setTransferringStudent(student); setTransferTargetClassId(null); }}
                                          className="text-gray-400 hover:text-violet-600 p-2 rounded-full hover:bg-violet-50 transition-colors"
                                          title={t('نقل لفصل تاني', 'Transfer to another class')}
                                        >
                                           <ArrowLeftRight size={16} />
                                        </button>
                                        <button 
                                          onClick={() => removeStudent(student.id)}
                                          className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                          title="Remove from roster"
                                        >
                                           <XCircle size={18} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button className="text-gray-400 hover:text-violet-600 p-2 rounded-full hover:bg-violet-50">
                                         <MoreVertical size={16} />
                                      </button>
                                    )}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Right Col: Class Info & Lesson Plan */}
            <div className="space-y-6 flex flex-col">
               <AcademicPlanAccordion gradeLevel={classData.gradeLevel} sectionId={classData.id} />
               <div className="bg-violet-50 rounded-3xl p-6 border border-violet-100">
                  <h4 className="font-bold text-violet-900 mb-2">{t('أداء الفصل', 'Class Performance')}</h4>
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-3xl font-bold text-violet-700">92%</p>
                        <p className="text-xs text-violet-600">{t('معدل الحضور', 'Attendance Rate')}</p>
                     </div>
                     <div className="h-8 w-px bg-violet-200"></div>
                     <div>
                        <p className="text-3xl font-bold text-violet-700">A-</p>
                        <p className="text-xs text-violet-600">{t('درجة سلوك الفصل', 'Class Behavior Score')}</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
            </>
         )}

         {/* إضافة طالب Modal */}
         {isAddStudentModalOpen && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
             <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-bold text-gray-900">{t('إضافة طالب للقائمة', 'Add Student to List')}</h3>
                 <button onClick={() => setIsAddStudentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                   <X size={20} />
                 </button>
               </div>
               <div className="p-6 space-y-4">
                 <div className="relative">
                   <input 
                     type="text" 
                     placeholder="Search students by name or ID..." 
                     className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                   <Users className="absolute left-3 top-3.5 text-gray-400" size={18} />
                 </div>
                 <div className="max-h-60 overflow-y-auto space-y-2">
                   {realStudents.filter(s => 
                     !classData.students.includes(s.id) && 
                     (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase()))
                   ).map(student => (
                     <div key={student.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                           {student.name.charAt(0)}
                         </div>
                         <div>
                           <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                           <p className="text-[10px] text-gray-500">{student.id} • {student.grade}</p>
                         </div>
                       </div>
                       <Button variant="secondary" className="text-xs h-8 px-3" onClick={() => addStudent(student.id)}>
                         Add
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
               <div className="p-6 bg-gray-50 border-t border-gray-100">
                 <Button variant="secondary" className="w-full" onClick={() => setIsAddStudentModalOpen(false)}>{t('إغلاق', 'Close')}</Button>
               </div>
             </div>
           </div>
         )}

        {transferringStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-fadeIn max-h-[85vh] flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('نقل', 'Transfer')} {transferringStudent.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t(`اختار الفصل الجديد (من نفس الصف ${classData.gradeLevel})`, `Choose the new class (from the same grade ${classData.gradeLevel})`)}</p>
                </div>
                <button onClick={() => { setTransferringStudent(null); setTransferTargetClassId(null); }} className="text-gray-400 hover:text-gray-700"><X size={22} /></button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-2">
                {otherSameGradeClasses.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">{t('مفيش فصول تانية في نفس الصف.', 'No other classes in the same grade.')}</p>
                )}
                {otherSameGradeClasses.map((c) => {
                  const enrolled = c.students.length;
                  const capacity = c.capacity ?? 25;
                  const hasRoom = enrolled < capacity;
                  const isTargetSelected = transferTargetClassId === c.id;
                  return (
                    <div key={c.id} className={`rounded-2xl border p-4 transition-all ${isTargetSelected ? 'border-violet-400 bg-violet-50/50' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{c.name}</p>
                          <p className={`text-xs mt-0.5 font-bold ${hasRoom ? 'text-emerald-600' : 'text-red-500'}`}>
                            {enrolled}/{capacity} {t('طالب', 'students')} {hasRoom ? t(`(متاح ${capacity - enrolled} مكان)`, `(${capacity - enrolled} spot(s) available)`) : t('(الفصل مكتمل)', '(Class full)')}
                          </p>
                        </div>
                        {hasRoom ? (
                          <Button
                            variant="primary"
                            className="text-xs h-9 px-4"
                            disabled={isTransferring}
                            onClick={() => handleTransferStudent(c.id)}
                          >
                            {t('نقل هنا', 'Transfer Here')}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="text-xs h-9 px-4"
                            onClick={() => setTransferTargetClassId(isTargetSelected ? null : c.id)}
                          >
                            {isTargetSelected ? t('إلغاء الاستبدال', 'Cancel Swap') : t('استبدال بدل طالب', 'Swap with a Student')}
                          </Button>
                        )}
                      </div>

                      {isTargetSelected && !hasRoom && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                          <p className="text-[11px] text-gray-400 font-bold mb-2">{t(`اختار طالب من ${c.name} يستبدل مكانه مع ${transferringStudent.name}:`, `Choose a student from ${c.name} to swap places with ${transferringStudent.name}:`)}</p>
                          {realStudents.filter(s => c.students.includes(s.id)).map((s) => (
                            <button
                              key={s.id}
                              disabled={isTransferring}
                              onClick={() => handleSwapStudent(c.id, s.id)}
                              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-colors text-sm"
                            >
                              <span className="font-bold text-gray-800">{s.name}</span>
                              <span className="text-violet-600 font-bold text-xs flex items-center gap-1"><ArrowLeftRight size={12} /> {t('استبدال', 'Swap')}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Components based on Persona ---

  // 1. ADMIN: Class Wizard & List
  const AdminView = () => {
    const [step, setStep] = useState(1);
    const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isAutoDistributeOpen, setIsAutoDistributeOpen] = useState(false);
    const [distributeGrade, setDistributeGrade] = useState('');
    const [isDistributing, setIsDistributing] = useState(false);
    const [distributeResult, setDistributeResult] = useState<{ assigned: number; skipped: number } | null>(null);
    
    // Form State
    const [classData, setClassData] = useState({
      name: '',
      grade: 'الصف 10',
      capacity: 25,
      teachers: {} as Record<string, string>,
      students: [] as string[],
    });

    const [isCreatingClass, setIsCreatingClass] = useState(false);

    const handleConfirmCreate = async () => {
      setIsCreatingClass(true);
      const newId = await createClassSection({
        name: classData.name || t('فصل بدون اسم', 'Unnamed Class'),
        gradeLevel: classData.grade,
        teacherId: classData.teachers['MainTeacher'],
        academicYear: '2025/2026',
        capacity: classData.capacity,
        studentIds: classData.students,
      });
      setIsCreatingClass(false);
      if (newId) {
        refreshClasses();
        setViewState('list');
      } else {
        showToast('حصل خطأ أثناء إنشاء الفصل. تأكد إن جدول class_sections فيه عمود capacity، وحاول تاني.', 'error');
      }
    };

    const [activeSubjectForTeacher, setActiveSubjectForTeacher] = useState<string | null>(null);
    const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
    const [teacherFilterSubject, setTeacherFilterSubject] = useState('');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState('ALL');

    const toggleStudent = (studentId: string) => {
      setClassData(prev => {
        const isSelected = prev.students.includes(studentId);
        if (isSelected) {
          return { ...prev, students: prev.students.filter(id => id !== studentId) };
        } else {
          return { ...prev, students: [...prev.students, studentId] };
        }
      });
    };

    const selectAllStudents = (filteredStudents: string[]) => {
      setClassData(prev => {
        const newStudents = new Set([...prev.students, ...filteredStudents]);
        return { ...prev, students: Array.from(newStudents) };
      });
    };

    const handleAutoDistribute = async () => {
      if (!distributeGrade) return;
      setIsDistributing(true);
      const gradeClasses = classes.filter(c => c.gradeLevel === distributeGrade);
      const enrolledIds = new Set(gradeClasses.flatMap(c => c.students));
      const unassignedStudents = realStudents.filter(s => s.grade === distributeGrade && !enrolledIds.has(s.id));

      if (gradeClasses.length === 0 || unassignedStudents.length === 0) {
        setIsDistributing(false);
        setDistributeResult({ assigned: 0, skipped: unassignedStudents.length });
        return;
      }

      // بنحسب الأماكن المتاحة في كل فصل، وبنوزّع الطلاب بالتساوي بينهم
      const capacities = gradeClasses.map(c => ({ id: c.id, remaining: (c.capacity ?? 25) - c.students.length }));
      let assigned = 0;
      let skipped = 0;
      let classIndex = 0;
      for (const student of unassignedStudents) {
        // بندوّر على أقرب فصل فيه مكان، بدايةً من اللي بعد آخر فصل اتاخد
        let attempts = 0;
        while (attempts < capacities.length && capacities[classIndex].remaining <= 0) {
          classIndex = (classIndex + 1) % capacities.length;
          attempts++;
        }
        if (capacities[classIndex].remaining <= 0) {
          skipped++;
          continue;
        }
        const ok = await addEnrollment(student.id, capacities[classIndex].id);
        if (ok) {
          assigned++;
          capacities[classIndex].remaining--;
        } else {
          skipped++;
        }
        classIndex = (classIndex + 1) % capacities.length;
      }

      setIsDistributing(false);
      setDistributeResult({ assigned, skipped });
      refreshClasses();
    };

    
    const deselectAllStudents = (filteredStudents: string[]) => {
      setClassData(prev => {
        return { ...prev, students: prev.students.filter(id => !filteredStudents.includes(id)) };
      });
    };

    if (viewState === 'class-detail' && activeClass) {
      return <ClassDetail role={role} classData={activeClass} />;
    }

    if (viewState === 'create') {
      const filteredStudents = realStudents.filter(s => 
        s.grade === classData.grade &&
        (s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
         s.id.toLowerCase().includes(studentSearchQuery.toLowerCase()))
      );
      
      const isOverCapacity = classData.students.length > classData.capacity;

      return (
        <div className="max-w-5xl mx-auto animate-fadeIn pb-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{t('إنشاء فصل جديد', 'Create New Class')}</h2>
              <p className="text-gray-500">Define class details, assign teachers, and enroll students.</p>
            </div>
            <Button variant="secondary" onClick={() => setViewState('list')}>{t('إلغاء', 'Cancel')}</Button>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Stepper */}
            <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center flex-row justify-between overflow-x-auto" dir="rtl">
               {[1, 2, 3, 4].map(s => (
                 <div key={s} className={`flex items-center gap-2 ${s <= step ? 'text-violet-600' : 'text-gray-400'} flex-shrink-0`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${s === step ? 'bg-violet-600 text-white' : s < step ? 'bg-violet-100 text-violet-600' : 'bg-gray-200'}`}>
                       {s < step ? <CheckCircle2 size={16} /> : s}
                    </div>
                    <span className="text-sm font-medium hidden md:block">
                      {s === 1 ? t('التفاصيل 1', 'Details 1') : s === 2 ? t('المعلمون 2', 'Teachers 2') : s === 3 ? t('الطلاب 3', 'Students 3') : t('المراجعة 4', 'Review 4')}
                    </span>
                 </div>
               ))}
            </div>

            <div className="p-8 min-h-[400px]">
               {step === 1 && (
                 <div className="space-y-6 max-w-lg mx-auto">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">{t('تفاصيل الفصل', 'Class Details')}</h3>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">{t('اسم الفصل', 'Class Name')}</label>
                       <input 
                          type="text" 
                          placeholder="e.g. 10-A" 
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                          value={classData.name}
                          onChange={e => setClassData({...classData, name: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">{t('الصف الدراسي', 'Grade Level')}</label>
                       <select 
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500" 
                          value={classData.grade} 
                          onChange={e => setClassData({...classData, grade: e.target.value, students: []})}
                       >
                          {gradeLevels.map(g => <option key={g}>{g}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">{t('السعة الاستيعابية', 'Capacity')}</label>
                       <input 
                          type="number" 
                          placeholder="e.g. 25" 
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                          value={classData.capacity}
                          onChange={e => setClassData({...classData, capacity: parseInt(e.target.value) || 0})}
                       />
                    </div>
                 </div>
               )}

               {step === 2 && (
                 <div className="space-y-6 max-w-4xl mx-auto">
                    {!activeSubjectForTeacher ? (
                      <>
                        {/* Class Management Section */}
                        <div className="mb-4">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">{t('إدارة الفصل', 'Class Management')}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Main Teacher Card */}
                            <div className="p-4 border border-slate-100 rounded-xl flex items-center justify-between bg-white shadow-none">
                              <div>
                                <p className="font-bold text-gray-900">{t('معلم رئيسي', 'Main Teacher')}</p>
                                <p className="text-xs text-slate-500">Required • Homeroom</p>
                              </div>
                              {classData.teachers['MainTeacher'] ? (
                                (() => {
                                  const t = realTeachers.find(x => x.id === classData.teachers['MainTeacher']);
                                  if (!t) return null;
                                  return (
                                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <img src={t.avatar} alt={t.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                                      <span className="text-sm font-medium text-slate-900">{t.name}</span>
                                      <button 
                                        onClick={() => {
                                          const newTeachers = { ...classData.teachers };
                                          delete newTeachers['MainTeacher'];
                                          setClassData({ ...classData, teachers: newTeachers });
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  );
                                })()
                              ) : (
                                <Button 
                                  variant="secondary" 
                                  className="text-xs py-1.5 h-8 shadow-none"
                                  onClick={() => setActiveSubjectForTeacher('MainTeacher')}
                                >
                                  Assign Teacher
                                </Button>
                              )}
                            </div>

                            {/* Assistant Teacher Card */}
                            <div className="p-4 border border-slate-100 rounded-xl flex items-center justify-between bg-white shadow-none">
                              <div>
                                <p className="font-bold text-gray-900">{t('معلم مساعد', 'Assistant Teacher')}</p>
                                <p className="text-xs text-slate-500">Optional • Co-Teacher</p>
                              </div>
                              {classData.teachers['AssistantTeacher'] ? (
                                (() => {
                                  const t = realTeachers.find(x => x.id === classData.teachers['AssistantTeacher']);
                                  if (!t) return null;
                                  return (
                                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <img src={t.avatar} alt={t.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                                      <span className="text-sm font-medium text-slate-900">{t.name}</span>
                                      <button 
                                        onClick={() => {
                                          const newTeachers = { ...classData.teachers };
                                          delete newTeachers['AssistantTeacher'];
                                          setClassData({ ...classData, teachers: newTeachers });
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  );
                                })()
                              ) : (
                                <Button 
                                  variant="secondary" 
                                  className="text-xs py-1.5 h-8 shadow-none"
                                  onClick={() => setActiveSubjectForTeacher('AssistantTeacher')}
                                >
                                  Assign Teacher
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                      </>
                    ) : (
                      <div className="animate-fadeIn">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => setActiveSubjectForTeacher(null)}
                              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <ArrowRight size={20} className="text-gray-600" />
                            </button>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">{t('تعيين معلم', 'Assign Teacher for')} {activeSubjectForTeacher}</h3>
                              <p className="text-sm text-gray-500">{t('اختر معلماً لهذه المادة.', 'Choose a teacher for this subject.')}</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${classData.teachers[activeSubjectForTeacher] ? 'bg-violet-50 text-violet-600 border border-violet-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                            Selected: {classData.teachers[activeSubjectForTeacher] ? '1' : '0'} / 1 (Required)
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-[400px]">
                          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                            <div className="relative flex-1">
                              <input 
                                type="text" 
                                placeholder="Search teachers by name or ID..." 
                                className="w-full p-2.5 pl-10 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                                value={teacherSearchQuery}
                                onChange={(e) => setTeacherSearchQuery(e.target.value)}
                              />
                              <Users className="absolute left-3 top-3 text-gray-400" size={16} />
                            </div>
                            <select
                              value={teacherFilterSubject}
                              onChange={(e) => setTeacherFilterSubject(e.target.value)}
                              className="p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                            >
                              <option value="">{t('كل المواد', 'All Subjects')}</option>
                              {['رياضيات', 'علوم', 'لغة عربية', 'لغة إنجليزية', 'تاريخ', 'فنون'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="overflow-y-auto flex-1 p-2">
                            {(() => {
                              const filteredTeachers = realTeachers.filter(t => 
                                ((t as any).grades && (t as any).grades.includes(classData.grade)) &&
                                (!teacherFilterSubject || ((t as any).subjects && (t as any).subjects.includes(teacherFilterSubject))) &&
                                (t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) || 
                                 t.id.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                              );

                              if (filteredTeachers.length === 0) {
                                return (
                                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <Users size={32} className="mb-2 opacity-50" />
                                    <p>No teachers found for {activeSubjectForTeacher}</p>
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {filteredTeachers.map(teacher => {
                                    const isSelected = classData.teachers[activeSubjectForTeacher] === teacher.id;
                                    const isConflict = (teacher.academicLoad || 0) > 20;

                                    return (
                                      <div 
                                        key={teacher.id} 
                                        onClick={() => {
                                          if (isSelected) {
                                            const newTeachers = { ...classData.teachers };
                                            delete newTeachers[activeSubjectForTeacher];
                                            setClassData({ ...classData, teachers: newTeachers });
                                          } else {
                                            setClassData({
                                              ...classData,
                                              teachers: { ...classData.teachers, [activeSubjectForTeacher]: teacher.id }
                                            });
                                          }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                      >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-300 bg-white'}`}>
                                          {isSelected && <CheckCircle2 size={14} />}
                                        </div>
                                        <img src={teacher.avatar || `https://ui-avatars.com/api/?name=${teacher.name}&background=random`} alt={teacher.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-gray-900 truncate">{teacher.name}</p>
                                            {isConflict && (
                                              <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Schedule Conflict</span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-gray-500">{teacher.academicLoad || 0}/24 Sessions • Assigned to: {(teacher.assignedClasses || []).join(', ') || 'None'}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                 </div>
               )}

               {step === 3 && (
                 <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{t('تسجيل الطلاب', 'Enroll Students')}</h3>
                        <p className="text-sm text-gray-500">Select students from {classData.grade} to add to this class.</p>
                      </div>
                      <div className={`px-4 py-2 rounded-xl font-bold text-sm ${isOverCapacity ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>
                        Selected: {classData.students.length} / {classData.capacity} ({t('السعة الاستيعابية', 'capacity')})
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-[400px]">
                      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder="Search students by name or ID..." 
                            className="w-full p-2.5 pl-10 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                            value={studentSearchQuery}
                            onChange={(e) => setStudentSearchQuery(e.target.value)}
                          />
                          <Users className="absolute left-3 top-3 text-gray-400" size={16} />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            className="text-xs py-2"
                            onClick={() => selectAllStudents(filteredStudents.map(s => s.id))}
                          >
                            Select All
                          </Button>
                          <Button 
                            variant="secondary" 
                            className="text-xs py-2"
                            onClick={() => deselectAllStudents(filteredStudents.map(s => s.id))}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      
                      <div className="overflow-y-auto flex-1 p-2">
                        {filteredStudents.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Users size={32} className="mb-2 opacity-50" />
                            <p>No students found in {classData.grade}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {filteredStudents.map(student => {
                              const isSelected = classData.students.includes(student.id);
                              return (
                                <div 
                                  key={student.id} 
                                  onClick={() => toggleStudent(student.id)}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                >
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <CheckCircle2 size={14} />}
                                  </div>
                                  <img src={student.avatar || `https://ui-avatars.com/api/?name=${student.name}&background=random`} alt={student.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{student.name}</p>
                                    <p className="text-[10px] text-gray-500">{student.id}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                 </div>
               )}

               {step === 4 && (
                 <div className="text-center py-10">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                       <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('جاهز للإنشاء', 'Ready to Create')}</h3>
                    <div className="bg-gray-50 p-6 rounded-2xl max-w-md mx-auto mb-8 text-left space-y-3">
                       <div className="flex justify-between text-sm"><span className="text-gray-500">{t('اسم الفصل', 'Class Name')}</span><span className="font-bold">{classData.name || 'Unnamed Class'}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-gray-500">{t('الصف الدراسي', 'Grade Level')}</span><span className="font-bold">{classData.grade}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-gray-500">{t('السعة الاستيعابية', 'Capacity')}</span><span className="font-bold">{classData.capacity}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-gray-500">{t('المعلمون المعينون', 'Assigned Teachers')}</span><span className="font-bold">{Object.keys(classData.teachers).length}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-gray-500">{t('الطلاب المسجلين', 'Enrolled Students')}</span><span className="font-bold">{classData.students.length}</span></div>
                    </div>
                    <Button onClick={handleConfirmCreate} disabled={isCreatingClass} className="w-full max-w-xs mx-auto text-lg py-3 bg-violet-600 hover:bg-violet-700">
                       {isCreatingClass ? t('جاري الإنشاء...', 'Creating...') : t('تأكيد وإنشاء الفصل', 'Confirm & Create Class')}
                    </Button>
                 </div>
               )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between">
               <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>{t('رجوع', 'Back')}</Button>
               {step < 4 && (
                 <Button 
                   onClick={() => setStep(s => s + 1)} 
                   disabled={step === 3 && classData.students.length > classData.capacity}
                   className="bg-violet-600 hover:bg-violet-700"
                 >
                   {t('الخطوة التالية', 'Next Step')} <ArrowRight size={16} />
                 </Button>
               )}
            </div>
          </div>
        </div>
      );
    }

    if (viewState === 'class-detail' && activeClass) {
      return <ClassDetail role={role} classData={activeClass} />;
    }

    return (
      <div className="animate-fadeIn space-y-8">
         <div className="flex justify-between items-center">
            <div>
               <h2 className="text-3xl font-bold text-gray-900">{t('دليل الفصول', 'Class Directory')}</h2>
               <p className="text-gray-500">{t('إدارة الفصول، التسجيل، وتعيينات طاقم العمل.', 'Manage classes, enrollment, and staff assignments.')}</p>
            </div>
         </div>

         {/* Control Bar */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="relative">
                  <input 
                     type="text" 
                     placeholder={t('البحث عن فصول أو قاعات...', 'Search classes or rooms...')} 
                     className="w-72 bg-white border border-slate-200 rounded-lg px-4 py-2 pl-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
               </div>
               <div className="relative">
                  <button 
                     onClick={() => setIsFilterOpen(!isFilterOpen)}
                     className="flex items-center justify-between w-40 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                     <span>{selectedGrade === 'ALL' ? t('كل الصفوف', 'All Grades') : selectedGrade}</span>
                     <ChevronDown size={16} className="text-slate-400" />
                  </button>
                  {isFilterOpen && (
                     <div className="absolute top-full right-0 mt-2 z-50 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                        {['ALL', ...gradeLevels].map((grade) => (
                           <div
                              key={grade}
                              onClick={() => {
                                 setSelectedGrade(grade);
                                 setIsFilterOpen(false);
                              }}
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 transition-colors"
                           >
                              {grade === 'ALL' ? t('كل الصفوف', 'All Grades') : grade}
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              {canManageClasses && (
              <Button variant="secondary" onClick={() => { setIsAutoDistributeOpen(true); setDistributeResult(null); setDistributeGrade(selectedGrade !== 'ALL' ? selectedGrade : ''); }} className="shadow-sm border-slate-200">
                 <Users size={18} className="mr-2" /> {t('توزيع تلقائي', 'Auto-Distribute')}
              </Button>
              )}
              {canManageClasses && (
              <Button variant="secondary" onClick={() => setIsBulkImportModalOpen(true)} className="shadow-sm border-slate-200">
                 <FileSpreadsheet size={18} className="mr-2" /> {t('استيراد جماعي', 'Bulk Import')}
              </Button>
              )}
              {canManageClasses && (
              <Button onClick={() => setViewState('create')} className="shadow-sm">
                 <Plus size={18} className="mr-2" /> {t('تأكيد وإنشاء الفصل', 'Confirm & Create Class')}
              </Button>
              )}
            </div>
         </div>

         {/* استيراد جماعي Modal */}
         {isBulkImportModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
             <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
               <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                     <FileSpreadsheet size={24} />
                   </div>
                   <div>
                     <h3 className="text-2xl font-bold text-gray-900">{t('استيراد جماعي', 'Bulk Import')} Classes</h3>
                     <p className="text-sm text-gray-500">{t('قم برفع ملف CSV لإنشاء فصول متعددة دفعة واحدة.', 'Upload a CSV file to create multiple classes at once.')}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsBulkImportModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                   <X size={20} />
                 </button>
               </div>

               <div className="p-8 space-y-8">
                 {/* التعليمات */}
                 <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 flex gap-4">
                   <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex-shrink-0 flex items-center justify-center">
                     <Info size={20} />
                   </div>
                   <div className="space-y-2">
                     <h4 className="font-bold text-violet-900 text-sm">{t('التعليمات', 'Instructions')}</h4>
                     <ul className="text-xs text-violet-700 space-y-1 list-disc ml-4">
                       <li>{t('تأكد من أن ملف CSV الخاص بك يتبع هيكل النموذج بدقة.', 'Make sure your CSV file follows the template structure exactly.')}</li>
                       <li>Required columns: <strong>Name, Grade, Room, Curriculum, Year</strong>.</li>
                       <li>Curriculum must be one of: <strong>National, American, IG</strong>.</li>
                       <li>Maximum 100 rows per upload.</li>
                     </ul>
                   </div>
                 </div>

                 {/* Template Download */}
                 <div className="flex items-center justify-between p-6 border border-gray-100 rounded-3xl bg-gray-50/50">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-green-600">
                       <FileSpreadsheet size={24} />
                     </div>
                     <div>
                       <p className="font-bold text-gray-900">{t('نموذج CSV', 'CSV Template')}</p>
                       <p className="text-xs text-gray-500">Download the pre-formatted template</p>
                     </div>
                   </div>
                   <Button variant="secondary" className="gap-2">
                     <Download size={16} /> Download Template
                   </Button>
                 </div>

                 {/* Upload Area */}
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                   onDragLeave={() => setIsDragging(false)}
                   onDrop={(e) => { e.preventDefault(); setIsDragging(false); /* Handle file */ }}
                   className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all ${isDragging ? 'border-violet-600 bg-violet-50' : 'border-gray-200 bg-gray-50/30 hover:border-violet-300 hover:bg-gray-50'}`}
                 >
                   <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6 text-violet-600 group-hover:scale-110 transition-transform">
                     <Upload size={32} />
                   </div>
                   <h4 className="text-xl font-bold text-gray-900 mb-2">{t('ارفع ملف CSV الخاص بك', 'Upload Your CSV File')}</h4>
                   <p className="text-sm text-gray-500 mb-8">{t('اسحب وأفلت الملف هنا، أو انقر للتصفح', 'Drag and drop the file here, or click to browse')}</p>
                   <input type="file" className="hidden" id="csv-upload" accept=".csv" />
                   <label htmlFor="csv-upload">
                     <Button className="bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg px-8 cursor-pointer">{t('اختيار ملف', 'Choose File')}</Button>
                   </label>
                 </div>
               </div>

               <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-3">
                 <Button variant="secondary" className="flex-1" onClick={() => setIsBulkImportModalOpen(false)}>{t('إلغاء', 'Cancel')}</Button>
                 <Button className="bg-violet-600 text-white hover:bg-violet-700 shadow-md hover:shadow-lg flex-1" disabled>{t('بدء الاستيراد', 'Start Import')}</Button>
               </div>
             </div>
           </div>
         )}

         {/* توزيع تلقائي Modal */}
         {isAutoDistributeOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
             <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-fadeIn">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                 <div>
                   <h3 className="text-lg font-bold text-gray-900">{t('توزيع تلقائي للطلاب', 'Auto-Distribute Students')}</h3>
                   <p className="text-xs text-gray-500 mt-1">{t('هيوزّع كل الطلاب اللي مش متسكّنين في أي فصل، بالتساوي على فصول الصف اللي هتختاره (على حسب الأماكن الفاضية).', 'Will distribute all unassigned students evenly across the grade\'s classes (based on available spots).')}</p>
                 </div>
                 <button onClick={() => setIsAutoDistributeOpen(false)} className="text-gray-400 hover:text-gray-700"><XCircle size={22} /></button>
               </div>

               <div className="p-6 space-y-4">
                 {distributeResult ? (
                   <div className="text-center py-6">
                     <p className="text-2xl font-bold text-gray-900 mb-2">{t('تم التوزيع', 'Distribution Complete')}</p>
                     <p className="text-sm text-gray-500">
                       {t('اتسكّن', 'Assigned')} {distributeResult.assigned} {t('طالب', 'student(s)')}
                       {distributeResult.skipped > 0 ? t(` — ${distributeResult.skipped} طالب متسكّنوش (الفصول مليانة أو حصل خطأ)`, ` — ${distributeResult.skipped} student(s) not assigned (classes full or an error occurred)`) : ''}
                     </p>
                     <Button variant="primary" className="mt-6" onClick={() => { setIsAutoDistributeOpen(false); setDistributeResult(null); }}>تمام</Button>
                   </div>
                 ) : (
                   <>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-2">{t('الصف الدراسي', 'Grade Level')}</label>
                       <select value={distributeGrade} onChange={(e) => setDistributeGrade(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                         <option value="">{t('اختار الصف...', 'Select grade...')}</option>
                         {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                       </select>
                     </div>
                     {distributeGrade && (() => {
                       const gradeClasses = classes.filter(c => c.gradeLevel === distributeGrade);
                       const enrolledIds = new Set(gradeClasses.flatMap(c => c.students));
                       const unassignedCount = realStudents.filter(s => s.grade === distributeGrade && !enrolledIds.has(s.id)).length;
                       const totalRoom = gradeClasses.reduce((sum, c) => sum + Math.max(0, (c.capacity ?? 25) - c.students.length), 0);
                       return (
                         <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
                           <p>{t('فصول الصف ده:', 'Classes in this grade:')} <span className="font-bold text-gray-900">{gradeClasses.length}</span></p>
                           <p>{t('طلاب مش متسكّنين:', 'Unassigned students:')} <span className="font-bold text-gray-900">{unassignedCount}</span></p>
                           <p>{t('أماكن متاحة إجمالًا:', 'Total available spots:')} <span className="font-bold text-gray-900">{totalRoom}</span></p>
                         </div>
                       );
                     })()}
                     <div className="flex gap-3 pt-2">
                       <Button variant="secondary" className="flex-1" onClick={() => setIsAutoDistributeOpen(false)}>{t('إلغاء', 'Cancel')}</Button>
                       <Button variant="primary" className="flex-1" disabled={!distributeGrade || isDistributing} onClick={handleAutoDistribute}>
                         {isDistributing ? t('جاري التوزيع...', 'Distributing...') : t('ابدأ التوزيع', 'Start Distribution')}
                       </Button>
                     </div>
                   </>
                 )}
               </div>
             </div>
           </div>
         )}

          {classesLoading && (
            <div className="text-center py-10 text-gray-400">{t('جاري تحميل الفصول من قاعدة البيانات...', 'Loading classes from the database...')}</div>
          )}
          {selectedClassIds.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-violet-800">{selectedClassIds.length} {t('فصل محدد', 'class(es) selected')}</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedClassIds([])} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-lg">{t('إلغاء التحديد', 'Deselect')}</button>
                <button onClick={handleBulkDeleteClasses} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">{t('حذف المحدد', 'Delete Selected')}</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
               <div key={cls.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-violet-600"></div>
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-start gap-3">
                        <input type="checkbox" className="mt-1.5" checked={selectedClassIds.includes(cls.id)} onChange={() => toggleSelectClass(cls.id)} />
                        <div>
                           <h3 className="text-2xl font-bold text-gray-900">{cls.name}</h3>
                           <p className="text-sm text-gray-500">{cls.gradeLevel}</p>
                        </div>
                     </div>
                     <div className="relative">
                       <button onClick={() => setOpenClassMenu(openClassMenu === cls.id ? null : cls.id)} className="text-gray-300 hover:text-gray-600"><MoreVertical size={20} /></button>
                       {openClassMenu === cls.id && (
                         <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 w-32" onMouseLeave={() => setOpenClassMenu(null)}>
                           {canManageClasses && <button onClick={() => { setEditingClass(cls); setOpenClassMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{t('تعديل', 'Edit')}</button>}
                           {canManageClasses && <button onClick={() => { handleDeleteClass(cls); setOpenClassMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50">{t('حذف', 'Delete')}</button>}
                         </div>
                       )}
                     </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                     <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users size={16} className="text-gray-400" />
                        <span>{cls.students.length} {t('إجمالي الطلاب', 'total students')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 size={16} className="text-gray-400" />
                        <span>{Math.round(85 + Math.random() * 10)}% {t('إجمالي الحضور', 'attendance rate')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Briefcase size={16} className="text-gray-400" />
                        <span>{Math.ceil(Math.random() * 3) + 2} {t('إجمالي المدرسين', 'total teachers')}</span>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <Button 
                       variant="secondary" 
                       className="flex-1 text-xs"
                       onClick={() => {
                         setActiveClass(cls);
                         setViewState('class-detail');
                       }}
                     >
                       Manage Roster
                     </Button>
                  </div>
               </div>
            ))}
          </div>
      </div>
    );
  };

  // 2. TEACHER: فصولي & Detailed Dashboard
  const TeacherView = () => {
    if (viewState === 'class-detail' && activeClass) {
      return <ClassDetail role={role} classData={activeClass} />;
    }

    // Default List View
    return (
      <div className="animate-fadeIn space-y-8">
         <div className="flex justify-between items-center">
            <div>
               <h2 className="text-3xl font-bold text-gray-900">{t('فصولي', 'My Classes')}</h2>
               <p className="text-gray-500">{t('إدارة جدولك اليومي وحصصك.', 'Manage your daily schedule and periods.')}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
               <div 
                 key={cls.id} 
                 onClick={() => {
                    setActiveClass(cls);
                    setViewState('class-detail');
                 }}
                 className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
               >
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600">
                        <BookOpen size={24} />
                     </div>
                     <button className="text-gray-400 hover:text-gray-900"><MoreVertical size={20} /></button>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{cls.name}</h3>
                  <p className="text-sm text-gray-500 mb-6">{cls.gradeLevel} • Room {cls.room}</p>
                  
                  <div className="bg-gray-50 rounded-xl p-4 mb-6 flex justify-between items-center">
                     <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Next Session</p>
                        <p className="font-bold text-gray-900">Mathematics</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase">Time</p>
                        <p className="font-bold text-violet-600">08:00 AM</p>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     <Button 
                       className="flex-1 shadow-violet-200" 
                       onClick={(e) => {
                          e.stopPropagation();
                          setActiveClass(cls);
                          setViewState('class-detail');
                       }}
                     >
                        View Dashboard
                     </Button>
                  </div>
               </div>
            ))}
         </div>
      </div>
    );
  };

  // 3. STUDENT: Scanner Simulation
  const StudentView = () => {
    const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');

    const handleSimulateScan = () => {
       setScanState('scanning');
       setTimeout(() => {
          setScanState('success');
       }, 2000);
    };

    if (viewState === 'scanner') {
       return (
          <div className="max-w-md mx-auto bg-black min-h-[600px] rounded-[3rem] overflow-hidden relative shadow-2xl border-8 border-gray-800 animate-fadeIn">
             {/* Camera Viewfinder UI */}
             {scanState === 'scanning' || scanState === 'idle' ? (
                <>
                   <div className="absolute inset-0 bg-gray-800 z-0">
                      <p className="text-white text-center mt-64 opacity-50">Camera Feed Simulation</p>
                   </div>
                   
                   {/* Overlays */}
                   <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
                      <button onClick={() => setViewState('list')} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                         <XCircle size={24} />
                      </button>
                      <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium">
                         Scan QR Code
                      </div>
                      <div className="w-10"></div>
                   </div>

                   {/* Scanner Frame */}
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white/50 rounded-3xl z-10 flex flex-col justify-between p-4">
                      <div className="flex justify-between">
                         <div className="w-4 h-4 border-l-4 border-t-4 border-violet-600 rounded-tl-lg"></div>
                         <div className="w-4 h-4 border-r-4 border-t-4 border-violet-600 rounded-tr-lg"></div>
                      </div>
                      {scanState === 'scanning' && (
                         <div className="w-full h-1 bg-violet-600 shadow-[0_0_15px_rgba(124,58,237,0.8)] animate-[scan_2s_infinite]"></div>
                      )}
                      <div className="flex justify-between">
                         <div className="w-4 h-4 border-l-4 border-b-4 border-violet-600 rounded-bl-lg"></div>
                         <div className="w-4 h-4 border-r-4 border-b-4 border-violet-600 rounded-br-lg"></div>
                      </div>
                   </div>
                   
                   {/* Trigger (since we can't really scan) */}
                   <div className="absolute bottom-10 left-0 w-full flex justify-center z-20">
                      {scanState === 'idle' && (
                         <button 
                           onClick={handleSimulateScan}
                           className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform"
                         >
                           Simulate Scan
                         </button>
                      )}
                      {scanState === 'scanning' && <p className="text-white font-mono animate-pulse">Detecting...</p>}
                   </div>
                </>
             ) : (
                <div className="absolute inset-0 bg-green-500 flex flex-col items-center justify-center text-white p-8 text-center animate-fadeIn">
                   <div className="w-24 h-24 bg-white text-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl">
                      <CheckCircle2 size={48} strokeWidth={3} />
                   </div>
                   <h2 className="text-3xl font-bold mb-2">Checked In!</h2>
                   <p className="text-green-100 text-lg mb-8">Mathematics • Grade 10-A</p>
                   <div className="bg-white/20 rounded-xl p-4 w-full backdrop-blur-sm mb-8">
                      <div className="flex justify-between text-sm mb-1">
                         <span className="opacity-80">Time</span>
                         <span className="font-bold">08:02 AM</span>
                      </div>
                      <div className="flex justify-between text-sm">
                         <span className="opacity-80">Status</span>
                         <span className="font-bold">{t('حاضر', 'Present')}</span>
                      </div>
                   </div>
                   <button onClick={() => setViewState('list')} className="bg-white text-green-600 w-full py-3 rounded-xl font-bold">Done</button>
                </div>
             )}
          </div>
       );
    }

    return (
       <div className="animate-fadeIn max-w-md mx-auto">
          <div className="bg-gradient-to-br from-violet-600 to-violet-800 text-white rounded-3xl p-6 shadow-xl mb-6">
             <div className="flex items-center gap-4 mb-6">
                <img src={user.avatar} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full border-2 border-white/30" alt="Profile" />
                <div>
                   <h3 className="font-bold text-lg">Hello, Layla!</h3>
                   <p className="text-violet-100 text-sm">Grade 10 • ID: ST-2023-001</p>
                </div>
             </div>
             
             <div className="bg-white/10 rounded-2xl p-4 flex justify-between items-center backdrop-blur-sm">
                <div>
                   <p className="text-violet-100 text-xs font-bold uppercase mb-1">{t('معدل الحضور', 'Attendance Rate')}</p>
                   <p className="text-3xl font-bold">98%</p>
                </div>
                <div className="h-10 w-px bg-white/20"></div>
                <div>
                   <p className="text-violet-100 text-xs font-bold uppercase mb-1">{t('الفصول', 'Classes')}</p>
                   <p className="text-3xl font-bold">12</p>
                </div>
             </div>
          </div>

          <div className="space-y-4">
             <button 
               onClick={() => setViewState('scanner')}
               className="w-full bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group active:scale-95 transition-all"
             >
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 group-hover:bg-violet-700 group-hover:text-white transition-colors">
                      <Scan size={24} />
                   </div>
                   <div className="text-left">
                      <h4 className="font-bold text-gray-900 text-lg">Check-In</h4>
                      <p className="text-gray-500 text-sm">{t('امسح رمز QR للحضور', 'Scan the QR code for attendance')}</p>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                   <ArrowRight size={16} />
                </div>
             </button>

             <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><History size={18} /> Recent Activity</h4>
                <div className="space-y-4">
                   {[
                      { sub: 'Mathematics', status: 'Present', time: 'Today, 08:02 AM' },
                      { sub: 'Science', status: 'Present', time: 'Yesterday, 09:00 AM' },
                      { sub: 'English', status: 'Late', time: 'Yesterday, 10:15 AM' }
                   ].map((rec, i) => (
                      <div key={i} className="flex justify-between items-center">
                         <div>
                            <p className="font-bold text-gray-900 text-sm">{rec.sub}</p>
                            <p className="text-xs text-gray-500">{rec.time}</p>
                         </div>
                         <span className={`text-xs font-bold px-2 py-1 rounded ${rec.status === 'Present' ? 'bg-green-50 text-green-700' : 'bg-violet-50 text-violet-700'}`}>
                            {rec.status}
                         </span>
                      </div>
                   ))}
                </div>
             </div>
          </div>
       </div>
    );
  };

  return (
    <div dir="rtl" className="h-full w-full">
      {role === UserRole.ADMIN ? <AdminView /> : role === UserRole.STUDENT ? <StudentView /> : <TeacherView />}
      {editingClass && (
        <EditClassModal cls={editingClass} teachers={realTeachers} gradeLevels={gradeLevels} onClose={() => setEditingClass(null)} onSubmit={handleUpdateClass} />
      )}
    </div>
  );
};
