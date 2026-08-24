import { supabase } from '../lib/supabaseClient';
import { Student, ClassSection, Teacher } from '../types';
import { calculateWeightedGrade } from '../lib/gradeCalculations';

// بيجيب الطلاب الحقيقيين من قاعدة البيانات (Supabase) بدل الـ mock data.
// بعض الحقول (fees, reportCards, transcript, attendance, performance) لسه
// مش لها جداول في قاعدة البيانات، فبنحطلها قيم افتراضية فارغة مؤقتًا
// لحد ما نبني موديول الحضور والدرجات والمصروفات.
// بيحسب نسبة الحضور الحقيقية لكل طالب من سجلات الحضور الفعلية
async function getAttendancePercentages(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('attendance_records').select('student_id, status');
  if (error || !data) {
    console.error('Error computing attendance percentages:', error);
    return {};
  }
  const totals: Record<string, { total: number; present: number }> = {};
  data.forEach((row: any) => {
    if (!totals[row.student_id]) totals[row.student_id] = { total: 0, present: 0 };
    totals[row.student_id].total += 1;
    if (row.status === 'Present' || row.status === 'Late') totals[row.student_id].present += 1;
  });
  const result: Record<string, number> = {};
  Object.entries(totals).forEach(([studentId, t]) => {
    result[studentId] = t.total > 0 ? Math.round((t.present / t.total) * 100) : 0;
  });
  return result;
}

// بينشئ طالب حقيقي جديد (يوزر + سجل طالب)
// بيولّد كود طالب جديد بالشكل STU-YYYY-00001 — تسلسل منفصل لكل سنة قيد
async function generateStudentCode(enrollmentYear: string): Promise<string> {
  const { count } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .like('student_code', `STU-${enrollmentYear}-%`);
  const nextSeq = (count || 0) + 1;
  return `STU-${enrollmentYear}-${String(nextSeq).padStart(5, '0')}`;
}

export async function createStudent(input: {
  name: string;
  grade: string;
  dob: string;
  email?: string;
  password?: string;
}): Promise<string | null> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .insert({ name: input.name, role: 'STUDENT', email: input.email?.trim() ? input.email.trim() : null, password: input.password || null })
    .select('id')
    .single();

  if (userError || !userRow) {
    console.error('Error creating student user:', userError);
    return null;
  }

  const enrollmentDate = new Date().toISOString().slice(0, 10);
  const studentCode = await generateStudentCode(enrollmentDate.slice(0, 4));
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .insert({
      user_id: userRow.id,
      grade: input.grade,
      dob: input.dob || null,
      enrollment_date: enrollmentDate,
      status: 'Active',
      student_code: studentCode,
    })
    .select('id')
    .single();

  if (studentError || !studentRow) {
    console.error('Error creating student record:', studentError);
    return null;
  }

  return studentRow.id;
}

export async function getStudents(): Promise<(Student & { userId: string; email: string })[]> {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      user_id,
      grade,
      national_id,
      dob,
      enrollment_date,
      status,
      father_info,
      mother_info,
      legal_guardian,
      guardian_relationship,
      student_code,
      users ( name, email )
    `);

  if (error) {
    console.error('Error fetching students from Supabase:', error);
    return [];
  }

  const attendanceMap = await getAttendancePercentages();

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.users?.name ?? 'بدون اسم',
    email: row.users?.email ?? '',
    grade: row.grade ?? '',
    studentCode: row.student_code ?? '',
    attendance: attendanceMap[row.id] ?? 0,
    performance: 0,
    status: row.status ?? 'Active',
    fees: [],
    installmentPlans: [],
    reportCards: [],
    dob: row.dob ?? undefined,
    nationalId: row.national_id ?? undefined,
    enrollmentDate: row.enrollment_date ?? undefined,
    fatherInfo: row.father_info ?? undefined,
    motherInfo: row.mother_info ?? undefined,
    legalGuardian: row.legal_guardian ?? undefined,
    guardianRelationship: row.guardian_relationship ?? undefined,
  }));
}

// بيعدّل بيانات طالب موجود
export async function updateStudent(input: {
  studentId: string;
  userId: string;
  name: string;
  grade: string;
  dob: string;
  status: string;
  email?: string;
  password?: string;
  fatherInfo?: any;
  motherInfo?: any;
  legalGuardian?: string;
  guardianRelationship?: string;
  identityInfo?: any;
  emergencyContact1?: any;
  emergencyContact2?: any;
  homeAddress?: any;
  additionalInfo?: any;
}): Promise<boolean> {
  const userUpdate: any = { name: input.name };
  if (input.email !== undefined) userUpdate.email = input.email?.trim() ? input.email.trim() : null;
  if (input.password) userUpdate.password = input.password;
  const { error: userError } = await supabase.from('users').update(userUpdate).eq('id', input.userId);
  if (userError) {
    console.error('Error updating student user:', userError);
    return false;
  }
  const { error: studentError } = await supabase
    .from('students')
    .update({
      grade: input.grade,
      dob: input.dob || null,
      status: input.status,
      father_info: input.fatherInfo ?? null,
      mother_info: input.motherInfo ?? null,
      legal_guardian: input.legalGuardian ?? null,
      guardian_relationship: input.guardianRelationship ?? null,
      identity_info: input.identityInfo ?? null,
      emergency_contact_1: input.emergencyContact1 ?? null,
      emergency_contact_2: input.emergencyContact2 ?? null,
      home_address: input.homeAddress ?? null,
      additional_info: input.additionalInfo ?? null,
    })
    .eq('id', input.studentId);
  if (studentError) {
    console.error('Error updating student record:', studentError);
    return false;
  }
  return true;
}

// بيجيب بيانات طالب واحد كاملة (لملف بيانات الطالب الشامل)
export async function getStudentById(studentId: string): Promise<(Student & { userId: string; email: string }) | null> {
  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      user_id,
      grade,
      national_id,
      dob,
      enrollment_date,
      status,
      father_info,
      mother_info,
      legal_guardian,
      guardian_relationship,
      identity_info,
      emergency_contact_1,
      emergency_contact_2,
      home_address,
      additional_info,
      student_code,
      users ( name, email )
    `)
    .eq('id', studentId)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching student by id:', error);
    return null;
  }

  const row: any = data;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.users?.name ?? 'بدون اسم',
    email: row.users?.email ?? '',
    grade: row.grade ?? '',
    attendance: 0,
    performance: 0,
    status: row.status ?? 'Active',
    fees: [],
    installmentPlans: [],
    reportCards: [],
    dob: row.dob ?? undefined,
    nationalId: row.national_id ?? undefined,
    enrollmentDate: row.enrollment_date ?? undefined,
    fatherInfo: row.father_info ?? undefined,
    motherInfo: row.mother_info ?? undefined,
    legalGuardian: row.legal_guardian ?? undefined,
    guardianRelationship: row.guardian_relationship ?? undefined,
    identityInfo: row.identity_info ?? undefined,
    emergencyContact1: row.emergency_contact_1 ?? undefined,
    emergencyContact2: row.emergency_contact_2 ?? undefined,
    homeAddress: row.home_address ?? undefined,
    additionalInfo: row.additional_info ?? undefined,
    studentCode: row.student_code ?? '',
  };
}

// بيمسح طالب واحد (مسح اليوزر بيمسح معاه سجل الطالب والتسجيلات تلقائيًا بسبب CASCADE)
export async function deleteStudent(userId: string): Promise<boolean> {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    console.error('Error deleting student:', error);
    return false;
  }
  return true;
}

// بيمسح مجموعة طلاب دفعة واحدة
export async function bulkDeleteStudents(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const { error } = await supabase.from('users').delete().in('id', userIds);
  if (error) {
    console.error('Error bulk deleting students:', error);
    return false;
  }
  return true;
}

// بيمسح مجموعة معلمين دفعة واحدة
export async function bulkDeleteTeachers(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const { error } = await supabase.from('users').delete().in('id', userIds);
  if (error) {
    console.error('Error bulk deleting teachers:', error);
    return false;
  }
  return true;
}

// بيجيب الفصول الدراسية الحقيقية مع قائمة الطلاب المسجلين في كل فصل
export async function getClassSections(): Promise<ClassSection[]> {
  const { data, error } = await supabase
    .from('class_sections')
    .select(`
      id,
      name,
      grade_level,
      academic_year,
      teacher_id,
      capacity,
      enrollments ( student_id )
    `);

  if (error) {
    console.error('Error fetching class sections from Supabase:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    gradeLevel: row.grade_level ?? '',
    curriculumSystem: 'National',
    academicYear: row.academic_year ?? '',
    room: '-',
    teacherId: row.teacher_id ?? '',
    capacity: row.capacity ?? 25,
    students: (row.enrollments || []).map((e: any) => e.student_id),
    schedule: [],
  }));
}

// بيجيب المدرسين الحقيقيين (مع بياناتهم من جدول users)
const ALL_SUBJECTS = ['رياضيات', 'علوم', 'لغة عربية', 'لغة إنجليزية', 'تاريخ', 'فنون'];

export async function getTeachers(): Promise<(Teacher & { userId: string; grades: string[]; subjects: string[]; teacherType: 'Main' | 'Assistant'; canUseQuestionBank: boolean; teacherCode: string })[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select(`
      id,
      user_id,
      specialization,
      employment_type,
      hiring_date,
      teacher_type,
      teacher_code,
      can_add_to_question_bank,
      users ( name, email ),
      teacher_grades ( grade ),
      teacher_subjects ( subject )
    `);

  if (error) {
    console.error('Error fetching teachers from Supabase:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.users?.name ?? 'بدون اسم',
    role: 'TEACHER' as any,
    avatar: '',
    email: row.users?.email ?? '',
    specialization: row.specialization ?? '',
    hiringDate: row.hiring_date ?? '',
    employmentType: row.employment_type ?? 'Full-time',
    phone: '',
    assignedClasses: [],
    academicLoad: 0,
    grades: (row.teacher_grades || []).map((g: any) => g.grade),
    subjects: (row.teacher_subjects || []).map((s: any) => s.subject),
    teacherType: row.teacher_type ?? 'Main',
    canUseQuestionBank: row.can_add_to_question_bank ?? false,
    teacherCode: row.teacher_code ?? '',
  }));
}

// بيجيب المعلمين المسجّلين فعليًا على مادة معيّنة (من جدول teacher_subjects)
export async function getTeachersBySubject(subject: string): Promise<Teacher[]> {
  const { data, error } = await supabase
    .from('teacher_subjects')
    .select(`
      subject,
      teachers ( id, specialization, employment_type, users ( name, email ) )
    `)
    .eq('subject', subject);

  if (error) {
    console.error('Error fetching teachers by subject:', error);
    return [];
  }

  return (data || [])
    .filter((row: any) => row.teachers)
    .map((row: any) => ({
      id: row.teachers.id,
      name: row.teachers.users?.name ?? 'بدون اسم',
      role: 'TEACHER' as any,
      avatar: '',
      email: row.teachers.users?.email ?? '',
      specialization: row.teachers.specialization ?? '',
      hiringDate: '',
      employmentType: row.teachers.employment_type ?? 'Full-time',
      phone: '',
      assignedClasses: [],
      academicLoad: 0,
    }));
}

// بينشئ معلم حقيقي جديد (يوزر + سجل معلم + ربطه بمواده وصفوفه ونوعه)
export async function createTeacher(input: {
  name: string;
  email: string;
  password: string;
  hiringDate: string;
  employmentType: string;
  subjects: string[];
  allSubjects: boolean;
  grades: string[];
  teacherType: 'Main' | 'Assistant';
  canUseQuestionBank?: boolean;
}): Promise<string | null> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .insert({ name: input.name, role: 'TEACHER', email: input.email?.trim() ? input.email.trim() : null, password: input.password || null })
    .select('id')
    .single();

  if (userError || !userRow) {
    console.error('Error creating teacher user:', userError);
    return null;
  }

  const effectiveSubjects = input.allSubjects ? ALL_SUBJECTS : input.subjects;
  const specializationLabel = input.allSubjects ? 'كل المواد' : (effectiveSubjects.join('، ') || '');

  // كود تلقائي فريد لكل معلم جديد (يُستخدم في ربط ملفات الإكسيل بجدول الحصص)
  const { data: existingCodes } = await supabase.from('teachers').select('teacher_code').not('teacher_code', 'is', null);
  const maxNum = (existingCodes || []).reduce((max: number, row: any) => {
    const match = /T-(\d+)/.exec(row.teacher_code || '');
    const num = match ? parseInt(match[1], 10) : 0;
    return Math.max(max, num);
  }, 0);
  const newTeacherCode = `T-${String(maxNum + 1).padStart(4, '0')}`;

  const { data: teacherRow, error: teacherError } = await supabase
    .from('teachers')
    .insert({
      user_id: userRow.id,
      specialization: specializationLabel,
      employment_type: input.employmentType,
      hiring_date: input.hiringDate || null,
      teacher_type: input.teacherType,
      can_add_to_question_bank: input.canUseQuestionBank || false,
      teacher_code: newTeacherCode,
    })
    .select('id')
    .single();

  if (teacherError || !teacherRow) {
    console.error('Error creating teacher record:', teacherError);
    return null;
  }

  if (effectiveSubjects.length > 0) {
    const rows = effectiveSubjects.map(s => ({ teacher_id: teacherRow.id, subject: s }));
    const { error: subjectError } = await supabase.from('teacher_subjects').insert(rows);
    if (subjectError) console.error('Error linking teacher to subjects:', subjectError);
  }

  if (input.grades.length > 0) {
    const rows = input.grades.map(g => ({ teacher_id: teacherRow.id, grade: g }));
    const { error: gradesError } = await supabase.from('teacher_grades').insert(rows);
    if (gradesError) console.error('Error linking teacher to grades:', gradesError);
  }

  return teacherRow.id;
}

// بيعدّل بيانات معلم موجود (يوزر + سجل معلم + يعيد ضبط مواده وصفوفه)
export async function updateTeacher(input: {
  teacherId: string;
  userId: string;
  name: string;
  email: string;
  employmentType: string;
  subjects: string[];
  allSubjects: boolean;
  grades: string[];
  teacherType: 'Main' | 'Assistant';
  password?: string;
  canUseQuestionBank?: boolean;
}): Promise<boolean> {
  const userUpdate: any = { name: input.name, email: input.email?.trim() ? input.email.trim() : null };
  if (input.password) userUpdate.password = input.password;
  const { error: userError } = await supabase
    .from('users')
    .update(userUpdate)
    .eq('id', input.userId);

  if (userError) {
    console.error('Error updating teacher user:', userError);
    return false;
  }

  const effectiveSubjects = input.allSubjects ? ALL_SUBJECTS : input.subjects;
  const specializationLabel = input.allSubjects ? 'كل المواد' : (effectiveSubjects.join('، ') || '');

  const { error: teacherError } = await supabase
    .from('teachers')
    .update({
      specialization: specializationLabel,
      employment_type: input.employmentType,
      teacher_type: input.teacherType,
      can_add_to_question_bank: input.canUseQuestionBank || false,
    })
    .eq('id', input.teacherId);

  if (teacherError) {
    console.error('Error updating teacher record:', teacherError);
    return false;
  }

  // بنمسح المواد والصفوف القديمة ونحط الجديدة بدل ما نحاول نعمل diff معقد
  await supabase.from('teacher_subjects').delete().eq('teacher_id', input.teacherId);
  await supabase.from('teacher_grades').delete().eq('teacher_id', input.teacherId);

  if (effectiveSubjects.length > 0) {
    const rows = effectiveSubjects.map(s => ({ teacher_id: input.teacherId, subject: s }));
    const { error } = await supabase.from('teacher_subjects').insert(rows);
    if (error) console.error('Error re-linking teacher to subjects:', error);
  }

  if (input.grades.length > 0) {
    const rows = input.grades.map(g => ({ teacher_id: input.teacherId, grade: g }));
    const { error } = await supabase.from('teacher_grades').insert(rows);
    if (error) console.error('Error re-linking teacher to grades:', error);
  }

  return true;
}

// بيمسح معلم بالكامل (مسح اليوزر بيمسح معاه تلقائيًا سجل المعلم ومواده وصفوفه، لأن العلاقات معمولة بـ CASCADE)
export async function deleteTeacher(userId: string): Promise<boolean> {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    console.error('Error deleting teacher:', error);
    return false;
  }
  return true;
}

// بيجيب سجلات الحضور المُسجّلة فعليًا في تاريخ معيّن لفصل معيّن، منظّمة حسب الحصة (أو daily لو يومي)
export async function getAttendanceForDate(sectionId: string, date: string): Promise<Record<string, Record<string, string>>> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_id, status, attendance_sessions!inner(section_id, date, period_id)')
    .eq('attendance_sessions.section_id', sectionId)
    .eq('attendance_sessions.date', date);

  if (error || !data) {
    console.error('Error fetching attendance for date:', error);
    return {};
  }

  const statusMap: Record<string, string> = { Present: 'present', Absent: 'absent', Late: 'late', Excused: 'excused' };
  const result: Record<string, Record<string, string>> = {};
  (data as any[]).forEach(row => {
    const periodKey = row.attendance_sessions.period_id || 'daily';
    if (!result[periodKey]) result[periodKey] = {};
    result[periodKey][row.student_id] = statusMap[row.status] || 'absent';
  });
  return result;
}


export async function getPeriods(sectionId: string): Promise<{ id: string; subject: string; day: string; startTime: string; endTime: string; teacherId: string | null }[]> {
  const { data, error } = await supabase
    .from('class_periods')
    .select('id, subject, day, start_time, end_time, teacher_id')
    .eq('section_id', sectionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching periods:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    subject: row.subject,
    day: row.day ?? '',
    startTime: row.start_time ?? '',
    endTime: row.end_time ?? '',
    teacherId: row.teacher_id ?? null,
  }));
}

// بيتأكد إن مفيش حصة تانية لنفس الفصل بتتعارض في نفس اليوم والوقت قبل ما ننشئ حصة جديدة
function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

// بينشئ حصة حقيقية جديدة لفصل معيّن (من تاب "الجدول" جوه الفصل)
// بيرجّع { id } لو نجح، أو { conflict: true, conflictSubject } لو فيه تعارض في الميعاد
export async function createPeriod(input: {
  sectionId: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
  teacherId?: string | null;
}): Promise<{ id: string | null; conflict?: boolean; conflictSubject?: string }> {
  const existing = await getPeriods(input.sectionId);
  const conflicting = existing.find(p => p.day === input.day && timesOverlap(input.startTime, input.endTime, p.startTime, p.endTime));
  if (conflicting) {
    return { id: null, conflict: true, conflictSubject: conflicting.subject };
  }

  const { data, error } = await supabase
    .from('class_periods')
    .insert({
      section_id: input.sectionId,
      subject: input.subject,
      day: input.day,
      start_time: input.startTime,
      end_time: input.endTime,
      teacher_id: input.teacherId || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating period:', error);
    return { id: null };
  }
  return { id: data.id };
}

// بيجيب حالة حضور كل طالب في الفصل ده "النهاردة" (عبر كل الحصص) — present لو ظهر حاضر/متأخر في أي حصة النهاردة
export async function getTodayAttendanceForSection(sectionId: string): Promise<Record<string, 'present' | 'absent'>> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_id, status, attendance_sessions!inner(section_id, date)')
    .eq('attendance_sessions.section_id', sectionId)
    .eq('attendance_sessions.date', today);

  if (error || !data) {
    console.error('Error fetching today attendance:', error);
    return {};
  }

  const result: Record<string, 'present' | 'absent'> = {};
  (data as any[]).forEach(row => {
    if (row.status === 'Present' || row.status === 'Late') {
      result[row.student_id] = 'present';
    } else if (!result[row.student_id]) {
      result[row.student_id] = 'absent';
    }
  });
  return result;
}


// إعدادات تسجيل الحضور (يومي أو حسب الحصة) — صف واحد عام للمدرسة كلها
export async function getAttendanceSettings(): Promise<{ mode: 'Daily' | 'Period'; lateThreshold: number; maxLateCount: number }> {
  const { data, error } = await supabase
    .from('attendance_settings')
    .select('mode, late_threshold, max_late_count')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching attendance settings:', error);
    return { mode: 'Period', lateThreshold: 15, maxLateCount: 5 };
  }
  return { mode: data.mode, lateThreshold: data.late_threshold, maxLateCount: data.max_late_count ?? 5 };
}

export async function saveAttendanceSettings(mode: 'Daily' | 'Period', lateThreshold: number, maxLateCount: number): Promise<boolean> {
  const { error } = await supabase
    .from('attendance_settings')
    .upsert({ id: 1, mode, late_threshold: lateThreshold, max_late_count: maxLateCount });

  if (error) {
    console.error('Error saving attendance settings:', error);
    return false;
  }
  return true;
}

export interface LateStudentRow {
  recordId: string;
  studentId: string;
  studentName: string;
  className: string;
  gradeLevel: string;
  time: string;
  reason: string | null;
  totalLateCount: number;
  status: 'Late' | 'Excused';
  excuseReason: string | null;
}

// كل حالات التأخير بتاعة يوم معيّن (بعذر وبدونه)، مع إجمالي مرات التأخير التاريخية لكل طالب (لمقارنتها بالحد المسموح)
export async function getLateStudentsForDateRange(startDate: string, endDate: string): Promise<LateStudentRow[]> {
  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select('id, created_at, class_sections(name, grade_level)')
    .gte('date', startDate)
    .lte('date', endDate);
  const sessionIds = (sessions || []).map((s: any) => s.id);
  if (sessionIds.length === 0) return [];

  const { data: records } = await supabase
    .from('attendance_records')
    .select('id, session_id, student_id, late_reason, excuse_reason, status')
    .in('session_id', sessionIds)
    .or('status.eq.Late,and(status.eq.Excused,excuse_of_status.eq.Late)');
  if (!records || records.length === 0) return [];

  const [studentsRes, allLateCountsRes] = await Promise.all([
    supabase.from('students').select('id, users(name)'),
    supabase.from('attendance_records').select('student_id').in('status', ['Late', 'Excused']),
  ]);

  const studentNameById: Record<string, string> = {};
  (studentsRes.data || []).forEach((s: any) => { studentNameById[s.id] = s.users?.name || ''; });

  const lateCountByStudent: Record<string, number> = {};
  (allLateCountsRes.data || []).forEach((r: any) => { lateCountByStudent[r.student_id] = (lateCountByStudent[r.student_id] || 0) + 1; });

  const sessionById: Record<string, any> = {};
  (sessions || []).forEach((s: any) => { sessionById[s.id] = s; });

  return (records as any[]).map((r) => {
    const session = sessionById[r.session_id];
    return {
      recordId: r.id,
      studentId: r.student_id,
      studentName: studentNameById[r.student_id] || '—',
      className: session?.class_sections?.name || '—',
      gradeLevel: session?.class_sections?.grade_level || '—',
      time: session?.created_at ? new Date(session.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—',
      reason: r.late_reason || null,
      totalLateCount: lateCountByStudent[r.student_id] || 0,
      status: r.status,
      excuseReason: r.excuse_reason || null,
    };
  });
}

export async function saveLateReason(recordId: string, reason: string): Promise<boolean> {
  const { error } = await supabase.from('attendance_records').update({ late_reason: reason }).eq('id', recordId);
  return !error;
}

// بيحفظ جلسة حضور جديدة (تاريخ اليوم + حالة كل طالب) في قاعدة البيانات
export async function saveAttendanceSession(input: {
  sectionId: string;
  date: string;
  subject?: string;
  periodId?: string | null;
  records: { studentId: string; status: string }[];
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert({
      section_id: input.sectionId,
      date: input.date,
      subject: input.subject || null,
      period_id: input.periodId || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating attendance session:', error);
    return null;
  }

  const sessionId = data.id;

  if (input.records.length > 0) {
    const rows = input.records.map((r) => ({
      session_id: sessionId,
      student_id: r.studentId,
      status: r.status,
      method: 'Manual',
    }));
    const { error: recError } = await supabase.from('attendance_records').insert(rows);
    if (recError) console.error('Error saving attendance records:', recError);
  }

  return sessionId;
}
export async function createClassSection(input: {
  name: string;
  gradeLevel: string;
  teacherId?: string;
  academicYear?: string;
  capacity?: number;
  studentIds: string[];
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('class_sections')
    .insert({
      name: input.name,
      grade_level: input.gradeLevel,
      teacher_id: input.teacherId || null,
      academic_year: input.academicYear || null,
      capacity: input.capacity ?? 25,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Error creating class section:', error);
    return null;
  }

  const sectionId = data.id;

  if (input.studentIds.length > 0) {
    const rows = input.studentIds.map((studentId) => ({ student_id: studentId, section_id: sectionId }));
    const { error: enrollError } = await supabase.from('enrollments').insert(rows);
    if (enrollError) console.error('Error enrolling students:', enrollError);
  }

  return sectionId;
}

// بيعدّل بيانات فصل موجود
export async function updateClassSection(input: {
  sectionId: string;
  name: string;
  gradeLevel: string;
  teacherId?: string | null;
  academicYear?: string;
  capacity?: number;
}): Promise<boolean> {
  const { error } = await supabase
    .from('class_sections')
    .update({
      name: input.name,
      grade_level: input.gradeLevel,
      teacher_id: input.teacherId || null,
      academic_year: input.academicYear || null,
      capacity: input.capacity ?? 25,
    })
    .eq('id', input.sectionId);

  if (error) {
    console.error('Error updating class section:', error);
    return false;
  }
  return true;
}

// بيمسح فصل واحد (بيمسح معاه تلقائيًا التسجيلات والحصص وجلسات الحضور بتاعته بسبب CASCADE)
export async function deleteClassSection(sectionId: string): Promise<boolean> {
  const { error } = await supabase.from('class_sections').delete().eq('id', sectionId);
  if (error) {
    console.error('Error deleting class section:', error);
    return false;
  }
  return true;
}

// بيمسح مجموعة فصول دفعة واحدة
export async function bulkDeleteClassSections(sectionIds: string[]): Promise<boolean> {
  if (sectionIds.length === 0) return true;
  const { error } = await supabase.from('class_sections').delete().in('id', sectionIds);
  if (error) {
    console.error('Error bulk deleting class sections:', error);
    return false;
  }
  return true;
}

// بيجيب الإداريين الحقيقيين مع صلاحياتهم
export async function getAdmins(): Promise<{ id: string; userId: string; name: string; email: string; title: string; department: string; permissions: string[] }[]> {
  const { data, error } = await supabase
    .from('admins')
    .select(`
      id,
      user_id,
      title,
      department,
      users ( name, email ),
      admin_permissions ( permission )
    `);

  if (error) {
    console.error('Error fetching admins:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.users?.name ?? 'بدون اسم',
    email: row.users?.email ?? '',
    title: row.title ?? '',
    department: row.department ?? '',
    permissions: (row.admin_permissions || []).map((p: any) => p.permission),
  }));
}

// بينشئ إداري حقيقي جديد
export async function createAdmin(input: {
  name: string;
  email: string;
  password: string;
  title: string;
  department: string;
  permissions: string[];
}): Promise<string | null> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .insert({ name: input.name, role: 'ADMIN', email: input.email?.trim() ? input.email.trim() : null, password: input.password || null })
    .select('id')
    .single();

  if (userError || !userRow) {
    console.error('Error creating admin user:', userError);
    return null;
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .insert({ user_id: userRow.id, title: input.title, department: input.department })
    .select('id')
    .single();

  if (adminError || !adminRow) {
    console.error('Error creating admin record:', adminError);
    return null;
  }

  if (input.permissions.length > 0) {
    const rows = input.permissions.map((p) => ({ admin_id: adminRow.id, permission: p }));
    const { error } = await supabase.from('admin_permissions').insert(rows);
    if (error) console.error('Error linking admin permissions:', error);
  }

  return adminRow.id;
}

// بيعدّل بيانات إداري موجود
export async function updateAdmin(input: {
  adminId: string;
  userId: string;
  name: string;
  email: string;
  title: string;
  department: string;
  permissions: string[];
}): Promise<boolean> {
  const { error: userError } = await supabase
    .from('users')
    .update({ name: input.name, email: input.email?.trim() ? input.email.trim() : null })
    .eq('id', input.userId);
  if (userError) {
    console.error('Error updating admin user:', userError);
    return false;
  }

  const { error: adminError } = await supabase
    .from('admins')
    .update({ title: input.title, department: input.department })
    .eq('id', input.adminId);
  if (adminError) {
    console.error('Error updating admin record:', adminError);
    return false;
  }

  await supabase.from('admin_permissions').delete().eq('admin_id', input.adminId);
  if (input.permissions.length > 0) {
    const rows = input.permissions.map((p) => ({ admin_id: input.adminId, permission: p }));
    const { error } = await supabase.from('admin_permissions').insert(rows);
    if (error) console.error('Error re-linking admin permissions:', error);
  }

  return true;
}

// بيمسح إداري واحد
export async function deleteAdmin(userId: string): Promise<boolean> {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    console.error('Error deleting admin:', error);
    return false;
  }
  return true;
}

// بيمسح مجموعة إداريين دفعة واحدة
export async function bulkDeleteAdmins(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const { error } = await supabase.from('users').delete().in('id', userIds);
  if (error) {
    console.error('Error bulk deleting admins:', error);
    return false;
  }
  return true;
}

// تسجيل دخول حقيقي: بيدوّر على مستخدم بنفس الإيميل والباسورد، وبيجيب دوره وصلاحياته لو كان إداري
export async function getUserByCredentials(email: string, password: string): Promise<{
  id: string;
  name: string;
  role: string;
  email: string;
  permissions: string[];
} | null> {
  const { data: userRow, error } = await supabase
    .from('users')
    .select('id, name, role, email, password')
    .eq('email', email)
    .eq('password', password)
    .maybeSingle();

  if (error || !userRow) {
    return null;
  }

  let permissions: string[] = [];
  if (userRow.role === 'ADMIN' || userRow.role === 'SUPER_ADMIN') {
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id, admin_permissions ( permission )')
      .eq('user_id', userRow.id)
      .maybeSingle();
    if (adminRow) {
      permissions = ((adminRow as any).admin_permissions || []).map((p: any) => p.permission);
    }
  }

  return {
    id: userRow.id,
    name: userRow.name,
    role: userRow.role,
    email: userRow.email,
    permissions,
  };
}

// ================== الدرجات والتقييم (Gradebook) ==================

// بيجيب كل الفصول الدراسية (الترمات)، ولو مفيش ولا واحد بينشئ فصل افتراضي أول مرة
export async function getOrCreateDefaultTerm(): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.from('grading_terms').select('id, name').order('created_at', { ascending: true });
  if (!error && data && data.length > 0) {
    return { id: data[0].id, name: data[0].name };
  }
  const { data: newTerm, error: insertError } = await supabase
    .from('grading_terms')
    .insert({ name: 'الفصل الدراسي الأول' })
    .select('id, name')
    .single();
  if (insertError || !newTerm) {
    console.error('Error creating default term:', insertError);
    return { id: '', name: 'الفصل الدراسي الأول' };
  }
  return { id: newTerm.id, name: newTerm.name };
}

export async function getTerms(): Promise<{ id: string; name: string; startDate: string; endDate: string; status: string }[]> {
  const { data, error } = await supabase.from('grading_terms').select('id, name, start_date, end_date, status').order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching terms:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    status: row.status ?? 'Active',
  }));
}

export async function createTerm(name: string, startDate: string, endDate: string): Promise<string | null> {
  const { data, error } = await supabase.from('grading_terms').insert({ name, start_date: startDate || null, end_date: endDate || null }).select('id').single();
  if (error || !data) {
    console.error('Error creating term:', error);
    return null;
  }
  return data.id;
}

export async function updateTerm(termId: string, name: string, startDate: string, endDate: string): Promise<boolean> {
  const { error } = await supabase.from('grading_terms').update({ name, start_date: startDate || null, end_date: endDate || null }).eq('id', termId);
  if (error) {
    console.error('Error updating term:', error);
    return false;
  }
  return true;
}

export async function deleteTerm(termId: string): Promise<boolean> {
  const { error } = await supabase.from('grading_terms').delete().eq('id', termId);
  if (error) {
    console.error('Error deleting term:', error);
    return false;
  }
  return true;
}

// بيجيب كل إعدادات الدرجات (مادة + الصفوف المشتركة فيها + حالة الاعتماد)
export async function getGradebookConfigs(): Promise<{
  id: string;
  subjectName: string;
  passingScore: number;
  categoryWeights: Record<string, number>;
  gradingDisplayType: string;
  status: string;
  academicYear: string;
  grades: string[];
}[]> {
  const { data, error } = await supabase
    .from('gradebook_configs')
    .select('id, subject_name, passing_score, category_weights, grading_display_type, status, academic_year, gradebook_config_grades ( grade )');
  if (error) {
    console.error('Error fetching gradebook configs:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    subjectName: row.subject_name,
    passingScore: row.passing_score,
    categoryWeights: row.category_weights || {},
    gradingDisplayType: row.grading_display_type || 'Points',
    status: row.status,
    academicYear: row.academic_year || '',
    grades: (row.gradebook_config_grades || []).map((g: any) => g.grade),
  }));
}

// بينشئ إعداد درجات جديد (مادة + صفوف مشتركة + أوزان الفئات)
export async function createGradebookConfig(input: {
  subjectName: string;
  grades: string[];
  passingScore: number;
  categoryWeights: Record<string, number>;
  academicYear?: string;
}): Promise<string | null> {
  const { data: configRow, error: configError } = await supabase
    .from('gradebook_configs')
    .insert({
      subject_name: input.subjectName,
      passing_score: input.passingScore,
      category_weights: input.categoryWeights,
      academic_year: input.academicYear || null,
      status: 'draft',
    })
    .select('id')
    .single();
  if (configError || !configRow) {
    console.error('Error creating gradebook config:', configError);
    return null;
  }
  if (input.grades.length > 0) {
    const rows = input.grades.map(g => ({ config_id: configRow.id, grade: g }));
    const { error } = await supabase.from('gradebook_config_grades').insert(rows);
    if (error) {
      console.error('Error linking gradebook config to grades:', error);
      // بدل ما نسيب النظام من غير صفوف مربوطة بيه (يبقى مستحيل نلاقيه بعد كده)، بنمسحه ونرجّع فشل واضح
      await supabase.from('gradebook_configs').delete().eq('id', configRow.id);
      return null;
    }
  }
  return configRow.id;
}

export async function updateGradebookConfigStatus(configId: string, status: 'draft' | 'pending' | 'approved' | 'archived'): Promise<boolean> {
  const { error } = await supabase.from('gradebook_configs').update({ status }).eq('id', configId);
  if (error) {
    console.error('Error updating gradebook config status:', error);
    return false;
  }
  return true;
}

// بيجيب التقييمات الحقيقية بتاعة إعداد درجات معيّن
export async function getAssessments(configId: string): Promise<{ id: string; title: string; category: string; maxScore: number; date: string; termId: string; weight: number }[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, title, category, max_score, date, term_id, weight')
    .eq('config_id', configId)
    .order('date', { ascending: true });
  if (error) {
    console.error('Error fetching assessments:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    maxScore: row.max_score,
    date: row.date,
    termId: row.term_id,
    weight: row.weight ?? 100,
  }));
}

export async function createAssessment(input: {
  configId: string;
  termId: string;
  title: string;
  category: string;
  maxScore: number;
  date: string;
  weight?: number;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      config_id: input.configId,
      term_id: input.termId,
      title: input.title,
      category: input.category,
      max_score: input.maxScore,
      date: input.date,
      weight: input.weight ?? 100,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('Error creating assessment:', error);
    return null;
  }
  return data.id;
}

export async function deleteAssessment(assessmentId: string): Promise<boolean> {
  const { error } = await supabase.from('assessments').delete().eq('id', assessmentId);
  if (error) {
    console.error('Error deleting assessment:', error);
    return false;
  }
  return true;
}

// بيجيب درجات كل الطلاب في كل تقييمات إعداد درجات معيّن، منظّمة (studentId-assessmentId -> score)
export async function getGradeEntries(configId: string): Promise<{ studentId: string; assessmentId: string; score: number | null; status: string }[]> {
  const { data, error } = await supabase
    .from('grade_entries')
    .select('student_id, assessment_id, score, status, assessments!inner(config_id)')
    .eq('assessments.config_id', configId);
  if (error) {
    console.error('Error fetching grade entries:', error);
    return [];
  }
  return (data as any[]).map(row => ({
    studentId: row.student_id,
    assessmentId: row.assessment_id,
    score: row.score,
    status: row.status,
  }));
}

// بيحفظ مجموعة درجات دفعة واحدة (upsert)
export async function saveGradeEntries(entries: { studentId: string; assessmentId: string; score: number | null; status: string }[]): Promise<boolean> {
  if (entries.length === 0) return true;
  const rows = entries.map(e => ({
    student_id: e.studentId,
    assessment_id: e.assessmentId,
    score: e.score,
    status: e.status,
  }));
  const { error } = await supabase.from('grade_entries').upsert(rows, { onConflict: 'assessment_id,student_id' });
  if (error) {
    console.error('Error saving grade entries:', error);
    return false;
  }
  return true;
}


// بيضيف طالب حقيقي لفصل موجود (تسجيل حقيقي في جدول enrollments)
export async function addEnrollment(studentId: string, sectionId: string): Promise<boolean> {
  const { error } = await supabase.from('enrollments').insert({ student_id: studentId, section_id: sectionId });
  if (error) {
    console.error('Error adding enrollment:', error);
    return false;
  }
  return true;
}

// بيشيل طالب حقيقي من فصل موجود
export async function removeEnrollment(studentId: string, sectionId: string): Promise<boolean> {
  const { error } = await supabase.from('enrollments').delete().eq('student_id', studentId).eq('section_id', sectionId);
  if (error) {
    console.error('Error removing enrollment:', error);
    return false;
  }
  return true;
}

// بيعدّل بيانات نظام درجات موجود (المادة، الصفوف، درجة النجاح، أوزان الفئات)
export async function updateGradebookConfig(input: {
  configId: string;
  subjectName: string;
  grades: string[];
  passingScore: number;
  categoryWeights: Record<string, number>;
}): Promise<boolean> {
  const { error: configError } = await supabase
    .from('gradebook_configs')
    .update({
      subject_name: input.subjectName,
      passing_score: input.passingScore,
      category_weights: input.categoryWeights,
    })
    .eq('id', input.configId);
  if (configError) {
    console.error('Error updating gradebook config:', configError);
    return false;
  }

  await supabase.from('gradebook_config_grades').delete().eq('config_id', input.configId);
  if (input.grades.length > 0) {
    const rows = input.grades.map(g => ({ config_id: input.configId, grade: g }));
    const { error } = await supabase.from('gradebook_config_grades').insert(rows);
    if (error) {
      console.error('Error re-linking gradebook config grades:', error);
      return false;
    }
  }
  return true;
}

// بيجيب مواد المنهج الدراسي الحقيقية لصف معيّن (المصدر الصح لقايمة المواد، مش سجلات الدرجات)
export async function getCurriculumSubjects(grade: string): Promise<string[]> {
  const { data, error } = await supabase.from('curriculum_subjects').select('subject').eq('grade', grade);
  if (error) {
    console.error('Error fetching curriculum subjects:', error);
    return [];
  }
  return (data || []).map((row: any) => row.subject);
}

// ================== المنهج الدراسي (Curriculum) ==================

// بيجيب كل مواد صف معيّن مع تفاصيلها
export async function getAllDistinctSubjects(): Promise<string[]> {
  const { data, error } = await supabase.from('curriculum_subjects').select('subject');
  if (error) {
    console.error('Error fetching distinct subjects:', error);
    return [];
  }
  return Array.from(new Set((data || []).map((row: any) => row.subject))).sort();
}

export async function getCurriculumSubjectsDetailed(grade: string): Promise<{ subject: string; code: string; nameEn: string; department: string; credits: number; color: string }[]> {
  const { data, error } = await supabase.from('curriculum_subjects').select('subject, code, name_en, department, credits, color').eq('grade', grade);
  if (error) {
    console.error('Error fetching curriculum subjects:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    subject: row.subject,
    code: row.code || '',
    nameEn: row.name_en || '',
    department: row.department || '',
    credits: row.credits ?? 3,
    color: row.color || 'bg-violet-500',
  }));
}

// بيجيب كل المواد بتاعة كل الصفوف مع تفاصيلها (لشاشة "المواد والمقررات" في الإعدادات)
export async function getAllCurriculumSubjectsWithGrade(): Promise<{ id: string; grade: string; subject: string; code: string; nameEn: string; department: string; credits: number; color: string; trackIds: string[] }[]> {
  const { data, error } = await supabase.from('curriculum_subjects').select('id, grade, subject, code, name_en, department, credits, color').order('grade', { ascending: true });
  if (error) {
    console.error('Error fetching all curriculum subjects:', error);
    return [];
  }
  const { data: trackLinks } = await supabase.from('subject_tracks').select('subject_id, track_id');
  return (data || []).map((row: any) => ({
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    code: row.code || '',
    nameEn: row.name_en || '',
    department: row.department || 'General',
    credits: row.credits ?? 3,
    color: row.color || 'bg-violet-500',
    trackIds: (trackLinks || []).filter((l: any) => l.subject_id === row.id).map((l: any) => l.track_id),
  }));
}

// بيضيف مادة جديدة لمنهج صف معيّن (المادة ممكن تكون مرتبطة بأكتر من مسار في نفس الوقت)
export async function addCurriculumSubject(input: { grade: string; subject: string; code?: string; nameEn?: string; department?: string; credits?: number; color?: string; trackIds?: string[] }): Promise<boolean> {
  const { data, error } = await supabase.from('curriculum_subjects').insert({
    grade: input.grade,
    subject: input.subject,
    code: input.code || null,
    name_en: input.nameEn || null,
    department: input.department || null,
    credits: input.credits ?? 3,
    color: input.color || 'bg-violet-500',
  }).select('id').single();
  if (error || !data) {
    console.error('Error adding curriculum subject:', error);
    return false;
  }
  if (input.trackIds && input.trackIds.length > 0) {
    await supabase.from('subject_tracks').insert(input.trackIds.map((tid) => ({ subject_id: data.id, track_id: tid })));
  }
  return true;
}

// بيعدّل بيانات مادة موجودة (عن طريق الـ id)
export async function updateCurriculumSubjectById(id: string, input: { code?: string; nameEn?: string; department?: string; credits?: number; color?: string; trackIds?: string[] }): Promise<boolean> {
  const { error } = await supabase.from('curriculum_subjects').update({
    code: input.code || null,
    name_en: input.nameEn || null,
    department: input.department || null,
    credits: input.credits ?? 3,
    color: input.color || 'bg-violet-500',
  }).eq('id', id);
  if (error) {
    console.error('Error updating curriculum subject:', error);
    return false;
  }
  if (input.trackIds !== undefined) {
    await supabase.from('subject_tracks').delete().eq('subject_id', id);
    if (input.trackIds.length > 0) {
      await supabase.from('subject_tracks').insert(input.trackIds.map((tid) => ({ subject_id: id, track_id: tid })));
    }
  }
  return true;
}

export async function removeCurriculumSubjectById(id: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_subjects').delete().eq('id', id);
  if (error) {
    console.error('Error removing curriculum subject:', error);
    return false;
  }
  return true;
}

// بيمسح مادة من منهج صف معيّن
export async function removeCurriculumSubject(grade: string, subject: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_subjects').delete().eq('grade', grade).eq('subject', subject);
  if (error) {
    console.error('Error removing curriculum subject:', error);
    return false;
  }
  return true;
}

// بيجيب الخطة الأسبوعية الحقيقية لمادة في صف معيّن
export async function getCurriculumWeeks(grade: string, subject: string): Promise<{ id: string; weekNumber: number; startDate: string; endDate: string; topics: string[] }[]> {
  const { data, error } = await supabase
    .from('curriculum_weeks')
    .select('id, week_number, start_date, end_date, topics')
    .eq('grade', grade)
    .eq('subject', subject)
    .order('week_number', { ascending: true });
  if (error) {
    console.error('Error fetching curriculum weeks:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    weekNumber: row.week_number,
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    topics: row.topics || [],
  }));
}

// بيحفظ (ينشئ أو يعدّل) أسبوع كامل بمواضيعه
export async function saveCurriculumWeek(input: { grade: string; subject: string; weekNumber: number; startDate: string; endDate: string; topics: string[] }): Promise<boolean> {
  const { error } = await supabase.from('curriculum_weeks').upsert({
    grade: input.grade,
    subject: input.subject,
    week_number: input.weekNumber,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    topics: input.topics,
  }, { onConflict: 'grade,subject,week_number' });
  if (error) {
    console.error('Error saving curriculum week:', error);
    return false;
  }
  return true;
}

export async function deleteCurriculumWeek(weekId: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_weeks').delete().eq('id', weekId);
  if (error) {
    console.error('Error deleting curriculum week:', error);
    return false;
  }
  return true;
}

// بيجيب موارد مادة معيّنة (وفلاتر اختياري بالمجلد)
export async function getCurriculumResources(grade: string, subject: string): Promise<{ id: string; title: string; type: string; url: string; folderId: string | null }[]> {
  const { data, error } = await supabase
    .from('curriculum_resources')
    .select('id, title, type, url, folder_id')
    .eq('grade', grade)
    .eq('subject', subject)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching curriculum resources:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, title: row.title, type: row.type, url: row.url, folderId: row.folder_id }));
}

export async function addCurriculumResource(input: { grade: string; subject: string; title: string; type: string; url: string; folderId?: string | null }): Promise<string | null> {
  const { data, error } = await supabase
    .from('curriculum_resources')
    .insert({ grade: input.grade, subject: input.subject, title: input.title, type: input.type, url: input.url, folder_id: input.folderId || null })
    .select('id')
    .single();
  if (error || !data) {
    console.error('Error adding curriculum resource:', error);
    return null;
  }
  return data.id;
}

export async function updateCurriculumResource(resourceId: string, input: { title: string; type: string; url: string }): Promise<boolean> {
  const { error } = await supabase.from('curriculum_resources').update({ title: input.title, type: input.type, url: input.url }).eq('id', resourceId);
  if (error) {
    console.error('Error updating curriculum resource:', error);
    return false;
  }
  return true;
}

export async function deleteCurriculumResource(resourceId: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_resources').delete().eq('id', resourceId);
  if (error) {
    console.error('Error deleting curriculum resource:', error);
    return false;
  }
  return true;
}

// مجلدات مكتبة الموارد
export async function getCurriculumFolders(grade: string, subject: string): Promise<{ id: string; name: string; parentFolderId: string | null }[]> {
  const { data, error } = await supabase.from('curriculum_folders').select('id, name, parent_folder_id').eq('grade', grade).eq('subject', subject);
  if (error) {
    console.error('Error fetching curriculum folders:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, name: row.name, parentFolderId: row.parent_folder_id }));
}

export async function createCurriculumFolder(input: { grade: string; subject: string; name: string; parentFolderId?: string | null }): Promise<string | null> {
  const { data, error } = await supabase
    .from('curriculum_folders')
    .insert({ grade: input.grade, subject: input.subject, name: input.name, parent_folder_id: input.parentFolderId || null })
    .select('id')
    .single();
  if (error || !data) {
    console.error('Error creating curriculum folder:', error);
    return null;
  }
  return data.id;
}

export async function renameCurriculumFolder(folderId: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_folders').update({ name }).eq('id', folderId);
  if (error) {
    console.error('Error renaming curriculum folder:', error);
    return false;
  }
  return true;
}

export async function deleteCurriculumFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_folders').delete().eq('id', folderId);
  if (error) {
    console.error('Error deleting curriculum folder:', error);
    return false;
  }
  return true;
}

// خطط الدروس
export async function getCurriculumLessonPlans(grade: string, subject: string): Promise<{ id: string; title: string; content: string; weekNumber: number | null }[]> {
  const { data, error } = await supabase
    .from('curriculum_lesson_plans')
    .select('id, title, content, week_number')
    .eq('grade', grade)
    .eq('subject', subject)
    .eq('assigned_to_subject', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching lesson plans:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, title: row.title, content: row.content || '', weekNumber: row.week_number }));
}

export async function getAllCurriculumLessonPlans(): Promise<{ id: string; title: string; content: string; grade: string; subject: string; createdAt: string; assigned: boolean }[]> {
  const { data, error } = await supabase
    .from('curriculum_lesson_plans')
    .select('id, title, content, grade, subject, created_at, assigned_to_subject')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching all lesson plans:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, title: row.title, content: row.content || '', grade: row.grade, subject: row.subject, createdAt: row.created_at, assigned: !!row.assigned_to_subject }));
}

export async function getCurriculumLessonPlanById(planId: string): Promise<{ id: string; title: string; content: string; grade: string; subject: string } | null> {
  const { data, error } = await supabase.from('curriculum_lesson_plans').select('id, title, content, grade, subject').eq('id', planId).maybeSingle();
  if (error || !data) {
    console.error('Error fetching lesson plan:', error);
    return null;
  }
  return data;
}

export async function createCurriculumLessonPlan(input: { grade: string; subject: string; title: string; content: string; weekNumber?: number | null; assigned?: boolean }): Promise<string | null> {
  const { data, error } = await supabase
    .from('curriculum_lesson_plans')
    .insert({ grade: input.grade, subject: input.subject, title: input.title, content: input.content, week_number: input.weekNumber ?? null, assigned_to_subject: input.assigned ?? false })
    .select('id')
    .single();
  if (error || !data) {
    console.error('Error creating lesson plan:', error);
    return null;
  }
  return data.id;
}

export async function updateCurriculumLessonPlan(planId: string, input: { title: string; content: string }): Promise<boolean> {
  const { error } = await supabase.from('curriculum_lesson_plans').update({ title: input.title, content: input.content }).eq('id', planId);
  if (error) {
    console.error('Error updating lesson plan:', error);
    return false;
  }
  return true;
}

export async function assignLessonPlanToSubject(planId: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_lesson_plans').update({ assigned_to_subject: true }).eq('id', planId);
  if (error) {
    console.error('Error assigning lesson plan to subject:', error);
    return false;
  }
  return true;
}

export async function deleteCurriculumLessonPlan(planId: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_lesson_plans').delete().eq('id', planId);
  if (error) {
    console.error('Error deleting lesson plan:', error);
    return false;
  }
  return true;
}

// إعداد النظام التعليمي والعام الدراسي (إعداد واحد عام)
// بيجيب بيانات العام الدراسي "النشط" فقط (ده اللي باقي النظام بيقرا منه: الجدول الزمني، إلخ)
export async function getAcademicYearSettings(): Promise<{ system: string; startDate: string; endDate: string; academicYear: string } | null> {
  const { data, error } = await supabase.from('academic_years').select('name, system, start_date, end_date').eq('status', 'Active').maybeSingle();
  if (error || !data || !data.system) {
    return null;
  }
  return { system: data.system, startDate: data.start_date, endDate: data.end_date, academicYear: data.name || '' };
}

// بيحفظ النظام التعليمي للعام النشط، أو بينشئ عام جديد نشط لو مفيش عام نشط أصلًا (أول استخدام)
export async function saveEducationSystem(system: string): Promise<boolean> {
  const { data: active } = await supabase.from('academic_years').select('id').eq('status', 'Active').maybeSingle();
  if (active) {
    const { error } = await supabase.from('academic_years').update({ system }).eq('id', active.id);
    if (error) { console.error('Error saving education system:', error); return false; }
    return true;
  }
  const { error } = await supabase.from('academic_years').insert({ name: 'العام الدراسي', system, status: 'Active' });
  if (error) { console.error('Error creating active academic year:', error); return false; }
  return true;
}

// كل الأعوام الدراسية (كل الحالات: مسودة / نشط / مؤرشف)
export async function getAcademicYears(): Promise<{ id: string; name: string; system: string; startDate: string; endDate: string; status: string }[]> {
  const { data, error } = await supabase.from('academic_years').select('id, name, system, start_date, end_date, status').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching academic years:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    system: row.system || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    status: row.status,
  }));
}

export async function createAcademicYear(input: { name: string; system?: string }): Promise<string | null> {
  const { data, error } = await supabase.from('academic_years').insert({ name: input.name, system: input.system || null, status: 'Draft' }).select('id').single();
  if (error || !data) {
    console.error('Error creating academic year:', error);
    return null;
  }
  return data.id;
}

export async function updateAcademicYear(id: string, input: { name?: string; startDate?: string; endDate?: string }): Promise<boolean> {
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.startDate !== undefined) patch.start_date = input.startDate || null;
  if (input.endDate !== undefined) patch.end_date = input.endDate || null;
  const { error } = await supabase.from('academic_years').update(patch).eq('id', id);
  if (error) {
    console.error('Error updating academic year:', error);
    return false;
  }
  return true;
}

// بيفعّل عام دراسي معيّن، وبيلغي تفعيل أي عام تاني كان نشط (عشان يفضل عام واحد بس نشط دايمًا)
export async function activateAcademicYear(id: string): Promise<boolean> {
  const { error: deactivateError } = await supabase.from('academic_years').update({ status: 'Archived' }).eq('status', 'Active').neq('id', id);
  if (deactivateError) {
    console.error('Error deactivating previous academic year:', deactivateError);
    return false;
  }
  const { error } = await supabase.from('academic_years').update({ status: 'Active' }).eq('id', id);
  if (error) {
    console.error('Error activating academic year:', error);
    return false;
  }
  return true;
}

export async function archiveAcademicYear(id: string): Promise<boolean> {
  const { error } = await supabase.from('academic_years').update({ status: 'Archived' }).eq('id', id);
  if (error) {
    console.error('Error archiving academic year:', error);
    return false;
  }
  return true;
}

export async function deleteAcademicYear(id: string): Promise<boolean> {
  const { error } = await supabase.from('academic_years').delete().eq('id', id);
  if (error) {
    console.error('Error deleting academic year:', error);
    return false;
  }
  return true;
}

// ================== الصفوف الدراسية (Grade Levels) ==================

export async function getGradeLevels(): Promise<{ id: string; name: string; displayOrder: number }[]> {
  const { data, error } = await supabase.from('grade_levels').select('id, name, display_order').order('display_order', { ascending: true });
  if (error) {
    console.error('Error fetching grade levels:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, name: row.name, displayOrder: row.display_order }));
}

export async function addGradeLevel(name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('grade_levels').select('display_order').order('display_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (existing?.display_order ?? 0) + 1;
  const { data, error } = await supabase.from('grade_levels').insert({ name, display_order: nextOrder }).select('id').single();
  if (error || !data) {
    console.error('Error adding grade level:', error);
    return null;
  }
  return data.id;
}

export async function deleteGradeLevel(id: string): Promise<boolean> {
  const { error } = await supabase.from('grade_levels').delete().eq('id', id);
  if (error) {
    console.error('Error deleting grade level:', error);
    return false;
  }
  return true;
}

// نواتج التعلم لمادة معيّنة في صف معيّن
export async function getLearningOutcomes(grade: string, subject: string): Promise<{ id: string; outcome: string }[]> {
  const { data, error } = await supabase.from('curriculum_learning_outcomes').select('id, outcome').eq('grade', grade).eq('subject', subject).order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching learning outcomes:', error);
    return [];
  }
  return data || [];
}

export async function addLearningOutcome(grade: string, subject: string, outcome: string): Promise<string | null> {
  const { data, error } = await supabase.from('curriculum_learning_outcomes').insert({ grade, subject, outcome }).select('id').single();
  if (error || !data) {
    console.error('Error adding learning outcome:', error);
    return null;
  }
  return data.id;
}

// ============ ثيم موحّد للمواد (أيقونة ولون) — جدول مشترك مع تاليا ليرن، مربوط باسم المادة نفسه ============
// أي تعديل من هنا أو من ليرن بيتحدّث في نفس الجدول، فبيبان فورًا في المكانين

export interface SubjectTheme {
  icon: string;
  color: string;
}

const DEFAULT_SUBJECT_THEME: SubjectTheme = { icon: 'book-open', color: 'bg-violet-500' };

export async function getSubjectThemes(): Promise<Record<string, SubjectTheme>> {
  const { data, error } = await supabase.from('subject_themes').select('subject_name, icon, color');
  if (error || !data) return {};
  const map: Record<string, SubjectTheme> = {};
  for (const row of data) {
    map[row.subject_name] = { icon: row.icon || DEFAULT_SUBJECT_THEME.icon, color: row.color || DEFAULT_SUBJECT_THEME.color };
  }
  return map;
}

export function getSubjectThemeFor(themes: Record<string, SubjectTheme>, subjectName: string): SubjectTheme {
  return themes[subjectName] || DEFAULT_SUBJECT_THEME;
}

export async function upsertSubjectTheme(subjectName: string, theme: SubjectTheme): Promise<boolean> {
  const { error } = await supabase.from('subject_themes').upsert({
    subject_name: subjectName,
    icon: theme.icon,
    color: theme.color,
  }, { onConflict: 'subject_name' });
  if (error) {
    console.error('Error saving subject theme:', error);
    return false;
  }
  return true;
}
// بيجيب كل المساحات الحقيقية: كل (فصل+مادة) موجودة فعليًا + مساحة إعلانات المدرسة، مع عدد بوستات حقيقي وآخر نشاط
export interface SpaceInfo {
  id: string;
  classId: string | null;
  subject: string | null;
  className: string;
  status: 'Active' | 'Archived';
  postCount: number;
  lastActivity: string | null;
}

export async function getSpaces(): Promise<SpaceInfo[]> {
  const { data: periods, error: periodsError } = await supabase
    .from('class_periods')
    .select('subject, section_id, class_sections ( name, grade_level )');
  if (periodsError) {
    console.error('Error fetching class periods for spaces:', periodsError);
    return [];
  }

  const comboMap = new Map<string, { classId: string; subject: string; className: string }>();
  (periods || []).forEach((row: any) => {
    const key = `${row.section_id}|${row.subject}`;
    if (!comboMap.has(key)) {
      comboMap.set(key, {
        classId: row.section_id,
        subject: row.subject,
        className: `${row.class_sections?.name || ''} — ${row.subject}`,
      });
    }
  });

  const { data: settingsRows } = await supabase.from('class_space_settings').select('class_id, subject, status');
  const settingsMap = new Map<string, string>();
  (settingsRows || []).forEach((r: any) => {
    const key = r.class_id ? `${r.class_id}|${r.subject}` : 'school';
    settingsMap.set(key, r.status);
  });

  const { data: posts } = await supabase.from('class_posts').select('class_id, subject, created_at');
  const postStats = new Map<string, { count: number; last: string }>();
  (posts || []).forEach((p: any) => {
    const key = p.class_id ? `${p.class_id}|${p.subject}` : 'school';
    const cur = postStats.get(key) || { count: 0, last: '' };
    cur.count++;
    if (!cur.last || p.created_at > cur.last) cur.last = p.created_at;
    postStats.set(key, cur);
  });

  const spaces: SpaceInfo[] = [];
  comboMap.forEach((combo, key) => {
    const stat = postStats.get(key);
    spaces.push({
      id: key,
      classId: combo.classId,
      subject: combo.subject,
      className: combo.className,
      status: (settingsMap.get(key) as any) || 'Active',
      postCount: stat?.count || 0,
      lastActivity: stat?.last || null,
    });
  });

  const schoolStat = postStats.get('school');
  spaces.push({
    id: 'school',
    classId: null,
    subject: null,
    className: 'إعلانات المدرسة',
    status: (settingsMap.get('school') as any) || 'Active',
    postCount: schoolStat?.count || 0,
    lastActivity: schoolStat?.last || null,
  });

  return spaces;
}

// بيغيّر حالة مساحة (نشطة/مؤرشفة) — لو مفيش صف إعدادات ليها لسه، بينشئ واحد
export async function updateSpaceStatus(classId: string | null, subject: string | null, status: 'Active' | 'Archived'): Promise<boolean> {
  let query = supabase.from('class_space_settings').select('id');
  query = classId ? query.eq('class_id', classId).eq('subject', subject as string) : query.is('class_id', null).is('subject', null);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase.from('class_space_settings').update({ status, updated_at: new Date().toISOString() }).eq('id', (existing as any).id);
    return !error;
  }
  const { error } = await supabase.from('class_space_settings').insert({ class_id: classId, subject, status });
  return !error;
}

export interface SchoolSettings {
  id: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  educationSystem: 'british' | 'american' | 'national';
}

// بيجيب إعدادات هوية المدرسة (لوجو وألوان ونظام التعليم) — دايمًا صف واحد بس
export async function getSchoolSettings(): Promise<SchoolSettings> {
  const { data, error } = await supabase.from('school_settings').select('*').limit(1).maybeSingle();
  if (error || !data) {
    return { id: '', schoolName: 'اسم المدرسة', logoUrl: null, primaryColor: '#7c3aed', secondaryColor: '#4c1d95', educationSystem: 'national' };
  }
  return {
    id: data.id,
    schoolName: data.school_name || 'اسم المدرسة',
    logoUrl: data.logo_url || null,
    primaryColor: data.primary_color || '#7c3aed',
    secondaryColor: data.secondary_color || '#4c1d95',
    educationSystem: (data.education_system || 'national') as 'british' | 'american' | 'national',
  };
}

export async function updateSchoolSettings(input: { id: string; schoolName: string; logoUrl?: string | null; primaryColor: string; secondaryColor: string; educationSystem?: string }): Promise<boolean> {
  const patch: any = {
    school_name: input.schoolName,
    logo_url: input.logoUrl ?? null,
    primary_color: input.primaryColor,
    secondary_color: input.secondaryColor,
    updated_at: new Date().toISOString(),
  };
  if (input.educationSystem !== undefined) patch.education_system = input.educationSystem;
  const { error } = await supabase
    .from('school_settings')
    .update(patch)
    .eq('id', input.id);
  return !error;
}

export interface StudentSubjectGrade {
  subject: string;
  grade: number | null; // null = مفيش نظام درجات معتمد للمادة دي لسه
}

// بيجيب درجة الطالب الحقيقية في كل مادة من مواد صفه، باستخدام نفس نظام الجريدبوك المعتمد
export async function getStudentGrades(studentId: string, gradeLevel: string, termId?: string): Promise<StudentSubjectGrade[]> {
  const [subjects, allConfigs] = await Promise.all([
    getCurriculumSubjects(gradeLevel),
    getGradebookConfigs(),
  ]);

  const results = await Promise.all(subjects.map(async (subject) => {
    const config = allConfigs.find((c) => c.status === 'approved' && c.subjectName === subject && c.grades.includes(gradeLevel));
    if (!config) return { subject, grade: null };

    const [assessments, entries] = await Promise.all([getAssessments(config.id), getGradeEntries(config.id)]);
    const hasAnyEntry = entries.some((e) => e.studentId === studentId);
    if (!hasAnyEntry) return { subject, grade: null };

    const grade = calculateWeightedGrade(assessments, entries, config.categoryWeights, studentId, termId);
    return { subject, grade };
  }));

  return results;
}

// بيجيب نسبة حضور الطالب الحقيقية في مدى تاريخ معيّن (زي ترم دراسي)
export async function getStudentAttendanceForTerm(studentId: string, startDate: string, endDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status, attendance_sessions!inner(date)')
    .eq('student_id', studentId)
    .gte('attendance_sessions.date', startDate)
    .lte('attendance_sessions.date', endDate);
  if (error || !data || data.length === 0) return 0;
  const present = data.filter((row: any) => row.status === 'Present' || row.status === 'Late').length;
  return Math.round((present / data.length) * 100);
}

export interface TranscriptSubjectRow {
  subject: string;
  termGrades: (number | null)[]; // بنفس ترتيب terms
  average: number | null;
}

export interface StudentTranscript {
  terms: { id: string; name: string }[];
  subjects: TranscriptSubjectRow[];
  cumulativeAverage: number | null;
}

// بيجمّع درجات الطالب الحقيقية عبر كل الترمات المسجّلة في مستند واحد (السجل الأكاديمي)
export async function getStudentTranscript(studentId: string, gradeLevel: string): Promise<StudentTranscript> {
  const terms = await getTerms();
  const perTermGrades = await Promise.all(terms.map((t) => getStudentGrades(studentId, gradeLevel, t.id)));

  const subjectSet = new Set<string>();
  perTermGrades.forEach((grades) => grades.forEach((g) => subjectSet.add(g.subject)));

  const subjects: TranscriptSubjectRow[] = Array.from(subjectSet).map((subject) => {
    const termGrades = perTermGrades.map((grades) => grades.find((g) => g.subject === subject)?.grade ?? null);
    const valid = termGrades.filter((g): g is number => g !== null);
    const average = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    return { subject, termGrades, average };
  });

  const allAverages = subjects.map((s) => s.average).filter((a): a is number => a !== null);
  const cumulativeAverage = allAverages.length > 0 ? Math.round(allAverages.reduce((a, b) => a + b, 0) / allAverages.length) : null;

  return { terms: terms.map((t) => ({ id: t.id, name: t.name })), subjects, cumulativeAverage };
}


// ============ معايير التحذير المبكر (Early Warning Radar) — إعداد واحد للمدرسة كلها ============

export interface EarlyWarningCriteria {
  id: string;
  criticalAttendance: number;
  criticalMinAverage: number;
  warningAttendance: number;
  warningMinAverage: number;
}

export async function getEarlyWarningCriteria(): Promise<EarlyWarningCriteria> {
  const { data, error } = await supabase.from('early_warning_criteria').select('*').limit(1).maybeSingle();
  if (error || !data) {
    return { id: '', criticalAttendance: 75, criticalMinAverage: 50, warningAttendance: 85, warningMinAverage: 65 };
  }
  return {
    id: data.id,
    criticalAttendance: data.critical_attendance,
    criticalMinAverage: data.critical_min_average,
    warningAttendance: data.warning_attendance,
    warningMinAverage: data.warning_min_average,
  };
}

export async function updateEarlyWarningCriteria(input: { id: string; criticalAttendance?: number; criticalMinAverage?: number; warningAttendance?: number; warningMinAverage?: number }): Promise<boolean> {
  const patch: any = { updated_at: new Date().toISOString() };
  if (input.criticalAttendance !== undefined) patch.critical_attendance = input.criticalAttendance;
  if (input.criticalMinAverage !== undefined) patch.critical_min_average = input.criticalMinAverage;
  if (input.warningAttendance !== undefined) patch.warning_attendance = input.warningAttendance;
  if (input.warningMinAverage !== undefined) patch.warning_min_average = input.warningMinAverage;
  const { error } = await supabase.from('early_warning_criteria').update(patch).eq('id', input.id);
  return !error;
}


// ============ الأقسام المنهجية (Curriculum Departments) ============

export interface CurriculumDepartment {
  id: string;
  name: string;
  displayOrder: number;
}

export async function getDepartments(): Promise<CurriculumDepartment[]> {
  const { data, error } = await supabase.from('curriculum_departments').select('id, name, display_order').order('display_order', { ascending: true });
  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ id: row.id, name: row.name, displayOrder: row.display_order }));
}

export async function addDepartment(name: string): Promise<string | null> {
  const { data: existing } = await supabase.from('curriculum_departments').select('display_order').order('display_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (existing?.display_order ?? 0) + 1;
  const { data, error } = await supabase.from('curriculum_departments').insert({ name, display_order: nextOrder }).select('id').single();
  if (error || !data) {
    console.error('Error adding department:', error);
    return null;
  }
  return data.id;
}

export async function deleteDepartment(id: string): Promise<boolean> {
  const { error } = await supabase.from('curriculum_departments').delete().eq('id', id);
  if (error) {
    console.error('Error deleting department:', error);
    return false;
  }
  return true;
}

// ============ المسارات (Academic Tracks) — كل مسار مرتبط بصف أو أكتر ============

export interface AcademicTrack {
  id: string;
  name: string;
  gradeLevelIds: string[];
}

export async function getTracks(): Promise<AcademicTrack[]> {
  const { data: tracks, error } = await supabase.from('academic_tracks').select('id, name');
  if (error || !tracks) {
    console.error('Error fetching tracks:', error);
    return [];
  }
  const { data: links } = await supabase.from('track_grade_levels').select('track_id, grade_level_id');
  return tracks.map((t: any) => ({
    id: t.id,
    name: t.name,
    gradeLevelIds: (links || []).filter((l: any) => l.track_id === t.id).map((l: any) => l.grade_level_id),
  }));
}

export async function addTrack(name: string, gradeLevelIds: string[]): Promise<string | null> {
  const { data, error } = await supabase.from('academic_tracks').insert({ name }).select('id').single();
  if (error || !data) {
    console.error('Error adding track:', error);
    return null;
  }
  if (gradeLevelIds.length > 0) {
    await supabase.from('track_grade_levels').insert(gradeLevelIds.map((gid) => ({ track_id: data.id, grade_level_id: gid })));
  }
  return data.id;
}

export async function deleteTrack(id: string): Promise<boolean> {
  const { error } = await supabase.from('academic_tracks').delete().eq('id', id);
  if (error) {
    console.error('Error deleting track:', error);
    return false;
  }
  return true;
}


// ============ لوحة المشرف الحقيقية للحضور ============

export interface ClassAttendanceOverview {
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
  teacherName: string | null;
  expectedCount: number;
  takenCount: number;
  status: 'not_taken' | 'partial' | 'complete';
}

// نظرة عامة حقيقية على كل الفصول ليوم معيّن: مين خد الحضور، مين لسه، ومين خد جزء بس
export async function getClassesAttendanceOverview(date: string, mode: 'Daily' | 'Period'): Promise<ClassAttendanceOverview[]> {
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

  const [sectionsRes, teachersRes, periodsRes, sessionsRes] = await Promise.all([
    supabase.from('class_sections').select('id, name, grade_level, teacher_id'),
    supabase.from('teachers').select('id, users(name)'),
    supabase.from('class_periods').select('id, section_id, day'),
    supabase.from('attendance_sessions').select('section_id, period_id').eq('date', date),
  ]);

  const sections = sectionsRes.data || [];
  const teachers = teachersRes.data || [];
  const periods = periodsRes.data || [];
  const sessions = sessionsRes.data || [];

  const teacherNameById: Record<string, string> = {};
  (teachers as any[]).forEach((t) => { teacherNameById[t.id] = t.users?.name || ''; });

  return (sections as any[]).map((s) => {
    let expectedCount: number;
    let takenCount: number;
    if (mode === 'Period') {
      const todaysPeriods = (periods as any[]).filter((p) => p.section_id === s.id && p.day === dayName);
      expectedCount = todaysPeriods.length;
      const takenPeriodIds = new Set((sessions as any[]).filter((sess) => sess.section_id === s.id && sess.period_id).map((sess) => sess.period_id));
      takenCount = todaysPeriods.filter((p) => takenPeriodIds.has(p.id)).length;
    } else {
      expectedCount = 1;
      takenCount = (sessions as any[]).some((sess) => sess.section_id === s.id) ? 1 : 0;
    }
    const status: ClassAttendanceOverview['status'] = takenCount === 0 ? 'not_taken' : takenCount >= expectedCount ? 'complete' : 'partial';
    return {
      sectionId: s.id,
      sectionName: s.name,
      gradeLevel: s.grade_level,
      teacherName: teacherNameById[s.teacher_id] || null,
      expectedCount,
      takenCount,
      status,
    };
  });
}

export interface AttendanceLogRow {
  id: string;
  studentName: string;
  className: string;
  teacherName: string;
  time: string;
  status: string;
  gradeLevel: string;
}

// سجل حقيقي بكل حالات الحضور اللي اتسجلت ليوم معيّن، في كل الفصول
export async function getAttendanceLogsForDateRange(startDate: string, endDate: string): Promise<AttendanceLogRow[]> {
  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id, section_id, created_at, class_sections(name, grade_level, teacher_id)')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error || !sessions) return [];

  const sessionIds = (sessions as any[]).map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const [recordsRes, studentsRes, teachersRes] = await Promise.all([
    supabase.from('attendance_records').select('id, session_id, student_id, status').in('session_id', sessionIds),
    supabase.from('students').select('id, users(name)'),
    supabase.from('teachers').select('id, users(name)'),
  ]);

  const records = recordsRes.data || [];
  const studentNameById: Record<string, string> = {};
  (studentsRes.data || []).forEach((s: any) => { studentNameById[s.id] = s.users?.name || ''; });
  const teacherNameById: Record<string, string> = {};
  (teachersRes.data || []).forEach((t: any) => { teacherNameById[t.id] = t.users?.name || ''; });

  const sessionById: Record<string, any> = {};
  (sessions as any[]).forEach((s) => { sessionById[s.id] = s; });

  const statusMap: Record<string, string> = { Present: 'حاضر', Absent: 'غائب', Late: 'متأخر', Excused: 'معذور' };

  return (records as any[]).map((r) => {
    const session = sessionById[r.session_id];
    const cls = session?.class_sections;
    return {
      id: r.id,
      studentName: studentNameById[r.student_id] || '—',
      className: cls?.name || '—',
      gradeLevel: cls?.grade_level || '—',
      teacherName: teacherNameById[cls?.teacher_id] || '—',
      time: session?.created_at ? new Date(session.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—',
      status: statusMap[r.status] || r.status,
    };
  });
}


export interface ExcusedStudentRow {
  recordId: string;
  studentId: string;
  studentName: string;
  className: string;
  gradeLevel: string;
  time: string;
  reason: string | null;
  fileUrl: string | null;
  status: 'Absent' | 'Excused';
}

// كل حالات الغياب (معذورة وغير معذورة) ليوم معيّن، جاهزة لمراجعة المشرف — يقدر يبرر أو يلغي التبرير من هنا
export async function getExcusedStudentsForDateRange(startDate: string, endDate: string): Promise<ExcusedStudentRow[]> {
  const { data: sessions } = await supabase
    .from('attendance_sessions')
    .select('id, created_at, class_sections(name, grade_level)')
    .gte('date', startDate)
    .lte('date', endDate);
  const sessionIds = (sessions || []).map((s: any) => s.id);
  if (sessionIds.length === 0) return [];

  const { data: records } = await supabase
    .from('attendance_records')
    .select('id, session_id, student_id, excuse_reason, excuse_file_url, status')
    .in('session_id', sessionIds)
    .or('status.eq.Absent,and(status.eq.Excused,excuse_of_status.eq.Absent)');
  if (!records || records.length === 0) return [];

  const { data: students } = await supabase.from('students').select('id, users(name)');
  const studentNameById: Record<string, string> = {};
  (students || []).forEach((s: any) => { studentNameById[s.id] = s.users?.name || ''; });

  const sessionById: Record<string, any> = {};
  (sessions || []).forEach((s: any) => { sessionById[s.id] = s; });

  return (records as any[]).map((r) => {
    const session = sessionById[r.session_id];
    return {
      recordId: r.id,
      studentId: r.student_id,
      studentName: studentNameById[r.student_id] || '—',
      className: session?.class_sections?.name || '—',
      gradeLevel: session?.class_sections?.grade_level || '—',
      time: session?.created_at ? new Date(session.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—',
      reason: r.excuse_reason || null,
      fileUrl: r.excuse_file_url || null,
      status: r.status,
    };
  });
}

export async function saveExcuseDetails(recordId: string, reason: string, fileUrl: string | null, originalStatus?: 'Absent' | 'Late'): Promise<boolean> {
  const patch: any = { excuse_reason: reason, status: 'Excused' };
  if (fileUrl !== null) patch.excuse_file_url = fileUrl;
  if (originalStatus) patch.excuse_of_status = originalStatus;
  const { error } = await supabase.from('attendance_records').update(patch).eq('id', recordId);
  return !error;
}

// بيلغي التبرير عن حالة (غياب أو تأخير) — بيرجّعها لحالتها الأصلية وبيمسح سبب العذر
export async function unexcuseAttendanceRecord(recordId: string): Promise<boolean> {
  const { data: existing } = await supabase.from('attendance_records').select('excuse_of_status').eq('id', recordId).maybeSingle();
  const revertTo = (existing as any)?.excuse_of_status || 'Absent';
  const { error } = await supabase.from('attendance_records').update({
    status: revertTo, excuse_reason: null, excuse_file_url: null, excuse_of_status: null,
  }).eq('id', recordId);
  return !error;
}

// بيرفع ملف عذر (تقرير طبي مثلاً) لمساحة التخزين وبيرجع رابطه العام
export async function uploadExcuseFile(recordId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${recordId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('excuse-documents').upload(path, file, { upsert: true });
  if (error) {
    console.error('Error uploading excuse file:', error);
    return null;
  }
  const { data } = supabase.storage.from('excuse-documents').getPublicUrl(path);
  return data.publicUrl;
}


// ============ الملاحظات السلوكية ============

export interface BehaviorNote {
  id: string;
  authorName: string;
  noteType: 'positive' | 'negative' | 'neutral';
  content: string;
  createdAt: string;
}

export async function getBehaviorNotes(studentId: string): Promise<BehaviorNote[]> {
  const { data, error } = await supabase
    .from('student_behavior_notes')
    .select('id, author_name, note_type, content, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching behavior notes:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    authorName: row.author_name,
    noteType: row.note_type,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function addBehaviorNote(studentId: string, input: { authorName: string; noteType: 'positive' | 'negative' | 'neutral'; content: string }): Promise<boolean> {
  const { error } = await supabase.from('student_behavior_notes').insert({
    student_id: studentId,
    author_name: input.authorName,
    note_type: input.noteType,
    content: input.content,
  });
  if (error) console.error('Error adding behavior note:', error);
  return !error;
}

export async function deleteBehaviorNote(id: string): Promise<boolean> {
  const { error } = await supabase.from('student_behavior_notes').delete().eq('id', id);
  return !error;
}

// ============ سجل الرسائل (أرشيف بس، مفيش توصيل فعلي) ============

export interface StudentMessageLog {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export async function getMessagesLog(studentId: string): Promise<StudentMessageLog[]> {
  const { data, error } = await supabase
    .from('student_messages_log')
    .select('id, sender_name, content, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching messages log:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    senderName: row.sender_name,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function addMessageLog(studentId: string, input: { senderName: string; content: string }): Promise<boolean> {
  const { error } = await supabase.from('student_messages_log').insert({
    student_id: studentId,
    sender_name: input.senderName,
    content: input.content,
  });
  if (error) console.error('Error adding message log:', error);
  return !error;
}


// ============ الملف الطبي الكامل ============

export interface StudentMedicalInfo {
  bloodType: string;
  allergies: string;
  chronicConditions: string;
  doctorName: string;
  doctorPhone: string;
  insuranceProvider: string;
  insuranceNumber: string;
}

export async function getMedicalInfo(studentId: string): Promise<StudentMedicalInfo | null> {
  const { data, error } = await supabase.from('student_medical_info').select('*').eq('student_id', studentId).maybeSingle();
  if (error || !data) return null;
  return {
    bloodType: data.blood_type || '',
    allergies: data.allergies || '',
    chronicConditions: data.chronic_conditions || '',
    doctorName: data.doctor_name || '',
    doctorPhone: data.doctor_phone || '',
    insuranceProvider: data.insurance_provider || '',
    insuranceNumber: data.insurance_number || '',
  };
}

export async function updateMedicalInfo(studentId: string, input: StudentMedicalInfo): Promise<boolean> {
  const { error } = await supabase.from('student_medical_info').upsert({
    student_id: studentId,
    blood_type: input.bloodType || null,
    allergies: input.allergies || null,
    chronic_conditions: input.chronicConditions || null,
    doctor_name: input.doctorName || null,
    doctor_phone: input.doctorPhone || null,
    insurance_provider: input.insuranceProvider || null,
    insurance_number: input.insuranceNumber || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id' });
  return !error;
}

export interface ClinicVisit {
  id: string;
  visitDate: string;
  reason: string;
  notes: string;
  recordedBy: string;
}

export async function getClinicVisits(studentId: string): Promise<ClinicVisit[]> {
  const { data, error } = await supabase.from('student_clinic_visits').select('id, visit_date, reason, notes, recorded_by').eq('student_id', studentId).order('visit_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, visitDate: row.visit_date, reason: row.reason || '', notes: row.notes || '', recordedBy: row.recorded_by || '' }));
}

export async function addClinicVisit(studentId: string, input: { visitDate: string; reason: string; notes: string; recordedBy: string }): Promise<boolean> {
  const { error } = await supabase.from('student_clinic_visits').insert({
    student_id: studentId, visit_date: input.visitDate, reason: input.reason || null, notes: input.notes || null, recorded_by: input.recordedBy,
  });
  return !error;
}

export async function deleteClinicVisit(id: string): Promise<boolean> {
  const { error } = await supabase.from('student_clinic_visits').delete().eq('id', id);
  return !error;
}

// ============ السجل السلوكي الهيكلي ============

export interface BehaviorIncident {
  id: string;
  incidentDate: string;
  incidentTime: string;
  problemTitle: string;
  description: string;
  actionTaken: string;
  recordedBy: string;
}

export async function getBehaviorIncidents(studentId: string): Promise<BehaviorIncident[]> {
  const { data, error } = await supabase
    .from('student_behavior_incidents')
    .select('id, incident_date, incident_time, problem_title, description, action_taken, recorded_by')
    .eq('student_id', studentId)
    .order('incident_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({
    id: row.id, incidentDate: row.incident_date, incidentTime: row.incident_time || '', problemTitle: row.problem_title,
    description: row.description || '', actionTaken: row.action_taken || '', recordedBy: row.recorded_by || '',
  }));
}

export async function addBehaviorIncident(studentId: string, input: { incidentDate: string; incidentTime: string; problemTitle: string; description: string; actionTaken: string; recordedBy: string }): Promise<boolean> {
  const { error } = await supabase.from('student_behavior_incidents').insert({
    student_id: studentId, incident_date: input.incidentDate, incident_time: input.incidentTime || null,
    problem_title: input.problemTitle, description: input.description || null, action_taken: input.actionTaken || null, recorded_by: input.recordedBy,
  });
  return !error;
}

export async function deleteBehaviorIncident(id: string): Promise<boolean> {
  const { error } = await supabase.from('student_behavior_incidents').delete().eq('id', id);
  return !error;
}

// ============ الإجراءات الإدارية / العقوبات ============

export interface AdminAction {
  id: string;
  actionDate: string;
  actionType: string;
  reason: string;
  issuedBy: string;
}

export async function getAdminActions(studentId: string): Promise<AdminAction[]> {
  const { data, error } = await supabase.from('student_admin_actions').select('id, action_date, action_type, reason, issued_by').eq('student_id', studentId).order('action_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, actionDate: row.action_date, actionType: row.action_type, reason: row.reason || '', issuedBy: row.issued_by || '' }));
}

export async function addAdminAction(studentId: string, input: { actionDate: string; actionType: string; reason: string; issuedBy: string }): Promise<boolean> {
  const { error } = await supabase.from('student_admin_actions').insert({
    student_id: studentId, action_date: input.actionDate, action_type: input.actionType, reason: input.reason || null, issued_by: input.issuedBy,
  });
  return !error;
}

export async function deleteAdminAction(id: string): Promise<boolean> {
  const { error } = await supabase.from('student_admin_actions').delete().eq('id', id);
  return !error;
}

// ============ الإنذارات ============

export interface StudentWarning {
  id: string;
  warningDate: string;
  reason: string;
  issuedBy: string;
}

export async function getWarnings(studentId: string): Promise<StudentWarning[]> {
  const { data, error } = await supabase.from('student_warnings').select('id, warning_date, reason, issued_by').eq('student_id', studentId).order('warning_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, warningDate: row.warning_date, reason: row.reason, issuedBy: row.issued_by || '' }));
}

export async function addWarning(studentId: string, input: { warningDate: string; reason: string; issuedBy: string }): Promise<boolean> {
  const { error } = await supabase.from('student_warnings').insert({
    student_id: studentId, warning_date: input.warningDate, reason: input.reason, issued_by: input.issuedBy,
  });
  return !error;
}

// ============ استدعاء ولي الأمر ============

export interface GuardianSummon {
  id: string;
  summonDate: string;
  reason: string;
  outcome: string;
  attendedBy: string;
}

export async function getGuardianSummons(studentId: string): Promise<GuardianSummon[]> {
  const { data, error } = await supabase.from('student_guardian_summons').select('id, summon_date, reason, outcome, attended_by').eq('student_id', studentId).order('summon_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, summonDate: row.summon_date, reason: row.reason || '', outcome: row.outcome || '', attendedBy: row.attended_by || '' }));
}

export async function addGuardianSummon(studentId: string, input: { summonDate: string; reason: string; outcome: string; attendedBy: string }): Promise<boolean> {
  const { error } = await supabase.from('student_guardian_summons').insert({
    student_id: studentId, summon_date: input.summonDate, reason: input.reason || null, outcome: input.outcome || null, attended_by: input.attendedBy,
  });
  return !error;
}

// ============ ملخص الحضور الحقيقي لطالب واحد ============

export interface StudentAttendanceSummary {
  attendanceRate: number;
  absentCount: number;
  lateCount: number;
  totalSessions: number;
}

export async function getStudentAttendanceSummary(studentId: string): Promise<StudentAttendanceSummary> {
  const { data, error } = await supabase.from('attendance_records').select('status').eq('student_id', studentId);
  if (error || !data || data.length === 0) return { attendanceRate: 0, absentCount: 0, lateCount: 0, totalSessions: 0 };
  const total = data.length;
  const present = data.filter((r: any) => r.status === 'Present' || r.status === 'Late').length;
  const absent = data.filter((r: any) => r.status === 'Absent').length;
  const late = data.filter((r: any) => r.status === 'Late').length;
  return { attendanceRate: Math.round((present / total) * 100), absentCount: absent, lateCount: late, totalSessions: total };
}


// ============ إعدادات جدول الحصص ============

export interface ScheduleSettings {
  id: string;
  periodsPerDay: number;
  periodDurationMinutes: number;
  dayStartTime: string;
}

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const { data, error } = await supabase.from('schedule_settings').select('*').limit(1).maybeSingle();
  if (error || !data) {
    return { id: '', periodsPerDay: 7, periodDurationMinutes: 45, dayStartTime: '08:00' };
  }
  return {
    id: data.id,
    periodsPerDay: data.periods_per_day,
    periodDurationMinutes: data.period_duration_minutes,
    dayStartTime: (data.day_start_time || '08:00').slice(0, 5),
  };
}

export async function updateScheduleSettings(input: ScheduleSettings): Promise<boolean> {
  const { error } = await supabase.from('schedule_settings').update({
    periods_per_day: input.periodsPerDay,
    period_duration_minutes: input.periodDurationMinutes,
    day_start_time: input.dayStartTime,
    updated_at: new Date().toISOString(),
  }).eq('id', input.id);
  return !error;
}

// ============ فترات الراحة (ممكن أكتر من واحدة) ============

export interface ScheduleBreak {
  id: string;
  afterPeriod: number;
  durationMinutes: number;
}

export async function getScheduleBreaks(): Promise<ScheduleBreak[]> {
  const { data, error } = await supabase.from('schedule_breaks').select('id, after_period, duration_minutes').order('after_period', { ascending: true });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, afterPeriod: row.after_period, durationMinutes: row.duration_minutes }));
}

export async function addScheduleBreak(input: { afterPeriod: number; durationMinutes: number }): Promise<boolean> {
  const { error } = await supabase.from('schedule_breaks').insert({ after_period: input.afterPeriod, duration_minutes: input.durationMinutes });
  return !error;
}

export async function deleteScheduleBreak(id: string): Promise<boolean> {
  const { error } = await supabase.from('schedule_breaks').delete().eq('id', id);
  return !error;
}

// ============ أكواد المعلمين (لربط ملفات الإكسيل) ============

export async function getTeacherCodesMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from('teachers').select('id, teacher_code');
  const map: Record<string, string> = {};
  (data || []).forEach((t: any) => { if (t.teacher_code) map[t.teacher_code] = t.id; });
  return map;
}

export async function getAllTeachersWithCodes(): Promise<{ id: string; code: string; name: string }[]> {
  const { data } = await supabase.from('teachers').select('id, teacher_code, users(name)');
  return (data || []).map((t: any) => ({ id: t.id, code: t.teacher_code || '', name: t.users?.name || '' }));
}

// ============ جدول الحصص الكامل (كل الفصول) — للتقويم والرفع ============

export interface ScheduleEntry {
  id: string;
  sectionId: string;
  sectionName: string;
  gradeLevel: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  teacherName: string;
  room: string;
}

export async function getFullSchedule(): Promise<ScheduleEntry[]> {
  const [periodsRes, sectionsRes, teachersRes] = await Promise.all([
    supabase.from('class_periods').select('id, section_id, subject, day, start_time, end_time, teacher_id, room'),
    supabase.from('class_sections').select('id, name, grade_level'),
    supabase.from('teachers').select('id, users(name)'),
  ]);

  const sectionById: Record<string, any> = {};
  (sectionsRes.data || []).forEach((s: any) => { sectionById[s.id] = s; });
  const teacherNameById: Record<string, string> = {};
  (teachersRes.data || []).forEach((t: any) => { teacherNameById[t.id] = t.users?.name || ''; });

  return (periodsRes.data || []).map((p: any) => ({
    id: p.id,
    sectionId: p.section_id,
    sectionName: sectionById[p.section_id]?.name || '—',
    gradeLevel: sectionById[p.section_id]?.grade_level || '—',
    subject: p.subject,
    day: p.day || '',
    startTime: p.start_time || '',
    endTime: p.end_time || '',
    teacherId: p.teacher_id,
    teacherName: teacherNameById[p.teacher_id] || '',
    room: p.room || '',
  }));
}

export interface ScheduleImportRow {
  classCode: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherCode: string;
  room?: string;
}

export interface ScheduleImportResult {
  success: boolean;
  insertedCount: number;
  errors: string[];
}

// بيرفع جدول حصص كامل، بعد التحقق من الأكواد والتعارضات — بيمسح الحصص القديمة لنفس الفصول ويحط الجديدة بدالها
export async function importSchedule(rows: ScheduleImportRow[]): Promise<ScheduleImportResult> {
  const errors: string[] = [];

  const [sectionsRes, teacherCodesMap] = await Promise.all([
    supabase.from('class_sections').select('id, name'),
    getTeacherCodesMap(),
  ]);
  const sectionIdByName: Record<string, string> = {};
  (sectionsRes.data || []).forEach((s: any) => { sectionIdByName[s.name] = s.id; });

  // تحقق من صحة الأكواد
  const validRows: (ScheduleImportRow & { sectionId: string; teacherId: string })[] = [];
  rows.forEach((row, idx) => {
    const sectionId = sectionIdByName[row.classCode];
    const teacherId = teacherCodesMap[row.teacherCode];
    if (!sectionId) {
      errors.push(`صف ${idx + 2}: كود الفصل "${row.classCode}" مش موجود.`);
      return;
    }
    if (!teacherId) {
      errors.push(`صف ${idx + 2}: كود المعلم "${row.teacherCode}" مش موجود.`);
      return;
    }
    validRows.push({ ...row, sectionId, teacherId });
  });

  // تحقق من تعارض الجدول: نفس المعلم أو نفس الفصل في نفس اليوم والوقت أكتر من مرة
  const seenByTeacher: Record<string, string> = {};
  const seenByClass: Record<string, string> = {};
  validRows.forEach((row, idx) => {
    const teacherKey = `${row.teacherId}|${row.day}|${row.startTime}`;
    const classKey = `${row.sectionId}|${row.day}|${row.startTime}`;
    if (seenByTeacher[teacherKey]) {
      errors.push(`تعارض: المعلم صاحب الكود "${row.teacherCode}" عنده حصتين يوم ${row.day} الساعة ${row.startTime}.`);
    }
    if (seenByClass[classKey]) {
      errors.push(`تعارض: الفصل "${row.classCode}" عنده حصتين يوم ${row.day} الساعة ${row.startTime}.`);
    }
    seenByTeacher[teacherKey] = classKey;
    seenByClass[classKey] = teacherKey;
  });

  if (errors.length > 0) {
    return { success: false, insertedCount: 0, errors };
  }

  // امسحي الحصص القديمة بس للفصول اللي هتتحدّث
  const affectedSectionIds = Array.from(new Set(validRows.map(r => r.sectionId)));
  if (affectedSectionIds.length > 0) {
    await supabase.from('class_periods').delete().in('section_id', affectedSectionIds);
  }

  const inserts = validRows.map(row => ({
    section_id: row.sectionId,
    subject: row.subject,
    day: row.day,
    start_time: row.startTime,
    end_time: row.endTime,
    teacher_id: row.teacherId,
    room: row.room || null,
  }));

  const { error } = await supabase.from('class_periods').insert(inserts);
  if (error) {
    return { success: false, insertedCount: 0, errors: [error.message] };
  }
  return { success: true, insertedCount: inserts.length, errors: [] };
}


// ============ غياب المعلمين والاحتياطي ============

export interface TeacherAbsence {
  id: string;
  teacherId: string;
  teacherName: string;
  absenceDate: string;
  reason: string;
  recordedBy: string;
}

export async function getTeacherAbsences(startDate: string, endDate: string): Promise<TeacherAbsence[]> {
  const { data, error } = await supabase
    .from('teacher_absences')
    .select('id, teacher_id, absence_date, reason, recorded_by, teachers(users(name))')
    .gte('absence_date', startDate)
    .lte('absence_date', endDate)
    .order('absence_date', { ascending: false });
  if (error) return [];
  return (data || []).map((row: any) => ({
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teachers?.users?.name || '',
    absenceDate: row.absence_date,
    reason: row.reason || '',
    recordedBy: row.recorded_by || '',
  }));
}

export async function addTeacherAbsence(input: { teacherId: string; absenceDate: string; reason: string; recordedBy: string }): Promise<string | null> {
  const { data, error } = await supabase.from('teacher_absences').insert({
    teacher_id: input.teacherId, absence_date: input.absenceDate, reason: input.reason || null, recorded_by: input.recordedBy,
  }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function deleteTeacherAbsence(id: string): Promise<boolean> {
  const { error } = await supabase.from('teacher_absences').delete().eq('id', id);
  return !error;
}

// بيجيب كل الحصص اللي المعلم الغائب ده كان هياخدها في يوم معيّن (بناءً على يوم الأسبوع)
export interface AffectedPeriod {
  periodId: string;
  sectionName: string;
  subject: string;
  startTime: string;
  endTime: string;
  substituteTeacherId: string | null;
  substituteTeacherName: string;
}

export async function getAffectedPeriodsForAbsence(teacherId: string, absenceDate: string): Promise<AffectedPeriod[]> {
  const dayName = new Date(absenceDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const [periodsRes, subsRes] = await Promise.all([
    supabase.from('class_periods').select('id, subject, start_time, end_time, class_sections(name)').eq('teacher_id', teacherId).eq('day', dayName),
    supabase.from('period_substitutions').select('class_period_id, substitute_teacher_id, teachers(users(name))').eq('substitution_date', absenceDate),
  ]);
  const subByPeriodId: Record<string, any> = {};
  (subsRes.data || []).forEach((s: any) => { subByPeriodId[s.class_period_id] = s; });

  return (periodsRes.data || []).map((p: any) => {
    const sub = subByPeriodId[p.id];
    return {
      periodId: p.id,
      sectionName: p.class_sections?.name || '—',
      subject: p.subject,
      startTime: p.start_time || '',
      endTime: p.end_time || '',
      substituteTeacherId: sub?.substitute_teacher_id || null,
      substituteTeacherName: sub?.teachers?.users?.name || '',
    };
  });
}

export async function assignSubstitute(classPeriodId: string, substitutionDate: string, substituteTeacherId: string, notes?: string): Promise<boolean> {
  const { error } = await supabase.from('period_substitutions').upsert({
    class_period_id: classPeriodId,
    substitution_date: substitutionDate,
    substitute_teacher_id: substituteTeacherId,
    notes: notes || null,
  }, { onConflict: 'class_period_id,substitution_date' });
  return !error;
}


// ============ الحالات المخصّصة لأخذ الحضور (بتتحفظ فعليًا في قاعدة البيانات) ============

export interface CustomAttendanceStatus {
  id: string;
  labelAr: string;
  labelEn: string;
  color: string;
}

export async function getCustomAttendanceStatuses(): Promise<CustomAttendanceStatus[]> {
  const { data, error } = await supabase.from('attendance_custom_statuses').select('id, label_ar, label_en, color').order('created_at', { ascending: true });
  if (error) return [];
  return (data || []).map((row: any) => ({ id: row.id, labelAr: row.label_ar, labelEn: row.label_en, color: row.color }));
}

export async function addCustomAttendanceStatus(input: { labelAr: string; labelEn: string; color: string }): Promise<string | null> {
  const { data, error } = await supabase.from('attendance_custom_statuses').insert({
    label_ar: input.labelAr, label_en: input.labelEn, color: input.color,
  }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function deleteCustomAttendanceStatus(id: string): Promise<boolean> {
  const { error } = await supabase.from('attendance_custom_statuses').delete().eq('id', id);
  return !error;
}
