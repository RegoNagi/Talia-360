import React, { useState } from 'react';
import { Language, User } from '../types';
import { Button } from '../components/Button';
import { showToast } from '../components/Toast';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Trophy,
  Star,
  Upload,
  Users,
} from 'lucide-react';
import {
  getHouses,
  getHouseDetails,
  createHouse,
  updateHouse,
  deleteHouse,
  uploadHouseLogo,
  addHousePoints,
  HouseDetails,
} from '../services/supabaseData';
import { House } from '../types';

interface HousesProps {
  language: Language;
  user: User;
}

export const Houses: React.FC<HousesProps> = ({ language, user }) => {
  const isRTL = language === Language.AR;
  const t = (ar: string, en: string) => (isRTL ? ar : en);

  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshHouses = () => {
    setIsLoading(true);
    getHouses().then((rows) => {
      setHouses(rows);
      setIsLoading(false);
    });
  };
  React.useEffect(() => { refreshHouses(); }, []);

  // ---------- إنشاء / تعديل هاوس ----------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [colorDraft, setColorDraft] = useState('#8b5cf6');
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openCreateModal = () => {
    setEditingHouseId(null);
    setNameDraft('');
    setColorDraft('#8b5cf6');
    setExistingLogoUrl(null);
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (house: House) => {
    setEditingHouseId(house.id);
    setNameDraft(house.name);
    setColorDraft(house.color);
    setExistingLogoUrl(house.logoUrl);
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const handleSaveHouse = async () => {
    if (!nameDraft.trim()) {
      showToast(t('اكتب اسم الهاوس الأول.', 'Enter a house name first.'), 'error');
      return;
    }
    setIsSaving(true);
    let logoUrl = existingLogoUrl;
    if (logoFile) {
      const uploaded = await uploadHouseLogo(logoFile);
      if (!uploaded) {
        setIsSaving(false);
        showToast(t('حصل خطأ أثناء رفع اللوجو.', 'Error uploading logo.'), 'error');
        return;
      }
      logoUrl = uploaded;
    }

    const ok = editingHouseId
      ? await updateHouse({ id: editingHouseId, name: nameDraft.trim(), color: colorDraft, logoUrl })
      : (await createHouse({ name: nameDraft.trim(), color: colorDraft, logoUrl })) !== null;

    setIsSaving(false);
    if (ok) {
      showToast(editingHouseId ? t('تم تعديل الهاوس.', 'House updated.') : t('تم إنشاء الهاوس.', 'House created.'), 'success');
      setIsModalOpen(false);
      refreshHouses();
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const handleDeleteHouse = async (house: House) => {
    const confirmed = window.confirm(
      t(`متأكد إنك عايز تمسح هاوس "${house.name}"؟ الطلاب اللي جواه هيفضلوا من غير هاوس.`, `Delete house "${house.name}"? Students in it will become houseless.`)
    );
    if (!confirmed) return;
    const ok = await deleteHouse(house.id);
    if (ok) {
      showToast(t('تم حذف الهاوس.', 'House deleted.'), 'success');
      refreshHouses();
    } else {
      showToast(t('حصل خطأ أثناء الحذف.', 'Error deleting.'), 'error');
    }
  };

  // ---------- عرض تفاصيل هاوس ----------
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [houseDetails, setHouseDetails] = useState<HouseDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const openHouseDetails = (houseId: string) => {
    setSelectedHouseId(houseId);
    setIsLoadingDetails(true);
    getHouseDetails(houseId).then((details) => {
      setHouseDetails(details);
      setIsLoadingDetails(false);
    });
  };

  const refreshHouseDetails = () => {
    if (!selectedHouseId) return;
    setIsLoadingDetails(true);
    getHouseDetails(selectedHouseId).then((details) => {
      setHouseDetails(details);
      setIsLoadingDetails(false);
    });
  };

  // ---------- إضافة نقاط لطالب (من جوا الكارت) ----------
  const [addingPointsForStudentId, setAddingPointsForStudentId] = useState<string | null>(null);
  const [pointsDraft, setPointsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingPoints, setIsSavingPoints] = useState(false);

  const handleAddPoints = async (studentId: string) => {
    const pointsNum = parseInt(pointsDraft, 10);
    if (!pointsNum || pointsNum <= 0) {
      showToast(t('اكتب عدد نقاط صحيح (أكبر من صفر).', 'Enter a valid points number (greater than zero).'), 'error');
      return;
    }
    if (!selectedHouseId) return;
    setIsSavingPoints(true);
    const ok = await addHousePoints({
      studentId,
      houseId: selectedHouseId,
      points: pointsNum,
      note: noteDraft.trim() || undefined,
      awardedByName: user.name,
    });
    setIsSavingPoints(false);
    if (ok) {
      showToast(t('تم إضافة النقاط.', 'Points added.'), 'success');
      setAddingPointsForStudentId(null);
      setPointsDraft('');
      setNoteDraft('');
      refreshHouseDetails();
      refreshHouses();
    } else {
      showToast(t('حصل خطأ أثناء الحفظ.', 'Error saving.'), 'error');
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  // ============ عرض تفاصيل هاوس معيّن ============
  if (selectedHouseId) {
    return (
      <div className="space-y-6 animate-fadeIn pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedHouseId(null); setHouseDetails(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronDown size={24} className={`${isRTL ? 'rotate-90' : '-rotate-90'} text-slate-600`} />
          </button>
          {isLoadingDetails || !houseDetails ? (
            <h2 className="text-2xl font-bold text-slate-900">{t('جاري التحميل...', 'Loading...')}</h2>
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2"
                style={{ backgroundColor: `${houseDetails.house.color}20`, borderColor: houseDetails.house.color }}
              >
                {houseDetails.house.logoUrl ? (
                  <img src={houseDetails.house.logoUrl} alt={houseDetails.house.name} className="w-full h-full object-cover" />
                ) : (
                  <Trophy size={24} style={{ color: houseDetails.house.color }} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{houseDetails.house.name}</h2>
                <p className="text-sm text-slate-500">{houseDetails.students.length} {t('طالب', 'students')} • {houseDetails.house.totalPoints} {t('نقطة إجمالي', 'total points')}</p>
              </div>
            </div>
          )}
        </div>

        {!isLoadingDetails && houseDetails && (
          <>
            {/* قائمة الطلاب */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{t('طلاب الهاوس', 'House Students')}</h3>
              </div>
              {houseDetails.students.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('لسه مفيش طلاب في الهاوس ده.', 'No students in this house yet.')}</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {houseDetails.students.map((s) => (
                    <div key={s.studentId} className="p-4">
                      {addingPointsForStudentId === s.studentId ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                              <Star size={16} />
                            </div>
                            <p className="font-bold text-gray-900 text-sm shrink-0 w-40 truncate">{s.studentName}</p>
                            <input
                              autoFocus
                              type="number"
                              min={1}
                              value={pointsDraft}
                              onChange={(e) => setPointsDraft(e.target.value)}
                              placeholder={t('عدد النقاط', 'Points')}
                              className="w-28 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder={t('سبب (اختياري)...', 'Reason (optional)...')}
                              className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 pl-12">
                            <button onClick={() => handleAddPoints(s.studentId)} disabled={isSavingPoints} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0">
                              {isSavingPoints ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
                            </button>
                            <button onClick={() => { setAddingPointsForStudentId(null); setPointsDraft(''); setNoteDraft(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shrink-0">
                              {t('إلغاء', 'Cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                            <Star size={16} />
                          </div>
                          <p className="font-bold text-gray-900 text-sm flex-1 truncate">{s.studentName}</p>
                          <span className="text-sm font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-full shrink-0">{s.totalPoints} {t('نقطة', 'pts')}</span>
                          <button
                            onClick={() => { setAddingPointsForStudentId(s.studentId); setPointsDraft(''); setNoteDraft(''); }}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors shrink-0"
                          >
                            {t('+ إضافة نقاط', '+ Add Points')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* سجل النقاط */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{t('سجل النقاط', 'Points Log')}</h3>
              </div>
              {houseDetails.pointsLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">{t('لسه مفيش نقاط اتضافت.', 'No points awarded yet.')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                        <th className="px-5 py-3 font-bold">{t('الطالب', 'Student')}</th>
                        <th className="px-5 py-3 font-bold">{t('النقاط', 'Points')}</th>
                        <th className="px-5 py-3 font-bold">{t('السبب', 'Reason')}</th>
                        <th className="px-5 py-3 font-bold">{t('بواسطة', 'Awarded By')}</th>
                        <th className="px-5 py-3 font-bold">{t('التاريخ', 'Date')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {houseDetails.pointsLog.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-bold text-gray-900 text-sm">{log.studentName}</td>
                          <td className="px-5 py-3 text-sm">
                            <span className="font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">+{log.points}</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">{log.note || '—'}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{log.awardedByName}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{formatDateTime(log.awardedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ============ قائمة الهاوسز ============
  return (
    <div className="space-y-6 animate-fadeIn pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('الهاوسز', 'Houses')}</h1>
          <p className="text-gray-500">{t('إدارة هاوسات المدرسة ونقاط الطلاب.', "Manage the school's houses and student points.")}</p>
        </div>
        <Button onClick={openCreateModal} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus size={16} className={isRTL ? 'ml-2' : 'mr-2'} /> {t('إنشاء هاوس', 'Create House')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">{t('جاري التحميل...', 'Loading...')}</p>
      ) : houses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">{t('لسه مفيش هاوسات. ابدأ بإنشاء أول هاوس.', 'No houses yet. Start by creating the first one.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {houses.map((house) => (
            <div key={house.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
              <button onClick={() => openHouseDetails(house.id)} className="w-full text-left p-5 flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2"
                  style={{ backgroundColor: `${house.color}20`, borderColor: house.color }}
                >
                  {house.logoUrl ? (
                    <img src={house.logoUrl} alt={house.name} className="w-full h-full object-cover" />
                  ) : (
                    <Trophy size={28} style={{ color: house.color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{house.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users size={12} /> {house.studentCount}</span>
                    <span className="flex items-center gap-1 font-bold text-violet-700"><Star size={12} /> {house.totalPoints} {t('نقطة', 'pts')}</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center border-t border-gray-50">
                <button onClick={() => openEditModal(house)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  <Pencil size={13} /> {t('تعديل', 'Edit')}
                </button>
                <div className="w-px h-5 bg-gray-100" />
                <button onClick={() => handleDeleteHouse(house)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} /> {t('حذف', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal إنشاء / تعديل هاوس */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
            <h3 className="text-lg font-bold text-gray-900">
              {editingHouseId ? t('تعديل الهاوس', 'Edit House') : t('إنشاء هاوس جديد', 'Create New House')}
            </h3>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('اسم الهاوس', 'House Name')}</label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t('مثال: النسور', 'e.g. Eagles')}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('اللون', 'Color')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colorDraft}
                  onChange={(e) => setColorDraft(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                />
                <span className="text-sm text-gray-500 font-mono">{colorDraft}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('اللوجو', 'Logo')}</label>
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-dashed"
                  style={{ borderColor: colorDraft }}
                >
                  {logoFile ? (
                    <img src={URL.createObjectURL(logoFile)} alt="preview" className="w-full h-full object-cover" />
                  ) : existingLogoUrl ? (
                    <img src={existingLogoUrl} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-gray-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="flex-1 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-600 file:text-xs file:font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>{t('إلغاء', 'Cancel')}</Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={isSaving} onClick={handleSaveHouse}>
                {isSaving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
