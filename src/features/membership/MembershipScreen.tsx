import { useState } from 'react';
import ConfirmModal from '../../app/components/overlay/ConfirmModal';
import BottomSheet from '../../app/components/overlay/BottomSheet';
import { MembershipItem } from '../../mocks/memberships';

interface MembershipScreenProps {
  memberships: MembershipItem[];
  onClose: () => void;
  onAddMembership: (membership: MembershipItem) => void;
  onUpdateMembership: (membership: MembershipItem) => void;
  onDeleteMembership: (membershipId: string) => void;
}

const GYM_OPTIONS = [
  { gymName: '더클라임', lightBg: '#E6F1FB', darkText: '#0C447C' },
  { gymName: '피커스', lightBg: '#F7E8D7', darkText: '#6A3F0A' },
  { gymName: '클라이밍랩코', lightBg: '#F0E8FA', darkText: '#5A2D84' },
];

const UNASSIGNED_GYM = {
  gymName: '',
  lightBg: '#F5F5F5',
  darkText: '#525252',
};

export default function MembershipScreen({ memberships, onClose, onAddMembership, onUpdateMembership, onDeleteMembership }: MembershipScreenProps) {
  const countPasses = memberships.filter((membership) => membership.passType === 'count').length;
  const periodPasses = memberships.length - countPasses;
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [deletingMembershipId, setDeletingMembershipId] = useState<string | null>(null);
  const [gymName, setGymName] = useState('');
  const [passName, setPassName] = useState('10회 이용권');
  const [passType, setPassType] = useState<'count' | 'period'>('count');
  const [remainingCount, setRemainingCount] = useState('10');
  const [totalCount, setTotalCount] = useState('10');
  const [remainingDays, setRemainingDays] = useState('30');
  const [startDate, setStartDate] = useState('2026.04.20');
  const [endDate, setEndDate] = useState('2026.05.20');
  const [note, setNote] = useState('저녁 시간대 사용 예정');

  const resetForm = () => {
    setGymName('');
    setPassName('10회 이용권');
    setPassType('count');
    setRemainingCount('10');
    setTotalCount('10');
    setRemainingDays('30');
    setStartDate('2026.04.20');
    setEndDate('2026.05.20');
    setNote('저녁 시간대 사용 예정');
  };

  const openAddSheet = () => {
    setEditingMembershipId(null);
    resetForm();
    setShowAddSheet(true);
  };

  const openEditSheet = (membership: MembershipItem) => {
    setEditingMembershipId(membership.id);
    setGymName(membership.gymName);
    setPassName(membership.passName);
    setPassType(membership.passType);
    setStartDate(membership.startDate);
    setEndDate(membership.endDate);
    setNote(membership.note);

    if (membership.passType === 'count') {
      const [remainingPart, totalPart] = membership.remainingValue.replace('회', '').split('/').map((value) => value.trim());
      setRemainingCount(remainingPart || '0');
      setTotalCount(totalPart || '0');
    } else {
      setRemainingDays(membership.remainingValue.replace('일 남음', '').trim() || '0');
    }

    setShowAddSheet(true);
  };

  const closeSheet = () => {
    setShowAddSheet(false);
    setEditingMembershipId(null);
    resetForm();
  };

  const handleDeleteMembership = () => {
    if (!deletingMembershipId) return;
    onDeleteMembership(deletingMembershipId);
    setDeletingMembershipId(null);
  };

  const handleSaveMembership = () => {
    const gymInfo = GYM_OPTIONS.find((option) => option.gymName === gymName) ?? UNASSIGNED_GYM;

    const nextMembership: MembershipItem = {
      id: editingMembershipId ?? `${gymName || 'unassigned'}-${Date.now()}`,
      gymName,
      passName,
      passType,
      remainingLabel: passType === 'count' ? '남은 횟수' : '남은 기간',
      remainingValue: passType === 'count' ? `${remainingCount} / ${totalCount}회` : `${remainingDays}일 남음`,
      lightBg: gymInfo.lightBg,
      darkText: gymInfo.darkText,
      startDate,
      endDate,
      note,
    };

    if (editingMembershipId) {
      onUpdateMembership(nextMembership);
    } else {
      onAddMembership(nextMembership);
    }

    closeSheet();
  };

  const handleToggleFavorite = (membership: MembershipItem) => {
    onUpdateMembership({ ...membership, isFavorite: !membership.isFavorite });
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-700"
          aria-label="뒤로가기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="text-[18px] font-bold text-neutral-950">회원권</div>
        <button onClick={openAddSheet} className="min-h-11 px-3 rounded-full border border-neutral-200 text-[14px] font-medium text-neutral-700">추가</button>
      </div>

      <div className="px-5 space-y-4">
        <div className="rounded-2xl border border-neutral-200 p-5 bg-white">
          <div className="text-[14px] text-neutral-500">보유 중인 회원권</div>
          <div className="text-[28px] font-bold text-neutral-950 mt-1">{memberships.length}개</div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">횟수권</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{countPasses}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">기간권</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{periodPasses}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">만료 예정</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">1</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {memberships.map((membership) => (
            <div key={membership.id} className="rounded-2xl border border-neutral-200 p-4 bg-white">
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] font-bold flex-shrink-0"
                  style={{ backgroundColor: membership.lightBg, color: membership.darkText }}
                >
                  {membership.gymName ? membership.gymName.slice(0, 1) : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[16px] font-bold text-neutral-950 truncate">{membership.gymName || '암장 미선택'}</div>
                      <div className="text-[13px] text-neutral-500 mt-0.5">{membership.passName}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div
                        className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
                        style={{ backgroundColor: membership.lightBg, color: membership.darkText }}
                      >
                        {membership.passType === 'count' ? '횟수권' : '기간권'}
                      </div>
                      <button onClick={() => handleToggleFavorite(membership)} className="p-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={membership.isFavorite ? "#EAB308" : "none"} stroke={membership.isFavorite ? "#EAB308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <button onClick={() => openEditSheet(membership)} className="text-[12px] font-medium text-neutral-500">편집</button>
                      <button onClick={() => setDeletingMembershipId(membership.id)} className="text-[12px] font-medium text-red-500">삭제</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="rounded-2xl border border-neutral-200 px-3 py-3">
                      <div className="text-[12px] text-neutral-500">{membership.remainingLabel}</div>
                      <div className="text-[16px] font-bold text-neutral-900 mt-1">{membership.remainingValue}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 px-3 py-3">
                      <div className="text-[12px] text-neutral-500">사용 기간</div>
                      <div className="text-[14px] font-semibold text-neutral-900 mt-1">{membership.startDate}</div>
                      <div className="text-[13px] text-neutral-500 mt-0.5">~ {membership.endDate}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 px-3 py-3 mt-3 text-[13px] text-neutral-600">
                    {membership.note}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-200 px-4 py-4 bg-white">
          <div className="text-[15px] font-bold text-neutral-950">알림 메모</div>
          <div className="text-[13px] text-neutral-500 mt-2 leading-6">
            만료 7일 전, 횟수권 1회 남음 상태에서 푸시 알림을 받도록 설정된 상태입니다.
          </div>
        </div>
      </div>

      {showAddSheet && (
        <BottomSheet onClose={closeSheet} title={editingMembershipId ? '회원권 편집' : '회원권 추가'} bodyClassName="px-6 py-5 space-y-4">
              <label className="block">
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">암장</div>
                <select value={gymName} onChange={(event) => setGymName(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 bg-white text-[15px] text-neutral-900 outline-none">
                  <option value="">선택 안 함</option>
                  {GYM_OPTIONS.map((option) => (
                    <option key={option.gymName} value={option.gymName}>{option.gymName}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">회원권 이름</div>
                <input value={passName} onChange={(event) => setPassName(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" />
              </label>

              <div>
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">회원권 종류</div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPassType('count')} className={`h-12 rounded-2xl border text-[15px] font-medium ${passType === 'count' ? 'border-blue-500 bg-blue-500 text-white' : 'border-neutral-200 text-neutral-700'}`}>횟수권</button>
                  <button onClick={() => setPassType('period')} className={`h-12 rounded-2xl border text-[15px] font-medium ${passType === 'period' ? 'border-blue-500 bg-blue-500 text-white' : 'border-neutral-200 text-neutral-700'}`}>기간권</button>
                </div>
              </div>

              {passType === 'count' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-[13px] font-semibold text-neutral-700 mb-2">남은 횟수</div>
                    <input value={remainingCount} onChange={(event) => setRemainingCount(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" inputMode="numeric" />
                  </label>
                  <label className="block">
                    <div className="text-[13px] font-semibold text-neutral-700 mb-2">전체 횟수</div>
                    <input value={totalCount} onChange={(event) => setTotalCount(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" inputMode="numeric" />
                  </label>
                </div>
              ) : (
                <label className="block">
                  <div className="text-[13px] font-semibold text-neutral-700 mb-2">남은 기간</div>
                  <input value={remainingDays} onChange={(event) => setRemainingDays(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" inputMode="numeric" />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-[13px] font-semibold text-neutral-700 mb-2">시작일</div>
                  <input value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" />
                </label>
                <label className="block">
                  <div className="text-[13px] font-semibold text-neutral-700 mb-2">만료일</div>
                  <input value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" />
                </label>
              </div>

              <label className="block">
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">메모</div>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="w-full min-h-[96px] rounded-2xl border border-neutral-200 px-4 py-3 text-[15px] text-neutral-900 outline-none resize-none" />
              </label>

            <div className="pt-2 border-t border-neutral-100">
              <button onClick={handleSaveMembership} className="w-full h-12 rounded-2xl bg-blue-500 text-white text-[15px] font-semibold">{editingMembershipId ? '회원권 수정 저장' : '회원권 저장'}</button>
            </div>
        </BottomSheet>
      )}

      {deletingMembershipId && (
        <ConfirmModal
          title="회원권 삭제"
          description="선택한 회원권을 목록에서 삭제할까요?"
          confirmLabel="삭제"
          confirmTone="danger"
          onClose={() => setDeletingMembershipId(null)}
          onConfirm={handleDeleteMembership}
        />
      )}
    </div>
  );
}
