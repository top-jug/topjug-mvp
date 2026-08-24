import { useEffect, useState } from 'react';
import { CALENDAR_WEEKDAYS } from '../../../mocks/calendar';
import type { SettingEvent } from '../../calendar/setting-calendar';
import { buildHomeSettingEntries, getHomeWeek, type HomeSettingEntry, type HomeWeekDay } from '../home-week';
import { getHomeDataState } from '../home-state';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeCalendarGridProps {
  onOpen: () => void;
}

interface HomeScheduleDayProps {
  weekday: string;
  date: HomeWeekDay;
  entries: HomeSettingEntry[];
  isToday: boolean;
}

function HomeScheduleDay({ weekday, date, entries, isToday }: HomeScheduleDayProps) {
  const weekdayColor = date.weekdayIndex === 0 ? 'text-[#E24B4A]' : date.weekdayIndex === 6 ? 'text-[#185FA5]' : 'text-neutral-950';
  const dayColor = isToday ? 'text-white' : weekdayColor;

  return (
    <div className="grid grid-rows-[22px_38px_auto] justify-items-center">
      <div className={`flex h-[22px] items-center text-[12px] leading-none ${weekdayColor}`}>{weekday}</div>
      <div className="flex h-[38px] items-center justify-center">
        <div className={`h-8 w-8 rounded-full text-center text-[20px] font-bold leading-8 ${isToday ? 'bg-[#185FA5]' : ''} ${dayColor}`}>
          {date.day}
        </div>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-col items-center gap-1 pt-1">
          {entries.slice(0, 2).map((entry) => entry.logoUrl ? (
            <img key={`${entry.gymId}-${entry.startsAt}`} src={entry.logoUrl} alt={entry.gym} className="h-8 w-8 rounded-full border border-neutral-200 bg-neutral-100 object-cover" />
          ) : (
            <div key={`${entry.gymId}-${entry.startsAt}`} title={entry.gym} className="flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-bold" style={{ backgroundColor: entry.lightBg, borderColor: entry.color, color: entry.darkText }}>
              {entry.gym.slice(0, 1)}
            </div>
          ))}
          {entries.length > 2 && <div className="text-[11px] font-medium leading-none text-neutral-500">+{entries.length - 2}개</div>}
        </div>
      )}
    </div>
  );
}

export function HomeCalendarGrid({ onOpen }: HomeCalendarGridProps) {
  const [week] = useState(() => getHomeWeek());
  const [entriesByDay, setEntriesByDay] = useState<Record<string, HomeSettingEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const now = new Date();
  const today = week.days.find((date) => date.year === now.getFullYear() && date.month === now.getMonth() + 1 && date.day === now.getDate())?.key;
  const entryCount = Object.values(entriesByDay).reduce((count, entries) => count + entries.length, 0);
  const state = getHomeDataState(isLoading, error, entryCount);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ from: week.from, to: week.to });
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/setting-events?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('세팅 일정을 불러오지 못했어요.');
        return response.json() as Promise<{ data: SettingEvent[] }>;
      })
      .then((payload) => setEntriesByDay(buildHomeSettingEntries(payload.data, week)))
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setEntriesByDay({});
        setError(fetchError instanceof Error ? fetchError.message : '세팅 일정을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [requestKey, week]);

  return (
    <HomeSectionShell title="세팅 일정" onAction={onOpen} actionLabel="더보기" bordered={false}>
      <div className="-mt-3 rounded-2xl border border-neutral-200 bg-white px-3 py-4">
        {state === 'loading' && <div className="py-9 text-center text-[13px] text-neutral-500">이번 주 세팅 일정을 불러오는 중입니다.</div>}
        {state === 'error' && (
          <div className="py-6 text-center text-[13px] text-red-600">
            <div>{error}</div>
            <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="mt-2 min-h-10 font-semibold text-red-700">다시 시도</button>
          </div>
        )}
        {(state === 'ready' || state === 'empty') && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {week.days.map((date, index) => (
                <HomeScheduleDay key={date.key} weekday={CALENDAR_WEEKDAYS[index]} date={date} entries={entriesByDay[date.key] ?? []} isToday={date.key === today} />
              ))}
            </div>
            {state === 'empty' && <div className="pt-4 text-center text-[12px] text-neutral-400">이번 주에 등록된 세팅 일정이 없어요.</div>}
          </>
        )}
      </div>
    </HomeSectionShell>
  );
}
