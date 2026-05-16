import { CalendarEntry } from '../../../entities/calendar/types';
import CalendarEntryStack from '../../calendar/components/CalendarEntryStack';
import { CALENDAR_SETTING_ENTRIES, CALENDAR_WEEKDAYS } from '../../../mocks/calendar';
import { HomeSectionShell } from './HomeSectionShell';

const HOME_WEEK_DAYS = [6, 7, 8, 9, 10, 11, 12];
const TODAY = 10;
const HOLIDAYS = new Set([6]);

interface HomeCalendarGridProps {
  onOpen: () => void;
}

interface HomeScheduleDayProps {
  weekday: string;
  day: number;
  entries: CalendarEntry[];
  dayIndex: number;
}

function HomeScheduleDay({ weekday, day, entries, dayIndex }: HomeScheduleDayProps) {
  const isToday = day === TODAY;
  const isHoliday = HOLIDAYS.has(day);
  const isSaturday = dayIndex === 6;
  const weekdayColor = isHoliday ? 'text-[#E24B4A]' : isSaturday ? 'text-[#185FA5]' : 'text-neutral-950';
  const dayColor = isToday ? 'text-white' : weekdayColor;

  return (
    <div className="grid grid-rows-[22px_38px_auto] justify-items-center">
      <div className={`flex h-[22px] items-center text-[12px] leading-none ${weekdayColor}`}>{weekday}</div>
      <div className="flex h-[38px] items-center justify-center">
        <div className={`h-8 w-8 rounded-full text-center text-[20px] font-bold leading-8 ${isToday ? 'bg-[#185FA5]' : ''} ${dayColor}`}>
          {day}
        </div>
      </div>
      <CalendarEntryStack
        entries={entries}
        className="pt-1"
        logoClassName="h-8 w-8"
        hiddenCountClassName="text-[11px] font-medium leading-none text-neutral-500"
      />
    </div>
  );
}

export function HomeCalendarGrid({ onOpen }: HomeCalendarGridProps) {
  return (
    <HomeSectionShell title="세팅 일정" onAction={onOpen} actionLabel="더보기" bordered={false}>
      <div className="-mt-3 rounded-2xl border border-neutral-200 bg-white px-3 py-4">
        <div className="grid grid-cols-7 gap-1">
          {CALENDAR_WEEKDAYS.map((weekday, index) => {
            const day = HOME_WEEK_DAYS[index];

            return (
              <HomeScheduleDay
                key={`${weekday}-${day}`}
                weekday={weekday}
                day={day}
                dayIndex={index}
                entries={CALENDAR_SETTING_ENTRIES[day] ?? []}
              />
            );
          })}
        </div>
      </div>
    </HomeSectionShell>
  );
}
