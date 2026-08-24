import { useRef, useState } from 'react';
import ConfirmModal from '../../app/components/overlay/ConfirmModal';
import BottomSheet from '../../app/components/overlay/BottomSheet';
import { MembershipDateField, MembershipDateValidationError, parseMembershipCounts, validateMembershipDates } from './membership-contract';
import { createPendingGuard } from './pending-guard';
import { firstUnusedHomeOrder, MembershipItem } from '../../mocks/memberships';
import { countExpiringSoon, EXPIRING_SOON_DAYS } from './membership-summary';

interface MembershipScreenProps {
  memberships: MembershipItem[];
  gymOptions: Array<{ gymName: string; gymId: string; lightBg: string; darkText: string }>;
  isLoading: boolean;
  error: string | null;
  isGymOptionsLoading: boolean;
  gymOptionsError: string | null;
  actionError: string | null;
  onRetry: () => void;
  onRetryGymOptions: () => void;
  onClose: () => void;
  onAddMembership: (membership: MembershipItem) => Promise<void>;
  onUpdateMembership: (membership: MembershipItem) => Promise<void>;
  onArchiveMembership: (membershipId: string) => Promise<void>;
}

const UNASSIGNED_GYM = {
  gymId: '',
  gymName: '',
  lightBg: '#F5F5F5',
  darkText: '#525252',
};

function formatFormDate(date: Date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function defaultMembershipDates(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  return { startDate: formatFormDate(now), endDate: formatFormDate(end) };
}

export default function MembershipScreen({
  memberships,
  gymOptions,
  isLoading,
  error,
  isGymOptionsLoading,
  gymOptionsError,
  actionError,
  onRetry,
  onRetryGymOptions,
  onClose,
  onAddMembership,
  onUpdateMembership,
  onArchiveMembership,
}: MembershipScreenProps) {
  const countPasses = memberships.filter((membership) => membership.passType === 'count').length;
  const periodPasses = memberships.length - countPasses;
  const expiringSoon = countExpiringSoon(memberships, new Date());
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [archivingMembershipId, setArchivingMembershipId] = useState<string | null>(null);
  const [gymName, setGymName] = useState('');
  const [passName, setPassName] = useState('10회 이용권');
  const [passType, setPassType] = useState<'count' | 'period'>('count');
  const [remainingCount, setRemainingCount] = useState('10');
  const [totalCount, setTotalCount] = useState('10');
  const initialDates = defaultMembershipDates();
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [note, setNote] = useState('');
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [dateErrors, setDateErrors] = useState<Partial<Record<MembershipDateField, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const archiveGuardRef = useRef(createPendingGuard());

  const resetForm = () => {
    setGymName('');
    setPassName('10회 이용권');
    setPassType('count');
    setRemainingCount('10');
    setTotalCount('10');
    const dates = defaultMembershipDates();
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setNote('');
    setDateErrors({});
    setFormMessage('');
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
    setNote(membership.note ?? '');

    if (membership.passType === 'count') {
      const [remainingPart, totalPart] = membership.remainingValue.replace('회', '').split('/').map((value) => value.trim());
      setRemainingCount(remainingPart || '0');
      setTotalCount(totalPart || '0');
    }

    setShowAddSheet(true);
  };

  const closeSheet = () => {
    setShowAddSheet(false);
    setEditingMembershipId(null);
    resetForm();
  };

  const handleArchiveMembership = async () => {
    if (!archivingMembershipId) return;
    await archiveGuardRef.current.run(async () => {
      setIsArchiving(true);
      setArchiveError('');
      try {
        await onArchiveMembership(archivingMembershipId);
        setArchivingMembershipId(null);
      } catch (requestError) {
        setArchiveError(requestError instanceof Error ? requestError.message : '회원권을 보관하지 못했습니다.');
      } finally {
        setIsArchiving(false);
      }
    });
  };

  const handleSaveMembership = async () => {
    const gymInfo = gymOptions.find((option) => option.gymName === gymName) ?? UNASSIGNED_GYM;
    const currentMembership = memberships.find((membership) => membership.id === editingMembershipId);
    const gymIds = gymInfo.gymName ? [gymInfo.gymId] : currentMembership?.gymIds ?? [];

    if (passType === 'count') {
      try {
        parseMembershipCounts(`${remainingCount} / ${totalCount}회`);
      } catch (validationError) {
        setFormMessage(validationError instanceof Error ? validationError.message : '횟수를 확인해주세요.');
        return;
      }
    }

    try {
      validateMembershipDates(startDate, endDate, currentMembership);
      setDateErrors({});
    } catch (validationError) {
      if (validationError instanceof MembershipDateValidationError) {
        setDateErrors({ [validationError.field]: validationError.message });
        setFormMessage('');
        return;
      }
      throw validationError;
    }

    const nextMembership: MembershipItem = {
      id: editingMembershipId ?? `${gymName || 'unassigned'}-${Date.now()}`,
      gymIds,
      gymName,
      passName,
      passType,
      remainingLabel: passType === 'count' ? '남은 횟수' : '남은 기간',
      remainingValue: passType === 'count' ? `${remainingCount} / ${totalCount}회` : currentMembership?.remainingValue ?? '0일 남음',
      lightBg: gymInfo.lightBg,
      darkText: gymInfo.darkText,
      startDate,
      endDate,
      validFrom: currentMembership?.validFrom,
      validUntil: currentMembership?.validUntil,
      updatedAt: currentMembership?.updatedAt,
      note,
      isFavorite: currentMembership?.isFavorite ?? false,
      homeOrder: currentMembership?.homeOrder ?? null,
    };

    setIsSaving(true);
    setFormMessage('');

    try {
      if (editingMembershipId) {
        await onUpdateMembership(nextMembership);
      } else {
        await onAddMembership(nextMembership);
      }

      closeSheet();
    } catch (requestError) {
      setFormMessage(requestError instanceof Error ? requestError.message : '회원권을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async (membership: MembershipItem) => {
    const favoriteMemberships = memberships.filter((item) => item.isFavorite);

    if (!membership.isFavorite && favoriteMemberships.length >= 3) {
      setFavoriteMessage('홈에 표시할 회원권은 최대 3개까지 선택할 수 있어요.');
      return;
    }

    setFavoriteMessage('');
    try {
      await onUpdateMembership({
        ...membership,
        isFavorite: !membership.isFavorite,
        homeOrder: !membership.isFavorite
          ? firstUnusedHomeOrder(favoriteMemberships)
          : null,
      });
    } catch (requestError) {
      setFavoriteMessage(requestError instanceof Error ? requestError.message : '홈 표시 상태를 변경하지 못했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="relative px-5 pt-5 pb-4 flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute left-5 h-11 w-6 flex items-center justify-start text-neutral-700"
          aria-label="뒤로가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="text-[18px] font-bold text-neutral-950">회원권</div>
        <button onClick={openAddSheet} className="absolute right-5 min-h-11 px-3 rounded-full border border-neutral-200 text-[14px] font-medium text-neutral-700">추가</button>
      </div>

      <div className="px-5 space-y-4">
        {favoriteMessage && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800" role="status">
            {favoriteMessage}
          </div>
        )}
        {actionError && !favoriteMessage && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600" role="status">
            {actionError}
          </div>
        )}
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
              <div className="text-[12px] text-neutral-500">{EXPIRING_SOON_DAYS}일 내 만료</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{expiringSoon}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {error ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
              <div className="text-[16px] font-bold text-neutral-900">{error}</div>
              <button onClick={onRetry} className="mt-4 rounded-full bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white">
                다시 시도
              </button>
            </div>
          ) : isLoading ? (
            <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-12 text-center text-[14px] text-neutral-500">
              회원권을 불러오는 중입니다.
            </div>
          ) : memberships.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
              <div className="text-[16px] font-bold text-neutral-900">등록된 회원권이 없어요</div>
              <div className="mt-2 text-[13px] text-neutral-500">추가 버튼으로 첫 회원권을 등록해보세요.</div>
            </div>
          ) : memberships.map((membership) => (
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
                      <button onClick={() => handleToggleFavorite(membership)} className="p-1" aria-label={`${membership.gymName || membership.passName} 회원권을 홈에서 ${membership.isFavorite ? '숨기기' : '표시하기'}`} aria-pressed={membership.isFavorite}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={membership.isFavorite ? "#EAB308" : "none"} stroke={membership.isFavorite ? "#EAB308" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <button onClick={() => openEditSheet(membership)} className="text-[12px] font-medium text-neutral-500">편집</button>
                      <button onClick={() => { setArchiveError(''); setArchivingMembershipId(membership.id); }} className="text-[12px] font-medium text-red-500">보관</button>
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
                    {membership.note || '메모 없음'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {showAddSheet && (
        <BottomSheet onClose={closeSheet} title={editingMembershipId ? '회원권 편집' : '회원권 추가'} description={editingMembershipId ? '선택한 회원권 정보를 수정합니다.' : '새 회원권 정보를 입력합니다.'} dismissible={!isSaving} bodyClassName="px-6 py-5 space-y-4">
              <label className="block">
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">암장</div>
                <select value={gymName} onChange={(event) => setGymName(event.target.value)} disabled={isGymOptionsLoading} className="w-full h-12 rounded-2xl border border-neutral-200 px-4 bg-white text-[15px] text-neutral-900 outline-none disabled:bg-neutral-100">
                  <option value="">선택 안 함</option>
                  {gymName && !gymOptions.some((option) => option.gymName === gymName) && <option value={gymName}>{gymName}</option>}
                  {gymOptions.map((option) => (
                    <option key={option.gymName} value={option.gymName}>{option.gymName}</option>
                  ))}
                </select>
                {gymOptionsError && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700" role="alert">
                    <span>{gymOptionsError}</span>
                    <button type="button" onClick={onRetryGymOptions} className="shrink-0 font-semibold underline">암장 다시 불러오기</button>
                  </div>
                )}
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
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-[13px] font-semibold text-neutral-700 mb-2">시작일</div>
                  <input value={startDate} onChange={(event) => { setStartDate(event.target.value); setDateErrors({}); }} aria-invalid={Boolean(dateErrors.startDate)} aria-describedby={dateErrors.startDate ? 'membership-start-date-error' : undefined} placeholder="YYYY.MM.DD" className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" />
                  {dateErrors.startDate && <div id="membership-start-date-error" className="mt-1.5 text-[12px] text-red-600" role="alert">{dateErrors.startDate}</div>}
                </label>
                <label className="block">
                  <div className="text-[13px] font-semibold text-neutral-700 mb-2">만료일</div>
                  <input value={endDate} onChange={(event) => { setEndDate(event.target.value); setDateErrors({}); }} aria-invalid={Boolean(dateErrors.endDate)} aria-describedby={dateErrors.endDate ? 'membership-end-date-error' : undefined} placeholder="YYYY.MM.DD" className="w-full h-12 rounded-2xl border border-neutral-200 px-4 text-[15px] text-neutral-900 outline-none" />
                  {dateErrors.endDate && <div id="membership-end-date-error" className="mt-1.5 text-[12px] text-red-600" role="alert">{dateErrors.endDate}</div>}
                </label>
              </div>

              <label className="block">
                <div className="text-[13px] font-semibold text-neutral-700 mb-2">메모</div>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="저녁 시간대 사용 예정" className="w-full min-h-[96px] rounded-2xl border border-neutral-200 px-4 py-3 text-[15px] text-neutral-900 outline-none resize-none" />
              </label>

            <div className="pt-2 border-t border-neutral-100">
              {formMessage && <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">{formMessage}</div>}
              <button
                onClick={handleSaveMembership}
                disabled={isSaving}
                className="w-full h-12 rounded-2xl bg-blue-500 text-white text-[15px] font-semibold disabled:bg-neutral-300"
              >
                {isSaving ? '저장 중' : editingMembershipId ? '회원권 수정 저장' : '회원권 저장'}
              </button>
            </div>
        </BottomSheet>
      )}

      {archivingMembershipId && (
        <ConfirmModal
          title="회원권 보관"
          description="보관하면 회원권은 목록에서 숨겨지지만 이용 기록과 기존 내역은 계속 보관됩니다."
          confirmLabel="보관"
          pendingLabel="보관 중"
          confirmTone="danger"
          error={archiveError}
          isPending={isArchiving}
          onClose={() => { setArchiveError(''); setArchivingMembershipId(null); }}
          onConfirm={handleArchiveMembership}
        />
      )}
    </div>
  );
}
