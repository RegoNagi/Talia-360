import React from 'react';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT'
}

export enum Language {
  AR = 'ar',
  EN = 'en'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  email?: string;
}

export interface Teacher extends User {
  specialization: string;
  hiringDate: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract';
  phone: string;
  assignedClasses: string[]; // Class IDs
  academicLoad: number; // Hours per week
}

export interface Admin extends User {
  title: string;
  permissions: string[];
  department: string;
  lastActive: string;
}

export interface Fee {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface Installment {
  id: string;
  dueDate: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface InstallmentPlan {
  id: string;
  title: string;
  totalAmount: number;
  installments: Installment[];
}

export interface ReportCard {
  id: string;
  title: string; // e.g., "Term 1 Report", "Certificate of Excellence"
  academicYear: string;
  issueDate: string;
  gradeAverage: string | number;
  type: 'Report Card' | 'Certificate' | 'Transcript';
  status?: 'Draft' | 'Released';
  term?: string;
  attendance?: {
    totalDays: number;
    absences: number;
    tardies: number;
  };
  behavioralComments?: string;
  nextSteps?: string;
  subjectGrades?: {
    subject: string;
    grade: string;
    score: number;
    trend: 'up' | 'down' | 'stable';
    teacher: string;
    teacherAvatar: string;
    breakdown: { category: string; score: number }[];
  }[];
  skills?: { category: string; score: number }[];
}

export interface TranscriptCourse {
  code: string;
  title: string;
  credits: number;
  grade: string;
  points: number;
}

export interface TranscriptYear {
  year: string;
  gradeLevel: string;
  courses: TranscriptCourse[];
}

export interface TranscriptData {
  years: TranscriptYear[];
  totalCreditsEarned: number;
  requiredCredits: number;
  cumulativeGPA: number;
  degreeConferred?: string;
  conferredDate?: string;
  honors?: string;
}

export interface ParentInfo {
  deceased?: boolean;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  nationality?: string;
  secondNationality?: string;
  idNumber?: string;
  academicDegree?: string;
  marital?: string;
  employmentStatus?: string;
  jobTitle?: string;
  companyName?: string;
  email?: string;
  mobile?: string;
  whatsapp?: string;
}

export interface Student {
  id: string;
  studentCode?: string;
  name: string;
  grade: string;
  attendance: number;
  performance: number;
  status: 'Active' | 'At Risk' | 'Inactive';
  fees: Fee[];
  installmentPlans: InstallmentPlan[];
  reportCards: ReportCard[];
  transcript?: TranscriptData;
  dob?: string;
  nationalId?: string;
  enrollmentDate?: string;
  avatar?: string;
  houseId?: string;
  fatherInfo?: ParentInfo;
  motherInfo?: ParentInfo;
  legalGuardian?: string;
  guardianRelationship?: string;
  identityInfo?: {
    firstName?: string; secondName?: string; thirdName?: string; lastName?: string;
    firstNameAr?: string; secondNameAr?: string; thirdNameAr?: string; lastNameAr?: string;
    gender?: string; religion?: string; nationality?: string; academicYear?: string; secondNationality?: string;
    nativeLanguage?: string; secondLanguage?: string; englishProficiency?: string;
  };
  emergencyContact1?: { firstName?: string; secondName?: string; thirdName?: string; lastName?: string; relativity?: string; mobile?: string };
  emergencyContact2?: { firstName?: string; secondName?: string; thirdName?: string; lastName?: string; relativity?: string; mobile?: string };
  homeAddress?: { city?: string; area?: string; street?: string; building?: string; apartment?: string; landline?: string };
  additionalInfo?: {
    hasMedical?: string; medicalDetails?: string; hasMedication?: string; medicationDetails?: string;
    busService?: string; hasSiblings?: string; siblingName?: string; siblingYearGroup?: string;
    appliedBefore?: string; hobbies?: string; marketing?: string; additionalNotes?: string;
  };
}

export interface LessonPlan {
  id?: string;
  topic: string;
  gradeLevel: string;
  subject: string;
  objectives: string[];
  materials: string[];
  outline: {
    duration: string;
    activity: string;
    description: string;
  }[];
  quiz: {
    question: string;
    options: string[];
    correctAnswer: string;
  }[];
}

export interface KPI {
  label: string;
  value: string | number;
  trend: number; // percentage
  trendDirection: 'up' | 'down';
}

export interface NavItem {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  view: string;
  subItems?: { id: string; labelAr: string; labelEn: string; view: string }[];
}

export enum SettingsTab {
  GENERAL = 'GENERAL',
  COURSES = 'COURSES',
  GRADE_LEVELS = 'GRADE_LEVELS',
  ACADEMIC_YEAR = 'ACADEMIC_YEAR',
  NOTIFICATIONS = 'NOTIFICATIONS',
  SECURITY = 'SECURITY',
  SPACE_MANAGEMENT = 'SPACE_MANAGEMENT'
}

export interface Course {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  gradeLevel?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  credits?: number;
  department?: string;
  color?: string;
  trackIds?: string[];
}

export interface Holiday {
  id: string;
  nameEn: string;
  nameAr: string;
  date: string;
  type: 'National' | 'Religious' | 'School';
}

export interface AcademicYearConfig {
  id: string;
  name: string;
  status: 'Active' | 'Archived' | 'Draft';
  instructionalDays: string[]; // e.g., ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  termDivision: 'Semesters' | 'Trimesters' | 'Quarters';
  terms: {
    id: string;
    nameEn: string;
    nameAr: string;
    startDate: string;
    endDate: string;
    gracePeriodDays: number;
    status: 'Active' | 'Locked' | 'Archived' | 'Draft';
  }[];
  holidays: Holiday[];
  schoolEvents: {
    id: string;
    nameEn: string;
    nameAr: string;
    date: string;
    type: 'Parent-Teacher' | 'Sports' | 'PD' | 'Other';
  }[];
  assignedCourses: string[]; // Course IDs
}

export interface TimetableEvent {
  id: string;
  title: string;
  date: string;
  type: 'Lesson' | 'Assessment' | 'Review';
  subjectId: string;
  isShifted?: boolean;
  originalDate?: string;
}

// --- Curriculum & Content Types ---

export type CurriculumSystem = 'National' | 'IG' | 'IB' | 'American';

export interface ContentResource {
  id: string;
  title: string;
  type: 'Document' | 'Video' | 'Presentation' | 'Link' | 'SCORM';
  url: string;
  source: 'Local' | 'Google Drive' | 'OneDrive';
  size?: string;
  uploadedAt?: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  resources: ContentResource[];
  subFolders: LibraryFolder[];
}

export interface AcademicWeek {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  topics: any[];
}

export interface SubjectNode {
  id: string;
  name: string;
  code?: string;
  nameEn?: string;
  nameAr?: string;
  department?: string;
  weeks: AcademicWeek[];
  resources: ContentResource[];
  folders: LibraryFolder[];
  lessonPlans: LessonPlan[];
  assignedTeacherIds?: string[];
}

export interface GradeLevelNode {
  id: string;
  name: string;
  subjects: SubjectNode[];
}

export interface CurriculumTree {
  id: string;
  system: CurriculumSystem;
  academicYear: string;
  grades: GradeLevelNode[];
}

// --- Gradebook Types ---

export type AssessmentCategory = 'Homework' | 'Quiz' | 'Project' | 'Exam' | 'Participation' | string;

export interface GradingTerm {
  id: string;
  name: string; // Term 1, Semester 1
  startDate: string;
  endDate: string;
  status: 'Active' | 'Locked' | 'Archived';
}

export interface Assessment {
  id: string;
  title: string;
  category: AssessmentCategory;
  maxScore: number;
  startDate?: string;
  date: string;
  termId: string;
  isGraded?: boolean;
  weight?: number; // Weight within the category
  gradingType?: 'Points' | 'Percentage';
}

export interface GradeEntry {
  studentId: string;
  assessmentId: string;
  score: number | null; // null represents not graded yet
  status: 'Submitted' | 'Graded' | 'Missing' | 'Late' | 'Excused';
  feedback?: string;
}

export interface GradingScaleRule {
  grade: string;
  min: number;
  max: number;
  color: string;
  gpaValue?: number;
}

export interface GradebookConfig {
  id: string;
  classId: string;
  subjectName: string;
  categoryWeights: Record<string, number>; // e.g. { Exam: 40, Quiz: 20 }
  categories: { id: string; name: string; weight: number }[]; // New nested structure
  passingScore: number;
  gradingScale: GradingScaleRule[];
  gradingDisplayType?: 'Points' | 'Percentage' | 'Letter Grades';
  terms: GradingTerm[];
  assessments: Assessment[];
  entries: GradeEntry[];
  approvalWorkflow?: 'Direct Publish' | 'Standard Review' | 'Strict Compliance';
}

// --- Notification Architecture Types ---

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL'
}

export enum NotificationCategory {
  ACADEMIC = 'ACADEMIC',
  FINANCIAL = 'FINANCIAL',
  BEHAVIORAL = 'BEHAVIORAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE'
}

export interface NotificationTrigger {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: NotificationCategory;
  enabled: boolean;
  channels: NotificationChannel[];
  recipients: UserRole[];
  aiPurposeEn?: string;
  aiPurposeAr?: string;
}

export interface NotificationSettings {
  channels: {
    [key in NotificationChannel]: {
      enabled: boolean;
      descriptionEn: string;
      descriptionAr: string;
    };
  };
  categories: {
    [key in NotificationCategory]: {
      enabled: boolean;
      channels: NotificationChannel[];
      recipients: UserRole[];
      descriptionEn: string;
      descriptionAr: string;
    };
  };
  triggers: NotificationTrigger[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    allowEmergency: boolean;
  };
  batching: {
    enabled: boolean;
    frequency: 'Daily' | 'Weekly';
    time: string; // HH:mm
  };
}

// --- Class Management & Attendance Types ---

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused' | 'Left Early';

export interface ClassSection {
  id: string;
  name: string; // e.g. "10-A"
  gradeLevel: string;
  curriculumSystem: CurriculumSystem;
  academicYear: string;
  room: string;
  teacherId: string; // Homeroom teacher
  capacity?: number;
  students: string[]; // List of Student IDs
  schedule: {
    day: string;
    periods: { subject: string; time: string }[];
  }[];
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  timestamp: string; // ISO time of scan
  method: 'QR' | 'Manual' | 'Geo';
  notes?: string;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'Active' | 'Closed';
  subject: string;
  records: AttendanceRecord[];
}

// --- Space Management Types ---

export interface SpaceGovernance {
  enableSocialWall: boolean;
  parentObserverAccess: boolean;
  aiContentFiltering: boolean;
  studentPosting: boolean;
  privateMessaging: boolean;
  classDrive: boolean;
  liveSessionIntegration: boolean;
  postApprovalMode: boolean;
  keywordFiltering: boolean;
  offTopicDetection: boolean;
  lockWallAfterHours: boolean;
}

export interface ClassSpace {
  id: string;
  sectionId: string;
  name: string;
  teacherId: string;
  coTeachers: string[];
  status: 'Active' | 'Archived' | 'Maintenance';
  engagementRate: number;
  pendingFlags: number;
  mood: 'Positive' | 'Neutral' | 'Stressed' | 'Excited';
  settings: SpaceGovernance;
}

// --- Houses Types ---

export interface House {
  id: string;
  name: string;
  color: string;
  logoUrl: string | null;
  studentCount: number;
  totalPoints: number;
}

export interface HousePointEntry {
  id: string;
  studentId: string;
  studentName: string;
  houseId: string;
  points: number;
  note?: string | null;
  awardedByName: string;
  awardedAt: string;
}
