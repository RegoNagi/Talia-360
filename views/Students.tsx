import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CLASSES } from '../services/mockData';
import { getStudents, getTeachers, createTeacher, createStudent, updateTeacher, deleteTeacher, updateStudent, deleteStudent, bulkDeleteStudents, bulkDeleteTeachers, getAdmins, createAdmin, updateAdmin, deleteAdmin, bulkDeleteAdmins, getGradeLevels, getAllCurriculumSubjectsWithGrade } from '../services/supabaseData';
import { showToast } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { Language, Student, Teacher, Admin, Parent, UserRole } from '../types';
import { ParentsManagement } from './ParentsManagement';
import { StudentProfile } from './StudentProfile';
import { Button } from '../components/Button';
import { Step2 } from '../components/steps/Step2';
import { 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  User, 
  GraduationCap, 
  Briefcase, 
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  MoreVertical,
  Calendar,
  Mail,
  Phone,
  Lock,
  Download,
  Settings,
  X,
  ToggleLeft,
  ToggleRight,
  Users,
  LayoutTemplate
} from 'lucide-react';

import { useEffect } from 'react';

interface UserManagementProps {
  language: Language;
  role: UserRole;
  onEditProfile?: (studentId: string) => void;
  activeTabProp?: 'students' | 'parents' | 'teachers' | 'admins';
  onTabChange?: (tab: 'students' | 'parents' | 'teachers' | 'admins') => void;
  permissions?: string[];
}

// كتالوج الصلاحيات — بيغطي كل موديول رئيسي في النظام بتفاصيله
const PERMISSION_GROUPS = [
   {
      category: 'إدارة المستخدمين (Users)',
      perms: [
         { id: 'users_view', label: 'عرض قائمة المستخدمين' },
         { id: 'users_create', label: 'إنشاء وتعديل المستخدمين' },
         { id: 'users_delete', label: 'حذف المستخدمين' },
         { id: 'users_bulk', label: 'إجراءات جماعية (حذف/استيراد جماعي)' },
         { id: 'users_reset', label: 'إعادة تعيين كلمات المرور' },
         { id: 'users_roles', label: 'إدارة الأدوار والصلاحيات (إنشاء/تعديل إداريين)' },
      ]
   },
   {
      category: 'الحضور والغياب (Attendance)',
      perms: [
         { id: 'attendance_view', label: 'عرض سجلات الحضور' },
         { id: 'attendance_take', label: 'تسجيل الحضور والغياب' },
         { id: 'attendance_edit_past', label: 'تعديل سجلات حضور سابقة' },
         { id: 'attendance_settings', label: 'إعدادات نظام الحضور (يومي/حصص)' },
         { id: 'attendance_reports', label: 'تقارير وتحليلات الحضور' },
      ]
   },
   {
      category: 'الدرجات والتقييم (Grading)',
      perms: [
         { id: 'grades_view', label: 'عرض الدرجات' },
         { id: 'grades_enter', label: 'إدخال وتعديل الدرجات' },
         { id: 'grades_approve', label: 'اعتماد ونشر الدرجات' },
         { id: 'grades_settings', label: 'إعداد نظام التقييم (الفئات والأوزان)' },
         { id: 'grades_reports', label: 'تقارير الدرجات وبطاقات التقرير' },
         { id: 'grades_supervise', label: 'مراقبة رصد الدرجات عبر الفصول' },
      ]
   },
   {
      category: 'لوحة التحكم (Dashboard)',
      perms: [
         { id: 'dashboard_view', label: 'عرض لوحة التحكم الرئيسية' },
         { id: 'dashboard_financial_widgets', label: 'عرض البيانات المالية في اللوحة' },
         { id: 'dashboard_export', label: 'تصدير تقارير من اللوحة' },
      ]
   },
   {
      category: 'المنهج الدراسي (Curriculum)',
      perms: [
         { id: 'curriculum_view', label: 'عرض المنهج الدراسي' },
         { id: 'curriculum_edit', label: 'تعديل وإدارة المنهج' },
         { id: 'curriculum_library', label: 'إدارة مكتبة المحتوى والموارد' },
         { id: 'curriculum_lesson_plans', label: 'إدارة خطط الدروس' },
      ]
   },
   {
      category: 'الفصول والجدول (Classes & Schedule)',
      perms: [
         { id: 'classes_view', label: 'عرض الفصول' },
         { id: 'classes_manage', label: 'إنشاء وتعديل وحذف الفصول' },
         { id: 'schedule_manage', label: 'إدارة الحصص والجدول الزمني' },
      ]
   },
   {
      category: 'الشؤون المالية (Finance)',
      perms: [
         { id: 'fin_view', label: 'عرض البيانات المالية' },
         { id: 'fin_manage', label: 'إدارة الرسوم والمصروفات' },
      ]
   },
   {
      category: 'بنك الأسئلة (Question Bank)',
      perms: [
         { id: 'qb_manage', label: 'إدارة بنك الأسئلة (إضافة/تعديل/حذف/تنظيم)' },
         { id: 'qb_approve', label: 'مراجعة واعتماد الأسئلة المقترحة' },
         { id: 'qb_analytics', label: 'عرض تحليلات بنك الأسئلة' },
      ]
   },
   {
      category: 'النظام (System)',
      perms: [
         { id: 'sys_settings', label: 'الإعدادات العامة' },
         { id: 'sys_logs', label: 'عرض سجلات التدقيق' },
      ]
   }
];

const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.id));

const ADMIN_TEMPLATES: Record<string, string[]> = {
    'Super Admin': ALL_PERMISSION_IDS,
    'Academic Manager': ['curriculum_view', 'curriculum_edit', 'curriculum_library', 'curriculum_lesson_plans', 'classes_view', 'classes_manage', 'schedule_manage', 'grades_view', 'grades_approve', 'grades_reports', 'grades_supervise', 'dashboard_view', 'users_view'],
    'مشرف مرحلة': ['classes_view', 'attendance_view', 'attendance_reports', 'grades_view', 'grades_supervise', 'grades_reports', 'dashboard_view'],
    'Registrar': ['users_view', 'users_create', 'users_reset', 'classes_view', 'classes_manage', 'attendance_view', 'attendance_reports', 'dashboard_view'],
    'Finance Officer': ['fin_view', 'fin_manage', 'dashboard_view', 'dashboard_financial_widgets'],
    'IT Support': ['sys_settings', 'sys_logs', 'users_reset', 'users_view'],
    'مشرف بنك الأسئلة': ['qb_manage', 'qb_approve', 'qb_analytics', 'dashboard_view']
};

// (الصفوف الدراسية بقت بتتجاب حقيقي من قاعدة البيانات، مش قايمة ثابتة هنا)
// (المواد بقت بتتجاب حقيقي من قاعدة البيانات، مش قايمة ثابتة هنا)

// ملاحظة مهمة: المودالات دي معمولة كـ component مستقل بحالته الخاصة (مش state جوه الصفحة الرئيسية)،
// عشان لما تكتب جوه المودال، بس المودال نفسه يعيد الرسم — مش الصفحة اللي وراه كلها.
// ده اللي بيمنع اهتزاز الخلفية اللي كان بيحصل قبل كده مع كل حرف بتكتبه.

const AddStudentModal: React.FC<{ gradeLevels: string[]; onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ gradeLevels, onClose, onSubmit }) => {
  const [form, setForm] = useState({ firstName: '', secondName: '', thirdName: '', lastName: '', grade: 'الصف 10', dob: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="text-xl font-bold text-gray-900">تسجيل طالب جديد</h3>
               <p className="text-sm text-gray-500">Add a single student record to the system.</p>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-4">
                   <label className="block text-sm font-bold text-gray-700 mb-2">Student Name</label>
                </div>
                <div>
                   <input type="text" placeholder="First" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <input type="text" placeholder="Second" value={form.secondName} onChange={(e) => setForm({...form, secondName: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <input type="text" placeholder="Third" value={form.thirdName} onChange={(e) => setForm({...form, thirdName: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <input type="text" placeholder="Last" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2">Grade Level</label>
                   <select value={form.grade} onChange={(e) => setForm({...form, grade: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                     {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                   </select>
                </div>
                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                   <input type="date" value={form.dob} onChange={(e) => setForm({...form, dob: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2">الإيميل (لتسجيل الدخول في Talia Learn)</label>
                   <input type="email" placeholder="student@school.com" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
                   <input type="text" placeholder="اكتب كلمة مرور" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
             </div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الإنشاء...' : 'Create Student'}</Button>
          </div>
       </div>
    </div>
  );
};

const AddTeacherModal: React.FC<{ gradeLevels: string[]; subjectOptions: string[]; onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ gradeLevels, subjectOptions, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', hiringDate: new Date().toISOString().split('T')[0], type: 'Full-time',
    subjects: [] as string[], allSubjects: false, grades: [] as string[], teacherType: 'Main' as 'Main' | 'Assistant',
    canUseQuestionBank: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGrade = (grade: string) => setForm(prev => ({ ...prev, grades: prev.grades.includes(grade) ? prev.grades.filter(g => g !== grade) : [...prev.grades, grade] }));
  const toggleSubject = (subject: string) => setForm(prev => ({ ...prev, allSubjects: false, subjects: prev.subjects.includes(subject) ? prev.subjects.filter(s => s !== subject) : [...prev.subjects, subject] }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="text-xl font-bold text-gray-900">إضافة عضو هيئة تدريس</h3>
               <p className="text-sm text-gray-500">Create a new teacher profile and assign subjects.</p>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                <input type="text" placeholder="e.g. Sarah Al-Majed" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                <input type="email" placeholder="teacher@school.edu" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور (لتسجيل الدخول في Talia Learn)</label>
                <input type="text" placeholder="اكتب كلمة مرور" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Hiring Date</label>
                <input type="date" value={form.hiringDate} onChange={(e) => setForm({...form, hiringDate: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Employment Type</label>
                <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value as any})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع المعلم</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({...form, teacherType: 'Main'})} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${form.teacherType === 'Main' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>مدرس رئيسي</button>
                  <button type="button" onClick={() => setForm({...form, teacherType: 'Assistant'})} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${form.teacherType === 'Assistant' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>مدرس مساعد</button>
                </div>
             </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">المواد اللي بيدرّسها</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({...form, allSubjects: !form.allSubjects, subjects: []})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.allSubjects ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>كل المواد</button>
                  {subjectOptions.map(subject => (
                    <button type="button" key={subject} disabled={form.allSubjects} onClick={() => toggleSubject(subject)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${form.subjects.includes(subject) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{subject}</button>
                  ))}
                </div>
                {form.allSubjects && <p className="text-xs text-slate-400 mt-1">هيدرّس كل مواد الفصل (مناسب لمدرس فصل ابتدائي مثلًا).</p>}
             </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الصفوف اللي بيدرّس فيها (تقدر تختار أكتر من صف)</label>
                <div className="flex flex-wrap gap-2">
                  {gradeLevels.map(grade => (
                    <button type="button" key={grade} onClick={() => toggleGrade(grade)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.grades.includes(grade) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{grade}</button>
                  ))}
                </div>
             </div>
             <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={form.canUseQuestionBank} onChange={(e) => setForm({...form, canUseQuestionBank: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <span className="text-sm font-bold text-gray-700">يقدر يستخدم بنك الأسئلة (إضافة أسئلة بس، مش إدارة أو اعتماد)</span>
                </label>
             </div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الإنشاء...' : 'Create Teacher'}</Button>
          </div>
       </div>
    </div>
  );
};

const EditTeacherModal: React.FC<{ teacher: any; gradeLevels: string[]; subjectOptions: string[]; onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ teacher, gradeLevels, subjectOptions, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: teacher.name || '',
    email: teacher.email || '',
    password: '',
    type: teacher.employmentType || 'Full-time',
    subjects: teacher.subjects || [],
    allSubjects: (teacher.subjects || []).length >= subjectOptions.length,
    grades: teacher.grades || [],
    teacherType: teacher.teacherType || 'Main',
    canUseQuestionBank: teacher.canUseQuestionBank || false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGrade = (grade: string) => setForm(prev => ({ ...prev, grades: prev.grades.includes(grade) ? prev.grades.filter((g: string) => g !== grade) : [...prev.grades, grade] }));
  const toggleSubject = (subject: string) => setForm(prev => ({ ...prev, allSubjects: false, subjects: prev.subjects.includes(subject) ? prev.subjects.filter((s: string) => s !== subject) : [...prev.subjects, subject] }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-bold text-gray-900">تعديل بيانات المعلم</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">كلمة مرور جديدة (سيبها فاضية لو مش عايز تغيّرها)</label>
                <input type="text" placeholder="•••••••" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع التوظيف</label>
                <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value as any})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع المعلم</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({...form, teacherType: 'Main'})} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${form.teacherType === 'Main' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>مدرس رئيسي</button>
                  <button type="button" onClick={() => setForm({...form, teacherType: 'Assistant'})} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold border transition-all ${form.teacherType === 'Assistant' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>مدرس مساعد</button>
                </div>
             </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">المواد اللي بيدرّسها</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({...form, allSubjects: !form.allSubjects, subjects: []})} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.allSubjects ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>كل المواد</button>
                  {subjectOptions.map(subject => (
                    <button type="button" key={subject} disabled={form.allSubjects} onClick={() => toggleSubject(subject)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${form.subjects.includes(subject) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{subject}</button>
                  ))}
                </div>
             </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الصفوف اللي بيدرّس فيها</label>
                <div className="flex flex-wrap gap-2">
                  {gradeLevels.map(grade => (
                    <button type="button" key={grade} onClick={() => toggleGrade(grade)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${form.grades.includes(grade) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{grade}</button>
                  ))}
                </div>
             </div>
             <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={form.canUseQuestionBank} onChange={(e) => setForm({...form, canUseQuestionBank: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <span className="text-sm font-bold text-gray-700">يقدر يستخدم بنك الأسئلة (إضافة أسئلة بس، مش إدارة أو اعتماد)</span>
                </label>
             </div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
          </div>
       </div>
    </div>
  );
};

// بيحوّل ParentInfo (اللي جايه من قاعدة البيانات) لشكل الحقول المفرودة اللي فورم Step2 عايزه (fatherFirstName, fatherEmail, إلخ)
function parentInfoToFormFields(prefix: 'father' | 'mother', info: any) {
  if (!info) return {};
  return {
    [`${prefix}FirstName`]: info.firstName || '',
    [`${prefix}SecondName`]: info.secondName || '',
    [`${prefix}ThirdName`]: info.thirdName || '',
    [`${prefix}LastName`]: info.lastName || '',
    [`${prefix}Nationality`]: info.nationality || '',
    [`${prefix}SecondNationality`]: info.secondNationality || '',
    [`${prefix}IdNumber`]: info.idNumber || '',
    [`${prefix}AcademicDegree`]: info.academicDegree || '',
    [`${prefix}Marital`]: info.marital || '',
    [`${prefix}EmploymentStatus`]: info.employmentStatus || '',
    [`${prefix}JobTitle`]: info.jobTitle || '',
    [`${prefix}CompanyName`]: info.companyName || '',
    [`${prefix}Email`]: info.email || '',
    [`${prefix}Mobile`]: info.mobile || '',
    [`${prefix}Whatsapp`]: info.whatsapp || '',
    [`${prefix}Deceased`]: info.deceased || false,
  };
}

const EditStudentModal: React.FC<{ student: any; gradeLevels: string[]; onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ student, gradeLevels, onClose, onSubmit }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'family'>('basic');
  const [form, setForm] = useState({
    name: student.name || '',
    grade: student.grade || 'الصف 10',
    dob: student.dob || '',
    status: student.status || 'Active',
    email: student.email || '',
    password: '',
    legalGuardian: student.legalGuardian || '',
    guardianRelationship: student.guardianRelationship || '',
    ...parentInfoToFormFields('father', student.fatherInfo),
    ...parentInfoToFormFields('mother', student.motherInfo),
  } as any);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-bold text-gray-900">تعديل بيانات الطالب</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>

          <div className="flex gap-2 mb-6 border-b border-gray-100">
             <button onClick={() => setActiveTab('basic')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'basic' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>البيانات الأساسية</button>
             <button onClick={() => setActiveTab('family')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'family' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>بيانات الأسرة</button>
          </div>

          {activeTab === 'basic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الصف الدراسي</label>
                <select value={form.grade} onChange={(e) => setForm({...form, grade: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الميلاد</label>
                <input type="date" value={form.dob} onChange={(e) => setForm({...form, dob: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الحالة</label>
                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  <option value="Active">نشط</option>
                  <option value="At Risk">في خطر</option>
                  <option value="Inactive">غير نشط</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الإيميل (لتسجيل الدخول في Talia Learn)</label>
                <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">كلمة مرور جديدة (سيبها فاضية لو مش عايز تغيّرها)</label>
                <input type="text" placeholder="•••••••" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
             </div>
          </div>
          )}

          {activeTab === 'family' && (
          <div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">ولي الأمر القانوني</label>
                   <input type="text" value={form.legalGuardian} onChange={(e) => updateForm('legalGuardian', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" placeholder="اسم ولي الأمر" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">صلة القرابة بالطفل</label>
                   <input type="text" value={form.guardianRelationship} onChange={(e) => updateForm('guardianRelationship', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" placeholder="مثال: الأب" />
                </div>
             </div>
             <Step2 formData={form} updateForm={updateForm} />
          </div>
          )}

          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
          </div>
       </div>
    </div>
  );
};

const DEPARTMENT_OPTIONS = ['Administration', 'Academics', 'Admissions', 'Finance', 'IT Support'];

const PermissionsPicker: React.FC<{ permissions: string[]; onToggle: (id: string) => void }> = ({ permissions, onToggle }) => (
  <div className="space-y-6 h-[400px] overflow-y-auto pr-2">
    {PERMISSION_GROUPS.map((group) => (
      <div key={group.category}>
        <p className="text-xs font-bold text-gray-500 uppercase mb-3 sticky top-0 bg-gray-50 py-1">{group.category}</p>
        <div className="space-y-2">
          {group.perms.map((perm) => (
            <div key={perm.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-sm font-medium text-gray-700">{perm.label}</span>
              <button onClick={() => onToggle(perm.id)} className={`transition-colors ${permissions.includes(perm.id) ? 'text-green-500' : 'text-gray-300'}`}>
                {permissions.includes(perm.id) ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const AddAdminModal: React.FC<{ onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ onClose, onSubmit }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', title: '', department: 'Administration', permissions: [] as string[] });
  const [selectedTemplate, setSelectedTemplate] = useState('Custom');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
    if (template !== 'Custom' && ADMIN_TEMPLATES[template]) {
      setForm(prev => ({ ...prev, permissions: ADMIN_TEMPLATES[template], title: prev.title || template }));
    }
  };

  const togglePermission = (id: string) => {
    setForm(prev => ({ ...prev, permissions: prev.permissions.includes(id) ? prev.permissions.filter(p => p !== id) : [...prev.permissions, id] }));
    setSelectedTemplate('Custom');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="text-xl font-bold text-gray-900">تكوين مسؤول</h3>
               <p className="text-sm text-gray-500">Assign role-based access control (RBAC) permissions.</p>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
             <div className="flex-1 space-y-4">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Role Template</label>
                   <div className="relative">
                      <select value={selectedTemplate} onChange={(e) => handleTemplateChange(e.target.value)} className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 appearance-none font-medium">
                         <option value="Custom">Custom Configuration</option>
                         {Object.keys(ADMIN_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <LayoutTemplate size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                   </div>
                </div>
                <hr className="border-gray-100" />
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                   <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                   <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور (لتسجيل الدخول)</label>
                   <input type="text" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Role Title</label>
                   <input type="text" placeholder="e.g. Registrar" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Department</label>
                   <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      {DEPARTMENT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                   </select>
                </div>
             </div>
             <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-gray-900 flex items-center gap-2"><Lock size={16}/> Access Permissions</h4>
                   <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-1 rounded-md">{form.permissions.length} Active</span>
                </div>
                <PermissionsPicker permissions={form.permissions} onToggle={togglePermission} />
             </div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الإنشاء...' : 'إنشاء مسؤول'}</Button>
          </div>
       </div>
    </div>
  );
};

const EditAdminModal: React.FC<{ admin: any; onClose: () => void; onSubmit: (data: any) => Promise<boolean> }> = ({ admin, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    name: admin.name || '', email: admin.email || '', title: admin.title || '',
    department: admin.department || 'Administration', permissions: admin.permissions || [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePermission = (id: string) => {
    setForm(prev => ({ ...prev, permissions: prev.permissions.includes(id) ? prev.permissions.filter((p: string) => p !== id) : [...prev.permissions, id] }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    const ok = await onSubmit(form);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
       <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-bold text-gray-900">تعديل بيانات الإداري</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
             <div className="flex-1 space-y-4">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل</label>
                   <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">البريد الإلكتروني</label>
                   <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">المسمى الوظيفي</label>
                   <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">القسم</label>
                   <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      {DEPARTMENT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                   </select>
                </div>
             </div>
             <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="font-bold text-gray-900 flex items-center gap-2"><Lock size={16}/> الصلاحيات</h4>
                   <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-1 rounded-md">{form.permissions.length} فعّالة</span>
                </div>
                <PermissionsPicker permissions={form.permissions} onToggle={togglePermission} />
             </div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
             <Button variant="secondary" className="flex-1" onClick={onClose}>إلغاء</Button>
             <Button variant="primary" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
          </div>
       </div>
    </div>
  );
};

export const UserManagement: React.FC<UserManagementProps> = ({ language, role, onEditProfile, activeTabProp = 'students', onTabChange, permissions = [] }) => {
  // لو مفيش صلاحيات محددة (زي أدوار الديمو القديمة) نسيبها مفتوحة زي ما كانت، عشان ميحصلش كسر مفاجئ
  const canManageUsers = permissions.length === 0 || permissions.includes('users_create');
  const canDeleteUsers = permissions.length === 0 || permissions.includes('users_delete');
  const isRTL = language === Language.AR;
  const [activeTab, setActiveTabInternal] = useState<'students' | 'parents' | 'teachers' | 'admins'>(activeTabProp);

  const setActiveTab = (tab: 'students' | 'parents' | 'teachers' | 'admins') => {
    setActiveTabInternal(tab);
    if (onTabChange) onTabChange(tab);
  };

  useEffect(() => {
    setActiveTabInternal(activeTabProp);
  }, [activeTabProp]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Data State (Lifted from constants to state to allow adding)
  // studentsList بيتم تحميلها الآن من قاعدة بيانات حقيقية (Supabase) بدل الـ mock data
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(true);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState<boolean>(true);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState<boolean>(true);
  const refreshAdmins = () => {
    setAdminsLoading(true);
    getAdmins().then((data) => {
      setAdminsList(data);
      setAdminsLoading(false);
    });
  };

  const refreshTeachers = () => {
    setTeachersLoading(true);
    getTeachers().then((data) => {
      setTeachersList(data);
      setTeachersLoading(false);
    });
  };

  const refreshStudents = () => {
    setStudentsLoading(true);
    getStudents().then((data) => {
      setStudentsList(data);
      setStudentsLoading(false);
    });
  };

  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);

  useEffect(() => {
    setStudentsLoading(true);
    setTeachersLoading(true);
    setAdminsLoading(true);
    Promise.all([getStudents(), getTeachers(), getAdmins(), getGradeLevels(), getAllCurriculumSubjectsWithGrade()]).then(([studentsData, teachersData, adminsData, gradesData, subjectsData]) => {
      setStudentsList(studentsData);
      setTeachersList(teachersData);
      setAdminsList(adminsData);
      setGradeLevels(gradesData.map(g => g.name));
      setSubjectOptions(Array.from(new Set(subjectsData.map(s => s.subject))));
      setStudentsLoading(false);
      setTeachersLoading(false);
      setAdminsLoading(false);
    });
  }, []);

  // Modal States
  const [uploadModalType, setUploadModalType] = useState<'student' | 'teacher' | null>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  const closeImportModal = () => {
    setUploadModalType(null);
    setImportRows([]);
    setImportFileName('');
    setImportResults(null);
  };

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportFileName(file.name);
    setImportResults(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
        setImportRows(rows);
      } catch (err) {
        showToast('حصل خطأ أثناء قراءة الملف. تأكد إنه ملف Excel أو CSV صحيح.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const headers = uploadModalType === 'student'
      ? ['الاسم بالكامل', 'الصف', 'تاريخ الميلاد (YYYY-MM-DD)', 'الإيميل', 'كلمة المرور']
      : ['الاسم بالكامل', 'التخصص', 'نوع التوظيف', 'نوع المعلم (Main/Assistant)', 'الإيميل', 'كلمة المرور'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, uploadModalType === 'student' ? 'قالب_استيراد_طلاب.xlsx' : 'قالب_استيراد_معلمين.xlsx');
  };

  const handleStartImport = async () => {
    if (importRows.length === 0) return;
    setIsImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of importRows) {
      if (uploadModalType === 'student') {
        const name = row['الاسم بالكامل'] || row['الاسم'] || row['Name'] || '';
        const grade = row['الصف'] || row['Grade'] || (gradeLevels[0] || '');
        const dob = row['تاريخ الميلاد (YYYY-MM-DD)'] || row['تاريخ الميلاد'] || row['DOB'] || '';
        const email = row['الإيميل'] || row['Email'] || '';
        const password = row['كلمة المرور'] || row['Password'] || '';
        if (!name.trim() || !grade.trim()) { failed++; continue; }
        const id = await createStudent({ name: name.trim(), grade: grade.trim(), dob: dob.toString().trim(), email: email.toString().trim(), password: password.toString().trim() });
        id ? success++ : failed++;
      } else {
        const name = row['الاسم بالكامل'] || row['الاسم'] || row['Name'] || '';
        const specialization = row['التخصص'] || row['Specialization'] || '';
        const employmentType = row['نوع التوظيف'] || row['Employment Type'] || 'Full-time';
        const teacherType = (row['نوع المعلم (Main/Assistant)'] || row['نوع المعلم'] || 'Main').toString().trim() as 'Main' | 'Assistant';
        const email = row['الإيميل'] || row['Email'] || '';
        const password = row['كلمة المرور'] || row['Password'] || '';
        if (!name.trim()) { failed++; continue; }
        const id = await createTeacher({
          name: name.trim(),
          email: email.toString().trim(),
          password: password.toString().trim(),
          hiringDate: new Date().toISOString().split('T')[0],
          employmentType: employmentType.toString().trim(),
          subjects: [],
          allSubjects: false,
          grades: [],
          teacherType: teacherType === 'Assistant' ? 'Assistant' : 'Main',
        });
        id ? success++ : failed++;
      }
    }
    setIsImporting(false);
    setImportResults({ success, failed });
    if (uploadModalType === 'student') refreshStudents(); else refreshTeachers();
    showToast(`تم استيراد ${success} بنجاح${failed > 0 ? ` (وفشل ${failed})` : ''}.`, success > 0 ? 'success' : 'error');
  };

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);

  // --- Form States ---

  // تعديل وحذف المعلمين
  const [openTeacherMenu, setOpenTeacherMenu] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const toggleSelectTeacher = (id: string) => {
    setSelectedTeacherIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // تعديل وحذف الطلاب
  const [openStudentMenu, setOpenStudentMenu] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAllStudents = () => {
    setSelectedStudentIds(prev => prev.length === filteredStudents.length ? [] : filteredStudents.map(s => s.id));
  };

  const handleUpdateTeacher = async (form: any): Promise<boolean> => {
    if (!editingTeacher) return false;
    const ok = await updateTeacher({
      teacherId: editingTeacher.id,
      userId: editingTeacher.userId,
      name: form.name,
      email: form.email,
      password: form.password,
      employmentType: form.type,
      subjects: form.subjects,
      allSubjects: form.allSubjects,
      grades: form.grades,
      teacherType: form.teacherType,
      canUseQuestionBank: form.canUseQuestionBank,
    });
    if (ok) {
      refreshTeachers();
      showToast('تم تعديل بيانات المعلم بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء تعديل المعلم.', 'error');
    }
    return ok;
  };

  const handleDeleteTeacher = async (teacher: any) => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح "${teacher.name}"؟ الإجراء ده مينفعش يترجع.`, 'حذف');
    if (!confirmed) return;
    const ok = await deleteTeacher(teacher.userId);
    if (ok) {
      refreshTeachers();
      showToast('تم حذف المعلم.', 'success');
    } else {
      showToast('حصل خطأ أثناء حذف المعلم.', 'error');
    }
  };

  const handleBulkDeleteTeachers = async () => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح ${selectedTeacherIds.length} معلم؟ الإجراء ده مينفعش يترجع.`, 'حذف الكل');
    if (!confirmed) return;
    const userIds = teachersList.filter(t => selectedTeacherIds.includes(t.id)).map(t => t.userId);
    const ok = await bulkDeleteTeachers(userIds);
    if (ok) {
      refreshTeachers();
      setSelectedTeacherIds([]);
      showToast('تم حذف المعلمين المحددين.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف الجماعي.', 'error');
    }
  };

  const handleUpdateStudent = async (form: any): Promise<boolean> => {
    if (!editingStudent) return false;
    const ok = await updateStudent({
      studentId: editingStudent.id,
      userId: editingStudent.userId,
      name: form.name,
      grade: form.grade,
      dob: form.dob,
      status: form.status,
      email: form.email,
      password: form.password,
      fatherInfo: { firstName: form.fatherFirstName, secondName: form.fatherSecondName, thirdName: form.fatherThirdName, lastName: form.fatherLastName, nationality: form.fatherNationality, secondNationality: form.fatherSecondNationality, idNumber: form.fatherIdNumber, academicDegree: form.fatherAcademicDegree, marital: form.fatherMarital, employmentStatus: form.fatherEmploymentStatus, jobTitle: form.fatherJobTitle, companyName: form.fatherCompanyName, email: form.fatherEmail, mobile: form.fatherMobile, whatsapp: form.fatherWhatsapp, deceased: form.fatherDeceased },
      motherInfo: { firstName: form.motherFirstName, secondName: form.motherSecondName, thirdName: form.motherThirdName, lastName: form.motherLastName, nationality: form.motherNationality, secondNationality: form.motherSecondNationality, idNumber: form.motherIdNumber, academicDegree: form.motherAcademicDegree, marital: form.motherMarital, employmentStatus: form.motherEmploymentStatus, jobTitle: form.motherJobTitle, companyName: form.motherCompanyName, email: form.motherEmail, mobile: form.motherMobile, whatsapp: form.motherWhatsapp, deceased: form.motherDeceased },
      legalGuardian: form.legalGuardian,
      guardianRelationship: form.guardianRelationship,
    });
    if (ok) {
      refreshStudents();
      showToast('تم تعديل بيانات الطالب بنجاح.', 'success');
    } else {
      showToast('حصل خطأ أثناء تعديل الطالب.', 'error');
    }
    return ok;
  };

  const handleDeleteStudent = async (student: any) => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح "${student.name}"؟ الإجراء ده مينفعش يترجع.`, 'حذف');
    if (!confirmed) return;
    const ok = await deleteStudent(student.userId);
    if (ok) {
      refreshStudents();
      showToast('تم حذف الطالب.', 'success');
    } else {
      showToast('حصل خطأ أثناء حذف الطالب.', 'error');
    }
  };

  const handleBulkDeleteStudents = async () => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح ${selectedStudentIds.length} طالب؟ الإجراء ده مينفعش يترجع.`, 'حذف الكل');
    if (!confirmed) return;
    const userIds = studentsList.filter(s => selectedStudentIds.includes(s.id)).map((s: any) => s.userId);
    const ok = await bulkDeleteStudents(userIds);
    if (ok) {
      refreshStudents();
      setSelectedStudentIds([]);
      showToast('تم حذف الطلاب المحددين.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف الجماعي.', 'error');
    }
  };

  // تعديل وحذف الإداريين
  const [openAdminMenu, setOpenAdminMenu] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const toggleSelectAdmin = (id: string) => {
    setSelectedAdminIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreateStudent = async (form: any): Promise<boolean> => {
      const fullName = [form.firstName, form.secondName, form.thirdName, form.lastName].filter(Boolean).join(' ');
      if (!fullName.trim()) return false;
      const id = await createStudent({ name: fullName, grade: form.grade, dob: form.dob, email: form.email, password: form.password });
      if (id) {
        refreshStudents();
        showToast('تم إضافة الطالب بنجاح.', 'success');
      } else {
        showToast('حصل خطأ أثناء إنشاء الطالب. راجع الـ Console (F12) لمعرفة التفاصيل.', 'error');
      }
      return !!id;
  };

  const handleCreateTeacher = async (form: any): Promise<boolean> => {
      if (!form.name.trim()) return false;
      const id = await createTeacher({
        name: form.name,
        email: form.email,
        password: form.password,
        hiringDate: form.hiringDate,
        employmentType: form.type,
        subjects: form.subjects,
        allSubjects: form.allSubjects,
        grades: form.grades,
        teacherType: form.teacherType,
        canUseQuestionBank: form.canUseQuestionBank,
      });
      if (id) {
        refreshTeachers();
        showToast('تم إضافة المعلم بنجاح.', 'success');
      } else {
        showToast('حصل خطأ أثناء إنشاء المعلم. تأكد إنك شغّلت كود إضافة عمود hiring_date في Supabase.', 'error');
      }
      return !!id;
  };

  const handleCreateAdmin = async (form: any): Promise<boolean> => {
      if (!form.name.trim()) return false;
      const id = await createAdmin({
        name: form.name,
        email: form.email,
        password: form.password,
        title: form.title,
        department: form.department,
        permissions: form.permissions,
      });
      if (id) {
        refreshAdmins();
        showToast('تم إضافة الإداري بنجاح.', 'success');
      } else {
        showToast('حصل خطأ أثناء إنشاء الإداري. تأكد إنك شغّلت كود إنشاء جدولي admins وadmin_permissions في Supabase.', 'error');
      }
      return !!id;
  };

  const handleUpdateAdmin = async (form: any): Promise<boolean> => {
      if (!editingAdmin) return false;
      const ok = await updateAdmin({
        adminId: editingAdmin.id,
        userId: editingAdmin.userId,
        name: form.name,
        email: form.email,
        title: form.title,
        department: form.department,
        permissions: form.permissions,
      });
      if (ok) {
        refreshAdmins();
        showToast('تم تعديل بيانات الإداري بنجاح.', 'success');
      } else {
        showToast('حصل خطأ أثناء تعديل الإداري.', 'error');
      }
      return ok;
  };

  const handleDeleteAdmin = async (admin: any) => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح "${admin.name}"؟ الإجراء ده مينفعش يترجع.`, 'حذف');
    if (!confirmed) return;
    const ok = await deleteAdmin(admin.userId);
    if (ok) {
      refreshAdmins();
      showToast('تم حذف الإداري.', 'success');
    } else {
      showToast('حصل خطأ أثناء حذف الإداري.', 'error');
    }
  };

  const handleBulkDeleteAdmins = async () => {
    const confirmed = await confirmDialog(`متأكد إنك عايز تمسح ${selectedAdminIds.length} إداري؟ الإجراء ده مينفعش يترجع.`, 'حذف الكل');
    if (!confirmed) return;
    const userIds = adminsList.filter(a => selectedAdminIds.includes(a.id)).map(a => a.userId);
    const ok = await bulkDeleteAdmins(userIds);
    if (ok) {
      refreshAdmins();
      setSelectedAdminIds([]);
      showToast('تم حذف الإداريين المحددين.', 'success');
    } else {
      showToast('حصل خطأ أثناء الحذف الجماعي.', 'error');
    }
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All Grades');

  const filteredStudents = studentsList.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || (student.studentCode || student.id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = gradeFilter === 'All Grades' || student.grade === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  // --- SUB-COMPONENTS ---

  // 1. Student List
  const StudentListView = () => {
    const t_search = isRTL ? 'البحث عن طلاب...' : 'Search students...';
    const t_all_grades = isRTL ? 'جميع الصفوف' : 'All Grades';
    const t_import = isRTL ? 'استيراد CSV' : 'Import CSV';
    const t_add_student = isRTL ? 'إضافة طالب' : 'Add Student';
    const t_name = isRTL ? 'الاسم' : 'Name';
    const t_id = isRTL ? 'الرقم التعريفي' : 'ID Number';
    const t_gradeLevel = isRTL ? 'الصف الدراسي' : 'Grade Level';
    const t_attendance = isRTL ? 'الحضور' : 'Attendance';
    const t_status = isRTL ? 'الحالة' : 'Status';
    const t_actions = isRTL ? 'الإجراءات' : 'Actions';

    const getTranslatedGrade = (grade: string) => {
      if (!isRTL) return grade;
      return grade.replace('Grade ', 'الصف ');
    };

    const getTranslatedStatus = (status: string) => {
      if (!isRTL) return status;
      if (status === 'Active') return 'نشط';
      if (status === 'At Risk') return 'في خطر';
      if (status === 'Inactive') return 'غير نشط';
      return status;
    };

      const trName = (name: string) => name;

    return (
    <div className="space-y-6 animate-fadeIn" dir={isRTL ? "rtl" : "ltr"}>
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm gap-4">
          <div className="flex flex-1 w-full sm:max-w-xl gap-3">
            <div className="relative flex-1">
               <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} size={18} />
               <input 
                 type="text" 
                 placeholder={t_search}
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={`w-full border border-gray-200 bg-gray-50 rounded-full py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none ${isRTL ? 'pr-11 pl-5' : 'pl-11 pr-5'}`}
               />
            </div>
            <div className="relative w-40 shrink-0">
               <Filter className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRTL ? 'right-4' : 'left-4'}`} size={16} />
               <select
                 value={gradeFilter}
                 onChange={(e) => setGradeFilter(e.target.value)}
                 className={`w-full border border-gray-200 bg-gray-50 rounded-full py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none appearance-none font-medium text-gray-700 ${isRTL ? 'pr-10 pl-8' : 'pl-10 pr-8'}`}
               >

                 <option value="All Grades">{t_all_grades}</option>
                 {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
               <ChevronRight className={`absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90 ${isRTL ? 'left-3' : 'right-3'}`} size={16} />
            </div>
          </div>
          <div className={`flex gap-2 w-full sm:w-auto ${isRTL ? 'flex-row-reverse sm:flex-row' : ''}`}>
             <Button variant="secondary" onClick={() => setUploadModalType('student')} className="flex-1 sm:flex-none justify-center whitespace-nowrap">
                <Upload size={18} /> {t_import}
             </Button>
             {canManageUsers && (
             <Button variant="primary" onClick={() => setIsAddStudentOpen(true)} className="flex-1 sm:flex-none justify-center bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap rounded-lg">
                <Plus size={18} /> {t_add_student}
             </Button>
             )}
          </div>
       </div>

       {selectedStudentIds.length > 0 && (
         <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-center justify-between">
           <span className="text-sm font-bold text-violet-800">{selectedStudentIds.length} طالب محدد</span>
           <div className="flex gap-2">
             <button onClick={() => setSelectedStudentIds([])} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-lg">إلغاء التحديد</button>
             <button onClick={handleBulkDeleteStudents} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">حذف المحدد</button>
           </div>
         </div>
       )}

       <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-4 py-5 w-10">
                  <input type="checkbox" checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length} onChange={toggleSelectAllStudents} />
                </th>
                <th className="px-8 py-5">{t_name}</th>
                <th className="px-6 py-5">{t_id}</th>
                <th className="px-6 py-5">{t_gradeLevel}</th>
                <th className="px-6 py-5">{t_attendance}</th>
                <th className="px-6 py-5">{t_status}</th>
                <th className="px-6 py-5 text-center">{t_actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {studentsLoading && (
                <tr><td colSpan={7} className="px-8 py-10 text-center text-gray-400">{isRTL ? 'جاري تحميل الطلاب من قاعدة البيانات...' : 'Loading students from the database...'}</td></tr>
              )}
              {!studentsLoading && filteredStudents.length === 0 && (
                <tr><td colSpan={7} className="px-8 py-10 text-center text-gray-400">{isRTL ? 'لا يوجد طلاب بعد' : 'No students yet'}</td></tr>
              )}
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-violet-50/30 transition-colors group cursor-pointer" onClick={() => setSelectedStudent(student)}>
                  <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleSelectStudent(student.id)} />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      {student.avatar ? (
                        <img src={student.avatar} alt={student.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden shadow-sm ring-2 ring-white">
                          <User size={20} />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{trName(student.name)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-gray-500 font-mono">{student.studentCode || student.id}</td>
                  <td className="px-6 py-5">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold">
                      {getTranslatedGrade(student.grade)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-20 bg-gray-100 rounded-full h-2 flex-shrink-0" dir="ltr">
                        <div 
                          className={`h-2 rounded-full ${student.attendance >= 90 ? 'bg-green-500' : 'bg-violet-500'}`} 
                          style={{ width: `${student.attendance}%`, float: isRTL ? 'right' : 'left' }}
                        ></div>
                      </div>
                      <span className="font-bold text-gray-700">{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      student.status === 'Active' 
                        ? 'bg-green-50 text-green-700 border-green-100' 
                        : student.status === 'At Risk' 
                        ? 'bg-red-50 text-red-700 border-red-100'
                        : 'bg-gray-50 text-gray-600 border-gray-100'
                    }`}>
                      {getTranslatedStatus(student.status)}
                    </span>
                  </td>
                  <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1 relative">
                      <button onClick={() => setOpenStudentMenu(openStudentMenu === student.id ? null : student.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                      {openStudentMenu === student.id && (
                        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 w-32" onMouseLeave={() => setOpenStudentMenu(null)}>
                          <button onClick={() => { setEditingStudent(student); setOpenStudentMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">تعديل</button>
                          {canDeleteUsers && <button onClick={() => { handleDeleteStudent(student); setOpenStudentMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50">حذف</button>}
                        </div>
                      )}
                      <button onClick={() => setSelectedStudent(student)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                        <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )};

  // 2. Parent Management View
  const ParentListView = () => (
     <ParentsManagement isRTL={isRTL} />
  );

  // 3. Teacher Management View
  const TeacherListView = () => {
     const t = {
        filter: isRTL ? 'تصفية' : 'Filter',
        searchFaculty: isRTL ? 'البحث عن معلمين...' : 'Search faculty...',
        bulkImport: isRTL ? 'استيراد جماعي' : 'Bulk Import',
        addTeacher: isRTL ? 'إضافة معلم' : 'Add Teacher',
        hiredDate: isRTL ? 'تاريخ التعيين' : 'Hired Date',
        employment: isRTL ? 'نوع العقد' : 'Employment',
        subjectDistribution: isRTL ? 'توزيع المواد' : 'Subject Distribution',
        class: isRTL ? 'الفصل' : 'Class',
        subject: isRTL ? 'المادة' : 'Subject',
        hrsWeek: isRTL ? 'ساعات المادة / أسبوع' : 'Hrs/Week',
        noClasses: isRTL ? 'لا توجد فصول دراسية' : 'No classes assigned',
        totalLoad: isRTL ? 'إجمالي العبء الأكاديمي' : 'Total Academic Load',
        hoursWeek: isRTL ? 'ساعة / أسبوع' : 'Hours / Week',
        fullTime: isRTL ? 'دوام كامل' : 'Full-time',
        contract: isRTL ? 'عقد مؤقت' : 'Contract'
     };

     const trName = (name: string) => {
        if (!isRTL) return name;
        const map: Record<string, string> = { 'Ahmed Khalil': 'أحمد خليل', 'Sarah Al-Majed': 'سارة الماجد', 'Omar Hassan': 'عمر حسن', 'Emily Davis': 'نورة إبراهيم' };
        return map[name] || name;
     };

     const trSubj = (subj: string) => {
        if (!isRTL) return subj;
        const map: Record<string, string> = { 'Physics': 'فيزياء', 'Mathematics': 'رياضيات', 'Arabic': 'لغة عربية', 'English Literature': 'أدب إنجليزي' };
        return map[subj] || subj;
     };

     return (
     <div className="space-y-6 animate-fadeIn" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div className={`flex gap-2 w-full md:w-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button variant="secondary" className="rounded-full whitespace-nowrap"><Filter size={16}/> {t.filter}</Button>
              <div className="relative w-full md:w-auto">
                 <input type="text" placeholder={t.searchFaculty} className={`bg-white border border-gray-200 rounded-full py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 w-full md:w-64 ${isRTL ? 'pr-4 pl-4' : 'px-4'}`} />
              </div>
           </div>
           <div className={`flex gap-2 w-full md:w-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button variant="secondary" onClick={() => setUploadModalType('teacher')} className="shadow-sm whitespace-nowrap">
                 <Upload size={18} /> {t.bulkImport}
              </Button>
              {canManageUsers && (
              <Button variant="primary" onClick={() => setIsAddTeacherOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200 whitespace-nowrap rounded-lg">
                 <Plus size={18} /> {t.addTeacher}
              </Button>
              )}
           </div>
        </div>

        {selectedTeacherIds.length > 0 && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-violet-800">{selectedTeacherIds.length} معلم محدد</span>
            <div className="flex gap-2">
              <button onClick={() => setSelectedTeacherIds([])} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-lg">إلغاء التحديد</button>
              <button onClick={handleBulkDeleteTeachers} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">حذف المحدد</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
           {teachersList.map(teacher => {
              const assignedClassDetails = CLASSES.filter(c => teacher.assignedClasses.includes(c.id));
              
              return (
                 <div key={teacher.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex gap-4">
                          <input type="checkbox" className="mt-1" checked={selectedTeacherIds.includes(teacher.id)} onChange={() => toggleSelectTeacher(teacher.id)} />
                          <img src={teacher.avatar} alt={teacher.name} referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm" />
                          <div>
                             <h3 className="font-bold text-lg text-gray-900">{trName(teacher.name)}</h3>
                             <p className="text-violet-600 font-medium text-sm">{trSubj(teacher.specialization)}</p>
                             <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><Mail size={12}/> <span dir="ltr">{teacher.email}</span></span>
                                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}><Phone size={12}/> <span dir="ltr">{teacher.phone || 'N/A'}</span></span>
                             </div>
                          </div>
                       </div>
                       <div className="relative">
                         <button onClick={() => setOpenTeacherMenu(openTeacherMenu === teacher.id ? null : teacher.id)} className="text-gray-300 hover:text-gray-600"><MoreVertical size={20} /></button>
                         {openTeacherMenu === teacher.id && (
                           <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 w-36" onMouseLeave={() => setOpenTeacherMenu(null)}>
                             <button onClick={() => { setEditingTeacher(teacher); setOpenTeacherMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">تعديل</button>
                             {canDeleteUsers && <button onClick={() => { handleDeleteTeacher(teacher); setOpenTeacherMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50">حذف</button>}
                           </div>
                         )}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">{t.hiredDate}</p>
                          <p className="font-bold text-gray-900 flex items-center gap-2"><Calendar size={14}/> <span dir="ltr">{teacher.hiringDate}</span></p>
                       </div>
                       <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">{t.employment}</p>
                          <p className="font-bold text-gray-900 flex items-center gap-2"><Briefcase size={14}/> {teacher.employmentType === 'Full-time' ? t.fullTime : teacher.employmentType === 'Contract' ? t.contract : teacher.employmentType}</p>
                       </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                       <h4 className={`text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ${isRTL ? 'text-right' : ''}`}>{t.subjectDistribution}</h4>
                       <table className={`w-full text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                          <thead>
                             <tr className={`text-gray-400 text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
                                <th className="pb-2 font-medium">{t.class}</th>
                                <th className="pb-2 font-medium">{t.subject}</th>
                                <th className={`pb-2 font-medium ${isRTL ? 'text-left' : 'text-right'}`}>{t.hrsWeek}</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                             {assignedClassDetails.map((cls, idx) => (
                                <tr key={idx}>
                                   <td className="py-2 font-bold text-gray-800">{isRTL ? cls.name.replace('Grade', 'الصف') : cls.name} <span className="text-gray-400 font-normal text-xs mx-1">({cls.gradeLevel})</span></td>
                                   <td className="py-2 text-gray-600">{trSubj(teacher.specialization)}</td>
                                   <td className={`py-2 font-mono font-medium ${isRTL ? 'text-left' : 'text-right'}`}>4</td>
                                </tr>
                             ))}
                             {assignedClassDetails.length === 0 && (
                                <tr><td colSpan={3} className="py-2 text-center text-gray-400 italic">{t.noClasses}</td></tr>
                             )}
                          </tbody>
                       </table>
                       <div className="mt-4 flex justify-between items-center text-xs">
                          <span className="text-gray-500">{t.totalLoad}</span>
                          <span className="bg-violet-50 text-violet-700 px-2 py-1 rounded font-bold">{teacher.academicLoad} {t.hoursWeek}</span>
                       </div>
                    </div>
                 </div>
              );
           })}
        </div>
     </div>
  )};

  // 4. Admin Management View
  const AdminListView = () => {
     const t = {
        adminHub: isRTL ? 'مركز الإدارة' : 'Administration Hub',
        manageRoles: isRTL ? 'إدارة الأدوار والصلاحيات' : 'Manage Roles & Permissions',
        subtitle: isRTL ? 'تكوين وصول النظام لمسؤولي النظام، ومسجلي البيانات، والمنسقين الأكاديميين. لضمان الامتثال لصلاحيات الوصول.' : 'Configure system access for co-teachers, registrars, and academic coordinators. Ensure RBAC compliance.',
        addNewAdmin: isRTL ? 'إضافة مسؤول جديد +' : 'Add New Admin +',
        user: isRTL ? 'المستخدم' : 'User',
        roleTitle: isRTL ? 'المسمى الوظيفي' : 'Role Title',
        department: isRTL ? 'القسم' : 'Department',
        activeStatus: isRTL ? 'حالة النشاط' : 'Active Status',
        permissions: isRTL ? 'الصلاحيات' : 'Permissions',
     };

     const trName = (name: string) => {
        if (!isRTL) return name;
        const map: Record<string, string> = { 'Dr. Faisal Omar': 'د. فيصل عمر', 'Mona Rashid': 'منى راشد', 'Yasser Ali': 'ياسر علي' };
        return map[name] || name;
     };

     const trRoleDeptStatus = (text: string) => {
        if (!isRTL) return text;
        const map: Record<string, string> = {
           'School Principal': 'مدير المدرسة',
           'Academic Coordinator': 'منسق أكاديمي',
           'Registrar': 'مسجل بيانات',
           'Administration': 'الإدارة',
           'Academics': 'الشؤون الأكاديمية',
           'Admissions': 'القبول والتسجيل',
           'Active now': 'نشط الآن'
        };
        if (map[text]) return map[text];
        if (text.includes('hours ago')) {
           return text.replace('hours ago', 'ساعات مضت').replace('2', 'ساعتين');
        }
        return text;
     };

     return (
     <div className="space-y-6 animate-fadeIn" dir={isRTL ? "rtl" : "ltr"}>
        <div className="bg-gradient-to-r from-violet-900 to-violet-700 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-end md:items-center relative overflow-hidden">
           <div className={`absolute top-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 ${isRTL ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}`}></div>
           <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2 text-violet-300 text-sm font-bold uppercase tracking-wider">
                 <ShieldCheck size={16} /> {t.adminHub}
              </div>
              <h2 className="text-3xl font-bold">{t.manageRoles}</h2>
              <p className="text-violet-200 max-w-xl">{t.subtitle}</p>
           </div>
           {canManageUsers && (
           <Button variant="primary" onClick={() => setIsAddAdminOpen(true)} className="relative z-10 mt-6 md:mt-0 bg-violet-600 hover:bg-violet-700 text-white whitespace-nowrap rounded-lg shadow-sm border border-violet-500/30">
              <Plus size={16} /> {t.addNewAdmin}
           </Button>
           )}
        </div>

        {selectedAdminIds.length > 0 && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-violet-800">{selectedAdminIds.length} إداري محدد</span>
            <div className="flex gap-2">
              <button onClick={() => setSelectedAdminIds([])} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-white rounded-lg">إلغاء التحديد</button>
              <button onClick={handleBulkDeleteAdmins} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg">حذف المحدد</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
           <table className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}>
              <thead className="bg-gray-50 text-gray-500 font-semibold text-sm">
                 <tr>
                    <th className="px-4 py-4 w-10">
                       <input type="checkbox" checked={adminsList.length > 0 && selectedAdminIds.length === adminsList.length} onChange={() => setSelectedAdminIds(selectedAdminIds.length === adminsList.length ? [] : adminsList.map(a => a.id))} />
                    </th>
                    <th className="px-6 py-4">{t.user}</th>
                    <th className="px-6 py-4">{t.roleTitle}</th>
                    <th className="px-6 py-4">{t.department}</th>
                    <th className="px-6 py-4">{t.activeStatus}</th>
                    <th className="px-6 py-4">{t.permissions}</th>
                    <th className="px-6 py-4"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                 {adminsLoading && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">جاري تحميل الإداريين...</td></tr>
                 )}
                 {!adminsLoading && adminsList.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">لا يوجد إداريين بعد</td></tr>
                 )}
                 {adminsList.map(admin => (
                    <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-4">
                          <input type="checkbox" checked={selectedAdminIds.includes(admin.id)} onChange={() => toggleSelectAdmin(admin.id)} />
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <img src={admin.avatar || `https://ui-avatars.com/api/?name=${admin.name}&background=random`} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" alt="" />
                             <div>
                                <p className="font-bold text-gray-900 text-sm">{trName(admin.name)}</p>
                                <p className="text-xs text-gray-400" dir="ltr">{admin.email}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-sm font-medium text-gray-700">{trRoleDeptStatus(admin.title)}</td>
                       <td className="px-6 py-4 text-sm text-gray-500">{trRoleDeptStatus(admin.department)}</td>
                       <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-bold w-fit px-2 py-1 rounded-full ${
                             admin.lastActive === 'Active now' 
                              ? 'text-green-600 bg-green-50' 
                              : 'text-gray-600 bg-gray-50'
                          }`}>
                             {admin.lastActive === 'Active now' && <div className="w-2 h-2 rounded-full bg-green-500"></div>} {trRoleDeptStatus(admin.lastActive || 'Active')}
                          </span>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                             {admin.permissions.slice(0, 2).map((p: string) => (
                                <span key={p} className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                   {p.replace(/_/g, ' ')}
                                </span>
                             ))}
                             {admin.permissions.length > 2 && (
                                <span className="text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                   +{admin.permissions.length - 2}
                                </span>
                             )}
                          </div>
                       </td>
                       <td className={`px-6 py-4 ${isRTL ? 'text-left' : 'text-right'} relative`}>
                          <button onClick={() => setOpenAdminMenu(openAdminMenu === admin.id ? null : admin.id)} className="text-gray-400 hover:text-violet-600 transition-colors"><Settings size={18}/></button>
                          {openAdminMenu === admin.id && (
                            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 w-32" onMouseLeave={() => setOpenAdminMenu(null)}>
                              <button onClick={() => { setEditingAdmin(admin); setOpenAdminMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">تعديل</button>
                              {canDeleteUsers && <button onClick={() => { handleDeleteAdmin(admin); setOpenAdminMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50">حذف</button>}
                            </div>
                          )}
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
     </div>
  )};

  // --- MAIN RENDER ---

  if (selectedStudent) {
    return <StudentProfile student={selectedStudent} language={language} onBack={() => setSelectedStudent(null)} onEditProfile={onEditProfile} />;
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
       
       {/* 1. UPLOAD MODAL (Generic) */}
       {uploadModalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fadeIn max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-gray-900">{isRTL ? (uploadModalType === "student" ? "استيراد طلاب" : "استيراد معلمين") : `Bulk Import ${uploadModalType === "student" ? "Students" : "Teachers"}`}</h3>
                   <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-700"><X size={24}/></button>
                </div>

                {importResults ? (
                  <div className="text-center py-8">
                    <p className="text-2xl font-bold text-gray-900 mb-2">تم الاستيراد</p>
                    <p className="text-sm text-gray-500">نجح: {importResults.success} — فشل: {importResults.failed}</p>
                    <Button variant="primary" className="mt-6" onClick={closeImportModal}>تمام</Button>
                  </div>
                ) : (
                  <>
                    <label className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center hover:bg-gray-50 transition-colors cursor-pointer mb-6 block">
                       <FileSpreadsheet size={48} className="mx-auto text-green-600 mb-4" />
                       <p className="font-bold text-gray-900">{importFileName || 'اضغط لرفع ملف Excel أو CSV'}</p>
                       <p className="text-sm text-gray-500">CSV, Excel (max 10MB)</p>
                       <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFileSelected} />
                    </label>

                    {importRows.length > 0 && (
                      <div className="mb-6 max-h-52 overflow-y-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              {Object.keys(importRows[0]).map((k) => <th key={k} className="p-2 font-bold text-gray-600">{k}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.slice(0, 20).map((row, i) => (
                              <tr key={i} className="border-t border-gray-50">
                                {Object.keys(importRows[0]).map((k) => <td key={k} className="p-2 text-gray-700">{String(row[k])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-xs text-gray-400 p-2">{importRows.length} صف جاهز للاستيراد{importRows.length > 20 ? ' (عرض أول 20)' : ''}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center bg-violet-50 p-4 rounded-xl text-sm text-violet-800 mb-8">
                       <span className="flex items-center gap-2"><Download size={16}/> نزّل القالب الفاضي</span>
                       <button onClick={handleDownloadTemplate} className="font-bold hover:underline">تحميل</button>
                    </div>

                    <div className="flex gap-4">
                       <Button variant="secondary" className="flex-1" onClick={closeImportModal}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                       <Button variant="primary" className="flex-1" disabled={importRows.length === 0 || isImporting} onClick={handleStartImport}>
                         {isImporting ? 'جاري الاستيراد...' : `استيراد ${importRows.length > 0 ? `(${importRows.length})` : ''}`}
                       </Button>
                    </div>
                  </>
                )}
             </div>
          </div>
       )}

       {/* 2. ADD STUDENT MODAL */}
       {isAddStudentOpen && (
         <AddStudentModal gradeLevels={gradeLevels} onClose={() => setIsAddStudentOpen(false)} onSubmit={handleCreateStudent} />
       )}

       {/* 3. ADD TEACHER MODAL */}
       {isAddTeacherOpen && (
         <AddTeacherModal gradeLevels={gradeLevels} subjectOptions={subjectOptions} onClose={() => setIsAddTeacherOpen(false)} onSubmit={handleCreateTeacher} />
       )}

       {/* EDIT TEACHER MODAL */}
       {editingTeacher && (
         <EditTeacherModal teacher={editingTeacher} gradeLevels={gradeLevels} subjectOptions={subjectOptions} onClose={() => setEditingTeacher(null)} onSubmit={handleUpdateTeacher} />
       )}

       {/* EDIT STUDENT MODAL */}
       {editingStudent && (
         <EditStudentModal student={editingStudent} gradeLevels={gradeLevels} onClose={() => setEditingStudent(null)} onSubmit={handleUpdateStudent} />
       )}


       {/* 4. ADD ADMIN MODAL */}
       {isAddAdminOpen && (
         <AddAdminModal onClose={() => setIsAddAdminOpen(false)} onSubmit={handleCreateAdmin} />
       )}

       {/* EDIT ADMIN MODAL */}
       {editingAdmin && (
         <EditAdminModal admin={editingAdmin} onClose={() => setEditingAdmin(null)} onSubmit={handleUpdateAdmin} />
       )}


       {/* Header & Tabs */}
       <div className={`flex flex-col md:flex-row justify-between items-end md:items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
             <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{isRTL ? "إدارة المستخدمين" : "User Management"}</h1>
             <p className="text-gray-500">{isRTL ? "الدليل والتحكم في الوصول للمؤسسة." : "Directory and access control for the institution."}</p>
          </div>
          
          {/* Permission-aware Tabs */}
          <div className={`bg-white p-1 rounded-full border border-gray-200 shadow-sm flex ${isRTL ? 'flex-row-reverse' : ''}`}>
             <button 
               onClick={() => setActiveTab('students')}
               className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'students' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
             >
                <GraduationCap size={16} /> {isRTL ? "الطلاب" : "Students"}
             </button>
             
             {(role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) && (
                <>
                  <button 
                     onClick={() => setActiveTab('parents')}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'parents' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                     <Users size={16} /> {isRTL ? "أولياء الأمور" : "Parents"}
                  </button>
                  <button 
                     onClick={() => setActiveTab('teachers')}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'teachers' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                     <Briefcase size={16} /> {isRTL ? "المعلمون" : "Teachers"}
                  </button>
                  <button 
                     onClick={() => setActiveTab('admins')}
                     className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'admins' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                     <ShieldCheck size={16} /> {isRTL ? "الإدارة" : "Admins"}
                  </button>
                </>
             )}
          </div>
       </div>

       {/* View Content */}
       {activeTab === 'students' && <StudentListView />}
       {activeTab === 'parents' && <ParentListView />}
       {activeTab === 'teachers' && <TeacherListView />}
       {activeTab === 'admins' && <AdminListView />}
    </div>
  );
};
