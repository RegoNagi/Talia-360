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

// النظرة دي بتتعرض بالإنجليزي دايمًا (بغض النظر عن لغة الموقع) بناءً على طلب صريح
export const Houses: React.FC<HousesProps> = ({ user }) => {
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

  // ---------- Create / Edit house ----------
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
      showToast('Enter a house name first.', 'error');
      return;
    }
    setIsSaving(true);
    let logoUrl = existingLogoUrl;
    if (logoFile) {
      const uploaded = await uploadHouseLogo(logoFile);
      if (!uploaded) {
        setIsSaving(false);
        showToast('Error uploading logo.', 'error');
        return;
      }
      logoUrl = uploaded;
    }

    const ok = editingHouseId
      ? await updateHouse({ id: editingHouseId, name: nameDraft.trim(), color: colorDraft, logoUrl })
      : (await createHouse({ name: nameDraft.trim(), color: colorDraft, logoUrl })) !== null;

    setIsSaving(false);
    if (ok) {
      showToast(editingHouseId ? 'House updated.' : 'House created.', 'success');
      setIsModalOpen(false);
      refreshHouses();
    } else {
      showToast('Error saving.', 'error');
    }
  };

  const handleDeleteHouse = async (house: House) => {
    const confirmed = window.confirm(`Delete house "${house.name}"? Students in it will become houseless.`);
    if (!confirmed) return;
    const ok = await deleteHouse(house.id);
    if (ok) {
      showToast('House deleted.', 'success');
      refreshHouses();
    } else {
      showToast('Error deleting.', 'error');
    }
  };

  // ---------- House detail view ----------
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

  // ---------- Add points to a specific student ----------
  const [addingPointsForStudentId, setAddingPointsForStudentId] = useState<string | null>(null);
  const [pointsDraft, setPointsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingPoints, setIsSavingPoints] = useState(false);

  const handleAddPointsToStudent = async (studentId: string) => {
    const pointsNum = parseInt(pointsDraft, 10);
    if (!pointsNum || pointsNum <= 0) {
      showToast('Enter a valid points number (greater than zero).', 'error');
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
      showToast('Points added.', 'success');
      setAddingPointsForStudentId(null);
      setPointsDraft('');
      setNoteDraft('');
      refreshHouseDetails();
      refreshHouses();
    } else {
      showToast('Error saving.', 'error');
    }
  };

  // ---------- Add points to the house itself (not tied to a student) ----------
  const [isAddingHousePoints, setIsAddingHousePoints] = useState(false);
  const [housePointsDraft, setHousePointsDraft] = useState('');
  const [houseNoteDraft, setHouseNoteDraft] = useState('');
  const [isSavingHousePoints, setIsSavingHousePoints] = useState(false);

  const handleAddPointsToHouse = async () => {
    const pointsNum = parseInt(housePointsDraft, 10);
    if (!pointsNum || pointsNum <= 0) {
      showToast('Enter a valid points number (greater than zero).', 'error');
      return;
    }
    if (!selectedHouseId) return;
    setIsSavingHousePoints(true);
    const ok = await addHousePoints({
      studentId: null,
      houseId: selectedHouseId,
      points: pointsNum,
      note: houseNoteDraft.trim() || undefined,
      awardedByName: user.name,
    });
    setIsSavingHousePoints(false);
    if (ok) {
      showToast('Points added to the house.', 'success');
      setIsAddingHousePoints(false);
      setHousePointsDraft('');
      setHouseNoteDraft('');
      refreshHouseDetails();
      refreshHouses();
    } else {
      showToast('Error saving.', 'error');
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  // ============ House detail view ============
  if (selectedHouseId) {
    return (
      <div className="space-y-6 animate-fadeIn pb-20" dir="ltr">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedHouseId(null); setHouseDetails(null); setIsAddingHousePoints(false); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronDown size={24} className="rotate-90 text-slate-600" />
            </button>
            {isLoadingDetails || !houseDetails ? (
              <h2 className="text-2xl font-bold text-slate-900">Loading...</h2>
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
                  <p className="text-sm text-slate-500">{houseDetails.students.length} students • {houseDetails.house.totalPoints} total points</p>
                </div>
              </div>
            )}
          </div>

          {!isLoadingDetails && houseDetails && (
            <Button onClick={() => setIsAddingHousePoints(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Plus size={16} className="mr-2" /> Add Points to House
            </Button>
          )}
        </div>

        {/* Inline form: add points to the house itself */}
        {isAddingHousePoints && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-violet-800">Award points to the house (not a specific student)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                type="number"
                min={1}
                value={housePointsDraft}
                onChange={(e) => setHousePointsDraft(e.target.value)}
                placeholder="Points"
                className="w-28 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="text"
                value={houseNoteDraft}
                onChange={(e) => setHouseNoteDraft(e.target.value)}
                placeholder="Reason (optional)..."
                className="flex-1 min-w-[200px] p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button onClick={handleAddPointsToHouse} disabled={isSavingHousePoints} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0">
                {isSavingHousePoints ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setIsAddingHousePoints(false); setHousePointsDraft(''); setHouseNoteDraft(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shrink-0">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!isLoadingDetails && houseDetails && (
          <>
            {/* Student list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">House Students</h3>
              </div>
              {houseDetails.students.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No students in this house yet.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {houseDetails.students.map((s) => (
                    <div key={s.studentId} className="p-4">
                      {addingPointsForStudentId === s.studentId ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
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
                              placeholder="Points"
                              className="w-28 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Reason (optional)..."
                              className="flex-1 min-w-[160px] p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 pl-12">
                            <button onClick={() => handleAddPointsToStudent(s.studentId)} disabled={isSavingPoints} className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shrink-0">
                              {isSavingPoints ? 'Saving...' : 'Save'}
                            </button>
                            <button onClick={() => { setAddingPointsForStudentId(null); setPointsDraft(''); setNoteDraft(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-bold shrink-0">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                            <Star size={16} />
                          </div>
                          <p className="font-bold text-gray-900 text-sm flex-1 truncate">{s.studentName}</p>
                          <span className="text-sm font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-full shrink-0">{s.totalPoints} pts</span>
                          <button
                            onClick={() => { setAddingPointsForStudentId(s.studentId); setPointsDraft(''); setNoteDraft(''); }}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors shrink-0"
                          >
                            + Add Points
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Points log */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Points Log</h3>
              </div>
              {houseDetails.pointsLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No points awarded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                        <th className="px-5 py-3 font-bold">Student</th>
                        <th className="px-5 py-3 font-bold">Points</th>
                        <th className="px-5 py-3 font-bold">Reason</th>
                        <th className="px-5 py-3 font-bold">Awarded By</th>
                        <th className="px-5 py-3 font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {houseDetails.pointsLog.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-bold text-gray-900 text-sm">
                            {log.studentName ?? <span className="italic text-gray-400 font-medium">House Bonus</span>}
                          </td>
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

  // ============ Houses list ============
  return (
    <div className="space-y-6 animate-fadeIn pb-20" dir="ltr">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Houses</h1>
          <p className="text-gray-500">Manage the school's houses and student points.</p>
        </div>
        <Button onClick={openCreateModal} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus size={16} className="mr-2" /> Create House
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
      ) : houses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No houses yet. Start by creating the first one.</p>
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
                    <span className="flex items-center gap-1 font-bold text-violet-700"><Star size={12} /> {house.totalPoints} pts</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center border-t border-gray-50">
                <button onClick={() => openEditModal(house)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  <Pencil size={13} /> Edit
                </button>
                <div className="w-px h-5 bg-gray-100" />
                <button onClick={() => handleDeleteHouse(house)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: create / edit house */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5" dir="ltr">
            <h3 className="text-lg font-bold text-gray-900">
              {editingHouseId ? 'Edit House' : 'Create New House'}
            </h3>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">House Name</label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. Eagles"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Color</label>
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Logo</label>
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
              <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={isSaving} onClick={handleSaveHouse}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
