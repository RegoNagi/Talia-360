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
import { getStudents, getStudentById, updateStudent, getGuardianSummons, addGuardianSummon, GuardianSummon } from '../services/supabaseData';
import { showToast } from '../components/Toast';

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

  const refreshParents = () => {
    setIsLoading(true);
    getStudents().then((students) => {
      setParents(buildParentEntries(students));
      setIsLoading(false);
    });
  };
  useEffect(() => { refreshParents(); }, []);

  // ============ تعديل بيانات ولي الأمر ============
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [parentDraft, setParentDraft] = useState<Partial<ParentEntry>>({});
  const [isSavingParent, setIsSavingParent] = useState(false);

  const startEditingParent = (parent: ParentEntry) => {
    setParentDraft({ ...parent });
    setIsEditingParent(true);
  };

  const handleSaveParent = async () => {
    if (!selectedParent) return;
    setIsSavingParent(true);
    const fullStudent = await getStudentById(selectedParent.studentId);
    if (!fullStudent) {
      showToast(isRTL ? 'حصل خطأ أثناء جلب بيانات الطالب.' : 'Error fetching student data.', 'error');
      setIsSavingParent(false);
      return;
    }
    const infoKey = selectedParent.relationshipLabel === 'الأب' ? 'fatherInfo' : 'motherInfo';
    const updatedParentInfo = {
      ...(fullStudent as any)[infoKey],
      firstName: parentDraft.firstName,
      secondName: parentDraft.secondName,
      thirdName: parentDraft.thirdName,
      lastName: parentDraft.lastName,
      nationality: parentDraft.nationality,
      academicDegree: parentDraft.academicDegree,
      jobTitle: parentDraft.jobTitle,
      companyName: parentDraft.companyName,
      idNumber: parentDraft.idNumber,
      email: parentDraft.email,
      mobile: parentDraft.mobile,
      whatsapp: parentDraft.whatsapp,
    };
    const ok = await updateStudent({
      studentId: fullStudent.id,
      userId: (fullStudent as any).userId,
      name: fullStudent.name,
      grade: fullStudent.grade,
      dob: fullStudent.dob || '',
      status: fullStudent.status,
      fatherInfo: infoKey === 'fatherInfo' ? updatedParentInfo : fullStudent.fatherInfo,
      motherInfo: infoKey === 'motherInfo' ? updatedParentInfo : fullStudent.motherInfo,
      legalGuardian: fullStudent.legalGuardian,
      guardianRelationship: fullStudent.guardianRelationship,
      identityInfo: fullStudent.identityInfo,
      emergencyContact1: fullStudent.emergencyContact1,
      emergencyContact2: fullStudent.emergencyContact2,
      homeAddress: fullStudent.homeAddress,
      additionalInfo: fullStudent.additionalInfo,
    });
    setIsSavingParent(false);
    if (ok) {
      const fullName = [parentDraft.firstName, parentDraft.secondName, parentDraft.thirdName, parentDraft.lastName].filter(Boolean).join(' ');
      const updated = { ...selectedParent, ...parentDraft, fullName: fullName || selectedParent.fullName } as ParentEntry;
      setSelectedParent(updated);
      setIsEditingParent(false);
      refreshParents();
      showToast(isRTL ? 'تم حفظ البيانات بنجاح.' : 'Information saved successfully.', 'success');
    } else {
      showToast(isRTL ? 'حصل خطأ أثناء الحفظ.' : 'Error saving.', 'error');
    }
  };

  // ============ سجل استدعاءات ولي الأمر (من ملف الطالب المرتبط) ============
  const [summons, setSummons] = useState<GuardianSummon[]>([]);
  const [isLoadingSummons, setIsLoadingSummons] = useState(true);
  const [isAddingSummon, setIsAddingSummon] = useState(false);
  const [newSummon, setNewSummon] = useState({ summonDate: '', reason: '', outcome: '' });

  const refreshSummons = (studentId: string) => {
    setIsLoadingSummons(true);
    getGuardianSummons(studentId).then((rows) => { setSummons(rows); setIsLoadingSummons(false); });
  };

  const handleAddSummon = async () => {
    if (!selectedParent || !newSummon.summonDate) return;
    const ok = await addGuardianSummon(selectedParent.studentId, { ...newSummon, attendedBy: isRTL ? 'المشرف' : 'Admin' });
    if (ok) {
      setNewSummon({ summonDate: '', reason: '', outcome: '' });
      setIsAddingSummon(false);
      refreshSummons(selectedParent.studentId);
      showToast(isRTL ? 'تم تسجيل الاستدعاء.' : 'Summon recorded.', 'success');
    }
  };

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
    setIsEditingParent(false);
    refreshSummons(parent.studentId);
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

            {/* زرار التعديل */}
            <div className="flex justify-end">
              {isEditingParent ? (
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingParent(false)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  <button onClick={handleSaveParent} disabled={isSavingParent} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold">{isSavingParent ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}</button>
                </div>
              ) : (
                <button onClick={() => startEditingParent(selectedParent)} className="px-5 py-2.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 text-sm font-bold">{isRTL ? 'تعديل البيانات' : 'Edit Information'}</button>
              )}
            </div>

            {/* Card 1: Professional & Personal */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Briefcase className="text-violet-500" /> {t.profAndPersonal}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                {isEditingParent && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">{isRTL ? 'الاسم الأول' : 'First Name'}</p>
                      <input value={parentDraft.firstName || ''} onChange={(e) => setParentDraft({ ...parentDraft, firstName: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">{isRTL ? 'الاسم الأخير' : 'Last Name'}</p>
                      <input value={parentDraft.lastName || ''} onChange={(e) => setParentDraft({ ...parentDraft, lastName: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                  </>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.jobTitle}</p>
                  {isEditingParent ? <input value={parentDraft.jobTitle || ''} onChange={(e) => setParentDraft({ ...parentDraft, jobTitle: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium">{selectedParent.jobTitle || '—'}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.companyName}</p>
                  {isEditingParent ? <input value={parentDraft.companyName || ''} onChange={(e) => setParentDraft({ ...parentDraft, companyName: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium">{selectedParent.companyName || '—'}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><GraduationCap size={16} /> {t.academicDegree}</p>
                  {isEditingParent ? <input value={parentDraft.academicDegree || ''} onChange={(e) => setParentDraft({ ...parentDraft, academicDegree: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium">{selectedParent.academicDegree || '—'}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Globe size={16} /> {t.nationality}</p>
                  {isEditingParent ? <input value={parentDraft.nationality || ''} onChange={(e) => setParentDraft({ ...parentDraft, nationality: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium">{selectedParent.nationality || '—'}</p>}
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1.5"><CreditCard size={16} /> {t.nationalId}</p>
                  {isEditingParent ? <input value={parentDraft.idNumber || ''} onChange={(e) => setParentDraft({ ...parentDraft, idNumber: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" /> : <p className="text-slate-900 font-medium font-mono">{selectedParent.idNumber || '—'}</p>}
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
                  {isEditingParent ? <input value={parentDraft.mobile || ''} onChange={(e) => setParentDraft({ ...parentDraft, mobile: e.target.value })} dir="ltr" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium" dir="ltr">{selectedParent.mobile || '—'}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t.whatsapp}</p>
                  {isEditingParent ? <input value={parentDraft.whatsapp || ''} onChange={(e) => setParentDraft({ ...parentDraft, whatsapp: e.target.value })} dir="ltr" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium" dir="ltr">{selectedParent.whatsapp || '—'}</p>}
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-slate-500 mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</p>
                  {isEditingParent ? <input value={parentDraft.email || ''} onChange={(e) => setParentDraft({ ...parentDraft, email: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" /> : <p className="text-slate-900 font-medium">{selectedParent.email || '—'}</p>}
                </div>
              </div>
            </div>

            {/* Card 5: سجل استدعاءات ولي الأمر */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <User className="text-violet-500" /> {isRTL ? 'سجل الاستدعاءات' : 'Summons Log'}
                </h2>
                <button onClick={() => setIsAddingSummon(!isAddingSummon)} className="text-sm font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg">
                  {isRTL ? '+ تسجيل استدعاء' : '+ Record Summon'}
                </button>
              </div>
              {isAddingSummon && (
                <div className="p-4 bg-slate-50 rounded-2xl mb-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{isRTL ? 'تاريخ الاستدعاء' : 'Summon Date'}</label>
                    <input type="date" value={newSummon.summonDate} onChange={(e) => setNewSummon({ ...newSummon, summonDate: e.target.value })} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{isRTL ? 'سبب الاستدعاء' : 'Reason'}</label>
                    <textarea value={newSummon.reason} onChange={(e) => setNewSummon({ ...newSummon, reason: e.target.value })} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[60px]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{isRTL ? 'اللي تم في الاجتماع' : 'What Was Discussed'}</label>
                    <textarea value={newSummon.outcome} onChange={(e) => setNewSummon({ ...newSummon, outcome: e.target.value })} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500 min-h-[70px]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSummon} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold">{isRTL ? 'حفظ' : 'Save'}</button>
                    <button onClick={() => setIsAddingSummon(false)} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold">{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  </div>
                </div>
              )}
              {isLoadingSummons ? (
                <p className="text-center text-slate-400 text-sm py-6">{t.loading}</p>
              ) : summons.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">{isRTL ? 'مفيش استدعاءات مسجّلة لهذا الطالب.' : 'No summons recorded for this student.'}</p>
              ) : (
                <div className="space-y-2">
                  {summons.map(s => (
                    <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-500">{s.summonDate}</p>
                      {s.reason && <p className="text-sm font-bold text-slate-900 mt-1">{s.reason}</p>}
                      {s.outcome && (
                        <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{isRTL ? 'اللي تم' : 'Outcome'}</p>
                          <p className="text-sm text-slate-700">{s.outcome}</p>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 mt-2">{s.attendedBy}</p>
                    </div>
                  ))}
                </div>
              )}
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
