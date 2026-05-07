import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import HabitItem from '../components/HabitItem.jsx';

function getLocalToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomePage() {
  const { username, logout } = useAuth();
  const [habits, setHabits] = useState([]);
  const [todayDone, setTodayDone] = useState(new Set()); // Set<habit_id>
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const today = getLocalToday();

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [habitsData, completionsData] = await Promise.all([
        api.getHabits(),
        api.getCompletions(today, today),
      ]);
      setHabits(habitsData);
      setTodayDone(new Set(completionsData.map((c) => c.habit_id)));
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddHabit(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      const habit = await api.createHabit(newName.trim(), newDesc.trim());
      setHabits((prev) => [habit, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  function cancelAdd() {
    setShowAddForm(false);
    setNewName('');
    setNewDesc('');
    setAddError('');
  }

  async function handleDelete(id) {
    await api.deleteHabit(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setTodayDone((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleTodayChange(habitId, isDone) {
    setTodayDone((prev) => {
      const next = new Set(prev);
      if (isDone) next.add(habitId);
      else next.delete(habitId);
      return next;
    });
  }

  const doneCount = habits.filter((h) => todayDone.has(h.id)).length;

  return (
    <div className="page-home">
      <header className="header">
        <div className="header-inner">
          <span className="header-logo">🌱 Habit Tracker</span>
          <div className="header-right">
            <span className="header-username">{username}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">

          {/* Progress summary */}
          {!loading && !loadError && habits.length > 0 && (
            <div className="progress-bar-wrap">
              <div className="progress-bar-labels">
                <span>Сегодня выполнено</span>
                <span className="progress-count">
                  {doneCount} / {habits.length}
                </span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(doneCount / habits.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Add habit */}
          {!showAddForm ? (
            <button
              className="btn btn-primary btn-block"
              onClick={() => setShowAddForm(true)}
            >
              + Добавить привычку
            </button>
          ) : (
            <div className="card add-habit-card">
              <h2 className="card-title">Новая привычка</h2>
              <form onSubmit={handleAddHabit}>
                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder="Название *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={200}
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder="Описание (необязательно)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    maxLength={1000}
                  />
                </div>
                {addError && (
                  <p className="error-inline" style={{ marginBottom: 12 }}>
                    {addError}
                  </p>
                )}
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={addLoading}
                  >
                    {addLoading ? (
                      <>
                        <span className="spinner spinner-sm" /> Сохранение...
                      </>
                    ) : (
                      'Сохранить'
                    )}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={cancelAdd}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="error-banner" role="alert">
              {loadError}
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 12 }}
                onClick={loadAll}
              >
                Повторить
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="loading-area">
              <span className="spinner" />
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadError && habits.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🌱</div>
              <p className="empty-title">Ещё нет привычек</p>
              <p className="empty-hint">Добавьте первую привычку, чтобы начать отслеживать прогресс</p>
            </div>
          )}

          {/* Habit list */}
          {!loading &&
            habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                doneToday={todayDone.has(habit.id)}
                onTodayChange={(done) => handleTodayChange(habit.id, done)}
                onDelete={() => handleDelete(habit.id)}
              />
            ))}
        </div>
      </main>
    </div>
  );
}
