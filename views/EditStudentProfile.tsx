import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Step1 } from '../components/steps/Step1';
import { Step2 } from '../components/steps/Step2';
import { Step3 } from '../components/steps/Step3';
import { getStudentById, updateStudent } from '../services/supabaseData';

const Stepper = ({ currentStep, steps }: { currentStep: number, steps: string[] }) => (
  <div className="flex justify-between items-center mb-8">
    {steps.map((step, index) => (
      <div key={step} className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index <= currentStep ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
          {index + 1}
        </div>
        <span className="text-xs mt-2 font-medium text-slate-600">{step}</span>
      </div>
    ))}
  </div>
);

const SuccessScreen = () => (
  <div className="text-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-2">تم تحديث ملف الطالب بنجاح</h3>
    <p className="text-slate-500">تم حفظ بيانات الطالب.</p>
  </div>
);

// بيحوّل ParentInfo (من قاعدة البيانات) لشكل الحقول المفرودة اللي Step2 عايزه
function parentInfoToFormFields(prefix: 'father' | 'mother', info: any) {
  if (!info) return {};
  return {
    [`${prefix}FirstName`]: info.firstName || '', [`${prefix}SecondName`]: info.secondName || '',
    [`${prefix}ThirdName`]: info.thirdName || '', [`${prefix}LastName`]: info.lastName || '',
    [`${prefix}Nationality`]: info.nationality || '', [`${prefix}SecondNationality`]: info.secondNationality || '',
    [`${prefix}IdNumber`]: info.idNumber || '', [`${prefix}AcademicDegree`]: info.academicDegree || '',
    [`${prefix}Marital`]: info.marital || '', [`${prefix}EmploymentStatus`]: info.employmentStatus || '',
    [`${prefix}JobTitle`]: info.jobTitle || '', [`${prefix}CompanyName`]: info.companyName || '',
    [`${prefix}Email`]: info.email || '', [`${prefix}Mobile`]: info.mobile || '',
    [`${prefix}Whatsapp`]: info.whatsapp || '', [`${prefix}Deceased`]: info.deceased || false,
  };
}

function buildFormDataFromStudent(student: any) {
  const identity = student.identityInfo || {};
  const home = student.homeAddress || {};
  const additional = student.additionalInfo || {};
  return {
    // Step 1 — بيانات الطالب: الاسم والميلاد والصف مربوطين بالأعمدة الحقيقية، الباقي من identity_info
    childFirstName: identity.firstName || '', childSecondName: identity.secondName || '',
    childThirdName: identity.thirdName || '', childLastName: identity.lastName || '',
    childFirstNameAr: identity.firstNameAr || '', childSecondNameAr: identity.secondNameAr || '',
    childThirdNameAr: identity.thirdNameAr || '', childLastNameAr: identity.lastNameAr || '',
    childGender: identity.gender || '', childReligion: identity.religion || '',
    childNationality: identity.nationality || '', childSecondNationality: identity.secondNationality || '',
    nativeLanguage: identity.nativeLanguage || '', secondLanguage: identity.secondLanguage || '',
    englishProficiency: identity.englishProficiency || '',
    childDob: student.dob || '', childIdNumber: student.nationalId || '',
    childIdFile: null, childPhoto: null,
    academicYear: identity.academicYear || '', yearLevel: student.grade || '',
    // Step 2 — الأسرة
    ...parentInfoToFormFields('father', student.fatherInfo),
    ...parentInfoToFormFields('mother', student.motherInfo),
    legalGuardian: student.legalGuardian || '', guardianRelationship: student.guardianRelationship || '',
    emergencyContact1: student.emergencyContact1 || {},
    emergencyContact2: student.emergencyContact2 || {},
    homeCity: home.city || '', homeArea: home.area || '', homeStreet: home.street || '',
    homeBuilding: home.building || '', homeApartment: home.apartment || '', homeLandline: home.landline || '',
    // Step 3 — بيانات إضافية
    hasMedical: additional.hasMedical || 'No', medicalDetails: additional.medicalDetails || '',
    hasMedication: additional.hasMedication || 'No', medicationDetails: additional.medicationDetails || '',
    busService: additional.busService || 'No', hasSiblings: additional.hasSiblings || 'No',
    siblings: additional.siblings || [], siblingName: additional.siblingName || '',
    siblingYearGroup: additional.siblingYearGroup || '', appliedBefore: additional.appliedBefore || 'No',
    hobbies: additional.hobbies || '', marketing: additional.marketing || '', additionalNotes: additional.additionalNotes || '',
  } as any;
}

export const EditStudentProfile = ({ studentId, onBack }: { studentId: string; onBack: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [userId, setUserId] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const steps = ["بيانات الطالب", "بيانات الأسرة", "بيانات إضافية"];

  useEffect(() => {
    getStudentById(studentId).then((student) => {
      if (student) {
        setFormData(buildFormDataFromStudent(student));
        setStudentName(student.name);
        setUserId((student as any).userId);
        setIsActive(student.status !== 'Inactive');
      }
      setIsLoading(false);
    });
  }, [studentId]);

  const updateForm = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
    else handleSave();
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');
    const fullName = [formData.childFirstName, formData.childSecondName, formData.childThirdName, formData.childLastName].filter(Boolean).join(' ').trim() || studentName;

    const ok = await updateStudent({
      studentId,
      userId,
      name: fullName,
      grade: formData.yearLevel || '',
      dob: formData.childDob || '',
      status: isActive ? 'Active' : 'Inactive',
      fatherInfo: {
        firstName: formData.fatherFirstName, secondName: formData.fatherSecondName, thirdName: formData.fatherThirdName, lastName: formData.fatherLastName,
        nationality: formData.fatherNationality, secondNationality: formData.fatherSecondNationality, idNumber: formData.fatherIdNumber,
        academicDegree: formData.fatherAcademicDegree, marital: formData.fatherMarital, employmentStatus: formData.fatherEmploymentStatus,
        jobTitle: formData.fatherJobTitle, companyName: formData.fatherCompanyName, email: formData.fatherEmail,
        mobile: formData.fatherMobile, whatsapp: formData.fatherWhatsapp, deceased: formData.fatherDeceased,
      },
      motherInfo: {
        firstName: formData.motherFirstName, secondName: formData.motherSecondName, thirdName: formData.motherThirdName, lastName: formData.motherLastName,
        nationality: formData.motherNationality, secondNationality: formData.motherSecondNationality, idNumber: formData.motherIdNumber,
        academicDegree: formData.motherAcademicDegree, marital: formData.motherMarital, employmentStatus: formData.motherEmploymentStatus,
        jobTitle: formData.motherJobTitle, companyName: formData.motherCompanyName, email: formData.motherEmail,
        mobile: formData.motherMobile, whatsapp: formData.motherWhatsapp, deceased: formData.motherDeceased,
      },
      legalGuardian: formData.legalGuardian,
      guardianRelationship: formData.guardianRelationship,
      identityInfo: {
        firstName: formData.childFirstName, secondName: formData.childSecondName, thirdName: formData.childThirdName, lastName: formData.childLastName,
        firstNameAr: formData.childFirstNameAr, secondNameAr: formData.childSecondNameAr, thirdNameAr: formData.childThirdNameAr, lastNameAr: formData.childLastNameAr,
        gender: formData.childGender, religion: formData.childReligion, nationality: formData.childNationality, secondNationality: formData.childSecondNationality,
        nativeLanguage: formData.nativeLanguage, secondLanguage: formData.secondLanguage, englishProficiency: formData.englishProficiency,
        academicYear: formData.academicYear,
      },
      emergencyContact1: formData.emergencyContact1,
      emergencyContact2: formData.emergencyContact2,
      homeAddress: {
        city: formData.homeCity, area: formData.homeArea, street: formData.homeStreet,
        building: formData.homeBuilding, apartment: formData.homeApartment, landline: formData.homeLandline,
      },
      additionalInfo: {
        hasMedical: formData.hasMedical, medicalDetails: formData.medicalDetails, hasMedication: formData.hasMedication, medicationDetails: formData.medicationDetails,
        busService: formData.busService, hasSiblings: formData.hasSiblings, siblingName: formData.siblingName, siblingYearGroup: formData.siblingYearGroup,
        appliedBefore: formData.appliedBefore, hobbies: formData.hobbies, marketing: formData.marketing, additionalNotes: formData.additionalNotes,
      },
    });

    setIsSaving(false);
    if (ok) {
      setIsSubmitted(true);
    } else {
      setSaveError('حصل خطأ أثناء الحفظ. حاول تاني.');
    }
  };

  if (isLoading || !formData) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium transition-colors mb-8"
        >
          <ArrowLeft size={20} /> الرجوع لملف {studentName}
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">تعديل ملف الطالب</h1>
            <p className="mt-2 text-base text-slate-600">تحديث بيانات {studentName} الشخصية والأكاديمية.</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-full shadow-sm border border-slate-200 self-start">
            <span className="text-sm font-medium text-slate-700">الحالة: {isActive ? 'نشط' : 'غير نشط'}</span>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${isActive ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {!isSubmitted ? (
            <div className="p-6 md:p-10">
              <Stepper currentStep={currentStep} steps={steps} />

              <div className="mt-8">
                {currentStep === 0 && <Step1 formData={formData} updateForm={updateForm} />}
                {currentStep === 1 && <Step2 formData={formData} updateForm={updateForm} />}
                {currentStep === 2 && <Step3 formData={formData} updateForm={updateForm} />}
              </div>

              {saveError && <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{saveError}</p>}

              <div className="mt-10 flex justify-between border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={prevStep}
                  className={`px-6 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
                >
                  السابق
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={isSaving}
                  className="px-6 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {isSaving ? 'جاري الحفظ...' : (currentStep === steps.length - 1 ? 'حفظ التعديلات' : 'التالي')}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 md:p-10">
              <SuccessScreen />
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-6 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  الرجوع للملف
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
