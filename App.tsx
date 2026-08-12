import React, { useState, useRef } from 'react';
import { getUserByCredentials } from './services/supabaseData';
import { showToast } from './components/Toast';
import { UserRole, Language, User, NavItem } from './types';
import { Header } from './components/Header';
import { ToastContainer } from './components/Toast';
import { ConfirmDialogContainer } from './components/ConfirmDialog';
import { Dashboard } from './views/Dashboard';
import { LessonPlanner } from './views/LessonPlanner';
import { LessonPlanLibrary } from './views/LessonPlanLibrary';
import { UserManagement } from './views/Students';
import { Curriculum } from './views/Curriculum';
import { CurriculumHub } from './views/CurriculumHub';
import { Gradebook } from './views/Gradebook';
import { ClassManagement } from './views/ClassManagement';
import { Attendance } from './views/Attendance';
import { Analytics } from './views/Analytics';
import { Settings } from './views/Settings';
import { EditStudentProfile } from './views/EditStudentProfile';
import { MOEDashboardView } from './views/MOEDashboardView';
import { FinancialManagement } from './views/FinancialManagement';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  LibraryBig, 
  BarChart3, 
  Settings as SettingsIcon, 
  School,
  Activity,
  Menu,
  X,
  FileSpreadsheet,
  Users,
  Calendar,
  Landmark,
  ChevronDown,
  ChevronUp,
  CreditCard,
  LogOut,
  User as UserIcon,
  Lock
} from 'lucide-react';
import taliaLogo from './assets/talia-360-logo.png';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(Language.AR);
  const [activeView, setActiveView] = useState('moe-dashboard');
  const [editProfileStudentId, setEditProfileStudentId] = useState<string | null>(null);
  const [lessonPlanContext, setLessonPlanContext] = useState<{ mode: 'edit' | 'view'; planId: string } | null>(null);
  const previousViewBeforePlanRef = useRef<string>('lessons-library');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    'moe-dashboard': true
  });
  
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<'MOE' | 'school'>('MOE');
  const [isLoading, setIsLoading] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Mock User State
  const [user, setUser] = useState<User>({
    id: 'u1',
    name: 'Sarah Al-Majed',
    role: UserRole.ADMIN,
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  });
  // صلاحيات المستخدم الحقيقي المسجّل دخوله (فاضية لحسابات الديمو، أو لو الدور مش إداري)
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loginError, setLoginError] = useState('');

  const handleDemoLogin = (demoRole: 'MOE' | 'school') => {
    const targetUsername = demoRole === 'MOE' ? 'MOE' : 'school';
    const targetPassword = '123';
    
    setLoginUsername('');
    setLoginPassword('');
    
    let uIndex = 0;
    let pIndex = 0;
    
    // Typing animation for username and password
    const uInterval = setInterval(() => {
      if (uIndex < targetUsername.length) {
        setLoginUsername(targetUsername.slice(0, uIndex + 1));
        uIndex++;
      } else {
        clearInterval(uInterval);
        const pInterval = setInterval(() => {
          if (pIndex < targetPassword.length) {
            setLoginPassword(targetPassword.slice(0, pIndex + 1));
            pIndex++;
          } else {
            clearInterval(pInterval);
          }
        }, 80); // Speed of password typing
      }
    }, 80); // Speed of username typing
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;

    setLoginError('');
    setIsLoading(true);

    // اختصارات الديمو القديمة (وزارة / مدرسة) — بتفضل شغالة زي ما هي بالظبط، من غير أي تغيير
    const isMOEDemo = loginUsername.toLowerCase() === 'moe';
    const isSchoolDemo = loginUsername.toLowerCase() === 'school' && loginPassword === '123';

    if (isMOEDemo || isSchoolDemo) {
      setTimeout(() => {
        const demoRole = isMOEDemo ? 'MOE' : 'school';
        setRole(demoRole);
        setUserPermissions([]);
        setIsLoggedIn(true);
        setActiveView(demoRole === 'MOE' ? 'moe-dashboard' : 'dashboard');
        if (demoRole === 'MOE') {
          setExpandedNav(prev => ({ ...prev, 'moe-dashboard': true }));
        } else {
          setExpandedNav(prev => ({ ...prev, 'dashboard': true }));
        }
        setIsLoading(false);
      }, 800);
      return;
    }

    // تسجيل دخول حقيقي: بيدوّر على المستخدم في قاعدة البيانات بنفس الإيميل والباسورد
    const realUser = await getUserByCredentials(loginUsername, loginPassword);
    setIsLoading(false);

    if (!realUser) {
      setLoginError('الإيميل أو كلمة المرور غلط.');
      showToast('الإيميل أو كلمة المرور غلط.', 'error');
      return;
    }

    setUser({
      id: realUser.id,
      name: realUser.name,
      role: realUser.role as UserRole,
      avatar: `https://ui-avatars.com/api/?name=${realUser.name}&background=random`,
    });
    setUserPermissions(realUser.permissions);
    setRole('school');
    setIsLoggedIn(true);

    // نودّيه لأول شاشة مسموح له يشوفها، بدل ما نفترض إن الرئيسية دايمًا متاحة له
    const permCheck = (perm: string) => realUser.permissions.length === 0 || realUser.permissions.includes(perm);
    const firstAllowedId = Object.entries(NAV_VIEW_PERMISSIONS).find(([, perm]) => permCheck(perm))?.[0] || 'dashboard';
    setActiveView(firstAllowedId);
    setExpandedNav(prev => ({ ...prev, [firstAllowedId]: true }));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginUsername('');
    setLoginPassword('');
    setUserPermissions([]);
    setLoginError('');
    // Optionally reset role, but for demo context it's fine.
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === Language.AR ? Language.EN : Language.AR);
  };

  const isRTL = language === Language.AR;

  // لو مفيش صلاحيات محددة (حسابات الديمو القديمة) الوصول يفضل مفتوح زي ما كان دايمًا.
  // غير كده، كل قسم في القائمة الجانبية بيتحكم فيه صلاحية العرض بتاعته.
  const hasPerm = (perm: string) => userPermissions.length === 0 || userPermissions.includes(perm);

  const NAV_VIEW_PERMISSIONS: Record<string, string> = {
    dashboard: 'dashboard_view',
    users: 'users_view',
    curriculum: 'curriculum_view',
    classes: 'classes_view',
    attendance: 'attendance_view',
    gradebook: 'grades_view',
    finance: 'fin_view',
    settings: 'sys_settings',
  };

  // Navigation Config
  const navItemsRaw: NavItem[] = [
    ...(role === 'MOE' ? [{ 
      id: 'moe-dashboard', 
      labelEn: 'MOE Command Center', 
      labelAr: 'مركز القيادة', 
      icon: <Landmark size={20} />, 
      view: 'moe-dashboard',
      subItems: [
        { id: 'moe-overview', labelAr: 'النظرة العامة', labelEn: 'Overview', view: 'moe-overview' },
        { id: 'moe-academies', labelAr: 'الاكاديميات و الطلاب', labelEn: 'Academies & Students', view: 'moe-academies' },
        { id: 'moe-hr', labelAr: 'الموارد البشريه و المعلمون', labelEn: 'HR & Teachers', view: 'moe-hr' },
        { id: 'moe-infra', labelAr: 'البنية التحتية و المدارس', labelEn: 'Infrastructure & Schools', view: 'moe-infra' },
        { id: 'moe-finance', labelAr: 'الماليه', labelEn: 'Finance', view: 'moe-finance' }
      ]
    }] : []),
    { 
      id: 'dashboard', 
      labelEn: 'Dashboard', 
      labelAr: 'الرئيسية', 
      icon: <LayoutDashboard size={20} />, 
      view: 'dashboard',
      subItems: [
        { id: 'dash-all', labelAr: 'المدرسة بأكملها', labelEn: 'Whole School', view: 'dash-all' },
        { id: 'dash-elem', labelAr: 'المرحلة الابتدائية', labelEn: 'Primary School', view: 'dash-elem' },
        { id: 'dash-mid', labelAr: 'المرحلة الاعدادية', labelEn: 'Middle School', view: 'dash-mid' },
        { id: 'dash-high', labelAr: 'المرحلة الثانوية', labelEn: 'High School', view: 'dash-high' }
      ]
    },
    { 
      id: 'users', 
      labelEn: 'People', 
      labelAr: 'المستخدمين', 
      icon: <Users size={20} />, 
      view: 'users',
      subItems: [
        { id: 'users-admin', labelAr: 'الادارة', labelEn: 'Administration', view: 'users-admin' },
        { id: 'users-teachers', labelAr: 'المعلمون', labelEn: 'Teachers', view: 'users-teachers' },
        { id: 'users-parents', labelAr: 'أولياء الأمور', labelEn: 'Parents', view: 'users-parents' },
        { id: 'users-students', labelAr: 'الطلاب', labelEn: 'Students', view: 'users-students' },
      ]
    },
    { 
      id: 'curriculum', 
      labelEn: 'Courses', 
      labelAr: 'المنهج الدراسي', 
      icon: <LibraryBig size={20} />, 
      view: 'curriculum',
      subItems: [
        { id: 'curr-setup', labelAr: 'إعداد المنهج', labelEn: 'Curriculum Setup', view: 'curr-setup' },
        { id: 'lessons-planner', labelAr: 'مخطط الدروس', labelEn: 'Lesson Planner', view: 'lessons-planner' },
        { id: 'lessons-library', labelAr: 'مكتبة خطط الدروس', labelEn: 'Lesson Plan Library', view: 'lessons-library' }
      ]
    },
    { id: 'classes', labelEn: 'Classes', labelAr: 'الفصول', icon: <School size={20} />, view: 'classes' },
    { id: 'attendance', labelEn: 'Attendance', labelAr: 'الحضور', icon: <Calendar size={20} />, view: 'attendance' },
    { id: 'gradebook', labelEn: 'Gradebook', labelAr: 'سجل الدرجات', icon: <FileSpreadsheet size={20} />, view: 'gradebook' },
    { id: 'finance', labelEn: 'Finance', labelAr: 'إدارة المدفوعات', icon: <CreditCard size={20} />, view: 'finance' },
    { id: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', icon: <SettingsIcon size={20} />, view: 'settings' },
  ];

  const navItems: NavItem[] = navItemsRaw.filter(item => {
    const requiredPerm = NAV_VIEW_PERMISSIONS[item.id];
    return !requiredPerm || hasPerm(requiredPerm);
  });

  React.useEffect(() => {
    // Automatically expand the parent section when a child view becomes active
    const activeItem = navItems.find(item => 
      item.view === activeView || item.subItems?.some(s => s.view === activeView)
    );
    if (activeItem && activeItem.subItems && !expandedNav[activeItem.id]) {
      setExpandedNav(prev => ({ ...prev, [activeItem.id]: true }));
    }
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case 'moe-dashboard':
      case 'moe-overview':
      case 'moe-academies':
      case 'moe-hr':
      case 'moe-infra':
      case 'moe-finance': {
        const tabMap: Record<string, string> = {
          'moe-dashboard': 'overview',
          'moe-overview': 'overview',
          'moe-academies': 'academics',
          'moe-hr': 'hr',
          'moe-infra': 'infrastructure',
          'moe-finance': 'financials',
        };
        return <MOEDashboardView language={language} activeTabProp={tabMap[activeView] || 'overview'} onTabChange={(tab) => {
          const viewMap: Record<string, string> = {
             'overview': 'moe-overview',
             'academics': 'moe-academies',
             'hr': 'moe-hr',
             'infrastructure': 'moe-infra',
             'financials': 'moe-finance'
          };
          if (viewMap[tab] && viewMap[tab] !== activeView) setActiveView(viewMap[tab]);
        }} />;
      }
      case 'finance':
        return <FinancialManagement language={language} />;
      case 'dashboard':
      case 'dash-all':
      case 'dash-elem':
      case 'dash-mid':
      case 'dash-high': {
        const filterMap: Record<string, string> = {
          'dashboard': isRTL ? 'المدرسة بأكملها' : 'All School',
          'dash-all': isRTL ? 'المدرسة بأكملها' : 'All School',
          'dash-elem': isRTL ? 'الابتدائية' : 'Elementary',
          'dash-mid': isRTL ? 'المتوسطة' : 'Middle School',
          'dash-high': isRTL ? 'الثانوية' : 'High School'
        };
        const mappedFilter = filterMap[activeView] || (isRTL ? 'المدرسة بأكملها' : 'All School');
        return <Dashboard role={user.role} language={language} activeFilterProp={mappedFilter} onFilterChange={(filter) => {
          const viewMap: Record<string, string> = {
            'المدرسة بأكملها': 'dash-all',
            'All School': 'dash-all',
            'الابتدائية': 'dash-elem',
            'Elementary': 'dash-elem',
            'المتوسطة': 'dash-mid',
            'Middle School': 'dash-mid',
            'الثانوية': 'dash-high',
            'High School': 'dash-high'
          };
          if (viewMap[filter] && viewMap[filter] !== activeView) setActiveView(viewMap[filter]);
        }} />;
      }
      case 'classes':
        return <ClassManagement role={user.role} language={language} user={user} permissions={userPermissions} />;
      case 'attendance':
        return <Attendance role={user.role} language={language} user={user} permissions={userPermissions} />;
      case 'lessons-planner':
        return <LessonPlanner language={language} permissions={userPermissions} editContext={lessonPlanContext} onExitContext={() => { setLessonPlanContext(null); setActiveView(previousViewBeforePlanRef.current); }} />;
      case 'lessons-library':
        return <LessonPlanLibrary language={language} permissions={userPermissions} onOpenPlan={(planId, mode) => { previousViewBeforePlanRef.current = 'lessons-library'; setLessonPlanContext({ planId, mode }); setActiveView('lessons-planner'); }} />;
      case 'users':
      case 'users-admin':
      case 'users-teachers':
      case 'users-parents':
      case 'users-students': {
        const tabMap: Record<string, string> = {
          'users': 'students', // default
          'users-admin': 'admins',
          'users-teachers': 'teachers',
          'users-parents': 'parents',
          'users-students': 'students',
        };
        const activeTabStr = tabMap[activeView] as 'students' | 'parents' | 'teachers' | 'admins';
        return <UserManagement language={language} role={user.role} permissions={userPermissions} onEditProfile={(studentId: string) => { setEditProfileStudentId(studentId); setActiveView('edit-profile'); }} activeTabProp={activeTabStr} onTabChange={(tab) => {
          const viewMap: Record<string, string> = {
            'students': 'users-students',
            'parents': 'users-parents',
            'teachers': 'users-teachers',
            'admins': 'users-admin'
          };
          if (viewMap[tab] && viewMap[tab] !== activeView) setActiveView(viewMap[tab]);
        }} />;
      }
      case 'curriculum':
        return <CurriculumHub language={language} onNavigate={setActiveView} />;
      case 'curr-setup':
        return <Curriculum language={language} permissions={userPermissions} />;
      case 'gradebook':
        return <Gradebook role={user.role} language={language} permissions={userPermissions} />;
      case 'analytics':
        return <Analytics role={user.role} language={language} />;
      case 'settings':
        return <Settings role={user.role} language={language} />;
      case 'edit-profile':
        case 'edit-profile':
        return editProfileStudentId ? <EditStudentProfile studentId={editProfileStudentId} onBack={() => setActiveView('users')} /> : null;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-6xl mb-6 opacity-30">
              <SettingsIcon size={64} />
            </span>
            <p className="text-xl font-medium">Feature coming soon</p>
          </div>
        );
    }
  };

  const getActiveTitle = () => {
    let title = isRTL ? 'لوحة القيادة' : 'Dashboard';
    for (const item of navItems) {
      if (item.view === activeView) {
        title = isRTL ? item.labelAr : item.labelEn;
        break;
      }
      if (item.subItems) {
        const sub = item.subItems.find(s => s.view === activeView);
        if (sub) {
          title = isRTL ? sub.labelAr : sub.labelEn;
          break;
        }
      }
    }
    return title;
  };

  if (!isLoggedIn) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen flex bg-white font-sans overflow-hidden">
        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 lg:p-24 flex flex-col justify-center relative bg-white z-10">
          <div className="absolute top-8 start-8 md:top-12 md:start-12">
            <img 
              src={taliaLogo} 
              alt="Talia 360" 
              className="w-32 md:w-40 object-contain"
              onError={(e) => console.error("Logo failed to load:", e.currentTarget.src)}
            />
          </div>

          <div className="max-w-md w-full mx-auto mt-20 md:mt-0 animate-fadeIn relative">
            <div className="mb-10 text-start">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                {isRTL ? (
                  <>مرحباً بك في <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] to-[#4c1d95]">تاليا</span></>
                ) : (
                  <>Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8b5cf6] to-[#4c1d95]">Talia</span></>
                )}
              </h1>
              <p className="text-slate-500 font-medium">{isRTL ? 'تسجيل الدخول إلى النظام الشامل لإدارة التعليم' : 'Log in to the comprehensive education management system'}</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-5 relative z-10">
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl px-4 py-3">{loginError}</div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{isRTL ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email'}</label>
                <div className="relative">
                  <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-slate-400`}>
                    <UserIcon size={20} />
                  </div>
                  <input 
                    type="text" 
                    className={`w-full bg-white border border-gray-200 shadow-none rounded-xl py-3 outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all font-medium text-slate-800 placeholder-slate-400 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                    placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-slate-700">{isRTL ? 'كلمة المرور' : 'Password'}</label>
                  <a href="#" className="text-sm font-bold text-violet-600 hover:text-violet-700 transition-colors shadow-none">{isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</a>
                </div>
                <div className="relative">
                  <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-slate-400`}>
                    <Lock size={20} />
                  </div>
                  <input 
                    type="password" 
                    className={`w-full bg-white border border-gray-200 shadow-none rounded-xl py-3 outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all font-medium text-slate-800 placeholder-slate-400 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#4c1d95] hover:opacity-90 shadow-none text-white font-bold py-3.5 rounded-xl transition-all mt-4"
                disabled={isLoading}
              >
                {isRTL ? 'دخول للمنصة' : 'Log In'}
              </button>
            </form>

            <div className="mt-12 pt-8 border-t border-gray-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 text-start">{isRTL ? 'الوصول السريع (تجريبي)' : 'Demo Access'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => handleDemoLogin('MOE')}
                  disabled={isLoading}
                  className="flex flex-row items-center justify-center py-3 px-4 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 hover:border-gray-300 transition-all text-slate-700 shadow-none focus:ring-2 focus:ring-slate-100 outline-none"
                >
                  <Landmark size={18} className="me-2 text-violet-600" />
                  <span className="text-sm font-bold">{isRTL ? 'حساب الوزارة' : 'MOE Demo'}</span>
                </button>
                <button 
                  type="button"
                  onClick={() => handleDemoLogin('school')}
                  disabled={isLoading}
                  className="flex flex-row items-center justify-center py-3 px-4 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 hover:border-gray-300 transition-all text-slate-700 shadow-none focus:ring-2 focus:ring-slate-100 outline-none"
                >
                  <School size={18} className="me-2 text-teal-600" />
                  <span className="text-sm font-bold">{isRTL ? 'حساب المدرسة' : 'School Demo'}</span>
                </button>
              </div>
            </div>
            
            {isLoading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                <div className="w-12 h-12 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin shadow-none"></div>
              </div>
            )}
            
          </div>
          
          <div className="absolute top-8 end-8 md:top-12 md:end-12">
            <button 
              onClick={toggleLanguage}
              className="text-sm font-bold text-slate-500 shadow-none hover:text-slate-800 transition-colors bg-white px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-slate-50"
            >
              {isRTL ? 'English' : 'عربي'}
            </button>
          </div>
        </div>

        {/* Left Side - Visual Banner */}
        <div className="hidden lg:flex w-1/2 bg-[#1b0a36] relative flex-col shadow-none">
          
          {/* Top Pill - absolute positioned */}
          <div className="absolute top-8 right-8 z-20">
            <div className="flex flex-row-reverse items-center justify-center px-4 py-2 rounded-full border border-white/10 bg-[#ffffff05] backdrop-blur-sm shadow-none gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-[#bf9cf1]" stroke="currentColor" strokeWidth="1.5">
                 <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
              </svg>
              <span className="text-white text-sm font-bold mb-[2px]">{isRTL ? 'منصة تاليا التعليمية الذكية' : 'Talia Smart Educational Platform'}</span>
            </div>
          </div>

          {/* Deep Space Background with Glows */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#210c43] via-[#100524] to-[#120322]">
             {/* Center Glow behind Star */}
             <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-[100px] shadow-none pointer-events-none"></div>
             {/* Bottom Glow behind Cards */}
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-[20rem] bg-purple-900/20 rounded-full blur-[120px] shadow-none pointer-events-none"></div>
             
             {/* Subtle Network Grid Pattern */}
             <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
             
             {/* Abstract Geometric Lines (approximating plexus) */}
             <svg className="absolute inset-0 w-full h-full opacity-30 shadow-none pointer-events-none" preserveAspectRatio="none">
               <path d="M0,150 L200,150 L400,300 L600,300 M500,600 L300,800 M100,500 L200,600" stroke="#a092cd" strokeWidth="1" fill="none"/>
               <circle cx="200" cy="150" r="4" fill="#a092cd" />
               <circle cx="400" cy="300" r="4" fill="#a092cd" />
             </svg>
          </div>

          {/* Content Wrapper */}
          <div className="relative z-10 w-full flex flex-col items-center justify-center min-h-screen px-12 py-16 mt-8">
            
            {/* The Multi-Color Central Scale/Star (Exact match to image) */}
            <div className="mb-10 w-48 h-48 relative flex items-center justify-center">
              
              {/* Floating Orbs around Star */}
              <div className="absolute w-2 h-2 rounded-full bg-white top-8 right-8 shadow-[0_0_10px_white]"></div>
              <div className="absolute w-1.5 h-1.5 rounded-full bg-white/70 bottom-12 left-10 shadow-none"></div>

              {/* Glowing SVG Star */}
              <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="starGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#d8b4fe" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </linearGradient>
                  {/* Subtle inner stroke gradient */}
                  <linearGradient id="starStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* The 4-point Diamond Shape */}
                <path d="M 100 10 C 100 50, 150 100, 190 100 C 150 100, 100 150, 100 190 C 100 150, 50 100, 10 100 C 50 100, 100 50, 100 10 Z" 
                      fill="url(#starGrad)" stroke="url(#starStroke)" strokeWidth="1.5" />
                
                {/* Inner darker core */}
                <path d="M 100 25 C 100 60, 135 100, 175 100 C 135 100, 100 140, 100 175 C 100 140, 65 100, 25 100 C 65 100, 100 60, 100 25 Z" 
                      fill="#4c1d95" opacity="0.4" />
                
                {/* Center Circle */}
                <circle cx="100" cy="100" r="28" fill="#a78bfa" opacity="0.3" stroke="#fff" strokeWidth="1" />
                <circle cx="100" cy="100" r="24" fill="#6d28d9" stroke="#fff" strokeWidth="1.5" />
                
                {/* AI Text inside */}
                <text x="100" y="108" fontSize="22" fontFamily="sans-serif" fontWeight="900" 
                      fill="white" textAnchor="middle" letterSpacing="1">AI</text>
              </svg>
            </div>

            {/* Typography */}
            <div className="text-center mb-16 w-full max-w-[550px]">
              <h2 className="text-white text-[3rem] font-bold leading-[1.2] drop-shadow-md mb-2">
                {isRTL ? 'مستقبل التعليم' : 'The Future of Education'}
              </h2>
              <h2 className="text-[#bf9cf1] text-[3rem] font-bold leading-[1.2] drop-shadow-md mb-6 whitespace-nowrap">
                 {isRTL ? 'مدعوم بالذكاء الاصطناعي' : 'Powered by AI'}
              </h2>
              <p className="text-[#d1d5db] text-lg font-medium shadow-none leading-relaxed px-4">
                 {isRTL 
                  ? 'نظام متكامل يربط المدارس والمعلمين وأولياء الأمور والطلاب في تجربة تعليمية سلسة مبنية على البيانات والتحليلات الذكية.' 
                  : 'An integrated system connecting schools, teachers, parents, and students in a seamless learning experience based on smart data and analytics.'}
              </p>
            </div>

            {/* Highlighted Dark Cards */}
            <div className="w-full max-w-[520px] space-y-4">
              {[
                { 
                  title: isRTL ? 'إدارة مركزية' : 'Centralized Management', 
                  desc: isRTL ? 'لجميع الأكاديميات والمدارس' : 'For all academies and schools',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                       <path d="M22 10L12 5L2 10L12 15L22 10Z"/>
                       <path d="M6 12V17C6 17 9 20 12 20C15 20 18 17 18 17V12"/>
                    </svg>
                  )
                },
                { 
                  title: isRTL ? 'تحليلات ذكية' : 'Smart Analytics', 
                  desc: isRTL ? 'قرارات مبنية على بيانات فورية' : 'Decisions based on real-time data',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10"/>
                      <path d="M12 20V4"/>
                      <path d="M6 20V14"/>
                    </svg>
                  ) 
                },
                { 
                  title: isRTL ? 'مناهج موحّدة' : 'Unified Curriculum', 
                  desc: isRTL ? 'تخطيط دروس مدعوم بالـ AI' : 'Lesson planning powered by AI',
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                       <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20"/>
                       <path d="M6.5 2H20V20H6.5C5.83696 20 5.20107 19.7366 4.73223 19.2678C4.26339 18.7989 4 18.163 4 17.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z"/>
                       <path d="M16 8L12 12L10 10"/>
                    </svg>
                  ) 
                },
              ].map((feature, idx) => (
                <div key={idx} className="flex flex-row-reverse items-center justify-start gap-5 bg-[#251545] rounded-2xl p-5 border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] w-full">
                  <div className="w-[52px] h-[52px] bg-[#4c278a] rounded-xl flex items-center justify-center text-white border border-white/5 shadow-none flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div className="flex-1 text-right flex flex-col justify-center">
                     <h4 className="text-white text-lg font-bold shadow-none m-0 text-right">
                        {feature.title}
                     </h4>
                     <p className="text-[#a092cd] text-sm font-medium mt-1">
                        {feature.desc}
                     </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[#fafafa] flex text-gray-900 font-sans relative">
      
      {/* Mobile Menu Toggle */}
      {activeView !== 'edit-profile' && (
        <div className={`lg:hidden fixed top-0 ${isRTL ? 'right-0' : 'left-0'} z-50 p-4`}>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      )}

      {/* M3 Navigation Drawer */}
      {activeView !== 'edit-profile' && (
        <aside className={`
          bg-[#f8f9fa] flex-shrink-0 flex flex-col fixed top-0 h-full z-40 transition-all duration-300 border-gray-100 overflow-hidden
          ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}
          ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : (isRTL ? 'translate-x-full w-[280px]' : '-translate-x-full w-[280px]')}
          lg:translate-x-0 lg:w-[280px]
        `}>
        <div className="w-full p-6 border-b border-slate-100 flex items-center justify-center">
          <img 
            src={taliaLogo} 
            alt="Talia 360" 
            className="w-40 max-w-[180px] object-contain block"
            onError={(e) => console.error("Logo failed to load:", e.currentTarget.src)}
          />
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 min-w-[280px]">
          {navItems.map((item) => {
            const isActive = activeView === item.view || item.subItems?.some(s => s.view === activeView);
            const isExactActive = activeView === item.view;
            const isExpanded = expandedNav[item.id];

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    setActiveView(item.view);
                    if (item.subItems) {
                      setExpandedNav(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                    } else {
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                    isExactActive 
                      ? 'bg-violet-100 text-violet-800' 
                      : isActive
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-6">
                      {item.icon}
                    </div>
                    <span className="transition-opacity duration-300 whitespace-nowrap">{isRTL ? item.labelAr : item.labelEn}</span>
                  </div>
                  {item.subItems && (
                    <div className="flex-shrink-0 text-slate-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </button>
                {item.subItems && isExpanded && (
                  <div 
                    className={`${isRTL ? 'text-right pr-4' : 'text-left pl-12'} space-y-1 mt-1`}
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    {item.subItems.map(sub => {
                      const isSubActive = activeView === sub.view;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setActiveView(sub.view);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                            isSubActive
                              ? 'bg-violet-100 text-violet-800'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <span className="whitespace-nowrap">{isRTL ? sub.labelAr : sub.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="p-4 min-w-[280px]">
          <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 flex items-center gap-3 mb-3">
             <div className="flex-shrink-0 flex items-center justify-center w-6 text-violet-700">
                <Activity size={20} className="animate-pulse" />
             </div>
             <div className="transition-opacity duration-300 whitespace-nowrap overflow-hidden">
               <span className="text-xs font-bold uppercase tracking-wider text-violet-700 block mb-1">System Live</span>
               <p className="text-[10px] text-violet-600 font-medium">v2.4.0 • Gemini 3.0</p>
             </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold shadow-none text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-6 text-inherit">
              <LogOut size={20} />
            </div>
            <span>{isRTL ? 'تسجيل الخروج' : 'Log Out'}</span>
          </button>
        </div>
      </aside>
      )}

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all w-full lg:w-auto ${activeView === 'edit-profile' ? '' : (isRTL ? 'lg:mr-[280px]' : 'lg:ml-[280px]')}`}>
        {activeView !== 'edit-profile' && (
          <Header 
            user={user} 
            language={language} 
            toggleLanguage={toggleLanguage}
            activeTitle={getActiveTitle()}
          />
        )}
        
        <main className={`flex-1 overflow-y-auto ${activeView === 'settings' || activeView === 'edit-profile' ? 'p-0' : 'p-4 md:p-8'}`}>
          <div className={`${activeView === 'settings' || activeView === 'edit-profile' ? 'w-full' : 'max-w-7xl mx-auto'} h-full`}>
            {renderContent()}
          </div>
        </main>
      </div>
      
      <ToastContainer />
      <ConfirmDialogContainer />
    </div>
  );
};

export default App;
