import { useState } from 'react';
import { api } from '../api.js';
import HabitCalendar from './HabitCalendar.jsx';

function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getUtcOffset() {
  return -new Date().getTimezoneOffset();
}

export default function HabitItem({ habit, doneToday, onTodayChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [markLoading, setMarkLoading] = useState(false);
  const [markError, setMarkError] = useState('');
  const [deleteStep, setDeleteStep] = useState('idle'); // 'idle' | 'confirm' | 'loading'
  const [deleteError, setDeleteError] = useState('');

  async function handleToggleToday() {
    setMarkLoading(true);
    setMarkError('');
    const today = getLocalToday();
    try {
      if (doneToday) {
        await api.unmarkCompletion(habit.id, today);
        onTodayChange(false);
      } else {
        await api.markCompletion(habit.id, today, getUtcOffset());
        onTodayChange(true);
      }
    } catch (err) {
      setMarkError(err.message);
    } finally {
      setMarkLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteStep('loading');
    setDeleteError('');
    try {
      await onDelete();
      // parent removes the item from the list — no state update needed here
    } catch (err) {
      setDeleteError(err.message);
      setDeleteStep('idle');
    }
  }

  // When calendar marks/unmarks today, sync the button state too
  function handleCalendarTodayToggle(isDone) {
    onTodayChange(isDone);
  }

  return (
    <div className={`habit-card${doneToday ? ' habit-card--done' : ''}`}>
      <div className="habit-header">
        <div className="habit-info">
          <span className="habit-name">{habit.name}</span>
          {habit.description && (
            <span className="habit-desc">{habit.description}</span>
          )}
        </div>

        <div className="habit-actions">
          {/* Mark / unmark today */}
          <button
            className={`btn btn-icon${doneToday ? ' btn-check--done' : ' btn-check--todo'}`}
            onClick={handleToggleToday}
            disabled={markLoading}
            title={doneToday ? 'Снять отметку за сегодня' : 'Отметить как выполненное сегодня'}
            aria-label={doneToday ? 'Снять отметку' : 'Отметить сегодня'}
          >
            {markLoading ? (
              <span className="spinner spinner-sm" />
            ) : doneToday ? (
              <CheckIcon />
            ) : (
              <CircleIcon />
            )}
          </button>

          {/* Calendar toggle */}
          <button
            className={`btn btn-icon btn-ghost${expanded ? ' btn-icon--active' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Скрыть календарь' : 'Показать календарь'}
            aria-expanded={expanded}
          >
            <CalendarIcon />
          </button>

          {/* Delete */}
          {deleteStep === 'idle' && (
            <button
              className="btn btn-icon btn-danger-ghost"
              onClick={() => setDeleteStep('confirm')}
              title="Удалить привычку"
              aria-label="Удалить привычку"
            >
              <TrashIcon />
            </button>
          )}
          {deleteStep === 'confirm' && (
            <div className="delete-confirm">
              <span className="delete-confirm__label">Удалить?</span>
              <button
                className="btn btn-danger btn-xs"
                onClick={handleDelete}
              >
                Да
              </button>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setDeleteStep('idle')}
              >
                Нет
              </button>
            </div>
          )}
          {deleteStep === 'loading' && (
            <span className="spinner spinner-sm" style={{ marginLeft: 8 }} />
          )}
        </div>
      </div>

      {/* Inline errors */}
      {markError && (
        <p className="error-inline px-card">{markError}</p>
      )}
      {deleteError && (
        <p className="error-inline px-card">{deleteError}</p>
      )}

      {/* Calendar */}
      {expanded && (
        <HabitCalendar
          habitId={habit.id}
          onTodayToggle={handleCalendarTodayToggle}
        />
      )}
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8l3.5 3.5L13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4h12M6 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M5 4l.8 8.5a.5.5 0 0 0 .5.5h3.4a.5.5 0 0 0 .5-.5L11 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
