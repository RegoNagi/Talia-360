// حساب الدرجة النهائية المرجّحة لطالب — منطق واحد مشترك تستخدمه شاشة الدرجات الأساسية
// وشاشة الإشراف على كل المواد، عشان ميبقاش فيه نسختين مختلفتين تديان نتايج مختلفة.
export interface AssessmentLite {
  id: string;
  category: string;
  maxScore: number;
  termId?: string;
  isGraded?: boolean;
}

export interface GradeEntryLite {
  studentId: string;
  assessmentId: string;
  score: number | null;
  status: string; // 'Graded' | 'Late' | 'Missing' | 'Excused'
}

export function calculateWeightedGrade(
  assessments: AssessmentLite[],
  entries: GradeEntryLite[],
  categoryWeights: Record<string, number>,
  studentId: string,
  termId?: string
): number {
  const scoped = termId ? assessments.filter((a) => a.termId === termId) : assessments;
  const catScores: Record<string, { total: number; max: number }> = {};

  scoped.forEach((a) => {
    if (a.isGraded === false) return; // مش عنصر مُقيَّم أصلاً — يُستبعد بالكامل

    const entry = entries.find((e) => e.studentId === studentId && e.assessmentId === a.id);
    let score = entry ? entry.score : null;
    const status = entry ? entry.status : 'Missing';

    if (score !== null && status !== 'Excused') {
      if (status === 'Late') score = score * 0.9; // خصم تأخير تلقائي 10%
      if (!catScores[a.category]) catScores[a.category] = { total: 0, max: 0 };
      catScores[a.category].total += score;
      catScores[a.category].max += a.maxScore;
    } else if (status === 'Missing') {
      // الغائب يتحسب صفر، بس بيدخل في المجموع الأقصى (max) — يعني بيأثر سلبًا على النسبة
      if (!catScores[a.category]) catScores[a.category] = { total: 0, max: 0 };
      catScores[a.category].max += a.maxScore;
    }
    // status === 'Excused': يُستبعد بالكامل من total ومن max — كأن التقييم ده مش موجود خالص
  });

  let totalWeightedScore = 0;
  let totalWeightUsed = 0;
  Object.keys(catScores).forEach((cat) => {
    const weight = categoryWeights[cat] || 0;
    const data = catScores[cat];
    if (data.max > 0) {
      const percentage = (data.total / data.max) * 100;
      totalWeightedScore += percentage * (weight / 100);
      totalWeightUsed += weight;
    }
  });

  if (totalWeightUsed === 0) return 0;
  return Math.round((totalWeightedScore / totalWeightUsed) * 100);
}
