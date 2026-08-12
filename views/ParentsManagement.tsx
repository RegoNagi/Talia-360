import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Mail,
  Briefcase,
  GraduationCap,
  Globe,
  CreditCard,
  User,
  CheckCircle2,
  XCircle,
  Search,
  ChevronRight
} from 'lucide-react';
import { getStudents } from '../services/supabaseData';

// كل "ولي أمر" هنا مشتق من بيانات طالب حقيقي (father_info أو mother_info)
// مفيش جدول أولياء أمور منفصل — البيانات دايمًا مربوطة بملف الطالب
interface ParentEntry {
  studentId: string;
  studentName: string;
  studentGrade: string;
  relationshipLabel: string; // 'الأب' أو 'الأم'
  isDeceased: boolean;
  firstName: string;
  secondName: string;
  thirdName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  academicDegree: string;
  jobTitle: string;
  companyName: string;
  idNumber: string;
  email: string;
  mobile: string;
  whatsapp: string;
  legalGuardian: string;
  guardianRelationship: string;
}

function buildParentEntries(students: any[]): ParentEntry[] {
  const entries: ParentEntry[] = [];
  students.forEach((s) => {
    (['fatherInfo', 'motherInfo'] as const).forEach((key) => {
      const info = s[key];
      if (!info || !(info.firstName || info.lastName)) return; // مفيش بيانات كافية لعرضه كولي أمر
      const fullName = [info.firstName, info.secondName, info.thirdName, info.lastName].filter(Boolean).join(' ');
      entries.push({
        studentId: s.id,
        studentName: s.name,
        studentGrade: s.grade,
        relationshipLabel: key === 'fatherInfo' ? 'الأب' : 'الأم',
        isDeceased: !!info.deceased,
        firstName: info.firstName || '',
        secondName: info.secondName || '',
        thirdName: info.thirdName || '',
        lastName: info.lastName || '',
        fullName: fullName || (key === 'fatherInfo' ? 'الأب' : 'الأم'),
        nationality: info.nationality || '',
        academicDegree: info.academicDegree || '',
        jobTitle: info.jobTitle || '',
        companyName: info.companyName || '',
        idNumber: info.idNumber || '',
        email: info.email || '',
        mobile: info.mobile || '',
        whatsapp: info.whatsapp || '',
        legalGuardian: s.legalGuardian || '',
        guardianRelationship: s.guardianRelationship || '',
      });
    });
  });
  return entries;
}

export const ParentsManagement = ({ isRTL = false }: { isRTL?: boolean }) => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [selectedParent, setSelectedParent] = useState<ParentEntry | null>(null);
  const [parents, setParents] = useState<ParentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getStudents().then((students) => {
      setParents(buildParentEntries(students));
      setIsLoading(false);
    });
  }, []);

  const t = {
    searchParents: isRTL ? 'البحث عن أولياء الأمور...' : 'Search parents...',
    name: isRTL ? 'الاسم' : 'Name',
    contact: isRTL ? 'معلومات الاتصال' : 'Contact',
    children: isRTL ? 'الابن/الابنة' : 'Child',
    status: isRTL ? 'الحالة' : 'Status',
    actions: isRTL ? 'الإجراءات' : 'Actions',
    active: isRTL ? 'نشط' : 'Active',
    inactive: isRTL ? 'متوفى' : 'Deceased',
    back: isRTL ? 'العودة للدليل' : 'Back to Directory',
    profAndPersonal: isRTL ? 'المعلومات المهنية والشخصية' : 'Professional & Personal',
    jobTitle: isRTL ? 'المسمى الوظيفي' : 'Job Title',
    companyName: isRTL ? 'اسم الشركة' : 'Company Name',
    academicDegree: isRTL ? 'الدرجة العلمية' : 'Academic Degree',
    nationality: isRTL ? 'الجنسية' : 'Nationality',
    nationalId: isRTL ? 'الرقم القومي' : 'National ID',
    contactInfo: isRTL ? 'معلومات الاتصال' : 'Contact Information',
    mobile: isRTL ? 'رقم الهاتف المتنقل' : 'Mobile Number',
    whatsapp: isRTL ? 'رقم الواتساب' : 'WhatsApp Number',
    linkedStudents: isRTL ? 'الطالب المرتبط' : 'Linked Student',
    legalGuardianInfo: isRTL ? 'ولي الأمر القانوني المسجّل' : 'Registered Legal Guardian',
    noData: isRTL ? 'لسه مفيش بيانات أولياء أمور مسجّلة. تُضاف من صفحة تعديل بيانات الطالب.' : 'No parent data yet. Add it from the student edit form.',
    loading: isRTL ? 'جاري التحميل...' : 'Loading...',
  };

  const filteredParents = parents.filter((p) =>
    !search.trim() ||
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.studentName.toLowerCase().includes(search.toLowerCase())
  );

  const handleViewProfile = (parent: ParentEntry) => {
    setSelectedParent(parent);
    setView('details');
  };

  const handleBack = () => {
    setSelectedParent(null);
    setView('list');
  };

  if (isLoading) {
    return <div className="p-10 text-center text-slate-400">{t.loading}</div>;
  }

  // --- View 1: Parent Directory (List View) ---
  if (view === 'list') {
    return (
      <div className="space-y-6 animate-fadeIn" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
           <div className="relative flex-1 max-w-md">
              <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-4' : 'left-4'}`} size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchParents}
                className={`w-full border border-slate-200 bg-slate-50 rounded-full py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none ${isRTL ? 'pr-11 pl-5' : 'pl-11 pr-5'}`}
              />
           </div>
        </div>

        {filteredParents.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center text-slate-400">
            {t.noData}
          </div>
        ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="overflow-x-auto">
           <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
             <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
               <tr>
                 <th className="px-8 py-5">{t.name}</th>
                 <th className="px-6 py-5">{t.contact}</th>
                 <th className="px-6 py-5">{t.children}</th>
                 <th className="px-6 py-5">{t.status}</th>
                 <th className="px-6 py-5">{t.actions}</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
               {filteredParents.map((parent, i) => (
                 <tr key={`${parent.studentId}-${parent.relationshipLabel}-${i}`} onClick={() => handleViewProfile(parent)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                   <td className="px-8 py-5">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-sm">
                         {parent.fullName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}
                       </div>
                       <div>
                         <p className="font-bold text-slate-900">{parent.fullName}</p>
                         <p className="text-xs text-slate-400">{parent.relationshipLabel}</p>
                       </div>
                     </div>
                   </td>
                   <td className="px-6 py-5">
                     <div className="flex flex-col gap-1 text-slate-500">
                       {parent.email && <span className="flex items-center gap-1"><Mail size={12}/> {parent.email}</span>}
                       {parent.mobile && <span className="flex items-center gap-1"><Phone size={12}/> {parent.mobile}</span>}
                       {!parent.email && !parent.mobile && <span className="text-slate-300">—</span>}
                     </div>
                   </td>
                   <td className="px-6 py-5">
                     <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200">
                       {parent.studentName}
                     </span>
                   </td>
                   <td className="px-6 py-5">
                     <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                       !parent.isDeceased
                         ? 'bg-green-50 text-green-700 border-green-100'
                         : 'bg-slate-50 text-slate-600 border-slate-100'
                     }`}>
                       {!parent.isDeceased ? t.active : t.inactive}
                     </span>
                   </td>
                   <td className="px-6 py-5">
                     <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                       <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
                     </button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
       )}
     </div>
    );
  }

  // --- View 2: Parent Details Profile ---
  if (view === 'details' && selectedParent) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10" dir={isRTL ? "rtl" : "ltr"}>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors mb-4"
        >
          <ArrowLeft size={20} className={isRTL ? "rotate-180" : ""} /> {t.back}
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md">
              {selectedParent.fullName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{selectedParent.fullName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                  <User size={14} className={isRTL ? "ml-1.5" : "mr-1.5"} /> {selectedParent.relationshipLabel}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${!selectedParent.isDeceased ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                  {!selectedParent.isDeceased ? <CheckCircle2 size={14} className={isRTL ? "ml-1.5" : "mr-1.5"} /> : <XCircle size={14} className={isRTL ? "ml-1.5" : "mr-1.5"} />}
                  {!selectedParent.isDeceased ? t.active : t.inactive}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CSS Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Card 1: Professional & Personal */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Briefcase className="text-violet-500" /> {t.profAndPersonal}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.jobTitle}</p>
                  <p className="text-slate-900 font-medium">{selectedParent.jobTitle || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.companyName}</p>
                  <p className="text-slate-900 font-medium">{selectedParent.companyName || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><GraduationCap size={16} /> {t.academicDegree}</p>
                  <p className="text-slate-900 font-medium">{selectedParent.academicDegree || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Globe size={16} /> {t.nationality}</p>
                  <p className="text-slate-900 font-medium">{selectedParent.nationality || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><CreditCard size={16} /> {t.nationalId}</p>
                  <p className="text-slate-900 font-medium font-mono">{selectedParent.idNumber || '—'}</p>
                </div>
              </div>
            </div>

            {/* Card 2: Contact Info */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Phone className="text-violet-500" /> {t.contactInfo}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.mobile}</p>
                  <p className="text-slate-900 font-medium" dir="ltr">{selectedParent.mobile || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.whatsapp}</p>
                  <p className="text-slate-900 font-medium" dir="ltr">{selectedParent.whatsapp || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-slate-500 mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</p>
                  <p className="text-slate-900 font-medium">{selectedParent.email || '—'}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Card 3: Linked Student */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="text-violet-500" /> {t.linkedStudents}
              </h2>
              <div className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 bg-slate-50">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedParent.studentName)}&background=random`} alt={selectedParent.studentName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm">{selectedParent.studentName}</h3>
                  <p className="text-xs text-slate-500">{selectedParent.studentGrade}</p>
                </div>
              </div>
            </div>

            {/* Card 4: Legal Guardian info, if registered */}
            {selectedParent.legalGuardian && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 mb-3">{t.legalGuardianInfo}</h2>
                <p className="text-slate-900 font-medium">{selectedParent.legalGuardian}</p>
                {selectedParent.guardianRelationship && <p className="text-sm text-slate-500 mt-1">{selectedParent.guardianRelationship}</p>}
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  return null;
};
