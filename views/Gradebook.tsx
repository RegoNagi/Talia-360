import React, { useState } from 'react';
import { Language, UserRole, GradebookConfig, GradeEntry, AssessmentCategory, GradingTerm, GradingScaleRule, Assessment } from '../types';
import { MOCK_GRADEBOOK } from '../services/mockData';
import {
  getGradebookConfigs, createGradebookConfig, updateGradebookConfigStatus, updateGradebookConfig,
  getOrCreateDefaultTerm, getAssessments, createAssessment as createAssessmentSvc, deleteAssessment as deleteAssessmentSvc,
  getGradeEntries, saveGradeEntries, getStudents, getClassSections, getCurriculumSubjects, getGradeLevels,
  getEarlyWarningCriteria, updateEarlyWarningCriteria, EarlyWarningCriteria
} from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { 
  FileSpreadsheet, 
  Settings, 
  Plus, 
  Lock, 
  Unlock, 
  Save, 
  Calculator, 
  Users, 
  CalendarRange, 
  AlertCircle, 
  CheckCircle2,
  Check,
  FileText,
  PieChart as LucidePieChart,
  Trash2,
  PlusCircle,
  X as XIcon,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  School,
  BookOpen,
  Filter,
  ArrowUpDown,
  Search,
  ArrowLeft,
  PanelRightOpen,
  MessageSquare,
  Send,
  ShieldCheck,
  FolderPlus,
  FileWarning
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface GradebookProps {
  role: UserRole;
  language: Language;
  permissions?: string[];
}

// (الصفوف الدراسية بقت بتتجاب حقيقي من قاعدة البيانات، مش قايمة ثابتة هنا)

export const Gradebook: React.FC<GradebookProps> = ({ role, language, permissions = [] }) => {
  const canEnterGrades = permissions.length === 0 || permissions.includes('grades_enter');
  const canApproveGrades = permissions.length === 0 || permissions.includes('grades_approve');
  const canSupervise = permissions.length === 0 || permissions.includes('grades_supervise');
  const [config, setConfig] = useState<GradebookConfig>(MOCK_GRADEBOOK);
  const [activeTab, setActiveTab] = useState<'admin' | 'teacher' | 'approvals'>(role === UserRole.ADMIN ? 'admin' : 'teacher');
  const [adminStep, setAdminStep] = useState(1);
  const [activeTermId, setActiveTermId] = useState('t1');
  const [editedEntries, setEditedEntries] = useState<Record<string, number | null>>({});
  const [isAddingAssessment, setIsAddingAssessment] = useState(false);
  const [status, setStatus] = useState<'draft' | 'pending' | 'approved'>('draft');
  const [gradebooksData, setGradebooksData] = useState<{ id: string; name: string; grades: string; gradesList: string[]; students: string; year: string; status: 'draft' | 'pending' | 'approved' | 'archived' }[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [realStudents, setRealStudents] = useState<any[]>([]);
  const [realClassSections, setRealClassSections] = useState<any[]>([]);
  const [supervisionClassId, setSupervisionClassId] = useState<string | null>(null);
  const [classGradeFilter, setClassGradeFilter] = useState('All');
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [defaultTermId, setDefaultTermId] = useState<string>('');
  React.useEffect(() => {
    if (defaultTermId) setActiveTermId(defaultTermId);
  }, [defaultTermId]);
  const [isCreateConfigOpen, setIsCreateConfigOpen] = useState(false);
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
      criticalMinAverage: warningCriteria.criticalMinAverage,
      warningMinAverage: warningCriteria.warningMinAverage,
    });
    setIsSavingWarningCriteria(false);
    showToast(ok ? 'تم حفظ معايير التحذير المبكر.' : 'حصل خطأ أثناء الحفظ.', ok ? 'success' : 'error');
  };
  const [adminView, setAdminView] = useState<'landing' | 'wizard' | 'draftsList'>('landing');

  const handleCreateConfig = async (form: any): Promise<boolean> => {
    const id = await createGradebookConfig({
      subjectName: form.subjectName,
      grades: form.grades,
      passingScore: form.passingScore,
      categoryWeights: form.categoryWeights,
    });
    if (id) {
      refreshConfigs();
      showToast('تم إنشاء نظام الدرجات بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء الإنشاء. تأكد إنك شغّلت كود SQL بتاع الدرجات في Supabase.', 'error');
    }
    return !!id;
  };

  const refreshConfigs = () => {
    setConfigsLoading(true);
    getGradebookConfigs().then((configs) => {
      setGradebooksData(configs.map(c => ({
        id: c.id,
        name: c.subjectName,
        grades: c.grades.join('، '),
        gradesList: c.grades,
        students: '',
        year: c.academicYear || '',
        status: c.status as any,
        passingScore: c.passingScore,
        categoryWeights: c.categoryWeights,
      })));
      setConfigsLoading(false);
    });
  };

  React.useEffect(() => {
    refreshConfigs();
    getStudents().then(setRealStudents);
    getClassSections().then(setRealClassSections);
    getOrCreateDefaultTerm().then(t => setDefaultTermId(t.id));
  }, []);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedAtRiskطلاب, setSelectedAtRiskطلاب] = useState<string[]>([]);
  const [showMessagingDrawer, setShowMessagingDrawer] = useState(false);
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    category: 'الاختبارات القصيرة' as AssessmentCategory,
    maxScore: 100,
    startDate: new Date().toISOString().split('T')[0],
    date: new Date().toISOString().split('T')[0],
    isGraded: true,
    gradingType: 'Points' as 'Points' | 'Percentage'
  });

  // New Context State
  const [selectedCurriculum, setSelectedCurriculum] = useState('National');
  const [selectedGrade, setSelectedGrade] = useState('Grade 10');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2023-2024');

  // Class Selection State
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // بيجيب التقييمات والدرجات الحقيقية أول ما تختار إعداد درجات معيّن
  const refreshGradeData = () => {
    if (!selectedClassId) return;
    Promise.all([getAssessments(selectedClassId), getGradeEntries(selectedClassId)]).then(([assessments, entries]) => {
      setConfig(prev => ({ ...prev, assessments: assessments as any, entries: entries as any }));
    });
  };

  // بيحسب الدرجة النهائية الحقيقية لطالب في تقييمات معيّنة، بنفس منطق الأوزان المستخدم في نظام الدرجات
  const computeWeightedGrade = (assessments: any[], entries: any[], categoryWeights: Record<string, number>, studentId: string): number => {
    const catScores: Record<string, { total: number; max: number }> = {};
    assessments.forEach((a: any) => {
      const entry = entries.find((e: any) => e.studentId === studentId && e.assessmentId === a.id);
      const score = entry ? entry.score : null;
      const status = entry ? entry.status : 'Missing';
      if (score !== null && status !== 'Excused') {
        if (!catScores[a.category]) catScores[a.category] = { total: 0, max: 0 };
        catScores[a.category].total += status === 'Late' ? score * 0.9 : score;
        catScores[a.category].max += a.maxScore;
      } else if (status === 'Missing') {
        if (!catScores[a.category]) catScores[a.category] = { total: 0, max: 0 };
        catScores[a.category].max += a.maxScore;
      }
    });
    let totalWeighted = 0, totalWeightUsed = 0;
    Object.keys(catScores).forEach(cat => {
      const weight = categoryWeights[cat] || 0;
      const data = catScores[cat];
      if (data.max > 0) {
        totalWeighted += (data.total / data.max) * 100 * (weight / 100);
        totalWeightUsed += weight;
      }
    });
    return totalWeightUsed === 0 ? 0 : Math.round(totalWeighted / totalWeightUsed);
  };

  // كل المواد الحقيقية من المنهج الدراسي لصف الفصل اللي بنراقبه، ودرجات الطلاب الحقيقية فيها (لو فيه نظام درجات معتمد للمادة دي)
  const [curriculumSubjects, setCurriculumSubjects] = useState<string[]>([]);
  const [allSubjectsGrades, setAllSubjectsGrades] = useState<Record<string, Record<string, number>>>({});

  React.useEffect(() => {
    if (!supervisionClassId) { setCurriculumSubjects([]); setAllSubjectsGrades({}); return; }
    const cls = realClassSections.find((c: any) => c.id === supervisionClassId);
    if (!cls) return;
    getCurriculumSubjects(cls.gradeLevel).then((subjects) => {
      setCurriculumSubjects(subjects);
      const classStudentIds: string[] = cls.students || [];
      // لكل مادة من مواد المنهج، بندوّر هل فيه نظام درجات معتمد ليها لنفس الصف
      const relevantConfigs = subjects.map((subj) =>
        (gradebooksData.find((g: any) => g.status === 'approved' && g.name === subj && g.gradesList?.includes(cls.gradeLevel)) as any) || null
      );
      Promise.all(
        relevantConfigs.map((cfg) => (cfg ? Promise.all([getAssessments(cfg.id), getGradeEntries(cfg.id)]) : Promise.resolve([[], []])))
      ).then((results) => {
        const gradesMap: Record<string, Record<string, number>> = {};
        subjects.forEach((subj, idx) => {
          const [assessments, entries] = results[idx] as [any[], any[]];
          const cfg = relevantConfigs[idx];
          const studentGrades: Record<string, number> = {};
          classStudentIds.forEach((sid) => {
            studentGrades[sid] = cfg ? computeWeightedGrade(assessments, entries, cfg.categoryWeights || {}, sid) : 0;
          });
          gradesMap[subj] = studentGrades;
        });
        setAllSubjectsGrades(gradesMap);
      });
    });
  }, [supervisionClassId, gradebooksData, realClassSections]);

  React.useEffect(() => {
    refreshGradeData();
    const realConfig = selectedClassId ? (gradebooksData.find(g => g.id === selectedClassId) as any) : null;
    if (selectedClassId && defaultTermId) {
      setConfig(prev => ({
        ...prev,
        terms: [{ id: defaultTermId, name: 'الفصل الدراسي الأول', startDate: '', endDate: '', status: 'Active' }],
        categoryWeights: (realConfig?.categoryWeights && Object.keys(realConfig.categoryWeights).length > 0) ? realConfig.categoryWeights : prev.categoryWeights,
        passingScore: realConfig?.passingScore ?? prev.passingScore,
      }));
      if (realConfig?.gradesList) {
        setSelectedTargetGrades(realConfig.gradesList);
      }
      setSubjectNameInput(realConfig?.name || '');
    } else if (!selectedClassId) {
      // مفيش نظام محدد يعني إحنا بصدد إنشاء واحد جديد — نبدأ بحقول فاضية
      setSubjectNameInput('');
      setSelectedTargetGrades([]);
      setConfig(prev => ({
        ...prev,
        categoryWeights: { 'الاختبارات القصيرة': 20, 'الواجبات': 20, 'المشاريع': 20, 'الاختبار النهائي': 40 },
        passingScore: 60,
      }));
    }
  }, [selectedClassId, defaultTermId]);

  const [selectedSubject, setSelectedSubject] = useState('الرياضيات');
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState(false);
  const [classFilters, setClassFilters] = useState({
    grade: 'All',
    search: ''
  });
  const [classSort, setClassSort] = useState<'name' | 'grade' | 'year'>('name');

  // Admin Customization States
  const [useDefaultTerms, setUseDefaultTerms] = useState(true);
  const [useDefaultPolicy, setUseDefaultPolicy] = useState(true);
  const [useDefaultWeights, setUseDefaultWeights] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [enableGPA, setEnableGPA] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('custom');
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isPassingMenuOpen, setIsPassingMenuOpen] = useState(false);
  const [openColorMenuIdx, setOpenColorMenuIdx] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedTargetGrades, setSelectedTargetGrades] = useState<string[]>([]);
  const [subjectNameInput, setSubjectNameInput] = useState('');
  const [isTargetGradesMenuOpen, setIsTargetGradesMenuOpen] = useState(false);

  const [k12Grades, setK12Grades] = useState<string[]>([]);
  React.useEffect(() => {
    getGradeLevels().then((grades) => setK12Grades(grades.map(g => g.name)));
  }, []);

  const isRTL = language === Language.AR;
  const currentTerm = config.terms.find(t => t.id === activeTermId);
  const termAssessments = config.assessments.filter(a => a.termId === activeTermId);

  // --- Helper Functions ---

  const getStudentScore = (studentId: string, assessmentId: string) => {
    // Check if being edited currently
    const editKey = `${studentId}::${assessmentId}`;
    if (editedEntries.hasOwnProperty(editKey)) {
      return editedEntries[editKey];
    }
    const entry = config.entries.find(e => e.studentId === studentId && e.assessmentId === assessmentId);
    return entry ? entry.score : null;
  };

  const getEntryStatus = (studentId: string, assessmentId: string) => {
    const entry = config.entries.find(e => e.studentId === studentId && e.assessmentId === assessmentId);
    return entry ? entry.status : 'Graded';
  };

  const calculateFinalGrade = (studentId: string, termId: string = activeTermId): number => {
    let totalWeightedScore = 0;
    let totalWeightUsed = 0;

    // Group by category
    const catScores: Record<string, { total: number, max: number }> = {};
    
    const assessmentsToUse = config.assessments.filter(a => a.termId === termId);

    assessmentsToUse.forEach(assessment => {
      if (assessment.isGraded === false) return; // Skip non-graded items

      let score = getStudentScore(studentId, assessment.id);
      const status = getEntryStatus(studentId, assessment.id);
      
      if (score !== null && status !== 'Excused') {
        if (status === 'Late') {
          score = score * 0.9; // Automatic 10% penalty
        }
        if (!catScores[assessment.category]) {
          catScores[assessment.category] = { total: 0, max: 0 };
        }
        catScores[assessment.category].total += score;
        catScores[assessment.category].max += assessment.maxScore;
      } else if (status === 'Missing') {
         if (!catScores[assessment.category]) {
          catScores[assessment.category] = { total: 0, max: 0 };
        }
        // Missing counts as 0
        catScores[assessment.category].total += 0;
        catScores[assessment.category].max += assessment.maxScore;
      }
    });

    Object.keys(catScores).forEach(cat => {
      const weight = config.categoryWeights[cat] || 0;
      const data = catScores[cat];
      if (data.max > 0) {
        const percentage = (data.total / data.max) * 100;
        totalWeightedScore += (percentage * (weight / 100));
        totalWeightUsed += weight;
      }
    });

    // Normalize if not all categories have assessments yet
    if (totalWeightUsed === 0) return 0;
    return Math.round((totalWeightedScore / totalWeightUsed) * 100);
  };

  const calculateYearFinal = (studentId: string): number => {
    let total = 0;
    let count = 0;
    config.terms.forEach(term => {
      const termGrade = calculateFinalGrade(studentId, term.id);
      if (termGrade > 0) {
        total += termGrade;
        count++;
      }
    });
    return count > 0 ? Math.round(total / count) : 0;
  };

  const handleScoreChange = (studentId: string, assessmentId: string, val: string) => {
    const num = val === '' ? null : Number(val);
    setEditedEntries(prev => ({
      ...prev,
      [`${studentId}::${assessmentId}`]: num
    }));
  };

  const [isSavingGrades, setIsSavingGrades] = useState(false);

  const handleSaveGrades = async () => {
    if (Object.keys(editedEntries).length === 0) return;
    setIsSavingGrades(true);
    const records = Object.keys(editedEntries).map(key => {
      const [sid, aid] = key.split('::');
      return { studentId: sid, assessmentId: aid, score: editedEntries[key], status: 'Graded' };
    });
    const ok = await saveGradeEntries(records);
    setIsSavingGrades(false);
    if (ok) {
      refreshGradeData();
      setEditedEntries({});
      showToast('تم حفظ الدرجات بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء حفظ الدرجات. تأكد إنك شغّلت كود SQL بتاع الدرجات في Supabase.', 'error');
    }
  };

  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);

  const handleCreateAssessment = async () => {
    if (!newAssessment.title || !selectedClassId) return;
    setIsCreatingAssessment(true);
    const id = await createAssessmentSvc({
      configId: selectedClassId,
      termId: activeTermId,
      title: newAssessment.title,
      category: newAssessment.category,
      maxScore: newAssessment.gradingType === 'Percentage' ? 100 : newAssessment.maxScore,
      date: newAssessment.date,
    });
    setIsCreatingAssessment(false);

    if (id) {
      refreshGradeData();
      showToast('تم إضافة التقييم بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء إضافة التقييم. تأكد إنك شغّلت كود SQL بتاع الدرجات في Supabase.', 'error');
      return;
    }

    setIsAddingAssessment(false);
    setNewAssessment({
      title: '',
      category: 'الاختبارات القصيرة',
      maxScore: 100,
      startDate: new Date().toISOString().split('T')[0],
      date: new Date().toISOString().split('T')[0],
      isGraded: true,
      gradingType: 'Points'
    });
  };

  const filteredSchemas = gradebooksData.filter(schema => {
    const matchesGrade = classFilters.grade === 'All' || schema.grades.includes(classFilters.grade);
    const matchesSearch = schema.name.toLowerCase().includes(classFilters.search.toLowerCase());
    return matchesGrade && matchesSearch;
  }).sort((a, b) => {
    if (classSort === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  // --- Components ---

  const ClassAndSubjectSelector = () => {
    if (!supervisionClassId) {
      const filteredClasses = realClassSections.filter(c =>
        (classGradeFilter === 'All' || c.gradeLevel === classGradeFilter) &&
        c.name.toLowerCase().includes(classSearchQuery.toLowerCase())
      );
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div className="relative flex-1 w-full">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث عن فصول..."
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="relative w-full md:w-auto">
                <select
                  value={classGradeFilter}
                  onChange={(e) => setClassGradeFilter(e.target.value)}
                  className="appearance-none w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium text-gray-800 transition-all cursor-pointer hover:bg-gray-100/50 text-sm"
                >
                  <option value="All">جميع الصفوف</option>
                  {k12Grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map(cls => (
              <div
                key={cls.id}
                onClick={() => setSupervisionClassId(cls.id)}
                className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-none hover:border-gray-300 transition-all cursor-pointer relative overflow-hidden flex flex-col"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-violet-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600 group-hover:bg-violet-100 transition-colors mb-4">
                  <School size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{cls.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{cls.gradeLevel}</p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Users size={14} /> {(cls.students || []).length} طالب
                  </div>
                  <ArrowRight size={18} className="text-violet-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
              </div>
            ))}
            {filteredClasses.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter size={32} className="text-gray-300" />
                </div>
                <p className="text-gray-500">لم يتم العثور على فصول تطابق عوامل التصفية الخاصة بك.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // فصل متاختار، دلوقتي نختار المادة (نظام الدرجات) اللي عايزين نراقبه
    const cls = realClassSections.find(c => c.id === supervisionClassId);
    const applicableConfigs = gradebooksData.filter(g => (g as any).gradesList?.includes(cls?.gradeLevel));
    return (
      <div className="space-y-6 animate-fadeIn">
        <button onClick={() => setSupervisionClassId(null)} className="flex items-center gap-2 text-sm font-bold text-violet-600 hover:underline">
          <ArrowRight size={16} className="rotate-180" /> رجوع لاختيار الفصل
        </button>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{cls?.name}</h2>
          <p className="text-sm text-gray-500 mb-6">اختار المادة اللي عايز تراقب رصد درجاتها</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applicableConfigs.map(config => (
              <div
                key={config.id}
                onClick={() => setSelectedClassId(config.id)}
                className="group bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-violet-300 hover:bg-white transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <BookOpen size={20} className="text-violet-600" />
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${config.status === 'draft' ? 'bg-gray-100 text-gray-600 border-gray-200' : config.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {config.status === 'draft' ? 'مسودة' : config.status === 'pending' ? 'طلب اعتماد' : 'معتمد'}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800">{config.name}</h3>
              </div>
            ))}
            {applicableConfigs.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-10">مفيش نظام درجات معمول للصف ده لسه.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ApprovalsView = () => {
    const pendingSchemas = gradebooksData.filter(g => g.status === 'pending');
    if (pendingSchemas.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100 shadow-none min-h-[400px]">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد سجلات بانتظار الاعتماد</h3>
          <p className="text-gray-500 text-sm">تم انجاز جميع المهام حتى الآن.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
        {pendingSchemas.map(schema => (
          <div key={schema.id} className="bg-white rounded-3xl border border-gray-100 flex flex-col overflow-hidden shadow-none">
            <div className="p-6 pb-4">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <BookOpen size={24} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">طلب اعتماد</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">{schema.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{schema.grades}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Users size={14} /> {schema.students} • {schema.year}
              </div>
            </div>
            <div className="mt-auto p-4 border-t border-gray-100 bg-gray-50/50 flex">
              <Button 
                className="bg-purple-50 text-purple-700 w-full py-3 text-sm font-bold hover:bg-purple-100 transition-colors shadow-none rounded-xl"
                onClick={() => {
                  setSelectedClassId(schema.id);
                  setActiveTab('admin');
                  setAdminStep(1);
                  setAdminView('wizard');
                }}
              >
                فتح للمراجعة
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const AdminLandingView = () => {
    const draftConfigs = gradebooksData.filter((g: any) => g.status === 'draft');
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 animate-fadeIn">
        <div className={`grid gap-6 w-full max-w-3xl ${draftConfigs.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-md'}`}>
          {draftConfigs.length > 0 && (
            <button
              onClick={() => setAdminView('draftsList')}
              className="bg-white border border-amber-200 hover:border-amber-400 rounded-3xl p-8 text-center transition-colors shadow-sm flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <FileWarning size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">قوالب مرفوضة للتعديل</h3>
                <p className="text-sm text-gray-500 mt-1">{draftConfigs.length} قالب محتاج مراجعة</p>
              </div>
            </button>
          )}
          <button
            onClick={() => { setSelectedClassId(null); setAdminStep(1); setAdminView('wizard'); }}
            className="bg-white border border-violet-200 hover:border-violet-400 rounded-3xl p-8 text-center transition-colors shadow-sm flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600">
              <Plus size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">إنشاء نظام درجات جديد</h3>
              <p className="text-sm text-gray-500 mt-1">ابدأ إعداد نظام درجات من الصفر</p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const AdminDraftsListView = () => {
    const draftConfigs = gradebooksData.filter((g: any) => g.status === 'draft');
    return (
      <div className="space-y-6 animate-fadeIn">
        <button onClick={() => setAdminView('landing')} className="flex items-center gap-2 text-sm font-bold text-violet-600 hover:underline">
          <ArrowRight size={16} className="rotate-180" /> رجوع
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {draftConfigs.map((g: any) => (
            <button
              key={g.id}
              onClick={() => { setSelectedClassId(g.id); setAdminStep(1); setAdminView('wizard'); }}
              className="text-right bg-white border border-amber-200 hover:border-amber-400 rounded-2xl p-5 transition-colors shadow-sm"
            >
              <p className="font-bold text-gray-900">{g.name}</p>
              <p className="text-sm text-gray-500 mt-1">{g.grades}</p>
            </button>
          ))}
          {draftConfigs.length === 0 && (
            <p className="col-span-full text-center text-gray-400 py-10">مفيش قوالب مسودة دلوقتي.</p>
          )}
        </div>
      </div>
    );
  };

  const AdminJourney = () => {
    const isPendingSchema = selectedClassId ? gradebooksData.find(g => g.id === selectedClassId)?.status === 'pending' : false;

    const steps = [
      { id: 1, label: 'سياسة التقييم', icon: <Settings size={18} /> },
      { id: 2, label: 'الأوزان', icon: <LucidePieChart size={18} /> },
      { id: 3, label: 'نشر', icon: <CheckCircle2 size={18} /> },
    ];

    const templates = [
      { id: 'custom', name: 'مخصص (بدون قالب)' },
      { id: 'american', name: 'الدبلومة الأمريكية' },
      { id: 'british', name: 'المنهج البريطاني (IGCSE)' },
      { id: 'national', name: 'المنهج الوطني' }
    ];

    const handleTemplateSelect = (templateId: string) => {
      setActiveTemplate(templateId);
      setIsTemplateMenuOpen(false);
      if (templateId === 'american') {
        setEnableGPA(true);
        setConfig({
          ...config,
          gradingScale: [
            { grade: 'A+', min: 97, max: 100, color: 'text-green-600', gpaValue: 4.0 },
            { grade: 'A', min: 93, max: 96, color: 'text-green-600', gpaValue: 4.0 },
            { grade: 'A-', min: 90, max: 92, color: 'text-green-600', gpaValue: 3.7 },
            { grade: 'B+', min: 87, max: 89, color: 'text-blue-600', gpaValue: 3.3 },
            { grade: 'B', min: 83, max: 86, color: 'text-blue-600', gpaValue: 3.0 },
            { grade: 'B-', min: 80, max: 82, color: 'text-blue-600', gpaValue: 2.7 },
            { grade: 'C+', min: 77, max: 79, color: 'text-yellow-600', gpaValue: 2.3 },
            { grade: 'C', min: 73, max: 76, color: 'text-yellow-600', gpaValue: 2.0 },
            { grade: 'C-', min: 70, max: 72, color: 'text-yellow-600', gpaValue: 1.7 },
            { grade: 'D', min: 65, max: 69, color: 'text-violet-600', gpaValue: 1.0 },
            { grade: 'F', min: 0, max: 64, color: 'text-pink-600', gpaValue: 0.0 },
          ]
        });
      } else if (templateId === 'british') {
        setEnableGPA(false);
        setConfig({
          ...config,
          gradingScale: [
            { grade: 'A*', min: 90, max: 100, color: 'text-green-600' },
            { grade: 'A', min: 80, max: 89, color: 'text-green-600' },
            { grade: 'B', min: 70, max: 79, color: 'text-blue-600' },
            { grade: 'C', min: 60, max: 69, color: 'text-yellow-600' },
            { grade: 'D', min: 50, max: 59, color: 'text-violet-600' },
            { grade: 'E', min: 40, max: 49, color: 'text-violet-600' },
            { grade: 'U', min: 0, max: 39, color: 'text-pink-600' },
          ]
        });
      } else if (templateId === 'national') {
        setEnableGPA(false);
        setConfig({
          ...config,
          gradingScale: [
            { grade: 'ممتاز', min: 85, max: 100, color: 'text-green-600' },
            { grade: 'جيد جداً', min: 75, max: 84, color: 'text-blue-600' },
            { grade: 'جيد', min: 65, max: 74, color: 'text-yellow-600' },
            { grade: 'مقبول', min: 50, max: 64, color: 'text-violet-600' },
            { grade: 'راسب', min: 0, max: 49, color: 'text-pink-600' },
          ]
        });
      }
    };

    // -- Custom Step Handlers --
    const handleAddTerm = () => {
      const newId = `t${config.terms.length + 1}`;
      const newTerm: GradingTerm = { 
        id: newId, 
        name: `الفصل ${config.terms.length + 1}`, 
        startDate: '', 
        endDate: '', 
        status: 'Active' 
      };
      setConfig({...config, terms: [...config.terms, newTerm]});
    };

    const handleUpdateTerm = (id: string, field: keyof GradingTerm, value: string) => {
      const updated = config.terms.map(t => t.id === id ? { ...t, [field]: value } : t);
      setConfig({...config, terms: updated});
    };

    const handleRemoveTerm = (id: string) => {
      setConfig({...config, terms: config.terms.filter(t => t.id !== id)});
    };

    const handleAddCategory = () => {
      const name = newCategoryName.trim();
      if (!name || config.categoryWeights[name] !== undefined) return;
      setConfig({
        ...config,
        categoryWeights: { ...config.categoryWeights, [name]: 0 }
      });
      setNewCategoryName('');
    };

    const handleRemoveCategory = (name: string) => {
      const newالأوزان = { ...config.categoryWeights };
      delete newالأوزان[name];
      setConfig({ ...config, categoryWeights: newالأوزان });
    };

    const handleUpdateCategoryWeight = (name: string, weight: number) => {
      setConfig({
        ...config,
        categoryWeights: { ...config.categoryWeights, [name]: weight }
      });
    };

    const handleRenameCategory = (oldName: string, newName: string) => {
      const trimmedNewName = newName.trim();
      if (!trimmedNewName || oldName === trimmedNewName || config.categoryWeights[trimmedNewName] !== undefined) return;
      
      const newالأوزان: Record<string, number> = {};
      Object.keys(config.categoryWeights).forEach(key => {
        if (key === oldName) {
          newالأوزان[trimmedNewName] = config.categoryWeights[oldName];
        } else {
          newالأوزان[key] = config.categoryWeights[key];
        }
      });

      // Update assessments category name if needed
      const updatedAssessments = config.assessments.map(a => a.category === oldName ? { ...a, category: trimmedNewName as AssessmentCategory } : a);
      
      setConfig({ ...config, categoryWeights: newالأوزان, assessments: updatedAssessments });
    };

    const toggleCategory = (name: string) => {
      setExpandedCategories(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const openAddAssessment = (categoryName: string) => {
      setNewAssessment({ ...newAssessment, category: categoryName as AssessmentCategory });
      setIsAddingAssessment(true);
    };
    
    // -- سياسة التقييم Handlers --
    const handleUpdateGradingRule = (index: number, field: keyof GradingScaleRule, value: string | number) => {
      setActiveTemplate('custom');
      const newScale = [...config.gradingScale];
      newScale[index] = { ...newScale[index], [field]: value };
      setConfig({ ...config, gradingScale: newScale });
    };

    const handleRemoveGradingRule = (index: number) => {
      setActiveTemplate('custom');
      const newScale = config.gradingScale.filter((_, i) => i !== index);
      setConfig({ ...config, gradingScale: newScale });
    };

    const handleAddGradingRule = () => {
      setActiveTemplate('custom');
      setConfig({
        ...config,
        gradingScale: [
          ...config.gradingScale,
          { grade: '?', min: 0, max: 0, color: 'text-gray-600' }
        ]
      });
    };

    const totalWeight = Object.values(config.categoryWeights).reduce((a: number, b: number) => a + b, 0);

    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)]">
        {/* Wizard Header */}
        <div className="bg-gray-50 border-b border-gray-100 p-6">
           <div className="flex justify-between items-center mb-4">
             <div>
               <button onClick={() => { setAdminView('landing'); setSelectedClassId(null); }} className="flex items-center gap-2 text-sm font-bold text-violet-600 hover:underline mb-2">
                 <ArrowRight size={16} className="rotate-180" /> رجوع
               </button>
               <h2 className="text-2xl font-bold text-gray-900">إعدادات سجل الدرجات</h2>
               <p className="text-sm text-gray-500">
                  تكوين قواعد التقييم ومسارات العمل لهذا المقرر.
               </p>
             </div>
             <div className="flex gap-2">
                {!isPendingSchema && (
                  <>
                     <Button variant="secondary" disabled={adminStep === 1} className="shadow-none" onClick={() => setAdminStep(s => s - 1)}>السابق</Button>
                     <Button
                       className="bg-purple-600 text-white shadow-none"
                       disabled={adminStep === 3 && (!subjectNameInput.trim() || selectedTargetGrades.length === 0)}
                       onClick={async () => {
                       if (adminStep === 3) {
                         if (!subjectNameInput.trim() || selectedTargetGrades.length === 0) return;
                         setStatus('pending');
                         if (selectedClassId) {
                           // نظام موجود بالفعل — نعدّله ونرسله لطلب اعتماد
                           await updateGradebookConfig({
                             configId: selectedClassId,
                             subjectName: subjectNameInput,
                             grades: selectedTargetGrades,
                             passingScore: config.passingScore,
                             categoryWeights: config.categoryWeights,
                           });
                           await updateGradebookConfigStatus(selectedClassId, 'pending');
                           refreshConfigs();
                           showToast(`تم إرسال نظام الدرجات "${subjectNameInput}" لطلب الاعتماد.`, 'success');
                         } else {
                           // مفيش نظام محدد — يبقى إحنا بصدد إنشاء واحد جديد بالكامل من نفس الشاشة
                           const newId = await createGradebookConfig({
                             subjectName: subjectNameInput,
                             grades: selectedTargetGrades,
                             passingScore: config.passingScore,
                             categoryWeights: config.categoryWeights,
                           });
                           if (newId) {
                             await updateGradebookConfigStatus(newId, 'pending');
                             refreshConfigs();
                             showToast(`تم إنشاء نظام الدرجات "${subjectNameInput}" وإرساله لطلب الاعتماد.`, 'success');
                           } else {
                             showToast('حصل خطأ أثناء إنشاء نظام الدرجات.', 'error');
                             return;
                           }
                         }
                         // مش بننقّل المستخدم لأي مكان تاني — الاعتماد النهائي بيحصل من تاب "الاعتمادات"
                         setSelectedClassId(null);
                         setAdminView('landing');
                         setAdminStep(1);
                       } else {
                         setAdminStep(s => Math.min(3, s + 1));
                       }
                     }}>
                        {adminStep === 3 ? 'إرسال للاعتماد' : 'الخطوة التالية'}
                     </Button>
                  </>
                )}
             </div>
           </div>

           {/* Step 1: Schema Setup */}
           <div className="flex items-center gap-4 relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-0"></div>
              {steps.map(step => (
                <div 
                  key={step.id} 
                  onClick={() => setAdminStep(step.id)}
                  className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all border-2 ${adminStep === step.id ? 'bg-violet-600 border-violet-600 text-white' : adminStep > step.id ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-400'}`}
                >
                  {adminStep > step.id ? <CheckCircle2 size={16} /> : step.icon}
                  <span className="text-sm font-bold whitespace-nowrap hidden lg:inline">{step.label}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Wizard Content */}
        <div className="flex-1 p-8 overflow-y-auto">

           {isPendingSchema && (
             <div className="flex justify-end gap-3 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
               {canApproveGrades && (
               <button 
                  className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-5 py-2 rounded-md font-medium shadow-none transition-colors"
                  onClick={() => {
                     if (selectedClassId) updateGradebookConfigStatus(selectedClassId, 'draft').then(() => refreshConfigs());
                     setGradebooksData(gradebooksData.map(g => g.id === selectedClassId ? { ...g, status: 'draft' } : g));
                     setActiveTab('admin');
                     setSelectedClassId(null);
                     setAdminView('landing');
                  }}
               >
                 إرجاع للتعديل
               </button>
               )}
               {canApproveGrades && (
               <button 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-md font-medium shadow-none transition-colors"
                  onClick={async () => {
                     if (!selectedClassId) return;
                     const thisConfig = gradebooksData.find(g => g.id === selectedClassId) as any;
                     const conflict = gradebooksData.find((g: any) =>
                       g.id !== selectedClassId &&
                       g.status === 'approved' &&
                       g.name === thisConfig?.name &&
                       (g.gradesList || []).some((gr: string) => (thisConfig?.gradesList || []).includes(gr))
                     ) as any;
                     if (conflict) {
                       const confirmed = await confirmDialog(
                         `فيه نظام درجات معتمد بالفعل لمادة "${thisConfig?.name}" لنفس الصف (اسمه "${conflict.name}"). لو كمّلت، النظام القديم هيرجع مسودة والنظام ده هيبقى هو المعتمد. تحب تكمّل؟`,
                         'استبدال واعتماد'
                       );
                       if (!confirmed) return;
                       await updateGradebookConfigStatus(conflict.id, 'draft');
                     }
                     await updateGradebookConfigStatus(selectedClassId, 'approved');
                     refreshConfigs();
                     setActiveTab('approvals');
                     setSelectedClassId(null);
                     setAdminView('landing');
                  }}
               >
                 اعتماد ونشر السجل
               </button>
               )}
             </div>
           )}

           {adminStep === 1 && (() => {
             const selectedTemplateName = templates.find(t => t.id === activeTemplate)?.name || 'مخصص (بدون قالب)';
             return (
             <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                   <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      إعداد مخطط التقييم
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-bold border ${activeTemplate !== 'custom' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        النظام: {selectedTemplateName}
                      </span>
                   </h3>
                </div>

                <div className="space-y-6">
                   {/* Section A: Configuration */}
                   <div className="p-6 border border-gray-200 rounded-3xl bg-white shadow-none space-y-6">
                      <div className="w-full">
                         <label className="text-sm font-bold text-gray-700 mb-2 block">اسم سجل الدرجات</label>
                         <input 
                           type="text" 
                           className="border border-gray-200 rounded-md p-3 w-full bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-0 outline-none shadow-none"
                           placeholder="مثال: سجل أعمال السنة - الفصل الدراسي الأول..." 
                           value={subjectNameInput}
                           onChange={(e) => setSubjectNameInput(e.target.value)}
                         />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 w-full">
                         <div className="relative w-full md:w-1/2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">البدء من قالب</label>
                            <div className="relative w-full">
                               <div 
                                 onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
                                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer flex justify-between items-center"
                               >
                                 <span className="font-medium text-gray-800">
                                   {selectedTemplateName}
                                 </span>
                                 <ChevronDown size={18} className="text-gray-400" />
                               </div>
                               
                               {isTemplateMenuOpen && (
                                 <>
                                   <div className="fixed inset-0 z-40" onClick={() => setIsTemplateMenuOpen(false)}></div>
                                   <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
                                     {templates.map(t => (
                                       <div 
                                         key={t.id}
                                         onClick={() => handleTemplateSelect(t.id)}
                                         className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center ${activeTemplate === t.id ? 'bg-violet-50 text-violet-800 font-bold' : 'font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700'}`}
                                       >
                                         {t.name}
                                         {activeTemplate === t.id && <Check size={16} className="text-violet-600" />}
                                       </div>
                                     ))}
                                   </div>
                                 </>
                               )}
                            </div>
                         </div>
                         
                         <div className="relative w-full md:w-1/2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">الصفوف المستهدفة</label>
                            <div 
                              className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-default min-h-[46px]"
                              onClick={() => setIsTargetGradesMenuOpen(!isTargetGradesMenuOpen)}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                {selectedTargetGrades.length === 0 ? (
                                  <span className="text-gray-500 text-sm px-2">اختر الصفوف...</span>
                                ) : (
                                  selectedTargetGrades.map(grade => (
                                    <span key={grade} className="bg-violet-50 text-violet-700 border border-violet-200 px-2 pl-1 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                      <span>{grade}</span>
                                      <button 
                                        className="hover:bg-violet-200 rounded-full p-0.5 transition-colors focus:outline-none"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTargetGrades(selectedTargetGrades.filter(g => g !== grade));
                                        }}
                                      >
                                        <XIcon size={12} />
                                      </button>
                                    </span>
                                  ))
                                )}
                              </div>
                              <ChevronDown size={18} className="text-gray-400 mr-2" />
                            </div>

                            {isTargetGradesMenuOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsTargetGradesMenuOpen(false)}></div>
                                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                                  {k12Grades.map(grade => {
                                    const isSelected = selectedTargetGrades.includes(grade);
                                    return (
                                      <div 
                                        key={grade}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedTargetGrades(selectedTargetGrades.filter(g => g !== grade));
                                          } else {
                                            setSelectedTargetGrades([...selectedTargetGrades, grade]);
                                          }
                                        }}
                                        className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center ${isSelected ? 'bg-violet-50 text-violet-800 font-bold' : 'font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700'}`}
                                      >
                                        {grade}
                                        {isSelected && <Check size={16} className="text-violet-600" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* Section C: Passing Criteria */}
                   <div className="p-6 border border-gray-200 rounded-3xl bg-white shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-violet-500" /> معايير النجاح
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                         <div className="flex flex-col w-full">
                           <label className="block text-sm font-bold text-gray-700 mb-2">الحد الأدنى لدرجة النجاح</label>
                           <div className="relative w-full">
                              <div 
                                onClick={() => setIsPassingMenuOpen(!isPassingMenuOpen)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer flex justify-between items-center"
                              >
                                <span className="font-medium text-gray-800">
                                  {config.passingScore > 0 ? `${config.gradingScale.find(g => g.min === config.passingScore)?.grade || ''} (Min: ${config.passingScore}%)` : 'اختر درجة النجاح...'}
                                </span>
                                <ChevronDown size={18} className="text-gray-400" />
                              </div>
                              
                              {isPassingMenuOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsPassingMenuOpen(false)}></div>
                                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                                    <div 
                                      onClick={() => { setConfig({...config, passingScore: 0}); setIsPassingMenuOpen(false); }}
                                      className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center ${config.passingScore === 0 ? 'bg-violet-50 text-violet-800 font-bold' : 'font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700'}`}
                                    >
                                      اختر درجة النجاح...
                                      {config.passingScore === 0 && <Check size={16} className="text-violet-600" />}
                                    </div>
                                    {config.gradingScale.map(g => (
                                      <div 
                                        key={g.grade}
                                        onClick={() => { setConfig({...config, passingScore: g.min}); setIsPassingMenuOpen(false); }}
                                        className={`px-4 py-3 text-sm cursor-pointer transition-colors flex justify-between items-center ${config.passingScore === g.min ? 'bg-violet-50 text-violet-800 font-bold' : 'font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-700'}`}
                                      >
                                        {g.grade} (Min: {g.min}%)
                                        {config.passingScore === g.min && <Check size={16} className="text-violet-600" />}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                           </div>
                         </div>

                         <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4 md:mt-0 justify-between">
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-gray-900">تفعيل حساب المعدل التراكمي (GPA)</span>
                               <span className="text-xs text-gray-500">تضمين أوزان المعدل التراكمي في المخطط</span>
                            </div>
                            <button 
                              onClick={() => setEnableGPA(!enableGPA)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${enableGPA ? 'bg-violet-600' : 'bg-gray-300'}`}
                            >
                               <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableGPA ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                         </div>
                      </div>
                   </div>

                   {/* Section B: The Dynamic Builder */}
                   <div className="p-6 border border-gray-200 rounded-3xl bg-white shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                         <h4 className="font-bold text-gray-900">بناء مقياس الدرجات</h4>
                         <Button variant="secondary" onClick={handleAddGradingRule} className="text-xs py-1.5 h-8">
                            <Plus size={14} /> إضافة حد للدرجة
                         </Button>
                      </div>
                      
                      <div className="space-y-3">
                          {/* Header Row */}
                          {config.gradingScale.length > 0 && (
                            <div className="flex items-center gap-4 px-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                               <div className="flex-1">قيمة العرض</div>
                               <div className="w-40 text-center">المدى (%)</div>
                               {enableGPA && <div className="w-24 text-center">وزن المعدل التراكمي</div>}
                               <div className="w-10"></div>
                            </div>
                          )}

                          {config.gradingScale.map((rule, idx) => (
                             <div key={idx} className="p-3 rounded-2xl border bg-white border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-4 hover:border-violet-200 transition-colors group">
                                
                                {/* Display Value & Color */}
                                <div className="flex-1 flex items-center gap-3 w-full">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${rule.color.replace('text-', 'bg-').replace('600', '100')} ${rule.color}`}>
                                      {rule.grade.charAt(0) || '?'}
                                   </div>
                                   <input 
                                     type="text" 
                                     value={rule.grade}
                                     placeholder="اسم الدرجة"
                                     onChange={(e) => handleUpdateGradingRule(idx, 'grade', e.target.value)}
                                     className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-bold text-gray-900 transition-all"
                                   />
                                   <div className="relative w-32">
                                      <div 
                                        onClick={() => setOpenColorMenuIdx(openColorMenuIdx === idx ? null : idx)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer flex justify-between items-center"
                                      >
                                        <span className={`font-medium text-sm ${rule.color}`}>
                                          {
  {
    'text-green-600': 'أخضر',
    'text-blue-600': 'أزرق',
    'text-yellow-600': 'أصفر',
    'text-violet-600': 'بنفسجي',
    'text-pink-600': 'أحمر',
    'text-purple-600': 'أرجواني',
    'text-gray-600': 'رمادي'
  }[rule.color as string] || rule.color
}
                                        </span>
                                        <ChevronDown size={18} className="text-gray-400" />
                                      </div>
                                      
                                      {openColorMenuIdx === idx && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setOpenColorMenuIdx(null)}></div>
                                          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                            {[
                                              { value: 'text-green-600', label: 'أخضر' },
                                              { value: 'text-blue-600', label: 'أزرق' },
                                              { value: 'text-yellow-600', label: 'أصفر' },
                                              { value: 'text-violet-600', label: 'بنفسجي' },
                                              { value: 'text-pink-600', label: 'أحمر' },
                                              { value: 'text-purple-600', label: 'أرجواني' },
                                              { value: 'text-gray-600', label: 'رمادي' }
                                            ].map(colorOption => (
                                              <div 
                                                key={colorOption.value}
                                                onClick={() => { handleUpdateGradingRule(idx, 'color', colorOption.value); setOpenColorMenuIdx(null); }}
                                                className={`px-4 py-2 text-sm cursor-pointer transition-colors flex justify-between items-center ${rule.color === colorOption.value ? 'bg-violet-50 font-bold' : 'font-medium hover:bg-violet-50'} ${colorOption.value}`}
                                              >
                                                {colorOption.label}
                                                {rule.color === colorOption.value && <Check size={14} />}
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                   </div>
                                </div>

                                {/* Range Inputs */}
                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 w-full md:w-40 justify-center focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-500 transition-all">
                                   <input 
                                     type="number" 
                                     value={rule.min} 
                                     onChange={(e) => handleUpdateGradingRule(idx, 'min', Number(e.target.value))}
                                     className="w-12 p-1 text-center bg-transparent outline-none font-bold text-gray-700" 
                                   />
                                   <span className="text-gray-300 font-medium">-</span>
                                   <input 
                                     type="number" 
                                     value={rule.max} 
                                     onChange={(e) => handleUpdateGradingRule(idx, 'max', Number(e.target.value))}
                                     className="w-12 p-1 text-center bg-transparent outline-none font-bold text-gray-700" 
                                   />
                                </div>

                                {/* GPA Value */}
                                {enableGPA && (
                                  <div className="w-full md:w-24">
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      value={rule.gpaValue || ''} 
                                      placeholder="4.0"
                                      onChange={(e) => handleUpdateGradingRule(idx, 'gpaValue', Number(e.target.value))}
                                      className="w-full p-2.5 text-center bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-bold text-gray-700 transition-all" 
                                    />
                                  </div>
                                )}

                                {/* Actions */}
                                <button 
                                  onClick={() => handleRemoveGradingRule(idx)}
                                  className="p-2.5 text-gray-400 hover:text-pink-600 hover:bg-red-50 rounded-xl transition-colors opacity-100 md:opacity-0 group-hover:opacity-100"
                                >
                                   <Trash2 size={18} />
                                </button>
                             </div>
                          ))}
                          
                          {config.gradingScale.length === 0 && (
                              <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                                 <p className="text-gray-500 mb-4">لم يتم تحديد حدود الدرجات</p>
                                 <Button variant="secondary" onClick={handleAddGradingRule}>إنشاء الدرجة الأولى</Button>
                              </div>
                          )}
                      </div>
                   </div>

                   {/* Section D: Early Warning Radar — معايير الدرجات */}
                   {warningCriteria && (
                   <div className="p-6 border border-gray-200 rounded-3xl bg-white shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                         <div>
                           <h4 className="font-bold text-gray-900">معايير التحذير المبكر — الدرجات</h4>
                           <p className="text-xs text-gray-400 mt-0.5">تحدد متوسط الأداء اللي بيصنّف الطالب "حرج" أو "تحذير" في رادار التحذير المبكر بـ Talia Learn.</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="text-sm font-bold text-red-600 mb-2 block">حالة حرجة: متوسط الأداء أقل من (%)</label>
                            <input
                              type="number"
                              value={warningCriteria.criticalMinAverage}
                              onChange={(e) => setWarningCriteria({ ...warningCriteria, criticalMinAverage: Number(e.target.value) })}
                              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                            />
                         </div>
                         <div>
                            <label className="text-sm font-bold text-amber-600 mb-2 block">تحذير: متوسط الأداء أقل من (%)</label>
                            <input
                              type="number"
                              value={warningCriteria.warningMinAverage}
                              onChange={(e) => setWarningCriteria({ ...warningCriteria, warningMinAverage: Number(e.target.value) })}
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
             </div>
             );
           })()}

           {/* Step 2: Gradebook Template Builder */}
           {adminStep === 2 && (
             <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                   <h3 className="text-xl font-bold text-gray-900">صانع قوالب سجل الدرجات</h3>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
                  <h4 className="text-sm font-bold text-gray-900 mb-1">بناء هيكل التقييم الخاص بك</h4>
                  <p className="text-xs text-gray-500 mb-4">قم بإنشاء فئات لتجميع التقييمات وتحديد أوزانها...</p>
                  <div className="flex bg-white rounded-xl border border-gray-300 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100 transition-all shadow-sm p-1">
                    <div className="flex-1 flex items-center px-3">
                       <FolderPlus size={18} className="text-gray-400 mr-2" />
                       <input 
                         type="text" 
                         placeholder="اكتب اسم الفئة الجديدة..." 
                         className="w-full bg-transparent outline-none text-sm font-medium text-gray-800" 
                         value={newCategoryName} 
                         onChange={(e) => setNewCategoryName(e.target.value)} 
                         onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} 
                       />
                    </div>
                    <Button onClick={handleAddCategory} className="rounded-lg px-6 bg-gray-900 text-white hover:bg-gray-800 border-none">إضافة فئة</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {/* Left Column: Categories List */}
                   <div className="lg:col-span-2 space-y-4">
                      {Object.entries(config.categoryWeights).map(([categoryName, weight]) => {
                         const isExpanded = expandedCategories[categoryName];
                         const categoryAssessments = config.assessments.filter(a => a.category === categoryName);
                         
                         return (
                         <div key={categoryName} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
                               <div className="flex items-center gap-3 flex-1">
                                  <button onClick={() => toggleCategory(categoryName)} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
                                    <ChevronDown size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  <div className="flex-1">
                                    <input 
                                      type="text" 
                                      defaultValue={categoryName}
                                      onBlur={(e) => handleRenameCategory(categoryName, e.target.value)}
                                      className="font-bold text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-gray-300 px-1 w-full"
                                    />
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                                       <div className="h-full bg-violet-500" style={{ width: `${weight}%` }}></div>
                                    </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4 ml-6">
                                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                                     <input 
                                       type="number" 
                                       value={weight}
                                       onChange={(e) => handleUpdateCategoryWeight(categoryName, Number(e.target.value))}
                                       className="w-16 p-2 text-center font-bold text-gray-900 outline-none bg-transparent"
                                     />
                                     <span className="pr-3 text-gray-500 font-bold">%</span>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveCategory(categoryName)}
                                    className="p-2 text-gray-400 hover:text-pink-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                     <Trash2 size={18} />
                                  </button>
                               </div>
                            </div>
                            
                            {/* Hidden Tree Feature (Expanded State) */}
                            {isExpanded && (
                              <div className="p-4 bg-gray-50 border-t border-gray-100">
                                 <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-sm font-bold text-gray-700">التقييمات في {categoryName}</h5>
                                    <Button variant="secondary" className="text-xs py-1 h-7" onClick={() => openAddAssessment(categoryName)}>
                                       <Plus size={12} /> إضافة تقييم
                                    </Button>
                                 </div>
                                 
                                 {categoryAssessments.length > 0 ? (
                                   <div className="space-y-2">
                                     {categoryAssessments.map(assessment => (
                                       <div key={assessment.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                         <div className="flex items-center gap-3">
                                           <FileText size={16} className="text-gray-400" />
                                           <span className="font-medium text-gray-900 text-sm">{assessment.title}</span>
                                         </div>
                                         <div className="flex items-center gap-4 text-xs text-gray-500">
                                           <span>{assessment.date}</span>
                                           <span className="font-bold bg-gray-100 px-2 py-1 rounded">{assessment.maxScore} نقطة</span>
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 ) : (
                                   <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg bg-white">
                                      <p className="text-sm text-gray-500">لا توجد تقييمات حتى الآن.</p>
                                   </div>
                                 )}
                              </div>
                            )}
                         </div>
                         );
                      })}
                      
                      {Object.keys(config.categoryWeights).length === 0 && (
                         <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                            <p className="text-gray-500 mb-4">لم يتم تحديد فئات. ابدأ في بناء قالب سجل الدرجات الخاص بك.</p>
                            <Button onClick={handleAddCategory}>إضافة الفئة الأولى</Button>
                         </div>
                      )}
                   </div>

                   {/* Right Column: The Donut Chart */}
                   <div className="lg:col-span-1">
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-6">
                         <h4 className="font-bold text-gray-900 mb-6 text-center">توزيع الأوزان</h4>
                         
                         <div className="h-64 relative">
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                  <Pie
                                    data={Object.entries(config.categoryWeights).map(([name, value]) => ({ name, value }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    {Object.entries(config.categoryWeights).map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={['#f97316', '#fb923c', '#fdba74', '#ffedd5', '#ea580c'][index % 5]} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip 
                                    formatter={(value: number) => [`${value}%`, 'الوزن']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                  />
                               </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                               <span className={`text-3xl font-black ${totalWeight === 100 ? 'text-violet-500' : 'text-pink-600'}`}>
                                 {totalWeight}%
                               </span>
                               <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">المجموع</span>
                            </div>
                         </div>
                         
                         {totalWeight !== 100 && (
                            <div className="mt-6 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2 border border-red-100">
                               <AlertCircle size={16} className="mt-0.5 shrink-0" />
                               <p>يجب أن يكون الوزن الإجمالي 100% بالضبط. الوزن الحالي {totalWeight}%.</p>
                            </div>
                         )}
                         
                         <div className="mt-6 space-y-2">
                           {Object.entries(config.categoryWeights).map(([name, weight], idx) => (
                             <div key={name} className="flex items-center justify-between text-sm">
                               <div className="flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#ffedd5', '#ea580c'][idx % 5] }}></div>
                                 <span className="text-gray-700 truncate max-w-[120px]">{name}</span>
                               </div>
                               <span className="font-bold text-gray-900">{weight}%</span>
                             </div>
                           ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           )}

           {/* Step 3: Review & نشر */}
           {adminStep === 3 && (
             <div className="max-w-5xl mx-auto py-4">
                <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">المراجعة النهائية</h3>
                  <p className="text-gray-500">راجع إعدادات سجل الدرجات قبل الاعتماد النهائي.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                   {/* Summary: الفصول الدراسية */}
                   <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-violet-100 transition-colors">
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                      <div className="flex justify-between items-start mb-4">
                         <h4 className="font-bold text-gray-900 flex items-center gap-2"><CalendarRange size={18} className="text-blue-500" /> الفصول الدراسية</h4>
                         <button onClick={() => setAdminStep(2)} className="text-gray-400 hover:text-blue-600"><Settings size={14} /></button>
                      </div>
                      <div className="space-y-3">
                         {config.terms.map(t => (
                            <div key={t.id} className="flex justify-between text-sm">
                               <span className="text-gray-600">{t.name}</span>
                               <span className="font-mono text-gray-400 text-xs bg-gray-50 px-2 py-0.5 rounded">{t.startDate || 'غير متاح'}</span>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Summary: السياسة */}
                   <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-violet-100 transition-colors">
                      <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                      <div className="flex justify-between items-start mb-4">
                         <h4 className="font-bold text-gray-900 flex items-center gap-2"><Settings size={18} className="text-purple-500" /> السياسة</h4>
                         <button onClick={() => setAdminStep(3)} className="text-gray-400 hover:text-purple-600"><Settings size={14} /></button>
                      </div>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl">
                            <span className="text-sm font-bold text-purple-900">درجة النجاح</span>
                            <span className="text-xl font-bold text-purple-600">{config.passingScore}%</span>
                         </div>
                         <div className="flex gap-1 flex-wrap">
                            {config.gradingScale.map(g => (
                               <span key={g.grade} className="text-xs border border-gray-200 px-2 py-1 rounded bg-gray-50">{g.grade}</span>
                            ))}
                         </div>
                      </div>
                   </div>

                   {/* Summary: الأوزان */}
                   <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-violet-100 transition-colors">
                      <div className="absolute top-0 left-0 w-full h-1 bg-violet-500"></div>
                      <div className="flex justify-between items-start mb-4">
                         <h4 className="font-bold text-gray-900 flex items-center gap-2"><LucidePieChart size={18} className="text-violet-500" /> الأوزان</h4>
                         <button onClick={() => setAdminStep(2)} className="text-gray-400 hover:text-violet-600"><Settings size={14} /></button>
                      </div>
                      <div className="space-y-2">
                         {Object.entries(config.categoryWeights).map(([name, weight]) => (
                            <div key={name} className="relative pt-1">
                               <div className="flex justify-between text-xs mb-1">
                                  <span className="font-bold text-gray-700">{name}</span>
                                  <span className="text-gray-500">{weight}%</span>
                               </div>
                               <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-500" style={{ width: `${weight}%` }}></div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>

                {!isPendingSchema && (
                   <div className="flex justify-center gap-4">
                      <Button variant="secondary" className="px-6 shadow-none border max-w-xs text-sm" onClick={async () => {
                         if (!subjectNameInput.trim() || selectedTargetGrades.length === 0) return;
                         if (selectedClassId) {
                           await updateGradebookConfig({ configId: selectedClassId, subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                           refreshConfigs();
                           showToast('تم حفظ المسودة.', 'success');
                         } else {
                           const newId = await createGradebookConfig({ subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                           if (newId) { refreshConfigs(); showToast('تم حفظ المسودة.', 'success'); setSelectedClassId(null); setAdminStep(1); }
                           else showToast('حصل خطأ أثناء الحفظ.', 'error');
                         }
                      }}>حفظ كمسودة</Button>
                      <Button 
                        className="bg-purple-600 text-white shadow-none px-10 py-3 text-lg" 
                        disabled={totalWeight !== 100 || !subjectNameInput.trim() || selectedTargetGrades.length === 0}
                        onClick={async () => {
                           setStatus('pending');
                           if (selectedClassId) {
                             await updateGradebookConfig({ configId: selectedClassId, subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                             await updateGradebookConfigStatus(selectedClassId, 'pending');
                             refreshConfigs();
                             showToast(`تم إرسال نظام الدرجات "${subjectNameInput}" لطلب الاعتماد.`, 'success');
                           } else {
                             const newId = await createGradebookConfig({ subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                             if (newId) {
                               await updateGradebookConfigStatus(newId, 'pending');
                               refreshConfigs();
                               showToast(`تم إنشاء نظام الدرجات "${subjectNameInput}" وإرساله لطلب الاعتماد.`, 'success');
                             } else {
                               showToast('حصل خطأ أثناء إنشاء نظام الدرجات.', 'error');
                               return;
                             }
                           }
                           setAdminStep(1);
                           setSelectedClassId(null);
                           setAdminView('landing');
                        }}
                      >
                         إرسال للاعتماد
                      </Button>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none px-10 py-3 text-lg"
                        disabled={totalWeight !== 100 || !subjectNameInput.trim() || selectedTargetGrades.length === 0}
                        onClick={async () => {
                           const conflict = gradebooksData.find((g: any) =>
                             g.id !== selectedClassId &&
                             g.status === 'approved' &&
                             g.name === subjectNameInput &&
                             (g.gradesList || []).some((gr: string) => selectedTargetGrades.includes(gr))
                           ) as any;
                           if (conflict) {
                             const confirmed = await confirmDialog(
                               `فيه نظام درجات معتمد بالفعل لمادة "${subjectNameInput}" لنفس الصف (اسمه "${conflict.name}"). لو كمّلت، النظام القديم هيرجع مسودة وده هيبقى هو المعتمد. تحب تكمّل؟`,
                               'استبدال واعتماد'
                             );
                             if (!confirmed) return;
                             await updateGradebookConfigStatus(conflict.id, 'draft');
                           }
                           setStatus('approved');
                           if (selectedClassId) {
                             await updateGradebookConfig({ configId: selectedClassId, subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                             await updateGradebookConfigStatus(selectedClassId, 'approved');
                             refreshConfigs();
                             showToast(`تم اعتماد نظام الدرجات "${subjectNameInput}" ونشره بنجاح.`, 'success');
                           } else {
                             const newId = await createGradebookConfig({ subjectName: subjectNameInput, grades: selectedTargetGrades, passingScore: config.passingScore, categoryWeights: config.categoryWeights });
                             if (newId) {
                               await updateGradebookConfigStatus(newId, 'approved');
                               refreshConfigs();
                               showToast(`تم إنشاء نظام الدرجات "${subjectNameInput}" واعتماده بنجاح.`, 'success');
                             } else {
                               showToast('حصل خطأ أثناء إنشاء نظام الدرجات.', 'error');
                               return;
                             }
                           }
                           setAdminStep(1);
                           setSelectedClassId(null);
                           setAdminView('landing');
                        }}
                      >
                         اعتماد
                      </Button>
                   </div>
                )}
             </div>
           )}
        </div>
      </div>
    );
  };



  const Sparkline = ({ data }: { data: number[] }) => {
    if (data.length === 0) return null;
    const min = Math.min(...data) - 5;
    const max = Math.max(...data) + 5;
    const range = max - min || 1;
    const width = 60;
    const height = 24;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const first = data[0];
    const last = data[data.length - 1];
    let color = '#9ca3af'; // gray-400
    if (last > first + 2) color = '#22c55e'; // green-500
    else if (last < first - 2) color = '#ef4444'; // red-500

    return (
      <svg width={width} height={height} className="overflow-visible inline-block">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {data.map((val, i) => {
          const x = (i / (data.length - 1)) * width;
          const y = height - ((val - min) / range) * height;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} className="stroke-white stroke-[2px]" />;
        })}
      </svg>
    );
  };

  const TeacherView = () => {
    const selectedClass = gradebooksData.find(c => c.id === selectedClassId);
    const supervisedClass = realClassSections.find(c => c.id === supervisionClassId);
    const eligibleStudents = supervisedClass
      ? realStudents.filter(s => (supervisedClass.students || []).includes(s.id))
      : realStudents.filter(s => (selectedClass?.gradesList || []).includes(s.grade));
    const subjects = ['جميع المواد', ...curriculumSubjects];
    const displaySubjects = curriculumSubjects;

    const getStudentSubjectGrade = (studentId: string, subject: string, _termId: string) => {
      return allSubjectsGrades[subject]?.[studentId] ?? 0;
    };
    
    return (
      <>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)]">
         {/* Toolbar */}
         <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/30">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full lg:w-auto">
               <div className="flex items-center gap-4">
                 <button 
                   onClick={() => setSelectedClassId(null)}
                   className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                 >
                   <ArrowLeft size={20} />
                 </button>
                 <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{selectedClass?.name || config.subjectName}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === 'draft' ? 'bg-gray-100 text-gray-600' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                        {status === 'draft' ? 'مسودة' : status === 'pending' ? 'طلب اعتماد' : 'معتمد'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{selectedClass?.gradeLevel} • {selectedClass?.students.length || 0} طلاب</p>
                 </div>
               </div>

               <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>

               <div className="relative">
                 <button 
                   onClick={() => setIsSubjectMenuOpen(!isSubjectMenuOpen)}
                   className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                 >
                   {selectedSubject}
                   <ChevronDown size={14} className="text-gray-400" />
                 </button>
                 {isSubjectMenuOpen && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setIsSubjectMenuOpen(false)}></div>
                     <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-2">
                       {subjects.map(subject => (
                         <button
                           key={subject}
                           onClick={() => { setSelectedSubject(subject); setIsSubjectMenuOpen(false); }}
                           className={`w-full text-right px-4 py-2 text-sm transition-colors ${selectedSubject === subject ? 'bg-violet-50 text-violet-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                         >
                           {subject}
                         </button>
                       ))}
                     </div>
                   </>
                 )}
               </div>

               <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>

               <div className="flex flex-wrap gap-2">
                 {config.terms.map(t => (
                   <button 
                     key={t.id} 
                     onClick={() => setActiveTermId(t.id)}
                     className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTermId === t.id ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-100'}`}
                   >
                     {t.name}
                   </button>
                 ))}
                 <button 
                   onClick={() => setActiveTermId('year')}
                   className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeTermId === 'year' ? 'bg-violet-100 text-violet-700' : 'text-gray-500 hover:bg-gray-100'}`}
                 >
                   النهائي
                 </button>
               </div>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto">
               {Object.keys(editedEntries).length > 0 && canEnterGrades && (
                  <Button variant="secondary" onClick={handleSaveGrades} disabled={isSavingGrades} className="text-xs">
                     <Save size={16} /> {isSavingGrades ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                  </Button>
               )}
               <Button variant="tonal" className="text-xs" onClick={() => setIsAddingAssessment(true)}>
                  <Plus size={16} /> إضافة تقييم
               </Button>
               <button 
                 onClick={() => setShowAnalytics(!showAnalytics)}
                 className={`p-2 rounded-lg transition-colors ${showAnalytics ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
               >
                 <PanelRightOpen size={18} />
               </button>
            </div>
         </div>
         
         {/* Status Legend */}
         <div className="px-4 py-2 flex flex-wrap gap-4 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 bg-white">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> تم التقييم</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> تم التسليم</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> مفقود</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> متأخر</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-gray-300"></div> معذور</div>
         </div>
         
         {/* Data Grid & Sidebar Container */}
         <div className="flex-1 overflow-hidden flex gap-6 p-4">
           {/* Data Grid */}
           <div className="flex-1 overflow-auto relative rounded-2xl border border-gray-200 bg-white">
             <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 z-20 shadow-sm">
                   <tr>
                      <th className="sticky right-0 z-20 bg-gray-50 px-4 py-3 text-right w-[250px] border-b border-l border-gray-200">اسم الطالب</th>
                      {selectedSubject === 'جميع المواد' ? (
                        <>
                          {displaySubjects.map(sub => (
                            <th key={sub} className="px-4 py-3 text-center min-w-[100px] border-b border-gray-200">
                               <span className="text-gray-900">{sub}</span>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center min-w-[100px] border-b border-gray-200">التقدم</th>
                          <th className="px-4 py-3 text-center w-[100px] border-b border-r border-gray-200 bg-gray-50 sticky left-0 z-20">النسبة الإجمالية</th>
                        </>
                      ) : activeTermId === 'year' ? (
                        <>
                          {config.terms.map(t => (
                            <th key={t.id} className="px-4 py-3 text-center min-w-[120px] border-b border-gray-200">
                               <span className="text-gray-900">درجة {t.name}</span>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center w-[100px] border-b border-r border-gray-200 bg-gray-50 sticky left-0 z-20">المجموع حتى تاريخه</th>
                        </>
                      ) : (
                        <>
                          {termAssessments.map(ass => (
                            <th key={ass.id} className="px-4 py-3 text-center min-w-[120px] border-b border-gray-200">
                               <div className="flex flex-col items-center">
                                  <span className="text-gray-900">{ass.title}</span>
                                  <span className="text-[10px] font-normal uppercase bg-gray-200 px-1.5 rounded mt-1">
                                    {ass.category} • {ass.maxScore} نقطة {ass.isGraded === false ? '• تدريب' : ''}
                                  </span>
                               </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center w-[100px] border-b border-r border-gray-200 bg-gray-50 sticky left-0 z-20">الدرجة النهائية</th>
                        </>
                      )}
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {eligibleStudents.map((student) => {
                      const finalGrade = activeTermId === 'year' ? calculateYearFinal(student.id) : calculateFinalGrade(student.id);
                      
                      let allSubjectsTotal = 0;
                      const subjectGrades = displaySubjects.map(sub => {
                        const grade = getStudentSubjectGrade(student.id, sub, activeTermId);
                        allSubjectsTotal += grade;
                        return grade;
                      });
                      const allSubjectsAvg = Math.round(allSubjectsTotal / displaySubjects.length);
                      
                      const t1Avg = Math.round(displaySubjects.reduce((sum, sub) => sum + getStudentSubjectGrade(student.id, sub, 't1'), 0) / displaySubjects.length);
                      const t2Avg = Math.round(displaySubjects.reduce((sum, sub) => sum + getStudentSubjectGrade(student.id, sub, 't2'), 0) / displaySubjects.length);
                      const t3Avg = Math.round(displaySubjects.reduce((sum, sub) => sum + getStudentSubjectGrade(student.id, sub, 't3'), 0) / displaySubjects.length);
                      const sparklineData = [t1Avg, t2Avg, t3Avg];

                      return (
                         <tr key={student.id} className="hover:bg-violet-50/30 transition-colors group">
                            <td className="sticky right-0 bg-white group-hover:bg-violet-50/30 px-4 py-3 border-l border-gray-200 font-medium text-gray-900 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <img src={`https://i.pravatar.cc/150?u=${student.id}`} alt={student.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-gray-200 object-cover" />
                                 {student.name}
                               </div>
                               <button className="text-gray-400 hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <MessageSquare size={16} />
                               </button>
                            </td>
                            
                            {selectedSubject === 'جميع المواد' ? (
                              <>
                                {subjectGrades.map((grade, idx) => (
                                  <td key={idx} className="px-2 py-2 text-center border-r border-gray-50">
                                    <span className={`font-medium ${grade < config.passingScore ? 'text-pink-600' : 'text-gray-900'}`}>{grade}%</span>
                                  </td>
                                ))}
                                <td className="px-4 py-2 text-center border-r border-gray-50 flex justify-center items-center h-full">
                                  <Sparkline data={sparklineData} />
                                </td>
                                <td className="sticky left-0 bg-gray-50/50 group-hover:bg-violet-50/30 px-4 py-3 border-r border-gray-200 text-center">
                                   <span className={`font-bold ${allSubjectsAvg < config.passingScore ? 'text-pink-600' : 'text-gray-900'}`}>
                                      {allSubjectsAvg}%
                                   </span>
                                </td>
                              </>
                            ) : activeTermId === 'year' ? (
                              <>
                                {config.terms.map(t => {
                                  const termGrade = calculateFinalGrade(student.id, t.id);
                                  return (
                                    <td key={t.id} className="px-2 py-2 text-center border-r border-gray-50">
                                      <span className={`font-medium ${termGrade > 0 && termGrade < config.passingScore ? 'text-pink-600' : 'text-gray-900'}`}>{termGrade > 0 ? `${termGrade}%` : '-'}</span>
                                    </td>
                                  );
                                })}
                                <td className="sticky left-0 bg-gray-50/50 group-hover:bg-violet-50/30 px-4 py-3 border-r border-gray-200 text-center">
                                   <span className={`font-bold ${finalGrade < config.passingScore ? 'text-pink-600' : 'text-gray-900'}`}>
                                      {finalGrade}%
                                   </span>
                                </td>
                              </>
                            ) : (
                              <>
                                {termAssessments.map(ass => {
                                   const score = getStudentScore(student.id, ass.id);
                                   const status = getEntryStatus(student.id, ass.id);
                                   const isEditing = editedEntries.hasOwnProperty(`${student.id}::${ass.id}`);
                                   const isFailing = score !== null && (score / ass.maxScore) < 0.5;

                                   return (
                                     <td key={ass.id} className="px-2 py-2 text-center border-r border-gray-50 relative">
                                        <input 
                                          type="number" 
                                          min="0"
                                          max={ass.maxScore}
                                          placeholder="-"
                                          value={score ?? ''} 
                                          onChange={(e) => handleScoreChange(student.id, ass.id, e.target.value)}
                                          className={`w-16 text-center p-1.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-violet-500 ${
                                             status === 'Missing' ? 'bg-red-50 border-red-200 text-pink-600' :
                                             status === 'Late' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                             status === 'Submitted' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                             status === 'Excused' ? 'bg-gray-100 border-gray-200 text-gray-400 italic' :
                                             isEditing ? 'bg-white border-violet-300 shadow-sm' :
                                             isFailing ? 'bg-red-50/50 border-transparent text-pink-600 hover:border-red-200' :
                                             'bg-transparent border-transparent hover:border-gray-200'
                                          }`}
                                        />
                                        {status === 'Missing' && <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" title="مفقود"></div>}
                                        {status === 'Submitted' && <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" title="تم التسليم"></div>}
                                        {status === 'Late' && <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-yellow-500 rounded-full" title="متأخر"></div>}
                                        {status === 'Graded' && score !== null && <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-green-500 rounded-full" title="تم التقييم"></div>}
                                     </td>
                                   );
                                })}
                                <td className="sticky left-0 bg-gray-50/50 group-hover:bg-violet-50/30 px-4 py-3 border-r border-gray-200 text-center">
                                   <span className={`font-bold ${finalGrade < config.passingScore ? 'text-pink-600' : 'text-gray-900'}`}>
                                      {finalGrade}%
                                   </span>
                                </td>
                              </>
                            )}
                         </tr>
                      );
                   })}
                </tbody>
             </table>
           </div>

           {/* Analytics Sidebar */}
           {showAnalytics && (
             <div className="w-[300px] flex flex-col gap-4 overflow-y-auto pr-2 animate-fadeIn">
               <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                 <div className="flex items-center gap-2 text-red-700 font-bold mb-4">
                   <AlertCircle size={20} />
                   <h3>طلاب في خطر</h3>
                 </div>
                 <div className="space-y-3 mb-6">
                   {eligibleStudents.map(student => {
                     const finalGrade = activeTermId === 'year' ? calculateYearFinal(student.id) : calculateFinalGrade(student.id);
                     if (finalGrade >= config.passingScore) return null;
                     
                     // Count missing assessments
                     let missingCount = 0;
                     termAssessments.forEach(ass => {
                       if (getEntryStatus(student.id, ass.id) === 'Missing') missingCount++;
                     });

                     return (
                       <div key={student.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-red-100 shadow-sm">
                         <div className="flex items-center gap-2">
                           <input 
                             type="checkbox" 
                             className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                             checked={selectedAtRiskطلاب.includes(student.id)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setSelectedAtRiskطلاب([...selectedAtRiskطلاب, student.id]);
                               } else {
                                 setSelectedAtRiskطلاب(selectedAtRiskطلاب.filter(id => id !== student.id));
                               }
                             }}
                           />
                           <img src={`https://i.pravatar.cc/150?u=${student.id}`} alt={student.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
                           <span className="text-sm font-medium text-gray-900 truncate w-24">{student.name}</span>
                         </div>
                         <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-100 text-red-700">
                           {missingCount > 0 ? `${missingCount} مفقود` : 'راسب'}
                         </span>
                       </div>
                     );
                   })}
                 </div>
                 <Button 
                    className="w-full bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-sm"
                    onClick={() => setShowMessagingDrawer(true)}
                  >
                   ⚡ {selectedAtRiskطلاب.length > 0 ? `إشعار ${selectedAtRiskطلاب.length} من أولياء الأمور` : 'إشعار أولياء الأمور (الكل)'}
                 </Button>
               </div>
             </div>
           )}
         </div>
      </div>

      {/* Messaging Drawer Placeholder */}
      {showMessagingDrawer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">رسالة تدخل</h3>
              <button onClick={() => setShowMessagingDrawer(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-100">
                <strong>المستلمون:</strong> {selectedAtRiskطلاب.length > 0 
                  ? eligibleStudents.filter(s => selectedAtRiskطلاب.includes(s.id)).map(s => s.name).join(', ')
                  : 'جميع الطلاب في خطر'}
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الرسالة</label>
                <textarea 
                  rows={5}
                  placeholder="اكتب رسالة التدخل الخاصة بك هنا..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium resize-none"
                ></textarea>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowMessagingDrawer(false)}>إلغاء</Button>
              <Button className="bg-violet-600 text-white hover:bg-violet-700 shadow-sm flex-1" onClick={() => {
                setShowMessagingDrawer(false);
                setSelectedAtRiskطلاب([]);
              }}>إرسال رسالة</Button>
            </div>
          </div>
        </div>
      )}
    </>
    );
  };

  return (
    <div dir="rtl" className="animate-fadeIn">
       <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {selectedClassId && (
              <button 
                onClick={() => setSelectedClassId(null)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">سجل الدرجات</h1>
          </div>
          
          {role === UserRole.ADMIN && (
             <div className="flex items-center gap-3">
               <div className="bg-white p-1 rounded-full border border-gray-200 shadow-sm flex items-center">
                  <button 
                    onClick={() => { setActiveTab('admin'); setAdminView('landing'); setSelectedClassId(null); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    إعدادات الإدارة
                  </button>
                  {canSupervise && (
                  <button 
                    onClick={() => { setActiveTab('teacher'); setSupervisionClassId(null); setSelectedClassId(null); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'teacher' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    الإشراف والمتابعة
                  </button>
                  )}
                  <button 
                    onClick={() => setActiveTab('approvals')}
                    className={`relative px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'approvals' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    الاعتمادات
                    {status === 'pending' && (
                      <span className="absolute top-1 right-2 w-2 h-2 bg-purple-500 rounded-full border border-white"></span>
                    )}
                  </button>
               </div>
               {activeTab === 'admin' && (
                 <Button onClick={() => { setSelectedClassId(null); setAdminStep(1); setAdminView('wizard'); }} className="bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap">
                    <Plus size={18} className="mr-2" /> إنشاء نظام درجات جديد
                 </Button>
               )}
             </div>
          )}
       </div>

       {!selectedClassId && activeTab === 'teacher' ? (
         ClassAndSubjectSelector()
       ) : activeTab === 'admin' && adminView === 'landing' ? (
         AdminLandingView()
       ) : activeTab === 'admin' && adminView === 'draftsList' ? (
         AdminDraftsListView()
       ) : activeTab === 'admin' ? (
         AdminJourney()
       ) : activeTab === 'approvals' ? (
         ApprovalsView()
       ) : (
         TeacherView()
       )}

       {/* إضافة تقييم Modal */}

       {isAddingAssessment && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
               <h3 className="text-xl font-bold text-gray-900">تقييم جديد</h3>
               <button onClick={() => setIsAddingAssessment(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                 <XIcon size={20} />
               </button>
             </div>
             <div className="p-6 space-y-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1">العنوان</label>
                 <input 
                   type="text" 
                   placeholder="مثال: الاختبار النصفي"
                   value={newAssessment.title}
                   onChange={(e) => setNewAssessment({...newAssessment, title: e.target.value})}
                   className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">الفئة</label>
                   <select 
                     value={newAssessment.category}
                     onChange={(e) => setNewAssessment({...newAssessment, category: e.target.value as AssessmentCategory})}
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                   >
                     {Object.keys(config.categoryWeights).map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                     ))}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">نوع التقييم</label>
                   <select 
                     value={newAssessment.gradingType}
                     onChange={(e) => setNewAssessment({...newAssessment, gradingType: e.target.value as 'Points' | 'Percentage'})}
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                   >
                     <option value="Points">نقاط</option>
                     <option value="Percentage">نسبة مئوية</option>
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">الدرجة القصوى</label>
                   <input 
                     type="number" 
                     value={newAssessment.gradingType === 'Percentage' ? 100 : newAssessment.maxScore}
                     onChange={(e) => setNewAssessment({...newAssessment, maxScore: Number(e.target.value)})}
                     disabled={newAssessment.gradingType === 'Percentage'}
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                   />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ البدء</label>
                   <input 
                     type="date" 
                     value={newAssessment.startDate}
                     onChange={(e) => setNewAssessment({...newAssessment, startDate: e.target.value})}
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الاستحقاق</label>
                   <input 
                     type="date" 
                     value={newAssessment.date}
                     onChange={(e) => setNewAssessment({...newAssessment, date: e.target.value})}
                     className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                   />
                 </div>
               </div>
               <div className="flex items-center gap-3 pt-2">
                 <input 
                   type="checkbox" 
                   id="isGraded"
                   checked={newAssessment.isGraded}
                   onChange={(e) => setNewAssessment({...newAssessment, isGraded: e.target.checked})}
                   className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
                 />
                 <label htmlFor="isGraded" className="text-sm font-bold text-gray-700 cursor-pointer">
                   يحتسب ضمن الدرجة النهائية
                 </label>
               </div>
             </div>
             <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
               <Button variant="secondary" className="flex-1" onClick={() => setIsAddingAssessment(false)}>إلغاء</Button>
               <Button className="bg-violet-600 text-white hover:bg-violet-700 shadow-sm flex-1" onClick={handleCreateAssessment} disabled={!newAssessment.title || isCreatingAssessment}>{isCreatingAssessment ? 'جاري الإضافة...' : 'إنشاء'}</Button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};
