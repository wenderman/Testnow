import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function pad(n) {
  return String(n).padStart(2, '0');
}

// month is 0-indexed
function toDateStr(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function getLocalToday() {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

function getUtcOffset() {
  return -new Date().getTimezoneOffset();
}

export default function HabitCalendar({ habitId, onTodayToggle }) {
  const today = getLocalToday();

  // viewDate is always set to the 1st of the viewed month
  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [completions, setCompletions] = useState(new Set()); // Set of YYYY-MM-DD strings
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(null); // date string currently toggling

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  const loadCompletions = useCallback(async () => {
    setLoading(true);
    setError('');
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const from = toDateStr(year, month, 1);
    const to = toDateStr(year, month, daysInMonth);
    try {
      const data = await api.getCompletions(from, to, habitId);
      setCompletions(new Set(data.map((c) => c.completed_date)));
    } catch {
      setError('Не удалось загрузить отметки');
    } finally {
      setLoading(false);
    }
  }, [year, month, habitId]);

  useEffect(() => {
    loadCompletions();
  }, [loadCompletions]);

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function handleDayClick(day) {
    const ds = toDateStr(year, month, day);
    if (ds > today) return;    // future date — ignore
    if (toggling) return;      // another toggle in flight

    const wasDone = completions.has(ds);
    setToggling(ds);

    // Optimistic update
    setCompletions((prev) => {
      const next = new Set(prev);
      if (wasDone) next.delete(ds);
      else next.add(ds);
      return next;
    });

    try {
      if (wasDone) {
        await api.unmarkCompletion(habitId, ds);
      } else {
        await api.markCompletion(habitId, ds, getUtcOffset());
      }
      if (ds === today) onTodayToggle?.(!wasDone);
    } catch (err) {
      // Revert optimistic update
      setCompletions((prev) => {
        const next = new Set(prev);
        if (wasDone) next.add(ds);
        else next.delete(ds);
        return next;
      });
      setError(err.message);
    } finally {
      setToggling(null);
    }
  }

  // Build grid: empty prefix cells + day cells
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7; // convert to Mon=0
  const cells = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDay = now.getDate();

  return (
    <div className="calendar" aria-label={`Календарь: ${MONTH_NAMES[month]} ${year}`}>
      {/* Month navigation */}
      <div className="calendar-header">
        <button
          className="btn btn-icon btn-ghost"
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <div className="calendar-title">
          {MONTH_NAMES[month]} {year}
          {loading && <span className="spinner spinner-sm cal-spinner" />}
        </div>
        <button
          className="btn btn-icon btn-ghost"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      {error && (
        <div className="error-inline cal-error" role="alert">
          {error}{' '}
          <button className="link-btn" onClick={loadCompletions}>
            Повторить
          </button>
        </div>
      )}

      {/* Weekday labels */}
      <div className="calendar-weekdays" aria-hidden>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="weekday-label">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="calendar-grid" role="grid">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="day-cell day-empty" role="gridcell" />;
          }

          const ds = toDateStr(year, month, day);
          const isFuture = ds > today;
          const isToday = isCurrentMonth && day === todayDay;
          const isDone = completions.has(ds);
          const isToggling = toggling === ds;

          let cls = 'day-cell';
          if (isFuture) cls += ' day-future';
          else if (isDone) cls += ' day-done';
          if (isToday) cls += ' day-today';
          if (isToggling) cls += ' day-toggling';

          return (
            <div
              key={day}
              className={cls}
              role="gridcell"
              tabIndex={isFuture ? -1 : 0}
              aria-label={`${day} ${MONTH_NAMES[month]}${isDone ? ', выполнено' : ''}${isFuture ? ', недоступно' : ''}`}
              aria-pressed={!isFuture ? isDone : undefined}
              onClick={() => handleDayClick(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDayClick(day);
                }
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
