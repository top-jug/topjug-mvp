import { useNavigate } from 'react-router';
import { useRecordHistory } from '../providers/RecordHistoryProvider';
import { getRecordTotals } from '../../features/record/record-summary';
import { useNavigateBack } from '../navigation';

export default function MyRecordsPage() {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/profile');
  const { records, isLoading, isLoadingMore, error, paginationError, hasMore, refresh, loadMore, retryLoadMore } = useRecordHistory();
  const totalSuccess = records.reduce((total, record) => total + getRecordTotals(record).success, 0);

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
        <button onClick={navigateBack} className="flex h-11 w-8 items-center" aria-label="뒤로가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[20px] font-bold text-neutral-950">내 기록</h1>
        <button onClick={() => navigate('/record/start')} className="min-h-11 text-[14px] font-semibold text-blue-600">새 기록</button>
      </header>

      <main className="space-y-5 px-5 py-5">
        <section className="overflow-hidden rounded-[28px] bg-neutral-950 p-5 text-white">
          <div className="text-[13px] text-white/60">나의 클라이밍 로그</div>
          <div className="mt-2 text-[30px] font-bold tracking-[-0.04em]">불러온 기록 {records.length}개</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-[12px] text-white/60">불러온 기록의 완등</div>
              <div className="mt-1 text-[22px] font-bold">{totalSuccess}</div>
            </div>
            <div className="rounded-2xl bg-[#A7F432] px-4 py-3 text-neutral-950">
              <div className="text-[12px] text-neutral-700">최근 암장</div>
              <div className="mt-1 truncate text-[15px] font-bold">{records[0]?.gym ?? '-'}</div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-neutral-950">기록 히스토리</h2>
            <span className="text-[12px] text-neutral-400">최근 순</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-[98px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-100 bg-white px-6 py-10 text-center">
              <div className="text-[16px] font-bold text-neutral-900">기록을 불러오지 못했어요</div>
              <div className="mt-2 text-[13px] text-neutral-500">{error}</div>
              <button onClick={refresh} className="mt-5 h-11 rounded-2xl bg-neutral-950 px-5 text-[14px] font-bold text-white">
                다시 시도
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
              <div className="text-[16px] font-bold text-neutral-900">아직 기록이 없어요</div>
              <div className="mt-2 text-[13px] text-neutral-500">첫 클라이밍 세션을 남겨보세요.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => {
                const totals = getRecordTotals(record);

                return (
                  <button
                    key={record.id}
                    onClick={() => navigate(`/records/${record.id}`)}
                    className="w-full rounded-3xl border border-neutral-200 bg-white p-4 text-left transition-transform active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-[18px] font-black ${index % 2 === 0 ? 'bg-[#A7F432] text-neutral-950' : 'bg-[#795CFF] text-white'}`}>
                        {record.gym.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[16px] font-bold text-neutral-950">{record.gym}</div>
                          <span className="text-[18px] text-neutral-300">›</span>
                        </div>
                        <div className="mt-1 text-[12px] text-neutral-500">{record.date} · {record.duration}</div>
                        <div className="mt-3 flex gap-2">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">완등 {totals.success}</span>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">시도 {totals.attempt}</span>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">{record.rating === null ? '미평가' : `★ ${record.rating}`}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {paginationError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center">
                  <div className="text-[13px] font-medium text-red-700">{paginationError}</div>
                  <button
                    type="button"
                    onClick={retryLoadMore}
                    disabled={isLoadingMore}
                    className="mt-3 h-11 rounded-xl bg-white px-4 text-[13px] font-bold text-red-700 disabled:opacity-50"
                  >
                    {isLoadingMore ? '다시 불러오는 중...' : '이어서 다시 시도'}
                  </button>
                </div>
              ) : hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="h-12 w-full rounded-2xl border border-neutral-200 bg-white text-[14px] font-bold text-neutral-800 disabled:opacity-50"
                >
                  {isLoadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
