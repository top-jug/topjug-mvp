import { useEffect } from 'react';
import { useAppScreenNavigate, useNavigateBack } from '../navigation';
import { useNavigate } from 'react-router';
import { useAuth } from '../../features/auth/AuthProvider';
import { getProfileRefreshState } from '../../features/auth/profile-refresh';

export default function ProfilePage() {
  const navigateToScreen = useAppScreenNavigate();
  const navigateBack = useNavigateBack('/');
  const navigate = useNavigate();
  const { user, logout, refreshUser, isRefreshingUser, refreshUserError } = useAuth();
  const refreshState = getProfileRefreshState(isRefreshingUser, refreshUserError, Boolean(user));

  useEffect(() => {
    void refreshUser().catch(() => undefined);
  }, [refreshUser]);

  if (!user) return null;

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // The pending-logout marker retries server invalidation on the next load.
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <>
      <div className="px-5 pt-5 pb-10 space-y-4 bg-white min-h-screen">
        <div className="relative flex items-center justify-center">
          <button onClick={navigateBack} className="absolute left-0 h-11 w-6 flex items-center justify-start rounded-full text-neutral-900" aria-label="뒤로가기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-[20px] font-bold tracking-[-0.03em] text-neutral-950">프로필</h1>
        </div>

        {refreshState === 'loading' && (
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-[13px] font-medium text-blue-700" role="status" aria-busy="true">
            최신 프로필 정보를 확인하고 있어요.
          </div>
        )}
        {refreshState === 'stale' && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">
            <div className="font-semibold">최신 정보를 불러오지 못해 이전 정보를 표시하고 있어요.</div>
            <div className="mt-1 text-[12px] text-amber-800">{refreshUserError?.message}</div>
            <button type="button" onClick={() => void refreshUser().catch(() => undefined)} className="mt-2 min-h-10 font-semibold underline">프로필 다시 시도</button>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500 text-white flex items-center justify-center text-[22px] font-bold">{user.displayName.slice(0, 1)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[18px] font-bold text-neutral-900">{user.displayName}</div>
              <div className="text-[14px] text-neutral-500 mt-1">내 암장과 회원권, 기록 설정을 관리할 수 있어요.</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">내 암장</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{user.stats.savedGyms}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">회원권</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{user.stats.memberships}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-3 py-3 text-center">
              <div className="text-[12px] text-neutral-500">이번 달 기록</div>
              <div className="text-[18px] font-bold text-neutral-900 mt-1">{user.stats.recordsThisMonth}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
          <div className="text-[15px] font-bold text-neutral-900 px-1">빠른 관리</div>
          <button onClick={() => navigateToScreen('records')} className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4 text-left bg-white">
            <div>
              <div className="text-[14px] font-semibold text-neutral-900">내 기록</div>
              <div className="text-[13px] text-neutral-500 mt-1">완료한 운동 기록과 공유 이미지를 확인합니다.</div>
            </div>
            <span className="text-[22px] leading-none text-neutral-400">›</span>
          </button>
          <button onClick={() => navigateToScreen('membership')} className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4 text-left bg-white">
            <div>
              <div className="text-[14px] font-semibold text-neutral-900">회원권 관리</div>
              <div className="text-[13px] text-neutral-500 mt-1">보유 중인 이용권과 만료 일정을 확인합니다.</div>
            </div>
            <span className="text-[22px] leading-none text-neutral-400">›</span>
          </button>
          <button onClick={() => navigateToScreen('myGyms')} className="w-full flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4 text-left bg-white">
            <div>
              <div className="text-[14px] font-semibold text-neutral-900">내 암장 관리</div>
              <div className="text-[13px] text-neutral-500 mt-1">세팅 일정과 기록에 반영할 암장을 관리합니다.</div>
            </div>
            <span className="text-[22px] leading-none text-neutral-400">›</span>
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="text-[15px] font-bold text-neutral-900 mb-3 px-1">계정</div>
          <div className="space-y-2">
            <div className="rounded-2xl bg-neutral-50 px-4 py-3">
              <div className="text-[13px] text-neutral-500">이메일</div>
              <div className="text-[14px] font-medium text-neutral-900 mt-1">{user.email}</div>
            </div>
            <div className="rounded-2xl bg-neutral-50 px-4 py-3">
              <div className="text-[13px] text-neutral-500">기본 활동 지역</div>
              <div className="text-[14px] font-medium text-neutral-900 mt-1">{user.homeRegion?.name ?? '설정되지 않음'}</div>
            </div>
            <button type="button" onClick={() => void handleLogout()} className="mt-2 h-12 w-full rounded-2xl border border-neutral-200 bg-white text-[14px] font-semibold text-neutral-700">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
