import { describe, it, expect } from 'vitest';
import { calculateWeightedGrade, AssessmentLite, GradeEntryLite } from './gradeCalculations';

describe('calculateWeightedGrade', () => {
  it('يرجع صفر لو مفيش تقييمات خالص', () => {
    expect(calculateWeightedGrade([], [], {}, 's1')).toBe(0);
  });

  it('يحسب مادة واحدة بوزن 100% صح', () => {
    const assessments: AssessmentLite[] = [{ id: 'a1', category: 'اختبارات', maxScore: 100 }];
    const entries: GradeEntryLite[] = [{ studentId: 's1', assessmentId: 'a1', score: 75, status: 'Graded' }];
    expect(calculateWeightedGrade(assessments, entries, { 'اختبارات': 100 }, 's1')).toBe(75);
  });

  it('يحسب فئتين بأوزان مختلفة صح (هنا الباگ الأصلي كان بيدي 1 بدل 80)', () => {
    const assessments: AssessmentLite[] = [
      { id: 'a1', category: 'اختبارات', maxScore: 100 },
      { id: 'a2', category: 'واجبات', maxScore: 100 },
    ];
    const entries: GradeEntryLite[] = [
      { studentId: 's1', assessmentId: 'a1', score: 80, status: 'Graded' },
      { studentId: 's1', assessmentId: 'a2', score: 80, status: 'Graded' },
    ];
    const result = calculateWeightedGrade(assessments, entries, { 'اختبارات': 50, 'واجبات': 50 }, 's1');
    expect(result).toBe(80);
  });

  it('يطبّق خصم التأخير 10% صح', () => {
    const assessments: AssessmentLite[] = [{ id: 'a1', category: 'واجبات', maxScore: 100 }];
    const entries: GradeEntryLite[] = [{ studentId: 's1', assessmentId: 'a1', score: 100, status: 'Late' }];
    expect(calculateWeightedGrade(assessments, entries, { 'واجبات': 100 }, 's1')).toBe(90);
  });

  it('الغياب (Missing) يتحسب صفر، ويأثر سلبًا على النسبة', () => {
    const assessments: AssessmentLite[] = [
      { id: 'a1', category: 'واجبات', maxScore: 100 },
      { id: 'a2', category: 'واجبات', maxScore: 100 },
    ];
    const entries: GradeEntryLite[] = [
      { studentId: 's1', assessmentId: 'a1', score: 100, status: 'Graded' },
    ];
    expect(calculateWeightedGrade(assessments, entries, { 'واجبات': 100 }, 's1')).toBe(50);
  });

  it('الإعفاء (Excused) يُستبعد بالكامل، عكس الغياب', () => {
    const assessments: AssessmentLite[] = [
      { id: 'a1', category: 'واجبات', maxScore: 100 },
      { id: 'a2', category: 'واجبات', maxScore: 100 },
    ];
    const entries: GradeEntryLite[] = [
      { studentId: 's1', assessmentId: 'a1', score: 90, status: 'Graded' },
      { studentId: 's1', assessmentId: 'a2', score: null, status: 'Excused' },
    ];
    expect(calculateWeightedGrade(assessments, entries, { 'واجبات': 100 }, 's1')).toBe(90);
  });

  it('لو فئة واحدة بس عندها تقييمات، بتاخد الوزن كله (إعادة توزين تلقائي)', () => {
    const assessments: AssessmentLite[] = [{ id: 'a1', category: 'اختبارات', maxScore: 100 }];
    const entries: GradeEntryLite[] = [{ studentId: 's1', assessmentId: 'a1', score: 60, status: 'Graded' }];
    const result = calculateWeightedGrade(assessments, entries, { 'اختبارات': 30, 'واجبات': 70 }, 's1');
    expect(result).toBe(60);
  });

  it('العنصر غير المُقيَّم (isGraded: false) يُستبعد تمامًا', () => {
    const assessments: AssessmentLite[] = [{ id: 'a1', category: 'واجبات', maxScore: 100, isGraded: false }];
    const entries: GradeEntryLite[] = [{ studentId: 's1', assessmentId: 'a1', score: 40, status: 'Graded' }];
    expect(calculateWeightedGrade(assessments, entries, { 'واجبات': 100 }, 's1')).toBe(0);
  });

  it('فلترة الترم (termId) بتاخد بس تقييمات الترم المطلوب', () => {
    const assessments: AssessmentLite[] = [
      { id: 'a1', category: 'واجبات', maxScore: 100, termId: 'term1' },
      { id: 'a2', category: 'واجبات', maxScore: 100, termId: 'term2' },
    ];
    const entries: GradeEntryLite[] = [
      { studentId: 's1', assessmentId: 'a1', score: 100, status: 'Graded' },
      { studentId: 's1', assessmentId: 'a2', score: 0, status: 'Graded' },
    ];
    expect(calculateWeightedGrade(assessments, entries, { 'واجبات': 100 }, 's1', 'term1')).toBe(100);
  });
});
