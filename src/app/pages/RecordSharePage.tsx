import { ArrowLeft, Clipboard, Download, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { ClimbingRecord } from '../../entities/record/types';
import { createRecordShareImage } from '../../features/record/record-share-image';
import {
  classifyRecordFetchFailure,
  createRequestVersionGuard,
  RecordFetchFailure,
} from '../../features/record/record-async-state';
import {
  createRecordShareModel,
  getRecordDifficultySummaries,
  RecordShareModel,
  ShareDifficultySummary,
} from '../../features/record/record-share-model';
import {
  createRecordShareRouteGuard,
  deliverRecordShare,
  getInFlightRecordShareCreation,
  getRecordShareCreationState,
  getRecordShareSessionStorage,
  isShareNotFoundError,
  mergeRecordShareListSnapshot,
  readCachedRecordShare,
  reconcileCachedRecordShare,
  removeCachedRecordShare,
  settleRecordShareCreation,
} from '../../features/record/record-share-orchestrator';
import {
  ApiCreatedShare,
  ApiShareSummary,
  createRecordShare as requestCreateRecordShare,
  getRecord as fetchRecord,
  listRecordShares,
  mapApiRecordDetail,
  publicShareUrl,
  revokeRecordShare,
} from '../api/record-api';
import { useNavigateBack } from '../navigation';

const MAX_SELECTED_DIFFICULTIES = 5;
const MAX_COMMENT_LENGTH = 40;

export default function RecordSharePage() {
  const { recordId } = useParams();
  const [record, setRecord] = useState<ClimbingRecord | undefined>();
  const [shares, setShares] = useState<ApiShareSummary[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(recordId));
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isShareListLoading, setIsShareListLoading] = useState(Boolean(recordId));
  const [isConfirmingAdditionalLink, setIsConfirmingAdditionalLink] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [failure, setFailure] = useState<RecordFetchFailure | null>(null);
  const [shareListError, setShareListError] = useState<string | null>(null);
  const [recordRetryVersion, setRecordRetryVersion] = useState(0);
  const [shareListRetryVersion, setShareListRetryVersion] = useState(0);
  const navigateBack = useNavigateBack(record ? `/records/${record.id}` : '/records');
  const difficultySummaries = useMemo(() => record ? getRecordDifficultySummaries(record) : [], [record]);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [selectedDifficultyIndexes, setSelectedDifficultyIndexes] = useState<number[]>([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [managedShare, setManagedShare] = useState<ApiCreatedShare | null>(null);
  const [preparedImage, setPreparedImage] = useState<{ blob: Blob; file: File } | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const routeGuard = useRef(createRecordShareRouteGuard());
  const createPending = useRef<number | null>(null);
  const mutationSequence = useRef({ generation: 0, version: 0 });
  const requestVersions = useRef(createRequestVersionGuard());

  useEffect(() => {
    if (!recordId) return;

    const route = routeGuard.current.begin(recordId);
    const storage = getRecordShareSessionStorage();
    const cachedShare = storage ? readCachedRecordShare(storage, recordId) : null;
    const listMutationVersion = 0;
    mutationSequence.current = { generation: route.generation, version: listMutationVersion };
    requestVersions.current.invalidate();
    setRecord(undefined);
    setShares([]);
    setManagedShare(cachedShare);
    setPreparedImage(null);
    setIsCreatingLink(false);
    setIsShareListLoading(true);
    setIsConfirmingAdditionalLink(false);
    setRevokingShareId(null);
    setIsPreparingImage(false);
    createPending.current = null;
    setIsLoading(true);
    setFailure(null);
    setShareListError(null);

    const inFlightCreation = getInFlightRecordShareCreation(recordId);
    if (inFlightCreation) {
      mutationSequence.current.version += 1;
      createPending.current = route.generation;
      setIsCreatingLink(true);
      void inFlightCreation
        .then((share) => {
          if (!routeGuard.current.isCurrent(route)) return;
          setManagedShare(share);
          setIsConfirmingAdditionalLink(false);
          setShares((current) => [share, ...current.filter((item) => item.id !== share.id)]);
          setStatus('진행 중이던 공개 링크 생성을 완료했어요.');
        })
        .catch((createError) => {
          if (routeGuard.current.isCurrent(route)) {
            setStatus(createError instanceof Error ? createError.message : '공유 링크를 만들지 못했어요.');
          }
        })
        .finally(() => {
          if (!routeGuard.current.isCurrent(route)) return;
          createPending.current = null;
          setIsCreatingLink(false);
        });
    }

    return () => routeGuard.current.cancel(route);
  }, [recordId]);

  useEffect(() => {
    if (!recordId) return;
    const route = routeGuard.current.current(recordId);
    if (!route) return;
    const request = requestVersions.current.begin('record');
    setIsLoading(true);
    setFailure(null);

    fetchRecord(recordId, route.signal)
      .then((recordPayload) => {
        if (!routeGuard.current.isCurrent(route) || !requestVersions.current.isCurrent(request)) return;
        setRecord(mapApiRecordDetail(recordPayload.data));
      })
      .catch((fetchError) => {
        if (!routeGuard.current.isCurrent(route) || !requestVersions.current.isCurrent(request)) return;
        setFailure(classifyRecordFetchFailure(fetchError, '공유할 기록을 불러오지 못했어요.'));
      })
      .finally(() => {
        if (routeGuard.current.isCurrent(route) && requestVersions.current.isCurrent(request)) setIsLoading(false);
      });
  }, [recordId, recordRetryVersion]);

  useEffect(() => {
    if (!recordId) return;
    const route = routeGuard.current.current(recordId);
    if (!route) return;
    const request = requestVersions.current.begin('shares');
    const storage = getRecordShareSessionStorage();
    const requestMutationVersion = mutationSequence.current.generation === route.generation
      ? mutationSequence.current.version
      : 0;
    setIsShareListLoading(true);
    setShareListError(null);

    listRecordShares(recordId, route.signal)
      .then((sharePayload) => {
        if (!routeGuard.current.isCurrent(route) || !requestVersions.current.isCurrent(request)) return;
        const currentMutationVersion = mutationSequence.current.generation === route.generation
          ? mutationSequence.current.version
          : requestMutationVersion;
        setShares((current) => mergeRecordShareListSnapshot(
          current,
          sharePayload.data,
          requestMutationVersion,
          currentMutationVersion,
        ));
        if (requestMutationVersion === currentMutationVersion) {
          setManagedShare((current) => {
            if (!current || reconcileCachedRecordShare(current, sharePayload.data)) return current;
            if (storage) removeCachedRecordShare(storage, recordId);
            return null;
          });
        }
      })
      .catch((shareError) => {
        if (!routeGuard.current.isCurrent(route) || !requestVersions.current.isCurrent(request)) return;
        setShareListError(shareError instanceof Error ? shareError.message : '공유 링크 목록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (routeGuard.current.isCurrent(route) && requestVersions.current.isCurrent(request)) setIsShareListLoading(false);
      });
  }, [recordId, shareListRetryVersion]);

  useEffect(() => {
    setView('edit');
    setSelectedDifficultyIndexes(
      difficultySummaries.slice(0, MAX_SELECTED_DIFFICULTIES).map((difficulty) => difficulty.difficultyIndex),
    );
    setComment('');
    setStatus('');
  }, [recordId, difficultySummaries]);

  const shareOptions = useMemo(() => ({
    selectedDifficultyIndexes,
    comment,
  }), [comment, selectedDifficultyIndexes]);

  const shareModel = useMemo(
    () => record ? createRecordShareModel(record, shareOptions) : undefined,
    [record, shareOptions],
  );

  useEffect(() => {
    if (view !== 'preview' || !record || record.id !== recordId) return;
    const route = routeGuard.current.current(record.id);
    if (!route) return;

    let acceptsResult = true;
    setPreparedImage(null);
    setIsPreparingImage(true);
    createRecordShareImage(record, shareOptions)
      .then((blob) => {
        if (!acceptsResult || !routeGuard.current.isCurrent(route)) return;
        setPreparedImage({ blob, file: new File([blob], `topjug-${record.date}.png`, { type: 'image/png' }) });
      })
      .catch(() => {
        if (acceptsResult && routeGuard.current.isCurrent(route)) {
          setStatus('맞춤 이미지를 준비하지 못했어요. 공개 링크는 계속 사용할 수 있어요.');
        }
      })
      .finally(() => {
        if (acceptsResult && routeGuard.current.isCurrent(route)) setIsPreparingImage(false);
      });

    return () => {
      acceptsResult = false;
    };
  }, [record, recordId, shareOptions, view]);

  if (!recordId) return <Navigate to="/records" replace />;

  if ((isLoading && !record) || (record && record.id !== recordId)) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
        <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center border-b border-neutral-100 bg-white px-4 py-3">
          <button type="button" onClick={navigateBack} className="flex h-11 w-11 items-center justify-center" aria-label="기록 상세로 돌아가기">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-center text-[18px] font-bold">공유 이미지 편집</h1>
          <div />
        </header>
        <main className="mx-auto max-w-md space-y-4 px-5 py-5">
          <div className="h-[86px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[230px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[92px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
        </main>
      </div>
    );
  }

  if (failure && !record) {
    const isTransient = failure.kind === 'transient';
    const title = failure.kind === 'not-found'
      ? '공유할 기록을 찾을 수 없어요'
      : failure.kind === 'authorization'
        ? '이 기록을 공유할 권한이 없어요'
        : '공유할 기록을 불러오지 못했어요';
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 pt-24 text-center text-neutral-950">
        <div className="text-[18px] font-bold">{title}</div>
        <div className="mt-2 text-[13px] text-neutral-500">{failure.message}</div>
        {isTransient && (
          <button onClick={() => setRecordRetryVersion((version) => version + 1)} className="mt-6 h-12 rounded-2xl bg-blue-600 px-5 text-[14px] font-bold text-white">
            다시 시도
          </button>
        )}
        <button onClick={navigateBack} className={`${isTransient ? 'mt-3' : 'mt-6'} h-12 rounded-2xl bg-neutral-950 px-5 text-[14px] font-bold text-white`}>
          돌아가기
        </button>
      </div>
    );
  }

  if (!record || !shareModel) return <Navigate to="/records" replace />;

  const supportsNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareCreationState = getRecordShareCreationState(
    managedShare,
    shares,
    isConfirmingAdditionalLink,
    !isShareListLoading && shareListError === null,
  );

  const toggleDifficulty = (difficultyIndex: number) => {
    setSelectedDifficultyIndexes((current) => {
      if (current.includes(difficultyIndex)) {
        return current.filter((index) => index !== difficultyIndex);
      }

      if (current.length >= MAX_SELECTED_DIFFICULTIES) return current;
      return [...current, difficultyIndex].sort((left, right) => left - right);
    });
  };

  const openPreview = () => {
    setStatus('');
    setPreparedImage(null);
    setIsPreparingImage(true);
    setView('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = () => {
    if (!preparedImage) return;
    const url = URL.createObjectURL(preparedImage.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = preparedImage.file.name;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('이미지를 저장했어요.');
  };

  const handleCopy = async () => {
    if (!preparedImage) return;
    const route = routeGuard.current.current(record.id);
    if (!route) return;

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': preparedImage.blob })]);
      if (!routeGuard.current.isCurrent(route)) return;
      setStatus('이미지를 복사했어요.');
    } catch {
      if (routeGuard.current.isCurrent(route)) setStatus('이 브라우저에서는 이미지 복사를 지원하지 않아요.');
    }
  };

  const handleCreateLink = async () => {
    const route = routeGuard.current.current(record.id);
    if (!route || createPending.current === route.generation) return;
    createPending.current = route.generation;
    if (mutationSequence.current.generation === route.generation) mutationSequence.current.version += 1;
    setIsCreatingLink(true);
    setStatus('');

    try {
      const result = await settleRecordShareCreation(
        record.id,
        async () => (await requestCreateRecordShare(record.id)).data,
        () => routeGuard.current.isCurrent(route),
        () => getRecordShareSessionStorage(),
      );
      if (!result.isOriginCurrent) return;
      setManagedShare(result.share);
      setIsConfirmingAdditionalLink(false);
      setShares((current) => [result.share, ...current.filter((share) => share.id !== result.share.id)]);
      setStatus('공개 링크를 만들었어요. 아래에서 복사하거나 공유하세요.');
    } catch (createError) {
      if (routeGuard.current.isCurrent(route)) {
        setStatus(createError instanceof Error ? createError.message : '공유 링크를 만들지 못했어요.');
      }
    } finally {
      if (routeGuard.current.isCurrent(route)) {
        createPending.current = null;
        setIsCreatingLink(false);
      }
    }
  };

  const handleCopyPublicLink = async () => {
    if (!managedShare) return;
    const route = routeGuard.current.current(record.id);
    if (!route) return;

    try {
      await navigator.clipboard.writeText(publicShareUrl(managedShare));
      if (routeGuard.current.isCurrent(route)) setStatus('공개 링크를 복사했어요.');
    } catch {
      if (routeGuard.current.isCurrent(route)) setStatus('공개 링크를 복사하지 못했어요. 표시된 주소를 직접 복사해주세요.');
    }
  };

  const handleNativeShare = async () => {
    if (!managedShare || typeof navigator.share !== 'function') return;
    const route = routeGuard.current.current(record.id);
    if (!route) return;
    const canShareFiles = Boolean(
      preparedImage
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [preparedImage.file] }),
    );
    const shareData: ShareData = {
      ...(canShareFiles && preparedImage ? { files: [preparedImage.file] } : {}),
      title: `${record.gym} 클라이밍 기록`,
      text: '오늘의 클라이밍 기록 #TopJug',
      url: publicShareUrl(managedShare),
    };
    const result = await deliverRecordShare(() => navigator.share!(shareData));
    if (!routeGuard.current.isCurrent(route)) return;

    if (result.outcome === 'delivered') {
      setStatus('공유를 완료했어요. 공유 앱에 따라 맞춤 이미지나 링크가 포함되지 않을 수 있어요.');
    } else if (result.outcome === 'cancelled') {
      setStatus('공유를 취소했어요. 공개 링크는 활성 상태로 유지됩니다.');
    } else {
      setStatus(result.error instanceof Error ? result.error.message : '공유 메뉴를 열지 못했어요.');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    const route = routeGuard.current.current(record.id);
    if (!route) return;
    if (mutationSequence.current.generation === route.generation) mutationSequence.current.version += 1;
    setRevokingShareId(shareId);
    setStatus('');

    try {
      await revokeRecordShare(record.id, shareId, route.signal);
      if (!routeGuard.current.isCurrent(route)) return;
      const revokedAt = new Date().toISOString();
      setShares((current) => markShareInactive(current, shareId, managedShare, revokedAt));
      if (managedShare?.id === shareId) {
        const storage = getRecordShareSessionStorage();
        if (storage) removeCachedRecordShare(storage, record.id);
        setManagedShare(null);
      }
      setStatus('공유 링크를 폐기했어요.');
    } catch (revokeError) {
      if (!routeGuard.current.isCurrent(route)) return;
      if (isShareNotFoundError(revokeError)) {
        setShares((current) => markShareInactive(current, shareId, managedShare));
        if (managedShare?.id === shareId) {
          const storage = getRecordShareSessionStorage();
          if (storage) removeCachedRecordShare(storage, record.id);
          setManagedShare(null);
        }
        setStatus('이미 비활성화된 공유 링크예요.');
      } else {
        setStatus(revokeError instanceof Error ? revokeError.message : '공유 링크를 폐기하지 못했어요.');
      }
    } finally {
      if (routeGuard.current.isCurrent(route)) setRevokingShareId(null);
    }
  };

  if (view === 'edit') {
    return (
      <ShareEditor
        record={record}
        difficulties={difficultySummaries}
        selectedDifficultyIndexes={selectedDifficultyIndexes}
        comment={comment}
        onBack={navigateBack}
        onToggleDifficulty={toggleDifficulty}
        onChangeComment={setComment}
        onOpenPreview={openPreview}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 text-neutral-950">
      <header className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center py-4">
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setView('edit');
          }}
          className="flex h-11 items-center gap-1 justify-self-start text-[13px] font-semibold text-neutral-600"
        >
          <ArrowLeft size={18} />
          다시 편집
        </button>
        <div className="text-[17px] font-bold">공유 미리보기</div>
        <button onClick={navigateBack} className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-white shadow-sm" aria-label="공유 화면 닫기">
          <X size={21} />
        </button>
      </header>

      <main className="mx-auto max-w-md">
        <ShareCard record={record} model={shareModel} />

        <section className="mt-7 rounded-3xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[16px] font-bold">맞춤 이미지</h2>
          <p className="mt-1 text-[12px] leading-5 text-neutral-500">선택한 난이도와 한줄평이 반영된 현재 이미지를 기기에 저장하거나 복사합니다.</p>
          <div className="mt-4 grid grid-cols-2 gap-5">
            <ActionButton label={isPreparingImage ? '준비 중' : '이미지 저장'} icon={<Download size={22} />} onClick={handleSave} disabled={!preparedImage} />
            <ActionButton label={isPreparingImage ? '준비 중' : '이미지 복사'} icon={<Clipboard size={21} />} onClick={handleCopy} disabled={!preparedImage} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-[16px] font-bold text-blue-950">공개 링크</h2>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-blue-950">공개 링크에는 맞춤 이미지가 게시되지 않고 기본 기록만 표시됩니다.</p>
          <p className="mt-1 text-[12px] leading-5 text-blue-800">이미지 업로드 기능이 없어 위 미리보기의 맞춤 설정과 한줄평은 URL에 포함되지 않습니다. 먼저 링크를 만든 뒤 별도 버튼으로 링크를 복사하거나 기기 공유 메뉴를 여세요.</p>
          {shareCreationState === 'managed' && managedShare ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 text-[12px] font-bold">
                <span className="text-blue-950">2. 링크 전달 또는 관리</span>
                <span className="text-green-700">활성</span>
              </div>
              <div className="mt-1 break-all text-[11px] leading-5 text-neutral-600">{publicShareUrl(managedShare)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={handleCopyPublicLink} className="min-h-11 rounded-xl bg-blue-600 px-3 text-[12px] font-bold text-white">링크 복사</button>
                <button
                  type="button"
                  onClick={handleNativeShare}
                  disabled={!supportsNativeShare || isPreparingImage}
                  className="min-h-11 rounded-xl bg-neutral-950 px-3 text-[12px] font-bold text-white disabled:bg-neutral-300"
                >
                  {isPreparingImage ? '이미지 준비 중' : '기기 공유 열기'}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-neutral-500">공유 앱에 따라 로컬 맞춤 이미지나 링크가 전달되지 않을 수 있습니다.</p>
              <button
                type="button"
                onClick={() => handleRevokeShare(managedShare.id)}
                disabled={revokingShareId === managedShare.id}
                className="mt-2 min-h-11 w-full rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-700 disabled:opacity-50"
              >
                {revokingShareId === managedShare.id ? '링크 폐기 중' : '공개 링크 폐기'}
              </button>
            </div>
          ) : isShareListLoading ? (
            <button
              type="button"
              disabled
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-blue-200 text-[14px] font-bold text-blue-700"
            >
              기존 공유 링크 확인 중
            </button>
          ) : shareCreationState === 'create' ? (
            <button
              type="button"
              onClick={handleCreateLink}
              disabled={isCreatingLink}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[14px] font-bold text-white disabled:opacity-50"
            >
              <Share2 size={19} />
              {isCreatingLink ? '공개 링크 생성 중' : '1. 공개 링크 만들기'}
            </button>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-[13px] font-bold text-amber-900">
                {shareListError
                  ? '기존 공유 링크 상태를 확인하지 못했어요.'
                  : '이미 활성 링크가 있지만 이 탭에는 주소 정보가 없어요.'}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-amber-800">
                {shareListError
                  ? '새 링크를 만들면 기존 링크와 중복될 수 있습니다. 계속하려면 위험을 확인해주세요.'
                  : '기존 링크는 아래 목록에서 폐기할 수 있습니다. 새 링크를 추가하면 활성 링크가 하나 더 생깁니다.'}
              </p>
              {shareCreationState === 'confirm-additional' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingAdditionalLink(false)}
                    className="min-h-11 rounded-xl bg-white px-3 text-[12px] font-bold text-neutral-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateLink}
                    disabled={isCreatingLink}
                    className="min-h-11 rounded-xl bg-amber-600 px-3 text-[12px] font-bold text-white disabled:opacity-50"
                  >
                    {isCreatingLink ? '생성 중' : '새 링크 생성 확인'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingAdditionalLink(true)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-[12px] font-bold text-amber-800"
                >
                  새 링크 추가
                </button>
              )}
            </div>
          )}
        </section>
        <div className="mt-4 min-h-5 text-center text-[12px] text-neutral-500" role="status">{status}</div>
        <ShareList
          shares={shares}
          isLoading={isShareListLoading}
          error={shareListError}
          revokingShareId={revokingShareId}
          onRetry={() => setShareListRetryVersion((version) => version + 1)}
          onRevoke={handleRevokeShare}
        />
      </main>
    </div>
  );
}

interface ShareEditorProps {
  record: ClimbingRecord;
  difficulties: ShareDifficultySummary[];
  selectedDifficultyIndexes: number[];
  comment: string;
  onBack: () => void;
  onToggleDifficulty: (difficultyIndex: number) => void;
  onChangeComment: (comment: string) => void;
  onOpenPreview: () => void;
}

function ShareEditor(props: ShareEditorProps) {
  const {
    record,
    difficulties,
    selectedDifficultyIndexes,
    comment,
    onBack,
    onToggleDifficulty,
    onChangeComment,
    onOpenPreview,
  } = props;

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
      <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center border-b border-neutral-100 bg-white px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center" aria-label="기록 상세로 돌아가기">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-center text-[18px] font-bold">공유 이미지 편집</h1>
        <div />
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 py-5">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[12px] font-semibold text-blue-600">CLIMBING RECORD</div>
          <h2 className="mt-2 truncate text-[23px] font-black tracking-[-0.04em]">{record.gym}</h2>
          <div className="mt-1 text-[13px] text-neutral-500">{record.date} · {record.duration}</div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold">표시할 난이도</h2>
              <p className="mt-1 text-[12px] leading-5 text-neutral-500">공유 이미지에 넣을 색상 난이도를 선택하세요.</p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-bold text-blue-700">
              {selectedDifficultyIndexes.length} / {MAX_SELECTED_DIFFICULTIES}
            </div>
          </div>

          {difficulties.length > 0 ? (
            <div className="mt-4 space-y-2">
              {difficulties.map((difficulty) => {
                const isChecked = selectedDifficultyIndexes.includes(difficulty.difficultyIndex);
                const isDisabled = !isChecked && selectedDifficultyIndexes.length >= MAX_SELECTED_DIFFICULTIES;

                return (
                  <label
                    key={difficulty.difficultyIndex}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      isChecked ? 'border-blue-200 bg-blue-50/60' : 'border-neutral-200 bg-white'
                    } ${isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => onToggleDifficulty(difficulty.difficultyIndex)}
                      className="h-5 w-5 flex-shrink-0 accent-blue-500"
                      aria-label={`${difficulty.colorName} 난이도 ${difficulty.grade} 공유 이미지에 표시`}
                    />
                    <span
                      className={`h-7 w-7 flex-shrink-0 rounded-full border border-black/10 ${difficulty.colorClassName}`}
                      style={{ backgroundColor: difficulty.colorHex }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-neutral-900">({difficulty.grade})</span>
                      <span className="mt-0.5 block text-[12px] text-neutral-500">완등 {difficulty.success} · 도전 {difficulty.attempt}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
              공유할 난이도 기록이 없습니다.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold">한줄평</h2>
            <span className="text-[11px] text-neutral-400">선택 사항 · {comment.length}/{MAX_COMMENT_LENGTH}</span>
          </div>
          <input
            type="text"
            value={comment}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => onChangeComment(event.target.value.replace(/[\r\n]/g, ''))}
            placeholder="오늘의 클라이밍을 한 줄로 남겨보세요."
            className="mt-4 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-[14px] outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-400 focus:bg-white"
          />
        </section>

        <button
          type="button"
          onClick={onOpenPreview}
          className="h-14 w-full rounded-2xl bg-blue-500 text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-blue-600 active:bg-blue-700"
        >
          공유 이미지 미리보기
        </button>
      </main>
    </div>
  );
}

function ShareCard({ record, model }: { record: ClimbingRecord; model: RecordShareModel }) {
  const difficultyCount = model.difficulties.length;
  const difficultyTextClassName = difficultyCount <= 1
    ? 'text-[15px]'
    : difficultyCount === 2
      ? 'text-[14px]'
      : difficultyCount === 3
        ? 'text-[13px]'
        : difficultyCount === 4
          ? 'text-[12px]'
          : 'text-[11px]';
  const difficultyDotClassName = difficultyCount <= 1
    ? 'h-6 w-6'
    : difficultyCount <= 3
      ? 'h-5 w-5'
      : 'h-4 w-4';
  const difficultyGridClassName = difficultyCount <= 2
    ? 'grid-cols-[24px_1fr_72px_72px]'
    : difficultyCount === 3
      ? 'grid-cols-[20px_1fr_68px_68px]'
      : 'grid-cols-[16px_1fr_64px_64px]';

  return (
    <section className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-[#F5F7FA] px-4 py-3 text-neutral-950 shadow-lg shadow-neutral-900/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[12px] font-black text-white">T</span>
          <span className="text-[12px] font-black tracking-[0.08em]">TOPJUG</span>
        </div>
        <span className="text-[9px] font-bold tracking-[0.12em] text-neutral-400">CLIMB LOG</span>
      </div>

      <div className="mt-2 border-l-[3px] border-blue-600 pl-3">
        <h1 className="truncate text-[23px] font-black leading-tight tracking-[-0.045em]">{record.gym}</h1>
        <div className="mt-1 text-[10px] font-semibold text-neutral-400">{record.date} · {model.durationLabel}</div>
      </div>

      <div className="mt-2 rounded-[18px] border border-neutral-100 bg-white px-2.5 py-1.5 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-neutral-100 text-center">
          <ShareSummary label="완등" value={String(model.totals.success)} />
          <ShareSummary label="도전" value={String(model.totals.attempt)} />
          <div>
            <div className="text-[9px] font-medium text-neutral-400">최고 난이도</div>
            {model.highestCompletedDifficulty ? (
              <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[17px] font-black">
                <DifficultyDot difficulty={model.highestCompletedDifficulty} sizeClassName="h-4 w-4" />
                {model.highestCompletedDifficulty.grade}
              </div>
            ) : <div className="mt-0.5 text-[17px] font-black">-</div>}
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[180px] flex-shrink-0 flex-col rounded-[18px] border border-neutral-100 bg-white px-3 py-2 shadow-sm">
        <div className="text-[13px] font-black">난이도별 기록</div>
        {model.difficulties.length > 0 ? (
          <div
            className="mt-1 grid min-h-0 flex-1 divide-y divide-neutral-100"
            style={{ gridTemplateRows: `repeat(${difficultyCount}, minmax(0, 1fr))` }}
          >
            {model.difficulties.map((difficulty) => (
              <div key={difficulty.difficultyIndex} className={`grid ${difficultyGridClassName} items-center gap-2 ${difficultyTextClassName}`}>
                <DifficultyDot difficulty={difficulty} sizeClassName={difficultyDotClassName} />
                <span className="font-black">{difficulty.grade}</span>
                <span className="text-left text-neutral-500">완등 <b className="text-neutral-900">{difficulty.success}</b></span>
                <span className="text-left text-neutral-500">도전 <b className="text-neutral-900">{difficulty.attempt}</b></span>
              </div>
            ))}
          </div>
        ) : <div className="mt-4 text-[12px] text-neutral-400">선택한 난이도가 없습니다.</div>}
      </div>

      {model.comment && (
        <div className="mt-3 h-[64px] flex-shrink-0 rounded-[18px] border border-neutral-100 bg-white px-3 py-2 shadow-sm">
          <div className="text-[13px] font-black leading-4 text-neutral-950">한줄평</div>
          <div className="mt-1 text-[13px] font-semibold leading-4 text-neutral-700">&quot;{model.comment}&quot;</div>
        </div>
      )}
    </section>
  );
}

function ShareSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400">{label}</div>
      <div className="mt-0.5 text-[17px] font-black">{value}</div>
    </div>
  );
}

function DifficultyDot({ difficulty, sizeClassName }: { difficulty: ShareDifficultySummary; sizeClassName: string }) {
  return (
    <span
      className={`${sizeClassName} inline-block flex-shrink-0 rounded-full border border-black/10 ${difficulty.colorClassName}`}
      style={{ backgroundColor: difficulty.colorHex }}
      role="img"
      aria-label={`${difficulty.colorName} 난이도`}
    />
  );
}

function ShareList({
  shares,
  isLoading,
  error,
  revokingShareId,
  onRetry,
  onRevoke,
}: {
  shares: ApiShareSummary[];
  isLoading: boolean;
  error: string | null;
  revokingShareId: string | null;
  onRetry: () => void;
  onRevoke: (shareId: string) => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold">공유 링크</h2>
        <span className="text-[12px] text-neutral-400">{isLoading ? '확인 중' : `${shares.length}개`}</span>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4 text-center">
          <div className="text-[13px] font-medium text-amber-800">{error}</div>
          <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl bg-white px-4 text-[12px] font-bold text-amber-800">다시 시도</button>
        </div>
      )}
      {isLoading && shares.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
          공유 링크 목록을 불러오는 중입니다.
        </div>
      ) : !isLoading && !error && shares.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
          아직 만든 공유 링크가 없습니다.
        </div>
      ) : shares.length > 0 && (
        <div className="mt-4 space-y-2">
          {shares.map((share) => {
            const isActive = share.status === 'active';

            return (
              <div key={share.id} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-neutral-300'}`} />
                    <span className="text-[14px] font-bold text-neutral-900">{shareStatusLabel(share.status)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    생성 {new Date(share.createdAt).toLocaleString('ko-KR')}
                  </div>
                  {share.expiresAt && (
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      만료 {new Date(share.expiresAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(share.id)}
                  disabled={!isActive || revokingShareId === share.id}
                  className="h-11 flex-shrink-0 rounded-xl bg-white px-3 text-[12px] font-bold text-red-600 disabled:text-neutral-300"
                >
                  {revokingShareId === share.id ? '폐기 중' : '폐기'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function shareStatusLabel(status: ApiShareSummary['status']) {
  if (status === 'active') return '활성';
  if (status === 'expired') return '만료';
  return '폐기됨';
}

function markShareInactive(
  shares: ApiShareSummary[],
  shareId: string,
  fallback: ApiCreatedShare | null,
  revokedAt: string | null = null,
): ApiShareSummary[] {
  if (shares.some((share) => share.id === shareId)) {
    return shares.map((share) => share.id === shareId ? { ...share, status: 'revoked' as const, revokedAt } : share);
  }
  if (!fallback || fallback.id !== shareId) return shares;
  return [{
    id: fallback.id,
    status: 'revoked',
    mediaAssetId: fallback.mediaAssetId,
    expiresAt: fallback.expiresAt,
    revokedAt,
    createdAt: fallback.createdAt,
  }, ...shares];
}

function ActionButton({ label, icon, onClick, disabled = false }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 text-[12px] font-semibold text-neutral-600 disabled:opacity-50">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-md active:scale-95">{icon}</span>
      {label}
    </button>
  );
}
