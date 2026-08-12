import React, { useState, useEffect } from 'react';
import { Language, UserRole, SettingsTab, Course, AcademicYearConfig, Holiday, TimetableEvent, NotificationSettings, NotificationChannel, NotificationCategory, NotificationTrigger } from '../types';
import { Button } from '../components/Button';
import { confirmDialog } from '../components/ConfirmDialog';
import { showToast } from '../components/Toast';
import { getAllCurriculumSubjectsWithGrade, addCurriculumSubject, updateCurriculumSubjectById, removeCurriculumSubjectById, getTerms, createTerm, updateTerm, deleteTerm, getSubjectThemes, upsertSubjectTheme, getSubjectThemeFor, SubjectTheme, getSpaces, updateSpaceStatus, SpaceInfo } from '../services/supabaseData';
import { getSubjectIconComponent, SUBJECT_COLOR_OPTIONS, SUBJECT_ICON_OPTIONS } from '../lib/subjectIcons';
import { getAcademicYears, createAcademicYear, updateAcademicYear, activateAcademicYear, archiveAcademicYear, deleteAcademicYear } from '../services/supabaseData';
import { getGradeLevels, addGradeLevel, deleteGradeLevel } from '../services/supabaseData';
import { 
  generateConflictFreeSchedule,
  simulateHolidayImpact,
  generateTermPacingGuide,
  predictIntakeAndSections,
  analyzePromotionEligibility,
  fetchEgyptianHolidays
} from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  Settings as SettingsIcon, 
  BookOpen, 
  Calendar, 
  Bell, 
  Shield, 
  Plus, 
  Search, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Globe,
  Hash,
  Layers,
  Upload,
  Download,
  FileSpreadsheet,
  Info,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRightLeft,
  CalendarDays,
  UserPlus,
  RefreshCw,
  Zap,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Mail,
  Smartphone,
  Moon,
  Sun,
  Activity,
  CreditCard,
  Users,
  FileText,
  Building2,
  Key,
  Settings2,
  Radio,
  ShieldCheck,
  ChevronDown,
  Lock,
  Database,
  Globe2,
  Palette,
  Coins,
  Fingerprint,
  HardDrive,
  Terminal,
  Scale,
  Check,
  Layout,
  ShieldAlert,
  Monitor,
  ToggleLeft,
  ToggleRight,
  MessageSquarePlus,
  FolderOpen,
  Video,
  Eye,
  EyeOff,
  Bot,
  Menu,
  Heart,
  Archive
} from 'lucide-react';

interface SettingsProps {
  role: UserRole;
  language: Language;
}

const MOCK_COURSES: Course[] = [
  { id: 'c1', code: 'MATH101', nameEn: 'Mathematics', nameAr: 'الرياضيات', credits: 4, department: 'Science', color: 'bg-blue-500', gradeLevel: 'Grade 10' },
  { id: 'c2', code: 'SCI101', nameEn: 'General Science', nameAr: 'العلوم العامة', credits: 3, department: 'Science', color: 'bg-green-500', gradeLevel: 'Grade 10' },
  { id: 'c3', code: 'ARB101', nameEn: 'Arabic Language', nameAr: 'اللغة العربية', credits: 5, department: 'Languages', color: 'bg-violet-500', gradeLevel: 'Grade 10' },
  { id: 'c4', code: 'ENG101', nameEn: 'English Language', nameAr: 'اللغة الإنجليزية', credits: 5, department: 'Languages', color: 'bg-purple-500', gradeLevel: 'Grade 11' },
  { id: 'c5', code: 'ISL101', nameEn: 'Islamic Studies', nameAr: 'الدراسات الإسلامية', credits: 2, department: 'Social Studies', color: 'bg-emerald-500', gradeLevel: 'Grade 12' },
];

export const Settings: React.FC<SettingsProps> = ({ role, language }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(SettingsTab.COURSES);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const refreshCourses = () => {
    setCoursesLoading(true);
    getAllCurriculumSubjectsWithGrade().then((subs) => {
      setCourses(subs.map(s => ({
        id: s.id,
        code: s.code,
        nameEn: s.nameEn,
        nameAr: s.subject,
        gradeLevel: s.grade,
        credits: s.credits,
        department: s.department,
        color: s.color,
      })));
      setCoursesLoading(false);
    });
  };
  useEffect(() => {
    refreshCourses();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseGradeFilter, setCourseGradeFilter] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const toggleSelectCourse = (id: string) => {
    setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const [courseViewMode, setCourseViewMode] = useState<'BROWSE' | 'WIZARD'>('BROWSE');
  const [subjectCreationStep, setSubjectCreationStep] = useState(1);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  
  // Space Management State — بيانات حقيقية
  const [spacesList, setSpacesList] = useState<SpaceInfo[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [isTogglingSpace, setIsTogglingSpace] = useState(false);
  const selectedSpace = spacesList.find(s => s.id === selectedSpaceId) || spacesList[0];
  const refreshSpaces = async () => {
    setSpacesLoading(true);
    const data = await getSpaces();
    setSpacesList(data);
    if (!selectedSpaceId && data.length > 0) setSelectedSpaceId(data[0].id);
    setSpacesLoading(false);
  };
  useEffect(() => { refreshSpaces(); }, []);

  // Academic Year State
  const [academicYears, setAcademicYears] = useState<AcademicYearConfig[]>([]);
  const [academicYearsLoading, setAcademicYearsLoading] = useState(true);
  const refreshAcademicYears = () => {
    setAcademicYearsLoading(true);
    getAcademicYears().then((years) => {
      setAcademicYears(prev => years.map(y => ({
        id: y.id,
        name: y.name,
        status: y.status as any,
        instructionalDays: prev.find(p => p.id === y.id)?.instructionalDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        termDivision: 'Semesters',
        terms: prev.find(p => p.id === y.id)?.terms || [],
        holidays: [],
        schoolEvents: [],
        assignedCourses: [],
      })));
      setAcademicYearsLoading(false);
    });
  };

  const [selectedYearId, setSelectedYearId] = useState('');

  useEffect(() => {
    setAcademicYearsLoading(true);
    Promise.all([getAcademicYears(), getTerms()]).then(([years, realTerms]) => {
      const mappedTerms = realTerms.map(t => ({
        id: t.id,
        nameEn: t.name,
        nameAr: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        gracePeriodDays: 5,
        status: t.status,
      }));
      setAcademicYears(years.map(y => ({
        id: y.id,
        name: y.name,
        status: y.status as any,
        instructionalDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        termDivision: 'Semesters',
        terms: mappedTerms,
        holidays: [],
        schoolEvents: [],
        assignedCourses: [],
      })));
      if (years.length > 0 && !selectedYearId) {
        const active = years.find(y => y.status === 'Active');
        setSelectedYearId(active?.id || years[0].id);
      }
      setAcademicYearsLoading(false);
    });
  }, []);
  const [academicYearViewMode, setAcademicYearViewMode] = useState<'BROWSE' | 'WIZARD' | 'DETAILS'>('BROWSE');
  const [creationStep, setCreationStep] = useState(1);
  
  const academicYear = academicYears.find(y => y.id === selectedYearId) || academicYears[0] || {
    id: '', name: '', status: 'Draft' as any,
    instructionalDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    termDivision: 'Semesters' as any, terms: [], holidays: [], schoolEvents: [], assignedCourses: [],
  };

  const setAcademicYear = (update: any) => {
    setAcademicYears(prev => prev.map(y => {
      if (y.id === selectedYearId) {
        return typeof update === 'function' ? update(y) : update;
      }
      return y;
    }));
  };

  const handleCreateAcademicYear = async () => {
    const id = await createAcademicYear({ name: '' });
    if (!id) {
      showToast('حصل خطأ أثناء إنشاء العام الدراسي.', 'error');
      return;
    }
    refreshAcademicYears();
    setSelectedYearId(id);
    setAcademicYearViewMode('WIZARD');
    setCreationStep(1);
  };

  const handleArchiveYear = async (yearId: string) => {
    const confirmed = await confirmDialog('متأكد إنك عايز تؤرشف العام الدراسي ده؟', 'أرشفة');
    if (!confirmed) return;
    const ok = await archiveAcademicYear(yearId);
    if (ok) {
      refreshAcademicYears();
      showToast('تم أرشفة العام الدراسي.', 'success');
    } else {
      showToast('حصل خطأ أثناء الأرشفة.', 'error');
    }
  };

  const handleDeleteYear = async (yearId: string) => {
    const confirmed = await confirmDialog('متأكد إنك عايز تمسح العام الدراسي ده؟ الإجراء ده مينفعش يترجع.', 'حذف');
    if (!confirmed) return;
    const ok = await deleteAcademicYear(yearId);
    if (ok) {
      refreshAcademicYears();
      showToast('تم حذف العام الدراسي.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف.', 'error');
    }
  };

  const handleAddTerm = async () => {
    const termCount = academicYear.terms.length + 1;
    const nameAr = `الفصل الدراسي ${termCount}`;
    const realId = await createTerm(nameAr, '', '');
    const newTerm = {
      id: realId || `t-${Date.now()}`,
      nameEn: `Term ${termCount}`,
      nameAr,
      startDate: '',
      endDate: '',
      gracePeriodDays: 5,
      status: 'Draft'
    };
    setAcademicYear((prev: any) => ({
      ...prev,
      terms: [...prev.terms, newTerm]
    }));
  };

  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);

  const calculateTeachingDays = () => {
    let total = 0;
    academicYear.terms.forEach(term => {
      const start = new Date(term.startDate);
      const end = new Date(term.endDate);
      let current = new Date(start);
      while (current <= end) {
        const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
        const isInstructional = academicYear.instructionalDays.includes(dayName);
        const isHoliday = academicYear.holidays.some(h => h.date === current.toISOString().split('T')[0]);
        
        if (isInstructional && !isHoliday) {
          total++;
        }
        current.setDate(current.getDate() + 1);
      }
    });
    return total;
  };

  const teachingDays = calculateTeachingDays();
  const isTeachingDaysLow = teachingDays < 160; // Example threshold

  const handleSyncHolidays = async () => {
    setIsSyncingHolidays(true);
    const year = academicYear.name.split('/')[0];
    const holidays = await fetchEgyptianHolidays(year, language);
    setAcademicYear(prev => ({
      ...prev,
      holidays: [...prev.holidays, ...holidays.filter(h => !prev.holidays.some(ph => ph.date === h.date))]
    }));
    setIsSyncingHolidays(false);
  };

  const handleDeleteHoliday = (id: string) => {
    setAcademicYear(prev => ({
      ...prev,
      holidays: prev.holidays.filter(h => h.id !== id)
    }));
  };

  const handleDeleteEvent = (id: string) => {
    setAcademicYear(prev => ({
      ...prev,
      schoolEvents: prev.schoolEvents.filter(e => e.id !== id)
    }));
  };

  const handleAddEvent = () => {
    const nameEn = prompt(isRTL ? 'أدخل اسم الفعالية (EN)' : 'Enter event name (EN)');
    const nameAr = prompt(isRTL ? 'أدخل اسم الفعالية (AR)' : 'Enter event name (AR)');
    const date = prompt(isRTL ? 'أدخل التاريخ (YYYY-MM-DD)' : 'Enter date (YYYY-MM-DD)');
    
    if (nameEn && nameAr && date) {
      setAcademicYear(prev => ({
        ...prev,
        schoolEvents: [
          ...prev.schoolEvents,
          { id: `ev-${Date.now()}`, nameEn, nameAr, date, type: 'Other' }
        ]
      }));
    }
  };

  const [timetable, setTimetable] = useState<any>(null);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [intakePrediction, setIntakePrediction] = useState<any>(null);
  const [isPredictingIntake, setIsPredictingIntake] = useState(false);
  const [holidayImpact, setHolidayImpact] = useState<any>(null);
  const [isSimulatingImpact, setIsSimulatingImpact] = useState(false);
  const [pacingGuide, setPacingGuide] = useState<any[]>([]);
  const [isGeneratingPacing, setIsGeneratingPacing] = useState(false);
  const [promotionAnalysis, setPromotionAnalysis] = useState<any>(null);
  const [isAnalyzingPromotion, setIsAnalyzingPromotion] = useState(false);
  const [triggerSearchQuery, setTriggerSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['identity']);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const [triggerCategoryFilter, setTriggerCategoryFilter] = useState<NotificationCategory | 'ALL'>('ALL');
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');
  const [isAddTriggerModalOpen, setIsAddTriggerModalOpen] = useState(false);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [newTrigger, setNewTrigger] = useState<Partial<NotificationTrigger>>({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    category: NotificationCategory.ACADEMIC,
    enabled: true,
    channels: [NotificationChannel.IN_APP],
    recipients: [UserRole.STUDENT],
    aiPurposeEn: '',
    aiPurposeAr: ''
  });

  // Notification State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    channels: {
      [NotificationChannel.IN_APP]: { enabled: true, descriptionEn: 'For non-urgent academic updates', descriptionAr: 'للتحديثات الأكاديمية غير العاجلة' },
      [NotificationChannel.PUSH]: { enabled: true, descriptionEn: 'For mobile app users (e.g., "Assignment due in 2 hours")', descriptionAr: 'لمستخدمي تطبيق الهاتف المحمول' },
      [NotificationChannel.SMS]: { enabled: false, descriptionEn: 'Reserved for High Priority (e.g., "Emergency School Closure")', descriptionAr: 'محجوز للأولويات العالية' },
      [NotificationChannel.EMAIL]: { enabled: true, descriptionEn: 'For long-form records (e.g., "Monthly Progress Report")', descriptionAr: 'للسجلات الطويلة' },
    },
    categories: {
      [NotificationCategory.ACADEMIC]: { enabled: true, channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL], recipients: [UserRole.STUDENT, UserRole.TEACHER], descriptionEn: 'Grade updates, attendance alerts, exam schedules', descriptionAr: 'تحديثات الدرجات، تنبيهات الحضور، جداول الامتحانات' },
      [NotificationCategory.FINANCIAL]: { enabled: true, channels: [NotificationChannel.EMAIL, NotificationChannel.SMS], recipients: [UserRole.ADMIN, UserRole.STUDENT], descriptionEn: 'Fee reminders, scholarship updates, payment receipts', descriptionAr: 'تذكيرات الرسوم، تحديثات المنح الدراسية، إيصالات الدفع' },
      [NotificationCategory.BEHAVIORAL]: { enabled: true, channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL], recipients: [UserRole.STUDENT, UserRole.TEACHER], descriptionEn: 'Merit/Demerit points, incident reports', descriptionAr: 'نقاط الجدارة/الخصم، تقارير الحوادث' },
      [NotificationCategory.ADMINISTRATIVE]: { enabled: true, channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], recipients: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT], descriptionEn: 'Term start/end, school events, survey requests', descriptionAr: 'بداية/نهاية الفصل الدراسي، فعاليات المدرسة' },
    },
    triggers: [
      {
        id: 'assessment_published',
        nameEn: 'New Assessment Published',
        nameAr: 'نشر تقييم جديد',
        descriptionEn: 'Notifies students/parents when a quiz or assignment is created.',
        descriptionAr: 'إخطار الطلاب/أولياء الأمور عند إنشاء اختبار أو واجب.',
        category: NotificationCategory.ACADEMIC,
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Performance Engagement',
        aiPurposeAr: 'مشاركة الأداء'
      },
      {
        id: 'grade_released',
        nameEn: 'Grade Released',
        nameAr: 'إصدار الدرجة',
        descriptionEn: 'Sent when a teacher finishes grading an assessment.',
        descriptionAr: 'يتم إرسالها عندما ينتهي المعلم من تصحيح التقييم.',
        category: NotificationCategory.ACADEMIC,
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Feedback Loop',
        aiPurposeAr: 'حلقة التغذية الراجعة'
      },
      {
        id: 'missing_submission',
        nameEn: 'Missing Submission',
        nameAr: 'تسليم مفقود',
        descriptionEn: 'Triggered 24 hours after a deadline if no file is uploaded.',
        descriptionAr: 'يتم تفعيلها بعد 24 ساعة من الموعد النهائي إذا لم يتم رفع أي ملف.',
        category: NotificationCategory.ACADEMIC,
        enabled: true,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Accountability Nudge',
        aiPurposeAr: 'تنبيه المسؤولية'
      },
      {
        id: 'grade_drop_alert',
        nameEn: 'Grade Drop Alert',
        nameAr: 'تنبيه انخفاض الدرجات',
        descriptionEn: 'Triggered if a student’s cumulative average drops by more than 10%.',
        descriptionAr: 'يتم تفعيلها إذا انخفض المعدل التراكمي للطالب بأكثر من 10%.',
        category: NotificationCategory.ACADEMIC,
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT, UserRole.TEACHER],
        aiPurposeEn: 'Early Intervention',
        aiPurposeAr: 'التدخل المبكر'
      },
      {
        id: 'exam_schedule_update',
        nameEn: 'Exam Schedule Update',
        nameAr: 'تحديث جدول الامتحانات',
        descriptionEn: 'Notifies of changes to midterms or finals.',
        descriptionAr: 'إخطار بالتغييرات في امتحانات منتصف العام أو نهايته.',
        category: NotificationCategory.ACADEMIC,
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [UserRole.STUDENT, UserRole.TEACHER],
        aiPurposeEn: 'Logistics Sync',
        aiPurposeAr: 'مزامنة الخدمات اللوجستية'
      },
      {
        id: 'daily_absence',
        nameEn: 'Daily Absence',
        nameAr: 'غياب يومي',
        descriptionEn: 'Sent 30 minutes after the start of the school day if the student is unmarked.',
        descriptionAr: 'يتم إرسالها بعد 30 دقيقة من بدء اليوم الدراسي إذا لم يتم تسجيل الطالب.',
        category: NotificationCategory.BEHAVIORAL,
        enabled: true,
        channels: [NotificationChannel.SMS, NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Safety & Presence',
        aiPurposeAr: 'السلامة والحضور'
      },
      {
        id: 'consecutive_absence',
        nameEn: 'Consecutive Absence',
        nameAr: 'غياب متكرر',
        descriptionEn: 'Triggered after 3 days of missed school (High Priority).',
        descriptionAr: 'يتم تفعيلها بعد 3 أيام من التغيب عن المدرسة (أولوية عالية).',
        category: NotificationCategory.BEHAVIORAL,
        enabled: true,
        channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
        recipients: [UserRole.ADMIN, UserRole.STUDENT],
        aiPurposeEn: 'Retention Risk',
        aiPurposeAr: 'خطر التسرب'
      },
      {
        id: 'tardy_late_arrival',
        nameEn: 'Tardy/Late Arrival',
        nameAr: 'تأخير/وصول متأخر',
        descriptionEn: 'Notifies parents of the exact time the student entered the gate.',
        descriptionAr: 'إخطار أولياء الأمور بالوقت المحدد لدخول الطالب من البوابة.',
        category: NotificationCategory.BEHAVIORAL,
        enabled: true,
        channels: [NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Punctuality Tracking',
        aiPurposeAr: 'تتبع المواعيد'
      },
      {
        id: 'behavioral_incident',
        nameEn: 'New Behavioral Incident',
        nameAr: 'واقعة سلوكية جديدة',
        descriptionEn: 'Sent when a teacher logs a demerit or a disciplinary note.',
        descriptionAr: 'يتم إرسالها عندما يسجل المعلم خصمًا أو ملاحظة تأديبية.',
        category: NotificationCategory.BEHAVIORAL,
        enabled: true,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [UserRole.STUDENT, UserRole.ADMIN],
        aiPurposeEn: 'Conduct Correction',
        aiPurposeAr: 'تصحيح السلوك'
      },
      {
        id: 'merit_award',
        nameEn: 'Merit Award',
        nameAr: 'جائزة جدارة',
        descriptionEn: 'A "Positive Nudge" sent when a student receives praise or points for good behavior.',
        descriptionAr: '"دفعة إيجابية" يتم إرسالها عندما يتلقى الطالب ثناءً أو نقاطًا للسلوك الجيد.',
        category: NotificationCategory.BEHAVIORAL,
        enabled: true,
        channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Positive Reinforcement',
        aiPurposeAr: 'التعزيز الإيجابي'
      },
      {
        id: 'invoice_generated',
        nameEn: 'Invoice Generated',
        nameAr: 'تم إنشاء الفاتورة',
        descriptionEn: 'Sent when monthly or term tuition fees are posted.',
        descriptionAr: 'يتم إرسالها عند نشر الرسوم الدراسية الشهرية أو الفصلية.',
        category: NotificationCategory.FINANCIAL,
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Revenue Cycle',
        aiPurposeAr: 'دورة الإيرادات'
      },
      {
        id: 'payment_reminder',
        nameEn: 'Payment Reminder',
        nameAr: 'تذكير بالدفع',
        descriptionEn: 'Automated nudge 5 days before the due date.',
        descriptionAr: 'تنبيه آلي قبل 5 أيام من تاريخ الاستحقاق.',
        category: NotificationCategory.FINANCIAL,
        enabled: true,
        channels: [NotificationChannel.SMS, NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Cashflow Optimization',
        aiPurposeAr: 'تحسين التدفق النقدي'
      },
      {
        id: 'overdue_notice',
        nameEn: 'Overdue Notice',
        nameAr: 'إشعار تأخير السداد',
        descriptionEn: 'Sent when a payment is late (includes a "Pay Now" link).',
        descriptionAr: 'يتم إرسالها عندما يتأخر الدفع (تتضمن رابط "ادفع الآن").',
        category: NotificationCategory.FINANCIAL,
        enabled: true,
        channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Debt Recovery',
        aiPurposeAr: 'تحصيل الديون'
      },
      {
        id: 'reenrollment_open',
        nameEn: 'Re-enrollment Open',
        nameAr: 'فتح إعادة التسجيل',
        descriptionEn: 'Notifies parents to confirm their spot for the next academic year.',
        descriptionAr: 'إخطار أولياء الأمور لتأكيد مكانهم للعام الدراسي القادم.',
        category: NotificationCategory.FINANCIAL,
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT],
        aiPurposeEn: 'Retention Planning',
        aiPurposeAr: 'تخطيط الاستبقاء'
      },
      {
        id: 'school_announcement',
        nameEn: 'School Announcement',
        nameAr: 'إعلان مدرسي',
        descriptionEn: 'General news from the Principal (e.g., "Snow Day," "Event Change").',
        descriptionAr: 'أخبار عامة من المدير (مثل: "يوم ثلجي"، "تغيير فعالية").',
        category: NotificationCategory.ADMINISTRATIVE,
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
        recipients: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
        aiPurposeEn: 'Mass Communication',
        aiPurposeAr: 'التواصل الجماعي'
      },
      {
        id: 'meeting_invite',
        nameEn: 'Parent-Teacher Meeting Invite',
        nameAr: 'دعوة لاجتماع أولياء الأمور والمعلمين',
        descriptionEn: 'Request for a slot in the conference calendar.',
        descriptionAr: 'طلب حجز موعد في تقويم المؤتمرات.',
        category: NotificationCategory.ADMINISTRATIVE,
        enabled: true,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        recipients: [UserRole.STUDENT, UserRole.TEACHER],
        aiPurposeEn: 'Stakeholder Alignment',
        aiPurposeAr: 'توافق أصحاب المصلحة'
      },
      {
        id: 'new_message',
        nameEn: 'New Message',
        nameAr: 'رسالة جديدة',
        descriptionEn: 'Notification of a direct chat from a teacher to a parent.',
        descriptionAr: 'إخطار برسالة مباشرة من المعلم إلى ولي الأمر.',
        category: NotificationCategory.ADMINISTRATIVE,
        enabled: true,
        channels: [NotificationChannel.PUSH],
        recipients: [UserRole.STUDENT, UserRole.TEACHER],
        aiPurposeEn: 'Direct Engagement',
        aiPurposeAr: 'المشاركة المباشرة'
      },
      {
        id: 'survey_request',
        nameEn: 'Survey/Feedback Request',
        nameAr: 'طلب استطلاع/تغذية راجعة',
        descriptionEn: 'Post-event surveys to gather school sentiment.',
        descriptionAr: 'استطلاعات ما بعد الفعاليات لجمع آراء المدرسة.',
        category: NotificationCategory.ADMINISTRATIVE,
        enabled: true,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        recipients: [UserRole.STUDENT, UserRole.TEACHER],
        aiPurposeEn: 'Sentiment Analysis',
        aiPurposeAr: 'تحليل المشاعر'
      }
    ],
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
      allowEmergency: true
    },
    batching: {
      enabled: false,
      frequency: 'Daily',
      time: '16:00'
    }
  });

  const [newCourse, setNewCourse] = useState<Partial<Course>>({
    code: '',
    nameEn: '',
    nameAr: '',
    credits: 3,
    department: 'General',
    color: 'bg-violet-500',
    gradeLevel: 'الصف 9'
  });
  const [newCourseIcon, setNewCourseIcon] = useState('book-open');
  const NewCoursePreviewIcon = getSubjectIconComponent(newCourseIcon);
  const [subjectThemes, setSubjectThemes] = useState<Record<string, SubjectTheme>>({});

  const refreshSubjectThemes = () => {
    getSubjectThemes().then(setSubjectThemes);
  };

  useEffect(() => {
    refreshSubjectThemes();
  }, []);

  const [gradeLevels, setGradeLevels] = useState<{ id: string; name: string; displayOrder: number }[]>([]);
  const [newGradeLevelName, setNewGradeLevelName] = useState('');
  const [isAddingGradeLevel, setIsAddingGradeLevel] = useState(false);
  const refreshGradeLevels = () => {
    getGradeLevels().then(setGradeLevels);
  };
  useEffect(() => {
    refreshGradeLevels();
  }, []);
  const handleAddGradeLevel = async () => {
    if (!newGradeLevelName.trim()) return;
    const id = await addGradeLevel(newGradeLevelName.trim());
    if (id) {
      refreshGradeLevels();
      setNewGradeLevelName('');
      setIsAddingGradeLevel(false);
      showToast('تم إضافة الصف الدراسي بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء الإضافة (ممكن يكون الاسم موجود بالفعل).', 'error');
    }
  };
  const handleDeleteGradeLevel = async (id: string) => {
    const confirmed = await confirmDialog('متأكد إنك عايز تمسح الصف الدراسي ده؟ الفصول والمواد المرتبطة بيه هتفضل موجودة لكن مش هتظهر تحت صف حالي.', 'حذف');
    if (!confirmed) return;
    const ok = await deleteGradeLevel(id);
    if (ok) {
      refreshGradeLevels();
      showToast('تم حذف الصف الدراسي.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف.', 'error');
    }
  };

  const isRTL = language === Language.AR;

  const handleAddCourse = async () => {
    if (!newCourse.code || !newCourse.nameEn || !newCourse.nameAr) return;

    let ok: boolean;
    if (editingCourseId) {
      ok = await updateCurriculumSubjectById(editingCourseId, {
        code: newCourse.code,
        nameEn: newCourse.nameEn,
        department: newCourse.department || 'General',
        credits: newCourse.credits || 3,
        color: newCourse.color || 'bg-violet-500',
      });
    } else {
      ok = await addCurriculumSubject({
        grade: newCourse.gradeLevel || 'الصف 9',
        subject: newCourse.nameAr!,
        code: newCourse.code,
        nameEn: newCourse.nameEn,
        department: newCourse.department || 'General',
        credits: newCourse.credits || 3,
        color: newCourse.color || 'bg-violet-500',
      });
    }

    if (ok) {
      if (newCourse.nameAr) {
        await upsertSubjectTheme(newCourse.nameAr, { icon: newCourseIcon, color: newCourse.color || 'bg-violet-500' });
        refreshSubjectThemes();
      }
      refreshCourses();
      showToast(editingCourseId ? 'تم تعديل المادة بنجاح.' : 'تم إضافة المادة بنجاح.', 'success');
      setCourseViewMode('BROWSE');
      setEditingCourseId(null);
      setNewCourse({ code: '', nameEn: '', nameAr: '', credits: 3, department: 'General', color: 'bg-violet-500', gradeLevel: 'الصف 9' }); setNewCourseIcon('book-open');
    } else {
      showToast(editingCourseId ? 'حصل خطأ أثناء التعديل.' : 'حصل خطأ أثناء إضافة المادة (ممكن تكون موجودة بالفعل لنفس الصف).', 'error');
    }
  };

  const handleBulkDeleteCourses = async () => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح ${selectedCourseIds.length} مادة؟ الإجراء ده مينفعش يترجع.`, 'حذف الكل');
    if (!confirmed) return;
    const results = await Promise.all(selectedCourseIds.map(id => removeCurriculumSubjectById(id)));
    refreshCourses();
    setSelectedCourseIds([]);
    if (results.every(Boolean)) {
      showToast('تم حذف المواد المحددة.', 'success');
    } else {
      showToast('حصل خطأ في حذف بعض المواد.', 'error');
    }
  };



  const handleAddTrigger = () => {
    if (!newTrigger.nameEn || !newTrigger.nameAr) return;
    
    if (editingTriggerId) {
      setNotificationSettings(prev => ({
        ...prev,
        triggers: prev.triggers.map(t => t.id === editingTriggerId ? { ...t, ...newTrigger as NotificationTrigger } : t)
      }));
    } else {
      const trigger: NotificationTrigger = {
        id: `custom_${Date.now()}`,
        nameEn: newTrigger.nameEn!,
        nameAr: newTrigger.nameAr!,
        descriptionEn: newTrigger.descriptionEn || '',
        descriptionAr: newTrigger.descriptionAr || '',
        category: newTrigger.category || NotificationCategory.ACADEMIC,
        enabled: true,
        channels: newTrigger.channels || [NotificationChannel.IN_APP],
        recipients: newTrigger.recipients || [UserRole.STUDENT],
        aiPurposeEn: newTrigger.aiPurposeEn,
        aiPurposeAr: newTrigger.aiPurposeAr
      };

      setNotificationSettings(prev => ({
        ...prev,
        triggers: [...prev.triggers, trigger]
      }));
    }

    setIsAddTriggerModalOpen(false);
    setEditingTriggerId(null);
    setNewTrigger({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      category: NotificationCategory.ACADEMIC,
      enabled: true,
      channels: [NotificationChannel.IN_APP],
      recipients: [UserRole.STUDENT],
      aiPurposeEn: '',
      aiPurposeAr: ''
    });
  };

  const handleEditTrigger = (trigger: NotificationTrigger) => {
    setNewTrigger(trigger);
    setEditingTriggerId(trigger.id);
    setIsAddTriggerModalOpen(true);
  };

  const handleDeleteTrigger = (id: string) => {
    setNotificationSettings(prev => ({
      ...prev,
      triggers: prev.triggers.filter(t => t.id !== id)
    }));
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate CSV parsing
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Mock parsing: split by lines and assume format: Code,NameEn,NameAr,Credits,Dept,Grade
      const lines = text.split('\n').slice(1); // skip header
      const newCourses: Course[] = lines.filter(line => line.trim()).map((line, i) => {
        const [code, nameEn, nameAr, credits, dept, grade] = line.split(',');
        return {
          id: `bulk-${Date.now()}-${i}`,
          code: code?.trim() || 'NEW',
          nameEn: nameEn?.trim() || 'New Subject',
          nameAr: nameAr?.trim() || 'مادة جديدة',
          credits: parseInt(credits?.trim()) || 3,
          department: dept?.trim() || 'General',
          color: 'bg-violet-500',
          gradeLevel: grade?.trim() || 'Grade 10'
        };
      });

      setCourses(prev => [...newCourses, ...prev]);
      setIsBulkImportModalOpen(false);
      showToast(isRTL ? `تم استيراد ${newCourses.length} مواد بنجاح` : `Successfully imported ${newCourses.length} subjects`, 'success');
    };
    reader.readAsText(file);
  };

  const handleGenerateSchedule = async () => {
    setIsGeneratingSchedule(true);
    const result = await generateConflictFreeSchedule([], [], courses, [], language);
    if (result) setTimetable(result);
    setIsGeneratingSchedule(false);
  };

  const handleSimulateImpact = async () => {
    setIsSimulatingImpact(true);
    const result = await simulateHolidayImpact(academicYear.holidays, academicYear.startDate, academicYear.endDate, "Standard Curriculum", language);
    if (result) setHolidayImpact(result);
    setIsSimulatingImpact(false);
  };

  const handleGeneratePacing = async () => {
    setIsGeneratingPacing(true);
    const result = await generateTermPacingGuide(academicYear.startDate, academicYear.endDate, "General Syllabus", language);
    if (result) setPacingGuide(result);
    setIsGeneratingPacing(false);
  };

  const handlePredictIntake = async () => {
    setIsPredictingIntake(true);
    const result = await predictIntakeAndSections({}, {}, language);
    if (result) setIntakePrediction(result);
    setIsPredictingIntake(false);
  };

  const handleAnalyzePromotion = async () => {
    setIsAnalyzingPromotion(true);
    const result = await analyzePromotionEligibility([], {}, language);
    if (result) setPromotionAnalysis(result);
    setIsAnalyzingPromotion(false);
  };

  const toggleCourseAssignment = (courseId: string) => {
    setAcademicYear(prev => ({
      ...prev,
      assignedCourses: prev.assignedCourses.includes(courseId)
        ? prev.assignedCourses.filter(id => id !== courseId)
        : [...prev.assignedCourses, courseId]
    }));
  };

  const handleDeleteCourse = async (id: string) => {
    const confirmed = await confirmDialog(isRTL ? 'هل أنت متأكد من حذف هذا المقرر؟' : 'Are you sure you want to delete this course?', isRTL ? 'حذف' : 'Delete');
    if (confirmed) {
      const ok = await removeCurriculumSubjectById(id);
      if (ok) {
        refreshCourses();
        showToast('تم حذف المادة.', 'success');
      } else {
        showToast('حصل خطأ أثناء الحذف.', 'error');
      }
    }
  };

  const filteredCourses = courses.filter(c => 
    (c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nameAr.includes(searchQuery) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!courseGradeFilter || c.gradeLevel === courseGradeFilter)
  );

  const tabs = [
    { id: SettingsTab.GENERAL, labelEn: 'General', labelAr: 'عام', icon: <SettingsIcon size={20} /> },
    { id: SettingsTab.COURSES, labelEn: 'Courses & Subjects', labelAr: 'المواد والمقررات', icon: <BookOpen size={20} /> },
    { id: SettingsTab.ACADEMIC_YEAR, labelEn: 'Academic Year', labelAr: 'العام الدراسي', icon: <Calendar size={20} /> },
    { id: SettingsTab.NOTIFICATIONS, labelEn: 'Notifications', labelAr: 'التنبيهات', icon: <Bell size={20} /> },
    { id: SettingsTab.SPACE_MANAGEMENT, labelEn: 'Space Management', labelAr: 'إدارة المساحات', icon: <Layout size={20} /> },
    { id: SettingsTab.SECURITY, labelEn: 'Security', labelAr: 'الأمان', icon: <Shield size={20} /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full animate-fadeIn">
      
      {/* Settings Sub-Sidebar */}
      <aside className={`w-full lg:w-[300px] flex flex-col bg-white border-gray-100 ${isRTL ? 'border-l' : 'border-r'} h-full`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-8 pb-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            {isRTL ? 'الإعدادات' : 'Settings'}
          </h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
            {isRTL ? 'تكوين النظام' : 'System Configuration'}
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 ${
                activeTab === tab.id 
                  ? 'bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-100' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'opacity-70'}`}>
                {tab.icon}
              </div>
              <span className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL ? tab.labelAr : tab.labelEn}</span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className={`w-1.5 h-1.5 rounded-full bg-violet-500 ${isRTL ? 'mr-2' : 'ml-2'}`} 
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-50">
          <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm">
              <Shield size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? 'مستوى الأمان' : 'Security Level'}</p>
              <p className="text-xs font-bold text-emerald-600">{isRTL ? 'عالي جداً' : 'Ultra High'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Settings Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#fdfdfd]">
        <div className="max-w-5xl mx-auto p-8 lg:p-12">
          {activeTab === SettingsTab.COURSES && (
            <div className="flex-1 flex flex-col">
              {/* Tab Header */}
              <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                    {isRTL ? 'إدارة المواد والمقررات' : 'Course & Subject Management'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {isRTL ? 'إضافة وتعديل المواد الدراسية المتاحة في النظام' : 'Add and edit the academic subjects available in the system'}
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingCourseId(null);
                    setNewCourse({ code: '', nameEn: '', nameAr: '', credits: 3, department: 'General', color: 'bg-violet-500', gradeLevel: 'الصف 9' }); setNewCourseIcon('book-open');
                    setCourseViewMode('WIZARD');
                    setSubjectCreationStep(1);
                  }} 
                  className="gap-2 shadow-xl shadow-violet-100 h-12 px-6 rounded-2xl"
                >
                  <Plus size={20} /> {isRTL ? 'إضافة مادة' : 'Add Subject'}
                </Button>
              </div>

              {/* Grade Levels Manager */}
              <div className="mb-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900">{isRTL ? 'الصفوف الدراسية' : 'Grade Levels'}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{isRTL ? 'الصفوف اللي بتستخدمها المدرسة في كل مكان بالنظام' : 'The grades your school uses throughout the system'}</p>
                  </div>
                  <button onClick={() => setIsAddingGradeLevel(true)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Plus size={16} /> {isRTL ? 'إضافة صف' : 'Add Grade'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gradeLevels.map(g => (
                    <span key={g.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-bold">
                      {g.name}
                      <button onClick={() => handleDeleteGradeLevel(g.id)} className="text-gray-300 hover:text-red-500">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {isAddingGradeLevel && (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={newGradeLevelName}
                        onChange={(e) => setNewGradeLevelName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddGradeLevel()}
                        placeholder={isRTL ? 'مثال: الصف 13' : 'e.g. Grade 13'}
                        className="bg-gray-50 border border-violet-200 rounded-full px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button onClick={handleAddGradeLevel} className="text-xs font-bold text-violet-600">{isRTL ? 'إضافة' : 'Add'}</button>
                      <button onClick={() => { setIsAddingGradeLevel(false); setNewGradeLevelName(''); }} className="text-xs text-gray-400">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  )}
                  {gradeLevels.length === 0 && !isAddingGradeLevel && (
                    <p className="text-sm text-gray-400">{isRTL ? 'مفيش صفوف دراسية متعملة لسه.' : 'No grade levels yet.'}</p>
                  )}
                </div>
              </div>

              {/* Toolbar */}
              <div className="mb-8 flex flex-col xl:flex-row gap-4">
                <div className="flex flex-1 gap-3 flex-col lg:flex-row">
                  <div className="relative flex-[2]">
                    <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-3.5 text-gray-400`} size={20} />
                    <input 
                      type="text" 
                      placeholder={isRTL ? 'البحث عن مادة...' : 'Search subjects...'}
                      className={`w-full p-4 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-none text-sm`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select value={courseGradeFilter} onChange={(e) => setCourseGradeFilter(e.target.value)} className="flex-1 bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-none text-gray-600 outline-none">
                    <option value="">{isRTL ? 'كل الصفوف' : 'All Grades'}</option>
                    {gradeLevels.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                  <select className="flex-1 bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-none text-gray-600 outline-none">
                    <option value="">{isRTL ? 'الفصل الدراسي' : 'All Terms'}</option>
                    <option value="T1">{isRTL ? 'الفصل الأول' : 'Term 1'}</option>
                    <option value="T2">{isRTL ? 'الفصل الثاني' : 'Term 2'}</option>
                    <option value="T3">{isRTL ? 'الفصل الثالث' : 'Term 3'}</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsBulkImportModalOpen(true)} className="h-12 px-5 rounded-2xl border-gray-100">
                    <Upload size={18} className={isRTL ? 'ml-2' : 'mr-2'} /> {isRTL ? 'استيراد CSV' : 'Import CSV'}
                  </Button>
                  <Button variant="secondary" className="h-12 px-5 rounded-2xl border-gray-100">
                    <Globe size={18} className={isRTL ? 'ml-2' : 'mr-2'} /> {isRTL ? 'تصدير' : 'Export'}
                  </Button>
                </div>
              </div>

              {/* Course Content Area */}
              <div className="flex-1">
                {selectedCourseIds.length > 0 && (
                  <div className="mb-6 bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-violet-800">{selectedCourseIds.length} مادة محددة</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedCourseIds([])} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-lg">إلغاء التحديد</button>
                      <button onClick={handleBulkDeleteCourses} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">حذف المحدد</button>
                    </div>
                  </div>
                )}
                {courseViewMode === 'BROWSE' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fadeIn">
                      {filteredCourses.map(course => {
                        const cardTheme = getSubjectThemeFor(subjectThemes, course.nameAr || '');
                        const CardIcon = getSubjectIconComponent(cardTheme.icon);
                        return (
                        <div key={course.id} className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-full h-1.5 ${cardTheme.color}`}></div>
                          
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedCourseIds.includes(course.id)}
                                onChange={() => toggleSelectCourse(course.id)}
                                className="mt-1"
                              />
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${cardTheme.color}`}>
                                <CardIcon size={24} />
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => {
                                  setNewCourse(course);
                                  setNewCourseIcon(getSubjectThemeFor(subjectThemes, course.nameAr || '').icon);
                                  setEditingCourseId(course.id);
                                  setCourseViewMode('WIZARD');
                                  setSubjectCreationStep(1);
                                }}
                                title={isRTL ? 'تعديل المادة' : 'Edit Subject'}
                                className="p-2 text-gray-400 bg-gray-50 border border-gray-100 hover:bg-violet-600 hover:text-white hover:border-violet-600 hover:shadow-md hover:-translate-y-0.5 rounded-full transition-all flex items-center justify-center"
                              >
                                <Pencil size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCourse(course.id)}
                                className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{course.code} • {course.gradeLevel}</p>
                            <h4 className="text-lg font-bold text-gray-900 mb-0.5">{isRTL ? course.nameAr : course.nameEn}</h4>
                            <p className="text-xs text-gray-500">{isRTL ? course.nameEn : course.nameAr}</p>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs font-bold text-gray-600">{course.department}</span>
                            </div>
                            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                              {course.credits} {isRTL ? 'ساعات' : 'Credits'}
                            </span>
                          </div>
                        </div>
                      );
                      })}

                      <button 
                        onClick={() => {
                          setEditingCourseId(null);
                          setNewCourse({ code: '', nameEn: '', nameAr: '', credits: 3, department: 'General', color: 'bg-violet-500', gradeLevel: 'الصف 9' }); setNewCourseIcon('book-open');
                          setCourseViewMode('WIZARD');
                          setSubjectCreationStep(1);
                        }}
                        className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-all group min-h-[200px]"
                      >
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-all">
                          <Plus size={24} />
                        </div>
                        <span className="font-bold">{isRTL ? 'إضافة مادة جديدة' : 'Add New Subject'}</span>
                      </button>

                      {filteredCourses.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Search size={40} className="opacity-20" />
                          </div>
                          <p className="text-lg font-medium">{isRTL ? 'لا توجد نتائج' : 'No subjects found'}</p>
                          <p className="text-sm">{isRTL ? 'جرب البحث بكلمات أخرى' : 'Try searching with different keywords'}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="max-w-4xl mx-auto animate-fadeIn">
                    <div className="mb-12 flex items-center justify-center gap-4">
                      {[1, 2, 3].map(step => (
                        <React.Fragment key={step}>
                          <div className={`flex items-center gap-2 ${subjectCreationStep >= step ? 'text-violet-600' : 'text-gray-300'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                              subjectCreationStep === step ? 'bg-violet-600 border-violet-600 text-white scale-110 shadow-md' : 
                              subjectCreationStep > step ? 'bg-violet-50 border-violet-600 text-violet-600' : 'bg-white border-gray-200'
                            }`}>
                              {subjectCreationStep > step ? <CheckCircle2 size={20} /> : step}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest hidden md:block">
                              {step === 1 ? (isRTL ? 'الهوية' : 'Identity') : 
                               step === 2 ? (isRTL ? 'التصنيف' : 'Classification') : 
                               (isRTL ? 'المراجعة' : 'Review')}
                            </span>
                          </div>
                          {step < 3 && <div className={`h-0.5 w-16 rounded-full transition-all ${subjectCreationStep > step ? 'bg-violet-600' : 'bg-gray-100'}`} />}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl shadow-violet-50/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full -mr-32 -mt-32 opacity-50" />
                      
                      <div className="relative z-10">
                        {subjectCreationStep === 1 && (
                          <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 mb-8">
                              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                                <Hash size={24} />
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-gray-900">{isRTL ? 'هوية المادة' : 'Subject Identity'}</h4>
                                <p className="text-sm text-gray-500">{isRTL ? 'حدد الرمز والاسم للمادة الجديدة' : 'Define the code and name for the new subject'}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'رمز المادة' : 'Subject Code'}</label>
                                <input 
                                  type="text" 
                                  value={newCourse.code}
                                  onChange={(e) => setNewCourse({...newCourse, code: e.target.value})}
                                  placeholder="e.g. MATH101"
                                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                                  <input 
                                    type="text" 
                                    value={newCourse.nameEn}
                                    onChange={(e) => setNewCourse({...newCourse, nameEn: e.target.value})}
                                    placeholder="e.g. Mathematics"
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                                  <input 
                                    type="text" 
                                    value={newCourse.nameAr}
                                    onChange={(e) => setNewCourse({...newCourse, nameAr: e.target.value})}
                                    placeholder="مثال: الرياضيات"
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all text-right"
                                    dir="rtl"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {subjectCreationStep === 2 && (
                          <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 mb-8">
                              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                                <Layers size={24} />
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-gray-900">{isRTL ? 'تصنيف المادة' : 'Subject Classification'}</h4>
                                <p className="text-sm text-gray-500">{isRTL ? 'حدد القسم والمستوى الدراسي والساعات' : 'Define department, grade level, and credits'}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'القسم' : 'Department'}</label>
                                <select 
                                  value={newCourse.department}
                                  onChange={(e) => setNewCourse({...newCourse, department: e.target.value})}
                                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all appearance-none"
                                >
                                  <option value="Science">Science</option>
                                  <option value="Mathematics">Mathematics</option>
                                  <option value="Languages">Languages</option>
                                  <option value="Social Studies">Social Studies</option>
                                  <option value="Arts">Arts</option>
                                  <option value="General">General</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'المستوى الدراسي' : 'Grade Level'}</label>
                                <select 
                                  value={newCourse.gradeLevel}
                                  onChange={(e) => setNewCourse({...newCourse, gradeLevel: e.target.value})}
                                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-violet-500 transition-all appearance-none"
                                >
                                  {gradeLevels.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                </select>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'الساعات المعتمدة' : 'Credits'}</label>
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={newCourse.credits}
                                    onChange={(e) => setNewCourse({...newCourse, credits: parseInt(e.target.value)})}
                                    className="flex-1 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
                                  />
                                  <span className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center font-black text-lg">
                                    {newCourse.credits}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'لون المادة' : 'Subject Color'}</label>
                                <div className="flex flex-wrap gap-2">
                                  {SUBJECT_COLOR_OPTIONS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => setNewCourse({ ...newCourse, color: c })}
                                      className={`w-9 h-9 rounded-full ${c} flex items-center justify-center transition-transform ${newCourse.color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                                    >
                                      {newCourse.color === c && <CheckCircle2 size={16} className="text-white" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isRTL ? 'أيقونة المادة' : 'Subject Icon'}</label>
                                <div className="grid grid-cols-8 gap-2">
                                  {SUBJECT_ICON_OPTIONS.map((iconName) => {
                                    const IconComp = getSubjectIconComponent(iconName);
                                    return (
                                      <button
                                        key={iconName}
                                        type="button"
                                        onClick={() => setNewCourseIcon(iconName)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${newCourseIcon === iconName ? `${newCourse.color || 'bg-violet-500'} text-white border-transparent` : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                                      >
                                        <IconComp size={18} />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {subjectCreationStep === 3 && (
                          <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 mb-8">
                              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                <CheckCircle2 size={24} />
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-gray-900">{isRTL ? 'مراجعة المادة' : 'Subject Review'}</h4>
                                <p className="text-sm text-gray-500">{isRTL ? 'تأكد من صحة البيانات قبل الحفظ' : 'Verify the data before saving'}</p>
                              </div>
                            </div>

                            <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6">
                              <div className="flex items-center gap-6">
                                <div className={`w-20 h-20 ${newCourse.color || 'bg-violet-500'} text-white rounded-[2rem] flex items-center justify-center shadow-sm`}>
                                  <NewCoursePreviewIcon size={40} />
                                </div>
                                <div>
                                  <h5 className="text-2xl font-black text-gray-900">{isRTL ? newCourse.nameAr : newCourse.nameEn}</h5>
                                  <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{newCourse.code}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200">
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{isRTL ? 'القسم' : 'Department'}</p>
                                  <p className="font-bold text-gray-900">{newCourse.department}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{isRTL ? 'المستوى' : 'Level'}</p>
                                  <p className="font-bold text-gray-900">{newCourse.gradeLevel}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{isRTL ? 'الساعات' : 'Credits'}</p>
                                  <p className="font-bold text-violet-600">{newCourse.credits}</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-violet-600 p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl shadow-violet-100">
                              <Sparkles size={32} />
                              <h5 className="text-xl font-black">{isRTL ? 'جاهز للإضافة!' : 'Ready to Add!'}</h5>
                              <p className="text-violet-100 text-sm leading-relaxed">
                                {isRTL ? 'بمجرد الحفظ، ستكون هذه المادة متاحة لتعيينها في الجداول الدراسية والأعوام الأكاديمية.' : 'Once saved, this subject will be available for assignment in timetables and academic years.'}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-12 flex justify-between items-center">
                          <div className="flex gap-3">
                            {subjectCreationStep > 1 && (
                              <Button variant="secondary" onClick={() => setSubjectCreationStep(prev => prev - 1)} className="px-8 h-12 rounded-2xl border-gray-100">
                                <ArrowLeft size={18} className={isRTL ? 'ml-2' : 'mr-2'} /> {isRTL ? 'السابق' : 'Previous'}
                              </Button>
                            )}
                            <Button variant="secondary" onClick={() => setCourseViewMode('BROWSE')} className="px-8 h-12 rounded-2xl border-gray-100">
                              {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                          </div>
                          
                          {subjectCreationStep < 3 ? (
                            <Button onClick={() => setSubjectCreationStep(prev => prev + 1)} className="px-10 h-12 rounded-2xl shadow-lg shadow-violet-100 font-bold">
                              {isRTL ? 'المتابعة' : 'Continue'} <ArrowRight size={18} className={isRTL ? 'mr-2' : 'ml-2'} />
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => {
                                handleAddCourse();
                                setCourseViewMode('BROWSE');
                              }} 
                              className="px-12 h-12 rounded-2xl shadow-xl shadow-violet-200 font-black text-lg"
                            >
                              <Save size={20} className={isRTL ? 'ml-2' : 'mr-2'} /> {isRTL ? 'حفظ المادة' : 'Save Subject'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === SettingsTab.ACADEMIC_YEAR && (
            <div className="flex-1 flex flex-col">
              {/* Tab Header */}
              <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Layers className="text-violet-600" />
                    {academicYearViewMode === 'WIZARD' 
                      ? (isRTL ? `إعداد ${academicYear.name || 'عام جديد'}` : `Setup ${academicYear.name || 'New Year'}`)
                      : academicYearViewMode === 'DETAILS'
                      ? (isRTL ? `تفاصيل ${academicYear.name}` : `Details of ${academicYear.name}`)
                      : (isRTL ? 'إعدادات التقويم' : 'Calendar Setup')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {academicYearViewMode === 'WIZARD'
                      ? (isRTL ? `الخطوة ${creationStep} من 4` : `Step ${creationStep} of 4`)
                      : academicYearViewMode === 'DETAILS'
                      ? (isRTL ? 'نظرة شاملة على العام الدراسي' : 'Comprehensive overview of the academic year')
                      : (isRTL ? 'تصفح وإدارة الأعوام الدراسية' : 'Browse and manage academic years')}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  {academicYearViewMode === 'BROWSE' ? (
                    <Button onClick={handleCreateAcademicYear} className="gap-2 h-12 px-6 rounded-2xl shadow-lg shadow-violet-100 mt-auto">
                      <Plus size={20} /> {isRTL ? 'إنشاء عام جديد' : 'Create Academic Year'}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="secondary" 
                        onClick={() => setAcademicYearViewMode('BROWSE')}
                        className="gap-2 h-12 px-6 rounded-2xl mt-auto"
                      >
                        <ArrowLeft size={20} /> {isRTL ? 'رجوع للتصفح' : 'Back to Browse'}
                      </Button>
                      {academicYearViewMode === 'DETAILS' && (
                        <Button 
                          onClick={() => {
                            setAcademicYearViewMode('WIZARD');
                            setCreationStep(1);
                          }}
                          className="gap-2 h-12 px-6 rounded-2xl mt-auto"
                        >
                          <Pencil size={20} /> {isRTL ? 'تعديل العام' : 'Edit Year'}
                        </Button>
                      )}
                      <div className={`flex items-center gap-4 px-6 py-3 rounded-3xl border transition-all shadow-sm mt-auto ${isTeachingDaysLow ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                        <div className="text-center">
                          <p className="text-2xl font-black leading-none">{teachingDays}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{isRTL ? 'أيام التدريس' : 'Teaching Days'}</p>
                        </div>
                        {isTeachingDaysLow && <AlertCircle size={20} className="animate-pulse" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {academicYearViewMode === 'BROWSE' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                  {academicYears.map(year => (
                    <div 
                      key={year.id}
                      onClick={() => {
                        setSelectedYearId(year.id);
                        setAcademicYearViewMode('DETAILS');
                      }}
                      className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-violet-100 transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150 opacity-50" />
                      
                      <div className="absolute top-6 left-6 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {year.status !== 'Archived' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchiveYear(year.id); }}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-amber-600 hover:border-amber-200 flex items-center justify-center transition-colors shadow-sm"
                            title="أرشفة"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteYear(year.id); }}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors shadow-sm"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-start">
                          <div className="w-14 h-14 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                            <Calendar size={28} />
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            year.status === 'Active' ? 'bg-green-100 text-green-700' : 
                            year.status === 'Archived' ? 'bg-gray-100 text-gray-600' : 'bg-violet-100 text-violet-700'
                          }`}>
                            {isRTL ? (year.status === 'Active' ? 'نشط' : year.status === 'Archived' ? 'مؤرشف' : 'مسودة') : year.status}
                          </span>
                        </div>
                        
                        <div>
                          <h4 className="text-2xl font-black text-gray-900">{year.name || (isRTL ? 'عام بدون اسم' : 'Unnamed Year')}</h4>
                          <p className="text-sm text-gray-500 mt-1">{year.terms.length} {isRTL ? 'فصول دراسية' : 'Terms'}</p>
                        </div>

                        <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-violet-600 font-bold text-sm">
                            {isRTL ? 'عرض التفاصيل' : 'View Details'}
                            <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'أيام التدريس' : 'Teaching Days'}</p>
                            <p className="text-lg font-black text-gray-900">
                              {year.terms.reduce((acc, term) => {
                                const start = new Date(term.startDate);
                                const end = new Date(term.endDate);
                                if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
                                let count = 0;
                                let curr = new Date(start);
                                while (curr <= end) {
                                  const day = curr.toLocaleDateString('en-US', { weekday: 'long' });
                                  if (year.instructionalDays.includes(day)) count++;
                                  curr.setDate(curr.getDate() + 1);
                                }
                                return acc + count;
                              }, 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={handleCreateAcademicYear}
                    className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-all">
                      <Plus size={32} />
                    </div>
                    <span className="font-bold text-lg">{isRTL ? 'إضافة عام دراسي جديد' : 'Add New Academic Year'}</span>
                  </button>
                </div>
              ) : academicYearViewMode === 'DETAILS' ? (
                <div className="space-y-8 animate-fadeIn">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                              <Layers size={24} />
                            </div>
                            <div>
                              <h5 className="font-bold text-gray-900 text-lg">{academicYear.name}</h5>
                              <p className="text-sm text-gray-500">{academicYear.status}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                              const fullDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].find(d => d.startsWith(day));
                              const isActive = academicYear.instructionalDays.includes(fullDay!);
                              return (
                                <span key={day} className={`px-2 py-1 text-[10px] font-bold rounded-md border ${isActive ? 'bg-violet-50 border-violet-100 text-violet-600' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                                  {day}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-gray-50 rounded-2xl text-center">
                            <p className="text-2xl font-black text-violet-600">{academicYear.terms.length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الفصول' : 'Terms'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl text-center">
                            <p className="text-2xl font-black text-violet-600">{teachingDays}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'أيام التدريس' : 'Teaching Days'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl text-center">
                            <p className="text-2xl font-black text-violet-600">{academicYear.holidays.length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'العطلات' : 'Holidays'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl text-center">
                            <p className="text-2xl font-black text-violet-600">{academicYear.schoolEvents.length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الفعاليات' : 'Events'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <h5 className="font-bold text-gray-900">{isRTL ? 'توزيع الأيام الدراسية' : 'Teaching Days Distribution'}</h5>
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={academicYear.terms.map(t => {
                              const start = new Date(t.startDate);
                              const end = new Date(t.endDate);
                              let count = 0;
                              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                let curr = new Date(start);
                                while (curr <= end) {
                                  const day = curr.toLocaleDateString('en-US', { weekday: 'long' });
                                  if (academicYear.instructionalDays.includes(day)) count++;
                                  curr.setDate(curr.getDate() + 1);
                                }
                              }
                              return {
                                name: isRTL ? t.nameAr : t.nameEn,
                                days: count
                              };
                            })}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                              <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f9fafb' }}
                              />
                              <Bar dataKey="days" radius={[8, 8, 0, 0]} barSize={40}>
                                {academicYear.terms.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#4f46e5', '#818cf8', '#c7d2fe'][index % 3]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <h5 className="font-bold text-gray-900">{isRTL ? 'الجدول الزمني للفصول' : 'Term Timeline'}</h5>
                        <div className="space-y-4">
                          {academicYear.terms.map((term, i) => (
                            <div key={term.id} className="flex items-center gap-4">
                              <div className="w-2 h-12 bg-violet-200 rounded-full" />
                              <div className="flex-1">
                                <p className="font-bold text-gray-900">{isRTL ? term.nameAr : term.nameEn}</p>
                                <p className="text-xs text-gray-500">{term.startDate} - {term.endDate}</p>
                              </div>
                              <div className="text-right">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                                  term.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                                }`}>
                                  {term.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <h5 className="font-bold text-gray-900 flex items-center gap-2">
                          <Globe size={18} className="text-blue-500" />
                          {isRTL ? 'العطلات' : 'Holidays'}
                        </h5>
                        <div className="space-y-3">
                          {academicYear.holidays.map(h => (
                            <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                              <div>
                                <p className="text-xs font-bold text-gray-900">{isRTL ? h.nameAr : h.nameEn}</p>
                                <p className="text-[10px] text-gray-500">{h.date}</p>
                              </div>
                            </div>
                          ))}
                          {academicYear.holidays.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">{isRTL ? 'لا توجد عطلات' : 'No holidays'}</p>}
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <h5 className="font-bold text-gray-900 flex items-center gap-2">
                          <Zap size={18} className="text-violet-500" />
                          {isRTL ? 'الفعاليات' : 'Events'}
                        </h5>
                        <div className="space-y-3">
                          {academicYear.schoolEvents.map(e => (
                            <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                              <div>
                                <p className="text-xs font-bold text-gray-900">{isRTL ? e.nameAr : e.nameEn}</p>
                                <p className="text-[10px] text-gray-500">{e.date}</p>
                              </div>
                            </div>
                          ))}
                          {academicYear.schoolEvents.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">{isRTL ? 'لا توجد فعاليات' : 'No events'}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-12 flex items-center justify-center gap-4">
                    {[1, 2, 3, 4].map(step => (
                      <React.Fragment key={step}>
                        <div className={`flex items-center gap-2 ${creationStep >= step ? 'text-violet-600' : 'text-gray-300'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${
                            creationStep === step ? 'bg-violet-600 border-violet-600 text-white scale-110 shadow-md' : 
                            creationStep > step ? 'bg-violet-50 border-violet-600 text-violet-600' : 'bg-white border-gray-200'
                          }`}>
                            {creationStep > step ? <CheckCircle2 size={20} /> : step}
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest hidden md:block">
                            {step === 1 ? (isRTL ? 'الأساسي' : 'Core') : 
                             step === 2 ? (isRTL ? 'الفصول' : 'Terms') : 
                             step === 3 ? (isRTL ? 'العطلات' : 'Holidays') : 
                             (isRTL ? 'النتيجة' : 'Result')}
                          </span>
                        </div>
                        {step < 4 && <div className={`h-0.5 w-12 rounded-full transition-all ${creationStep > step ? 'bg-violet-600' : 'bg-gray-100'}`} />}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="space-y-16">
                    {creationStep === 1 && (
                      <section className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">1</div>
                          <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'إنشاء العام الدراسي' : 'Create Academic Year'}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">{isRTL ? 'اسم العام الدراسي' : 'Academic Year Name'}</label>
                            <input 
                              type="text" 
                              value={academicYear.name}
                              onChange={(e) => {
                                setAcademicYear({...academicYear, name: e.target.value});
                                updateAcademicYear(academicYear.id, { name: e.target.value });
                              }}
                              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                              placeholder="e.g. 2026/2027"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">{isRTL ? 'حالة النظام' : 'System Toggle'}</label>
                            <div className="flex p-1 bg-gray-100 rounded-xl">
                              <button 
                                onClick={() => setAcademicYear({...academicYear, status: 'Active'})}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${academicYear.status === 'Active' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}
                              >
                                {isRTL ? 'نشط' : 'Active'}
                              </button>
                              <button 
                                onClick={() => setAcademicYear({...academicYear, status: 'Archived'})}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${academicYear.status === 'Archived' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-500'}`}
                              >
                                {isRTL ? 'مؤرشف' : 'Archived'}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">{isRTL ? 'هيكل الأسبوع العالمي' : 'Global Week Structure'}</label>
                            <div className="flex flex-wrap gap-1">
                              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                <button
                                  key={day}
                                  onClick={() => {
                                    const newDays = academicYear.instructionalDays.includes(day)
                                      ? academicYear.instructionalDays.filter(d => d !== day)
                                      : [...academicYear.instructionalDays, day];
                                    setAcademicYear({...academicYear, instructionalDays: newDays});
                                  }}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                                    academicYear.instructionalDays.includes(day)
                                      ? 'bg-violet-500 border-violet-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-400'
                                  }`}
                                >
                                  {day.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                          <Button 
                            onClick={() => setCreationStep(2)} 
                            disabled={!academicYear.name}
                            className="px-8 h-12 rounded-2xl shadow-lg shadow-violet-100 gap-2"
                          >
                            {isRTL ? 'حفظ ومتابعة للفصول' : 'Save & Continue to Terms'} <ArrowRight size={18} />
                          </Button>
                        </div>
                      </section>
                    )}

                    {creationStep === 2 && (
                      <section className="space-y-6 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">2</div>
                            <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'تخطيط الفصول الدراسية' : 'Term and Semester Mapping'}</h4>
                          </div>
                          <Button variant="secondary" onClick={handleAddTerm} className="gap-2 h-10 px-4 rounded-xl border-gray-200">
                            <Plus size={16} /> {isRTL ? 'إضافة فصل' : 'Add Term/Semester'}
                          </Button>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-gray-900">{isRTL ? 'تقسيم الفصول' : 'Term Divisions'}</p>
                              <p className="text-xs text-gray-500">{isRTL ? 'اختر عدد الفصول الدراسية في العام' : 'Select the number of terms in the academic year'}</p>
                            </div>
                            <div className="flex p-1 bg-gray-100 rounded-xl">
                              {['Semesters', 'Trimesters', 'Quarters'].map(type => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    let count = 2;
                                    if (type === 'Trimesters') count = 3;
                                    if (type === 'Quarters') count = 4;
                                    
                                    const newTerms = Array.from({ length: count }).map((_, i) => ({
                                      id: `t-${type}-${i}-${Date.now()}`,
                                      nameEn: `${type.slice(0, -1)} ${i + 1}`,
                                      nameAr: `${isRTL ? 'الفصل' : 'Term'} ${i + 1}`,
                                      startDate: '',
                                      endDate: '',
                                      gracePeriodDays: 5,
                                      status: 'Draft'
                                    }));

                                    setAcademicYear({
                                      ...academicYear, 
                                      termDivision: type as any,
                                      terms: newTerms
                                    });
                                  }}
                                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${academicYear.termDivision === type ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'}`}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {academicYear.terms.map((term, idx) => (
                              <div key={term.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'اسم الفصل' : 'Term Name'}</label>
                                  <input 
                                    type="text" 
                                    value={isRTL ? term.nameAr : term.nameEn}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                    readOnly
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'تاريخ البدء' : 'Start Date'}</label>
                                  <input 
                                    type="date" 
                                    value={term.startDate}
                                    onChange={(e) => {
                                      const newTerms = [...academicYear.terms];
                                      newTerms[idx].startDate = e.target.value;
                                      setAcademicYear({...academicYear, terms: newTerms});
                                      updateTerm(term.id, term.nameAr, e.target.value, term.endDate);
                                    }}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</label>
                                  <input 
                                    type="date" 
                                    value={term.endDate}
                                    onChange={(e) => {
                                      const newTerms = [...academicYear.terms];
                                      newTerms[idx].endDate = e.target.value;
                                      setAcademicYear({...academicYear, terms: newTerms});
                                      updateTerm(term.id, term.nameAr, term.startDate, e.target.value);
                                    }}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                    <Shield size={10} /> {isRTL ? 'فترة السماح (أيام)' : 'Grace Period (Days)'}
                                  </label>
                                  <input 
                                    type="number" 
                                    value={term.gracePeriodDays}
                                    onChange={(e) => {
                                      const newTerms = [...academicYear.terms];
                                      newTerms[idx].gracePeriodDays = parseInt(e.target.value);
                                      setAcademicYear({...academicYear, terms: newTerms});
                                    }}
                                    className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-8 flex justify-between">
                          <Button variant="secondary" onClick={() => setCreationStep(1)} className="px-8 h-12 rounded-2xl gap-2">
                            <ArrowLeft size={18} /> {isRTL ? 'السابق' : 'Previous'}
                          </Button>
                          <Button 
                            onClick={() => setCreationStep(3)} 
                            disabled={academicYear.terms.length === 0}
                            className="px-8 h-12 rounded-2xl shadow-lg shadow-violet-100 gap-2"
                          >
                            {isRTL ? 'حفظ ومتابعة للعطلات' : 'Save & Continue to Holidays'} <ArrowRight size={18} />
                          </Button>
                        </div>
                      </section>
                    )}

                    {creationStep === 3 && (
                      <section className="space-y-6 animate-fadeIn">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">3</div>
                          <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'مدير العطلات' : 'Holiday Manager'}</h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                              <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                <Globe size={18} className="text-blue-500" />
                                {isRTL ? 'العطلات الوطنية' : 'National Holidays'}
                              </h5>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleSyncHolidays}
                                disabled={isSyncingHolidays}
                                className="h-8 text-[10px] gap-1"
                              >
                                <RefreshCw size={12} className={isSyncingHolidays ? 'animate-spin' : ''} />
                                {isRTL ? 'مزامنة عطلات مصر' : 'Sync Egypt Holidays'}
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                              {academicYear.holidays.filter(h => h.type === 'National').map(holiday => (
                                <div key={holiday.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                                      <Calendar size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-gray-900">{isRTL ? holiday.nameAr : holiday.nameEn}</p>
                                      <p className="text-[10px] text-gray-500">{holiday.date}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteHoliday(holiday.id)}
                                    className="text-gray-300 hover:text-red-500"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                              <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                <CalendarDays size={18} className="text-violet-500" />
                                {isRTL ? 'فعاليات المدرسة' : 'School-Specific Events'}
                              </h5>
                              <Button 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 text-[10px] gap-1"
                                onClick={handleAddEvent}
                              >
                                <Plus size={12} />
                                {isRTL ? 'إضافة فعالية' : 'Add Event'}
                              </Button>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                              {academicYear.schoolEvents.map(event => (
                                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-violet-600 shadow-sm">
                                      <Zap size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-gray-900">{isRTL ? event.nameAr : event.nameEn}</p>
                                      <p className="text-[10px] text-gray-500">{event.date} • {event.type}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteEvent(event.id)}
                                    className="text-gray-300 hover:text-red-500"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-between">
                          <Button variant="secondary" onClick={() => setCreationStep(2)} className="px-8 h-12 rounded-2xl gap-2">
                            <ArrowLeft size={18} /> {isRTL ? 'السابق' : 'Previous'}
                          </Button>
                          <Button 
                            onClick={() => setCreationStep(4)} 
                            className="px-8 h-12 rounded-2xl shadow-lg shadow-violet-100 gap-2"
                          >
                            {isRTL ? 'مراجعة النتيجة النهائية' : 'Review Final Result'} <ArrowRight size={18} />
                          </Button>
                        </div>
                      </section>
                    )}

                    {creationStep === 4 && (
                      <section className="space-y-8 animate-fadeIn">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">5</div>
                          <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'مراجعة النتيجة النهائية' : 'Final Result Review'}</h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                                  <Layers size={24} />
                                </div>
                                <div>
                                  <h5 className="font-bold text-gray-900 text-lg">{academicYear.name}</h5>
                                  <p className="text-sm text-gray-500">{academicYear.status}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                                  <p className="text-2xl font-black text-violet-600">{academicYear.terms.length}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الفصول' : 'Terms'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                                  <p className="text-2xl font-black text-violet-600">{teachingDays}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'أيام التدريس' : 'Teaching Days'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                                  <p className="text-2xl font-black text-violet-600">{academicYear.holidays.length}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'العطلات' : 'Holidays'}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl text-center">
                                  <p className="text-2xl font-black text-violet-600">{academicYear.assignedCourses.length}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'المواد' : 'Courses'}</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                              <h5 className="font-bold text-gray-900">{isRTL ? 'توزيع الأيام الدراسية' : 'Teaching Days Distribution'}</h5>
                              <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={academicYear.terms.map(t => {
                                    const start = new Date(t.startDate);
                                    const end = new Date(t.endDate);
                                    let count = 0;
                                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                      let curr = new Date(start);
                                      while (curr <= end) {
                                        const day = curr.toLocaleDateString('en-US', { weekday: 'long' });
                                        if (academicYear.instructionalDays.includes(day)) count++;
                                        curr.setDate(curr.getDate() + 1);
                                      }
                                    }
                                    return {
                                      name: isRTL ? t.nameAr : t.nameEn,
                                      days: count
                                    };
                                  })}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                                    <Tooltip 
                                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                      cursor={{ fill: '#f9fafb' }}
                                    />
                                    <Bar dataKey="days" radius={[8, 8, 0, 0]} barSize={40}>
                                      {academicYear.terms.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#4f46e5', '#818cf8', '#c7d2fe'][index % 3]} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                              <h5 className="font-bold text-gray-900">{isRTL ? 'الجدول الزمني للفصول' : 'Term Timeline'}</h5>
                              <div className="space-y-4">
                                {academicYear.terms.map((term, i) => (
                                  <div key={term.id} className="flex items-center gap-4">
                                    <div className="w-2 h-12 bg-violet-200 rounded-full" />
                                    <div className="flex-1">
                                      <p className="font-bold text-gray-900">{isRTL ? term.nameAr : term.nameEn}</p>
                                      <p className="text-xs text-gray-500">{term.startDate} - {term.endDate}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className="px-2 py-1 bg-violet-50 text-violet-600 rounded-md text-[10px] font-bold uppercase">
                                        {term.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-8">
                            <div className="bg-violet-600 p-8 rounded-[2.5rem] text-white space-y-6 shadow-xl shadow-violet-200">
                              <Sparkles size={32} />
                              <h5 className="text-xl font-black">{isRTL ? 'جاهز للانطلاق!' : 'Ready to Launch!'}</h5>
                              <p className="text-violet-100 text-sm leading-relaxed">
                                {isRTL ? 'تم تكوين العام الدراسي بنجاح. يمكنك الآن البدء في تسجيل الطلاب.' : 'The academic year has been successfully configured. You can now start registering students.'}
                              </p>
                              <Button 
                                onClick={async () => {
                                  let overallStart = '';
                                  let overallEnd = '';
                                  if (academicYear.terms.length > 0) {
                                    const starts = academicYear.terms.map(t => new Date(t.startDate).getTime()).filter(n => !isNaN(n));
                                    const ends = academicYear.terms.map(t => new Date(t.endDate).getTime()).filter(n => !isNaN(n));
                                    if (starts.length > 0 && ends.length > 0) {
                                      overallStart = new Date(Math.min(...starts)).toISOString().split('T')[0];
                                      overallEnd = new Date(Math.max(...ends)).toISOString().split('T')[0];
                                    }
                                  }
                                  await updateAcademicYear(academicYear.id, { name: academicYear.name, startDate: overallStart, endDate: overallEnd });
                                  const ok = await activateAcademicYear(academicYear.id);
                                  if (ok) {
                                    refreshAcademicYears();
                                    setAcademicYearViewMode('BROWSE');
                                    showToast('تم تفعيل العام الدراسي (وأي عام تاني كان نشط رجع مؤرشف تلقائيًا)، وهيبقى متاح في المنهج الدراسي.', 'success');
                                  } else {
                                    showToast('حصل خطأ أثناء التفعيل.', 'error');
                                  }
                                }}
                                className="w-full bg-white text-violet-600 hover:bg-violet-50 h-12 rounded-2xl font-bold"
                              >
                                {isRTL ? 'تفعيل العام الدراسي' : 'Activate Academic Year'}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex justify-start">
                          <Button variant="secondary" onClick={() => setCreationStep(3)} className="px-8 h-12 rounded-2xl gap-2">
                            <ArrowLeft size={18} /> {isRTL ? 'السابق' : 'Previous'}
                          </Button>
                        </div>
                      </section>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === SettingsTab.NOTIFICATIONS && (
            <div className="flex-1 flex flex-col">
              {/* Tab Header */}
              <div className="mb-12">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <Bell className="text-violet-600" />
                  {isRTL ? 'مركز التنبيهات' : 'Notification Center'}
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  {isRTL ? 'تحكم في من وكيف وماذا يتم إرساله من تنبيهات' : 'Control Who, How, and What is sent as notifications'}
                </p>
              </div>

              <div className="space-y-16">
              
              {/* C. Quiet Hours & Frequency Logic */}
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">C</div>
                  <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'ساعات الهدوء ومنطق التكرار' : 'Quiet Hours & Frequency Logic'}</h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Global DND */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Moon size={24} />
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 text-lg">{isRTL ? 'عدم الإزعاج العالمي' : 'Global Do-Not-Disturb'}</h5>
                          <p className="text-sm text-gray-500">{isRTL ? 'حظر جميع التنبيهات غير الطارئة في أوقات محددة' : 'Block all non-emergency alerts during specific hours'}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={notificationSettings.quietHours.enabled}
                          onChange={() => {
                            const newSettings = { ...notificationSettings };
                            newSettings.quietHours.enabled = !newSettings.quietHours.enabled;
                            setNotificationSettings(newSettings);
                          }}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                      </label>
                    </div>

                    <div className={`grid grid-cols-2 gap-4 transition-all ${notificationSettings.quietHours.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                          <Sun size={12} /> {isRTL ? 'من' : 'From'}
                        </label>
                        <input 
                          type="time" 
                          value={notificationSettings.quietHours.start}
                          onChange={(e) => {
                            const newSettings = { ...notificationSettings };
                            newSettings.quietHours.start = e.target.value;
                            setNotificationSettings(newSettings);
                          }}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                          <Moon size={12} /> {isRTL ? 'إلى' : 'To'}
                        </label>
                        <input 
                          type="time" 
                          value={notificationSettings.quietHours.end}
                          onChange={(e) => {
                            const newSettings = { ...notificationSettings };
                            newSettings.quietHours.end = e.target.value;
                            setNotificationSettings(newSettings);
                          }}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all">
                      <input 
                        type="checkbox" 
                        checked={notificationSettings.quietHours.allowEmergency}
                        onChange={() => {
                          const newSettings = { ...notificationSettings };
                          newSettings.quietHours.allowEmergency = !newSettings.quietHours.allowEmergency;
                          setNotificationSettings(newSettings);
                        }}
                        className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-bold text-indigo-900">{isRTL ? 'السماح بتنبيهات الطوارئ' : 'Allow Emergency Alerts'}</span>
                    </label>
                  </div>

                  {/* Batching Mode */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                          <Layers size={24} />
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-900 text-lg">{isRTL ? 'وضع التجميع (الملخص)' : 'Batching (Digest) Mode'}</h5>
                          <p className="text-sm text-gray-500">{isRTL ? 'إرسال ملخص واحد بدلاً من تنبيهات متعددة' : 'Send one summary instead of multiple alerts'}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={notificationSettings.batching.enabled}
                          onChange={() => {
                            const newSettings = { ...notificationSettings };
                            newSettings.batching.enabled = !newSettings.batching.enabled;
                            setNotificationSettings(newSettings);
                          }}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                      </label>
                    </div>

                    <div className={`grid grid-cols-2 gap-4 transition-all ${notificationSettings.batching.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'التكرار' : 'Frequency'}</label>
                        <select 
                          value={notificationSettings.batching.frequency}
                          onChange={(e) => {
                            const newSettings = { ...notificationSettings };
                            newSettings.batching.frequency = e.target.value as any;
                            setNotificationSettings(newSettings);
                          }}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="Daily">{isRTL ? 'يومي' : 'Daily'}</option>
                          <option value="Weekly">{isRTL ? 'أسبوعي' : 'Weekly'}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الوقت' : 'Time'}</label>
                        <input 
                          type="time" 
                          value={notificationSettings.batching.time}
                          onChange={(e) => {
                            const newSettings = { ...notificationSettings };
                            newSettings.batching.time = e.target.value;
                            setNotificationSettings(newSettings);
                          }}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <p className="text-xs text-emerald-800 italic">
                        {isRTL 
                          ? `سيتم إرسال ملخص أكاديمي يومي في تمام الساعة ${notificationSettings.batching.time} بدلاً من التنبيهات الفردية.`
                          : `A daily academic summary will be sent at ${notificationSettings.batching.time} instead of individual alerts.`}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* D. Notification Master List */}
              <section className="space-y-6 pb-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center font-bold">D</div>
                    <h4 className="text-xl font-bold text-gray-900">{isRTL ? 'قائمة التنبيهات الرئيسية' : 'Notification Master List'}</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        {isRTL ? 'نوع التنبيه' : 'Trigger Type'}
                      </label>
                      <div className="flex p-1 bg-gray-100 rounded-xl">
                        {['ALL', 'SYSTEM', 'CUSTOM'].map(type => (
                          <button
                            key={type}
                            onClick={() => setTriggerTypeFilter(type as any)}
                            className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              triggerTypeFilter === type ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {type === 'ALL' ? (isRTL ? 'الكل' : 'ALL') : 
                             type === 'SYSTEM' ? (isRTL ? 'نظام' : 'SYSTEM') : 
                             (isRTL ? 'مخصص' : 'CUSTOM')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        {isRTL ? 'الفئة' : 'Category'}
                      </label>
                      <div className="flex p-1 bg-gray-100 rounded-xl">
                        {['ALL', NotificationCategory.ACADEMIC, NotificationCategory.BEHAVIORAL, NotificationCategory.FINANCIAL, NotificationCategory.ADMINISTRATIVE].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setTriggerCategoryFilter(cat as any)}
                            className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              triggerCategoryFilter === cat ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {cat === 'ALL' ? (isRTL ? 'الكل' : 'ALL') : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                        {isRTL ? 'بحث سريع' : 'Quick Search'}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                          type="text"
                          placeholder={isRTL ? 'بحث في التنبيهات...' : 'Search triggers...'}
                          value={triggerSearchQuery}
                          onChange={(e) => setTriggerSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none w-full"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-transparent uppercase tracking-wider px-1">
                        .
                      </label>
                      <button
                        onClick={() => setIsAddTriggerModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-100"
                      >
                        <Plus size={16} />
                        {isRTL ? 'إضافة تنبيه مخصص' : 'Add Custom Trigger'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'النشاط والهدف الذكي' : 'Activity & AI Purpose'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'الفئة' : 'Category'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'القنوات' : 'Channels'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'المستلمون' : 'Recipients'}</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">{isRTL ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {notificationSettings.triggers
                          .filter(t => 
                            (triggerCategoryFilter === 'ALL' || t.category === triggerCategoryFilter) &&
                            (triggerTypeFilter === 'ALL' || (triggerTypeFilter === 'CUSTOM' ? t.id.startsWith('custom_') : !t.id.startsWith('custom_'))) &&
                            (t.nameEn.toLowerCase().includes(triggerSearchQuery.toLowerCase()) ||
                             t.nameAr.includes(triggerSearchQuery) ||
                             t.descriptionEn.toLowerCase().includes(triggerSearchQuery.toLowerCase()) ||
                             t.descriptionAr.includes(triggerSearchQuery) ||
                             t.aiPurposeEn?.toLowerCase().includes(triggerSearchQuery.toLowerCase()) ||
                             t.aiPurposeAr?.includes(triggerSearchQuery))
                          )
                          .map((trigger) => (
                          <tr key={trigger.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-sm">{isRTL ? trigger.nameAr : trigger.nameEn}</span>
                                  {trigger.id.startsWith('custom_') && (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[9px] font-bold border border-amber-100 uppercase tracking-tighter">
                                      {isRTL ? 'مخصص' : 'Custom'}
                                    </span>
                                  )}
                                  {trigger.aiPurposeEn && (
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[9px] font-bold border border-purple-100 uppercase tracking-tighter">
                                      AI: {isRTL ? trigger.aiPurposeAr : trigger.aiPurposeEn}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-1 group-hover:line-clamp-none transition-all">
                                  {isRTL ? trigger.descriptionAr : trigger.descriptionEn}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                trigger.category === NotificationCategory.ACADEMIC ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                trigger.category === NotificationCategory.BEHAVIORAL ? 'bg-violet-50 border-violet-100 text-violet-600' :
                                trigger.category === NotificationCategory.FINANCIAL ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                'bg-purple-50 border-purple-100 text-purple-600'
                              }`}>
                                {trigger.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1.5">
                                {[NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL].map(channel => (
                                  <button
                                    key={channel}
                                    onClick={() => {
                                      const newTriggers = [...notificationSettings.triggers];
                                      const idx = newTriggers.findIndex(t => t.id === trigger.id);
                                      const channels = newTriggers[idx].channels;
                                      if (channels.includes(channel)) {
                                        newTriggers[idx].channels = channels.filter(c => c !== channel);
                                      } else {
                                        newTriggers[idx].channels = [...channels, channel];
                                      }
                                      setNotificationSettings({ ...notificationSettings, triggers: newTriggers });
                                    }}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${
                                      trigger.channels.includes(channel)
                                        ? 'bg-violet-50 border-violet-200 text-violet-600'
                                        : 'bg-white border-gray-100 text-gray-300 hover:border-gray-200'
                                    }`}
                                    title={channel}
                                  >
                                    {channel === NotificationChannel.IN_APP && <MessageSquare size={12} />}
                                    {channel === NotificationChannel.PUSH && <Smartphone size={12} />}
                                    {channel === NotificationChannel.SMS && <Zap size={12} />}
                                    {channel === NotificationChannel.EMAIL && <Mail size={12} />}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1">
                                {[UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT].map(role => (
                                  <button
                                    key={role}
                                    onClick={() => {
                                      const newTriggers = [...notificationSettings.triggers];
                                      const idx = newTriggers.findIndex(t => t.id === trigger.id);
                                      const recipients = newTriggers[idx].recipients;
                                      if (recipients.includes(role)) {
                                        newTriggers[idx].recipients = recipients.filter(r => r !== role);
                                      } else {
                                        newTriggers[idx].recipients = [...recipients, role];
                                      }
                                      setNotificationSettings({ ...notificationSettings, triggers: newTriggers });
                                    }}
                                    className={`px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${
                                      trigger.recipients.includes(role)
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                        : 'bg-white border-gray-100 text-gray-300 hover:border-gray-200'
                                    }`}
                                  >
                                    {role === UserRole.PARENT ? (isRTL ? 'ولي' : 'PAR') : role.substring(0, 3)}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => handleEditTrigger(trigger)}
                                  className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-all"
                                  title={isRTL ? 'تعديل' : 'Edit'}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTrigger(trigger.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title={isRTL ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 size={16} />
                                </button>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={trigger.enabled}
                                    onChange={() => {
                                      const newTriggers = [...notificationSettings.triggers];
                                      const idx = newTriggers.findIndex(t => t.id === trigger.id);
                                      newTriggers[idx].enabled = !newTriggers[idx].enabled;
                                      setNotificationSettings({ ...notificationSettings, triggers: newTriggers });
                                    }}
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                                </label>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

          {activeTab === SettingsTab.SPACE_MANAGEMENT && (
            <div className="flex-1 flex flex-col space-y-8 animate-fadeIn">
              {/* Header */}
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                    {isRTL ? 'إدارة المساحات التعليمية' : 'Space Management'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {isRTL ? 'تكوين مساحات الفصول والتحكم في الحوكمة والاعتدال.' : 'Configure class spaces and control governance and moderation.'}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex items-center gap-2">
                    <RefreshCw size={18} /> {isRTL ? 'مزامنة الفصول' : 'Sync Classes'}
                  </Button>
                  <Button variant="primary" className="flex items-center gap-2">
                    <Plus size={18} /> {isRTL ? 'قالب جديد' : 'New Template'}
                  </Button>
                </div>
              </div>

              {/* Main Split View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Class List */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="relative">
                    <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400`} size={18} />
                    <input 
                      type="text" 
                      placeholder={isRTL ? 'ابحث عن فصل...' : 'Search classes...'}
                      className={`w-full bg-white border border-gray-100 rounded-2xl py-4 ${isRTL ? 'pr-12' : 'pl-12'} pr-4 text-sm outline-none focus:ring-2 focus:ring-violet-500 shadow-sm transition-all`}
                    />
                  </div>

                  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">All Class Sections</h4>
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full">{spaces.length} Total</span>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                      {spaces.map(space => (
                        <button 
                          key={space.id}
                          onClick={() => setSelectedSpaceId(space.id)}
                          className={`w-full p-6 text-left flex items-center gap-4 transition-all hover:bg-gray-50 ${selectedSpaceId === space.id ? 'bg-violet-50/50 border-r-4 border-violet-600' : ''}`}
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                            space.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {space.name.split(' ')[1]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{space.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${space.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">{space.status}</span>
                            </div>
                          </div>
                          {space.pendingFlags > 0 && (
                            <div className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                              {space.pendingFlags}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Health Dashboard Mini */}
                  <div className="bg-indigo-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <Activity size={20} className="text-indigo-300" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Space Health</h4>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-indigo-300">Avg. Engagement</span>
                            <span className="font-bold">74%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 w-[74%] rounded-full"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                            <p className="text-[10px] text-indigo-300 uppercase font-black mb-1">Mood</p>
                            <p className="text-lg font-black">{selectedSpace.mood}</p>
                          </div>
                          <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/10">
                            <p className="text-[10px] text-indigo-300 uppercase font-black mb-1">Flags</p>
                            <p className="text-lg font-black">{selectedSpace.pendingFlags}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Governance Panel */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                          <ShieldCheck size={28} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Space Governance</h3>
                          <p className="text-sm text-gray-500">Configuring <span className="font-bold text-indigo-600">{selectedSpace.name}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-600">Moderator: Teacher ID {selectedSpace.teacherId}</span>
                      </div>
                    </div>

                    <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                      {/* Provisioning & Structure */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Settings2 size={14} /> Provisioning & Structure
                        </h4>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, enableSocialWall: !s.settings.enableSocialWall } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.enableSocialWall ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Radio size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Enable Social Wall</p>
                                <p className="text-[10px] text-gray-400">Allows class-wide feed</p>
                              </div>
                            </div>
                            {selectedSpace.settings.enableSocialWall ? <ToggleRight size={32} className="text-violet-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, parentObserverAccess: !s.settings.parentObserverAccess } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.parentObserverAccess ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Eye size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Parent Observer Access</p>
                                <p className="text-[10px] text-gray-400">Parents can view feed</p>
                              </div>
                            </div>
                            {selectedSpace.settings.parentObserverAccess ? <ToggleRight size={32} className="text-indigo-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, classDrive: !s.settings.classDrive } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.classDrive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                <FolderOpen size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Class Drive</p>
                                <p className="text-[10px] text-gray-400">Shared resource library</p>
                              </div>
                            </div>
                            {selectedSpace.settings.classDrive ? <ToggleRight size={32} className="text-emerald-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>
                        </div>
                      </div>

                      {/* Moderation & Safety */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <ShieldAlert size={14} /> Moderation & Safety
                        </h4>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, aiContentFiltering: !s.settings.aiContentFiltering } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.aiContentFiltering ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Bot size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">AI Content Filtering</p>
                                <p className="text-[10px] text-gray-400">Auto-detect off-topic/bullying</p>
                              </div>
                            </div>
                            {selectedSpace.settings.aiContentFiltering ? <ToggleRight size={32} className="text-purple-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, postApprovalMode: !s.settings.postApprovalMode } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.postApprovalMode ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>
                                <CheckCircle2 size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Post Approval Mode</p>
                                <p className="text-[10px] text-gray-400">Teacher must approve posts</p>
                              </div>
                            </div>
                            {selectedSpace.settings.postApprovalMode ? <ToggleRight size={32} className="text-violet-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all cursor-pointer group" onClick={() => {
                            const newSpaces = spaces.map(s => s.id === selectedSpaceId ? { ...s, settings: { ...s.settings, lockWallAfterHours: !s.settings.lockWallAfterHours } } : s);
                            setSpaces(newSpaces);
                          }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedSpace.settings.lockWallAfterHours ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Lock size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">Lock Wall After Hours</p>
                                <p className="text-[10px] text-gray-400">Prevents late-night posting</p>
                              </div>
                            </div>
                            {selectedSpace.settings.lockWallAfterHours ? <ToggleRight size={32} className="text-red-600" /> : <ToggleLeft size={32} className="text-gray-300" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-10 border-t border-gray-50 bg-gray-50/20">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Live Preview (Student View)</h4>
                        <div className="flex gap-2">
                          <button className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 hover:text-violet-600 shadow-sm transition-all">
                            <Smartphone size={16} />
                          </button>
                          <button className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 hover:text-violet-600 shadow-sm transition-all">
                            <Monitor size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Mobile Mockup */}
                      <div className="max-w-[320px] mx-auto bg-gray-900 rounded-[3rem] p-3 shadow-2xl border-4 border-gray-800">
                        <div className="bg-white rounded-[2.5rem] h-[500px] overflow-hidden flex flex-col font-sans">
                          {/* Mock App Header */}
                          <div className="bg-violet-600 p-6 text-white">
                            <div className="flex justify-between items-center mb-4">
                              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Menu size={16} />
                              </div>
                              <div className="flex gap-2">
                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                  <Bell size={16} />
                                </div>
                                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                  <Search size={16} />
                                </div>
                              </div>
                            </div>
                            <h5 className="text-xl font-black">{selectedSpace.name}</h5>
                            <p className="text-[10px] text-violet-100 opacity-80">Teacher: Mr. Ahmed Vance</p>
                            
                            <div className="flex gap-4 mt-6 border-b border-white/10">
                              <button className="pb-2 text-xs font-bold border-b-2 border-white">Wall</button>
                              <button className="pb-2 text-xs font-bold opacity-60">Classwork</button>
                              <button className="pb-2 text-xs font-bold opacity-60">Members</button>
                            </div>
                          </div>

                          {/* Mock Feed */}
                          <div className="flex-1 bg-gray-50 p-4 space-y-4 overflow-y-auto">
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">AV</div>
                                <div>
                                  <p className="text-[10px] font-bold">Ahmed Vance</p>
                                  <p className="text-[8px] text-gray-400">2 hours ago • Announcement</p>
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-600 leading-relaxed">
                                Good morning class! Don't forget our field trip tomorrow. Please bring your signed permission slips.
                              </p>
                              <div className="mt-3 pt-3 border-t border-gray-50 flex gap-4">
                                <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                                  <MessageSquare size={10} /> 12 Replies
                                </div>
                                <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400">
                                  <Heart size={10} /> 24 Likes
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 border-l-4 border-violet-500">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-xs">HW</div>
                                <div>
                                  <p className="text-[10px] font-bold">Homework Assignment</p>
                                  <p className="text-[8px] text-gray-400">5 hours ago • Due: Friday</p>
                                </div>
                              </div>
                              <h6 className="text-xs font-bold mb-1">Chapter 4 Review Questions</h6>
                              <p className="text-[10px] text-gray-500 mb-3">Complete questions 1-15 on page 84.</p>
                              <button className="w-full py-2 bg-violet-600 text-white rounded-xl text-[10px] font-bold">Submit Assignment</button>
                            </div>
                          </div>

                          {/* Mock Input */}
                          {selectedSpace.settings.studentPosting && (
                            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 items-center">
                              <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                              <div className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-[10px] text-gray-400">
                                Share something with your class...
                              </div>
                              <div className="text-violet-600">
                                <Plus size={18} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === SettingsTab.GENERAL && (
            <div className="flex-1 flex flex-col">
              {/* Tab Header */}
              <div className="mb-12">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <Settings2 className="text-violet-600" />
                  {isRTL ? 'الإعدادات العامة' : 'General Settings'}
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  {isRTL ? 'تكوين الهوية المؤسسية وقواعد النظام الأساسية' : 'Configure institutional identity and core system rules'}
                </p>
              </div>

              <div className="space-y-8">
              
              {/* 1. Institutional Identity & Localization */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('identity')}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Building2 size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{isRTL ? 'الهوية المؤسسية والتعريب' : 'Institutional Identity & Localization'}</h4>
                      <p className="text-xs text-gray-500">{isRTL ? 'تعريف "الحمض النووي" للمدرسة وكيفية ظهورها للعالم' : "Defines the school's 'DNA' and how it appears to the world"}</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedSections.includes('identity') ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedSections.includes('identity') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-50 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <FileText size={16} className="text-blue-500" />
                            {isRTL ? 'ملف المنظمة' : 'Organization Profile'}
                          </h5>
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الاسم القانوني' : 'Legal Name'}</label>
                              <input type="text" defaultValue="TaliaLearn International School" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'الرقم الضريبي' : 'Tax ID'}</label>
                                <input type="text" defaultValue="TR-99281-X" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'رقم الترخيص' : 'License No.'}</label>
                                <input type="text" defaultValue="EDU-2024-001" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Palette size={16} className="text-pink-500" />
                            {isRTL ? 'جناح الهوية البصرية' : 'Visual Branding Suite'}
                          </h5>
                          <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-violet-500 hover:text-violet-500 transition-all cursor-pointer">
                              <Upload size={20} />
                              <span className="text-[10px] font-bold mt-1 uppercase">Logo</span>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">{isRTL ? 'اللون الأساسي' : 'Primary Color'}</span>
                                <div className="flex gap-2">
                                  <div className="w-6 h-6 rounded-full bg-violet-600 cursor-pointer border-2 border-white shadow-sm ring-2 ring-violet-100"></div>
                                  <div className="w-6 h-6 rounded-full bg-blue-600 cursor-pointer border-2 border-white shadow-sm"></div>
                                  <div className="w-6 h-6 rounded-full bg-emerald-600 cursor-pointer border-2 border-white shadow-sm"></div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">{isRTL ? 'وضع التصميم' : 'Design Mode'}</span>
                                <div className="flex p-1 bg-gray-100 rounded-lg">
                                  <button className="px-3 py-1 text-[10px] font-bold bg-white rounded-md shadow-sm">Light</button>
                                  <button className="px-3 py-1 text-[10px] font-bold text-gray-500">Dark</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Globe2 size={16} className="text-emerald-500" />
                            {isRTL ? 'التعريب الإقليمي' : 'Regional Localization'}
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</label>
                              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option>Cairo (GMT+2)</option>
                                <option>Riyadh (GMT+3)</option>
                                <option>Dubai (GMT+4)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'التقويم الافتراضي' : 'Default Calendar'}</label>
                              <div className="flex p-1 bg-gray-100 rounded-lg">
                                <button className="flex-1 py-1.5 text-[10px] font-bold bg-white rounded-md shadow-sm">Gregorian</button>
                                <button className="flex-1 py-1.5 text-[10px] font-bold text-gray-500">Hijri</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Coins size={16} className="text-amber-500" />
                            {isRTL ? 'العملة والمنطق المالي' : 'Currency & Finance Logic'}
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'العملة الأساسية' : 'Base Currency'}</label>
                              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option>EGP (Egyptian Pound)</option>
                                <option>SAR (Egyptian Riyal)</option>
                                <option>USD (US Dollar)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'قواعد التقريب' : 'Rounding Rules'}</label>
                              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option>Standard (2 decimals)</option>
                                <option>Floor</option>
                                <option>Ceiling</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Identity & Access Management (IAM) */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('iam')}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                      <Key size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{isRTL ? 'إدارة الهوية والوصول (IAM)' : 'Identity & Access Management (IAM)'}</h4>
                      <p className="text-xs text-gray-500">{isRTL ? 'بروتوكولات الأمان وبوابات دخول المستخدم' : 'Security protocols and user entry gateways'}</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedSections.includes('iam') ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedSections.includes('iam') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-50 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Fingerprint size={16} className="text-purple-500" />
                            {isRTL ? 'مزودو المصادقة' : 'Authentication Providers'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                  <Globe size={16} className="text-blue-500" />
                                </div>
                                <span className="text-xs font-bold">Google Workspace SSO</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer scale-75">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                              </label>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                  <Smartphone size={16} className="text-gray-700" />
                                </div>
                                <span className="text-xs font-bold">Microsoft Azure AD</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer scale-75">
                                <input type="checkbox" className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Lock size={16} className="text-red-500" />
                            {isRTL ? 'سياسات الأمان' : 'Security Policies'}
                          </h5>
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'تعقيد كلمة المرور' : 'Password Complexity'}</label>
                              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option>High (Min 12 chars, Symbols, Numbers)</option>
                                <option>Medium (Min 8 chars, Numbers)</option>
                                <option>Standard</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'دورة انتهاء الصلاحية' : 'Expiration Cycle'}</span>
                              <select className="p-1.5 bg-gray-100 border-none rounded-lg text-[10px] font-bold outline-none">
                                <option>90 Days</option>
                                <option>180 Days</option>
                                <option>Never</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-indigo-500" />
                            {isRTL ? 'المصادقة الثنائية (MFA)' : 'Multi-Factor Authentication (MFA)'}
                          </h5>
                          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" defaultChecked />
                              <span className="text-xs font-bold text-indigo-900">{isRTL ? 'فرض MFA للمسؤولين' : 'Enforce MFA for Admins'}</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" />
                              <span className="text-xs font-bold text-indigo-900">{isRTL ? 'فرض MFA لجميع الموظفين' : 'Enforce MFA for all Staff'}</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Smartphone size={16} className="text-gray-500" />
                            {isRTL ? 'إدارة الأجهزة' : 'Device Management'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'القائمة البيضاء لـ IP' : 'IP Whitelisting'}</span>
                              <label className="relative inline-flex items-center cursor-pointer scale-75">
                                <input type="checkbox" className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'تقييد الأجهزة المعترف بها' : 'Restrict to Recognized Devices'}</span>
                              <label className="relative inline-flex items-center cursor-pointer scale-75">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Core System Logic & Global Rules */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('core')}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                      <Settings2 size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{isRTL ? 'منطق النظام الأساسي والقواعد العالمية' : 'Core System Logic & Global Rules'}</h4>
                      <p className="text-xs text-gray-500">{isRTL ? '"المفاتيح الرئيسية" لكيفية سلوك قاعدة البيانات' : "The 'Master Switches' for how the database behaves"}</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedSections.includes('core') ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedSections.includes('core') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-50 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Hash size={16} className="text-violet-500" />
                            {isRTL ? 'تسلسلات التسمية والترقيم' : 'Naming & Numbering Sequences'}
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'بادئة معرف الطالب' : 'Student ID Prefix'}</label>
                              <input type="text" defaultValue="STU-" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'بادئة الفاتورة' : 'Invoice Prefix'}</label>
                              <input type="text" defaultValue="INV-" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <CalendarDays size={16} className="text-blue-500" />
                            {isRTL ? 'أسبوع العمل الأكاديمي' : 'Academic Work-Week'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-1">
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <button key={day} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${['Fri', 'Sat'].includes(day) ? 'bg-white border-gray-200 text-gray-400' : 'bg-violet-500 border-violet-600 text-white shadow-sm'}`}>
                                  {day}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'ساعات العمل' : 'Operating Hours'}</span>
                              <div className="flex items-center gap-2">
                                <input type="time" defaultValue="08:00" className="p-1.5 bg-gray-100 border-none rounded-lg text-[10px] font-bold outline-none" />
                                <span className="text-gray-400">-</span>
                                <input type="time" defaultValue="15:00" className="p-1.5 bg-gray-100 border-none rounded-lg text-[10px] font-bold outline-none" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <RefreshCw size={16} className="text-emerald-500" />
                            {isRTL ? 'محرك الترقية والاستبقاء' : 'Promotion & Retention Engine'}
                          </h5>
                          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-emerald-900">{isRTL ? 'الحد الأدنى للنجاح' : 'Min Passing Score'}</span>
                              <span className="text-xs font-bold text-emerald-700">50%</span>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 rounded text-emerald-600" defaultChecked />
                              <span className="text-xs font-bold text-emerald-900">{isRTL ? 'الترحيل التلقائي للعام القادم' : 'Auto Year-over-Year Rollover'}</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Layers size={16} className="text-indigo-500" />
                            {isRTL ? 'هيكل الفصل الدراسي' : 'Term & Semester Structure'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'فترة قفل الدرجات' : 'Grade Locking Period'}</span>
                              <select className="p-1.5 bg-gray-100 border-none rounded-lg text-[10px] font-bold outline-none">
                                <option>7 Days after Term</option>
                                <option>14 Days after Term</option>
                                <option>Immediate</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'عدد الفصول' : 'Number of Terms'}</span>
                              <span className="text-xs font-bold text-gray-900">2 Semesters</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 4. Infrastructure & Integration */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('infra')}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Radio size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{isRTL ? 'البنية التحتية والتكامل' : 'Infrastructure & Integration'}</h4>
                      <p className="text-xs text-gray-500">{isRTL ? '"السباكة الرقمية" التي تربط نظامك بالعالم' : "The 'Digital Plumbing' connecting your SIS to the world"}</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedSections.includes('infra') ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedSections.includes('infra') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-50 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Terminal size={16} className="text-gray-700" />
                            {isRTL ? 'بوابة API و Webhook' : 'API & Webhook Gateway'}
                          </h5>
                          <div className="space-y-3">
                            <div className="p-3 bg-gray-900 rounded-xl flex items-center justify-between">
                              <code className="text-[10px] text-emerald-400 font-mono">sk_live_51P...92kL</code>
                              <button className="text-gray-400 hover:text-white transition-colors"><RefreshCw size={12} /></button>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[9px] font-bold border border-blue-100 uppercase">WhatsApp API</span>
                              <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-md text-[9px] font-bold border border-purple-100 uppercase">Zoom SDK</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <MessageSquare size={16} className="text-blue-500" />
                            {isRTL ? 'قنوات الاتصال' : 'Communication Channels'}
                          </h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'مزود SMS' : 'SMS Provider'}</label>
                              <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                                <option>Twilio</option>
                                <option>MessageBird</option>
                                <option>Local Gateway</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'خادم SMTP' : 'SMTP Server'}</label>
                              <input type="text" defaultValue="smtp.alfarouk.edu" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <HardDrive size={16} className="text-amber-500" />
                            {isRTL ? 'إدارة التخزين و CDN' : 'Storage & CDN Management'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'حد حجم الملف' : 'File Size Limit'}</span>
                              <span className="text-xs font-bold text-gray-900">25 MB</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                            </div>
                            <p className="text-[10px] text-gray-500 text-right">650GB / 1TB Used</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Activity size={16} className="text-emerald-500" />
                            {isRTL ? 'تدقيق النظام والصحة' : 'System Audit & Health'}
                          </h5>
                          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                              <span className="text-xs font-bold text-emerald-900">{isRTL ? 'جميع الأنظمة تعمل' : 'All Systems Operational'}</span>
                            </div>
                            <button className="text-[10px] font-bold text-emerald-700 underline uppercase">{isRTL ? 'عرض السجلات' : 'View Logs'}</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 5. Governance, Risk & Compliance (GRC) */}
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('grc')}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{isRTL ? 'الحوكمة والمخاطر والامتثال (GRC)' : 'Governance, Risk & Compliance (GRC)'}</h4>
                      <p className="text-xs text-gray-500">{isRTL ? 'مصفوفة الأذونات الحبيبية وسجلات التدقيق' : 'Granular permission matrix and audit trails'}</p>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedSections.includes('grc') ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} className="text-gray-400" />
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedSections.includes('grc') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-50 mt-4">
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Users size={16} className="text-red-500" />
                            {isRTL ? 'مصفوفة الأذونات الحبيبية' : 'Granular Permission Matrix'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-medium text-gray-700">{isRTL ? 'تعديل الدرجات بعد القفل' : 'Edit grades after term lock'}</span>
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[9px] font-bold border border-red-100 uppercase">Super Admin Only</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="text-xs font-medium text-gray-700">{isRTL ? 'عرض السجلات الصحية' : 'View health records'}</span>
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-bold border border-blue-100 uppercase">Nurse & Admin</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Terminal size={16} className="text-gray-700" />
                            {isRTL ? 'سجلات تدقيق النظام' : 'System Audit Trails'}
                          </h5>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                            <p className="text-[10px] text-gray-500 italic">{isRTL ? 'سجل غير قابل للتعديل يظهر كل تغيير قام به المسؤولون.' : 'A non-editable log showing every change made by admins.'}</p>
                            <Button variant="secondary" size="sm" className="w-full text-[10px] font-bold uppercase tracking-wider">
                              <Download size={12} className="mr-2" /> {isRTL ? 'تصدير سجل التدقيق' : 'Export Audit Log'}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Database size={16} className="text-indigo-500" />
                            {isRTL ? 'الاحتفاظ بالبيانات والأرشفة' : 'Data Retention & Archiving'}
                          </h5>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'سنوات الاحتفاظ' : 'Retention Years'}</label>
                            <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500">
                              <option>10 Years (Active)</option>
                              <option>25 Years (Archived)</option>
                              <option>Permanent</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Scale size={16} className="text-gray-500" />
                            {isRTL ? 'بروتوكولات الأمان والامتثال' : 'Security & Compliance Protocols'}
                          </h5>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'مهلة الجلسة' : 'Session Timeout'}</span>
                              <select className="p-1.5 bg-gray-100 border-none rounded-lg text-[10px] font-bold outline-none">
                                <option>30 Minutes</option>
                                <option>60 Minutes</option>
                                <option>4 Hours</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">{isRTL ? 'قفل "فشل تسجيل الدخول"' : '"Failed Login" Lockout'}</span>
                              <span className="text-xs font-bold text-gray-900">5 Attempts</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Add Trigger Modal */}
        {isAddTriggerModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                    <Bell size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {editingTriggerId 
                        ? (isRTL ? 'تعديل التنبيه' : 'Edit Trigger')
                        : (isRTL ? 'إضافة تنبيه مخصص' : 'Add Custom Trigger')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingTriggerId
                        ? (isRTL ? 'تحديث تفاصيل التنبيه الحالي.' : 'Update details for the existing notification.')
                        : (isRTL ? 'إنشاء تنبيه جديد بناءً على شروط محددة.' : 'Create a new notification based on specific conditions.')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsAddTriggerModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الاسم (EN)' : 'Name (EN)'}</label>
                    <input 
                      type="text" 
                      value={newTrigger.nameEn}
                      onChange={(e) => setNewTrigger({ ...newTrigger, nameEn: e.target.value })}
                      placeholder="e.g., Low Balance Alert"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الاسم (AR)' : 'Name (AR)'}</label>
                    <input 
                      type="text" 
                      value={newTrigger.nameAr}
                      onChange={(e) => setNewTrigger({ ...newTrigger, nameAr: e.target.value })}
                      placeholder="مثلاً: تنبيه الرصيد المنخفض"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الوصف (EN)' : 'Description (EN)'}</label>
                    <textarea 
                      value={newTrigger.descriptionEn}
                      onChange={(e) => setNewTrigger({ ...newTrigger, descriptionEn: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 h-20 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الوصف (AR)' : 'Description (AR)'}</label>
                    <textarea 
                      value={newTrigger.descriptionAr}
                      onChange={(e) => setNewTrigger({ ...newTrigger, descriptionAr: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 h-20 resize-none text-right"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'الفئة' : 'Category'}</label>
                    <select 
                      value={newTrigger.category}
                      onChange={(e) => setNewTrigger({ ...newTrigger, category: e.target.value as NotificationCategory })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {Object.values(NotificationCategory).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'هدف الذكاء الاصطناعي (EN)' : 'AI Purpose (EN)'}</label>
                    <input 
                      type="text" 
                      value={newTrigger.aiPurposeEn}
                      onChange={(e) => setNewTrigger({ ...newTrigger, aiPurposeEn: e.target.value })}
                      placeholder="e.g., Financial Health"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'القنوات الافتراضية' : 'Default Channels'}</label>
                    <div className="flex flex-wrap gap-2">
                      {[NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL].map(channel => (
                        <button
                          key={channel}
                          onClick={() => {
                            const channels = newTrigger.channels || [];
                            if (channels.includes(channel)) {
                              setNewTrigger({ ...newTrigger, channels: channels.filter(c => c !== channel) });
                            } else {
                              setNewTrigger({ ...newTrigger, channels: [...channels, channel] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            newTrigger.channels?.includes(channel)
                              ? 'bg-violet-50 border-violet-200 text-violet-600'
                              : 'bg-white border-gray-100 text-gray-400'
                          }`}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase">{isRTL ? 'المستلمون الافتراضيون' : 'Default Recipients'}</label>
                    <div className="flex flex-wrap gap-2">
                      {[UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT].map(role => (
                        <button
                          key={role}
                          onClick={() => {
                            const recipients = newTrigger.recipients || [];
                            if (recipients.includes(role)) {
                              setNewTrigger({ ...newTrigger, recipients: recipients.filter(r => r !== role) });
                            } else {
                              setNewTrigger({ ...newTrigger, recipients: [...recipients, role] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            newTrigger.recipients?.includes(role)
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                              : 'bg-white border-gray-100 text-gray-400'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddTriggerModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={handleAddTrigger}
                  className="px-8 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-200"
                >
                  {editingTriggerId 
                    ? (isRTL ? 'حفظ التغييرات' : 'Save Changes')
                    : (isRTL ? 'إنشاء التنبيه' : 'Create Trigger')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {isBulkImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{isRTL ? 'استيراد المواد' : 'Bulk Import Subjects'}</h3>
                    <p className="text-sm text-gray-500">{isRTL ? 'ارفع ملف CSV لإضافة عدة مواد دفعة واحدة.' : 'Upload a CSV file to create multiple subjects at once.'}</p>
                  </div>
                </div>
                <button onClick={() => setIsBulkImportModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center">
                    <Info size={20} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-blue-900 text-sm">{isRTL ? 'التعليمات' : 'Instructions'}</h4>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc ml-4">
                      <li>{isRTL ? 'يجب أن يحتوي الملف على الأعمدة التالية بالترتيب:' : 'File must contain the following columns in order:'}</li>
                      <li><strong>Code, NameEn, NameAr, Credits, Department, GradeLevel</strong></li>
                      <li>{isRTL ? 'مثال:' : 'Example:'} <code>MATH101, Mathematics, الرياضيات, 4, Science, Grade 10</code></li>
                    </ul>
                  </div>
                </div>

                <div className="border-2 border-dashed rounded-[2rem] p-12 text-center transition-all border-gray-200 bg-gray-50/30 hover:border-violet-300 hover:bg-gray-50">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6 text-violet-600">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'ارفع ملف CSV' : 'Upload your CSV file'}</h4>
                  <p className="text-sm text-gray-500 mb-8">{isRTL ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag and drop your file here, or click to browse'}</p>
                  <input type="file" className="hidden" id="subject-csv-upload" accept=".csv" onChange={handleBulkUpload} />
                  <label htmlFor="subject-csv-upload">
                    <Button className="px-8 cursor-pointer">{isRTL ? 'اختيار ملف' : 'Select File'}</Button>
                  </label>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setIsBulkImportModalOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

    </div>
  );
};
