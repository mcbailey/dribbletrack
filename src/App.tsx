import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  CHALLENGE_END,
  WEEKLY_TARGET,
  getChallengeProgress,
  getChallengeSessions,
  getCurrentStreak,
  getDatePart,
  getTargetTotal,
  getTodayKey,
  getWeeklyTarget,
  getWeeklySessionCount,
} from "./lib/challenge";
import { addPlayer, listPlayers, listSessions, setSessionComplete } from "./lib/storage";
import type { Player, Session } from "./types";

const PASSCODE_STORAGE_KEY = "dribbletrack.unlocked";
const APP_PASSCODE = import.meta.env.VITE_APP_PASSCODE?.trim() || "highhoops";

function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getTrendLabel(
  state: ReturnType<typeof getChallengeProgress>["state"],
): string {
  if (state === "done") {
    return "Goal hit";
  }

  if (state === "ahead") {
    return "Ahead";
  }

  if (state === "on-pace") {
    return "On pace";
  }

  return "Can catch up";
}

function getTrendNote(
  progress: ReturnType<typeof getChallengeProgress>,
): string {
  if (progress.state === "done") {
    return "Already above the 4-per-week average.";
  }

  return `${progress.sessionsLeft} more sessions to reach the goal.`;
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [unlocked, setUnlocked] = useState(
    window.localStorage.getItem(PASSCODE_STORAGE_KEY) === "yes",
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const todayKey = getTodayKey();

  useEffect(() => {
    async function loadData() {
      try {
        const [playerList, sessionList] = await Promise.all([
          listPlayers(),
          listSessions(),
        ]);

        setPlayers(playerList);
        setSessions(sessionList);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The court data could not be loaded.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  useEffect(() => {
    setSelectedDateKey(todayKey);
  }, [todayKey]);

  useEffect(() => {
    if (!players.length) {
      setSelectedPlayerId("");
      return;
    }

    const selectedStillExists = players.some(
      (player) => player.id === selectedPlayerId,
    );

    if (!selectedStillExists) {
      setSelectedPlayerId(players[0].id);
    }
  }, [players, selectedPlayerId]);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  const playerStats = useMemo(() => {
    return players
      .map((player) => {
        const signupDateKey = getDatePart(player.created_at);
        const allPlayerSessions = sessions.filter(
          (session) => session.player_id === player.id,
        );
        const challengePlayerSessions = getChallengeSessions(
          allPlayerSessions,
          signupDateKey,
        );
        const totalSessions = challengePlayerSessions.length;
        const weeklySessions = getWeeklySessionCount(allPlayerSessions);
        const weeklyTarget = getWeeklyTarget(signupDateKey);
        const progress = getChallengeProgress(totalSessions, signupDateKey);
        const streak = getCurrentStreak(allPlayerSessions);
        const targetTotal = getTargetTotal(signupDateKey);

        return {
          player,
          signupDateKey,
          totalSessions,
          targetTotal,
          weeklySessions,
          weeklyTarget,
          streak,
          completedToday: allPlayerSessions.some(
            (session) => session.practiced_on === todayKey,
          ),
          progress,
        };
      })
      .sort((left, right) => {
        if (right.totalSessions !== left.totalSessions) {
          return right.totalSessions - left.totalSessions;
        }

        if (right.streak !== left.streak) {
          return right.streak - left.streak;
        }

        return left.player.name.localeCompare(right.player.name);
      });
  }, [players, sessions, todayKey]);

  const selectedStats =
    playerStats.find((entry) => entry.player.id === selectedPlayerId) ?? null;

  useEffect(() => {
    if (!selectedStats) {
      return;
    }

    if (!selectedDateKey) {
      setSelectedDateKey(todayKey);
      return;
    }

    if (selectedDateKey > todayKey) {
      setSelectedDateKey(todayKey);
      return;
    }

    if (selectedDateKey < selectedStats.signupDateKey) {
      setSelectedDateKey(selectedStats.signupDateKey);
    }
  }, [selectedDateKey, selectedStats, todayKey]);

  const selectedDateCompleted = useMemo(() => {
    if (!selectedPlayer) {
      return false;
    }

    return sessions.some(
      (session) =>
        session.player_id === selectedPlayer.id &&
        session.practiced_on === selectedDateKey,
    );
  }, [selectedDateKey, selectedPlayer, sessions]);

  async function refreshData() {
    const [playerList, sessionList] = await Promise.all([
      listPlayers(),
      listSessions(),
    ]);

    setPlayers(playerList);
    setSessions(sessionList);
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passcodeInput.trim() !== APP_PASSCODE) {
      setErrorMessage("That passcode did not unlock the gym.");
      return;
    }

    window.localStorage.setItem(PASSCODE_STORAGE_KEY, "yes");
    setUnlocked(true);
    setPasscodeInput("");
    setErrorMessage("");
  }

  async function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = newPlayerName.trim();

    if (!trimmedName) {
      setErrorMessage("Add a name first.");
      return;
    }

    const duplicate = players.some(
      (player) => player.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      setErrorMessage("That person is already on the list.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      await addPlayer(trimmedName);
      setNewPlayerName("");
      await refreshData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "That person could not be added.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSessionToggle() {
    if (!selectedPlayer || !selectedStats || !selectedDateKey) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      await setSessionComplete(
        selectedPlayer.id,
        selectedDateKey,
        !selectedDateCompleted,
      );
      await refreshData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "That session could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="shell">
        <section className="unlock-card">
          <div className="eyebrow">DribbleTrack</div>
          <h1>Quick check-ins. Simple leaderboard.</h1>
          <p className="lead">
            Enter the shared passcode to open the challenge board.
          </p>
          <form className="unlock-form" onSubmit={handleUnlock}>
            <label className="field-label" htmlFor="passcode">
              Shared passcode
            </label>
            <input
              id="passcode"
              type="password"
              value={passcodeInput}
              onChange={(event) => setPasscodeInput(event.target.value)}
              placeholder="Enter passcode"
            />
            <button type="submit">Open app</button>
          </form>
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <section className="hero-card compact-hero">
        <div className="hero-copy">
          <div className="eyebrow">4-Week Challenge</div>
          <h1>Pick a person. Check off today. Watch the board.</h1>
          <p className="lead">
            Average {WEEKLY_TARGET} sessions a week and win a prize. Top the
            leaderboard and win the grand prize.
          </p>
          <p className="hero-subnote">
            Each person starts when they join. Challenge ends{" "}
            {formatDateLabel(CHALLENGE_END)}.
          </p>
        </div>
      </section>

      <section className="grid simple-grid">
        <article className="panel chooser-panel">
          <div className="panel-header compact-header">
            <div>
              <div className="eyebrow">People</div>
              <h2>Choose or add a person</h2>
            </div>
            <span className="panel-chip">{players.length} total</span>
          </div>

          <div className="chooser-layout">
            <div className="player-grid compact-player-grid">
              {players.length ? (
                players.map((player) => {
                  const stats = playerStats.find(
                    (entry) => entry.player.id === player.id,
                  );

                  return (
                    <button
                      key={player.id}
                      type="button"
                      className={`player-card compact-player-card ${
                        selectedPlayerId === player.id ? "selected" : ""
                      }`}
                      onClick={() => setSelectedPlayerId(player.id)}
                    >
                      <span className="player-name">{player.name}</span>
                      <span className="player-meta">
                        {stats?.completedToday ? "Done today" : "Not yet today"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state compact-empty-state">
                  No one added yet.
                </div>
              )}
            </div>

            <form className="inline-form compact-form" onSubmit={handleAddPlayer}>
              <input
                type="text"
                value={newPlayerName}
                onChange={(event) => setNewPlayerName(event.target.value)}
                placeholder="Add a name"
                maxLength={30}
              />
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Add"}
              </button>
            </form>
          </div>
        </article>

        <article className="panel focus-panel">
          <div className="panel-header compact-header">
            <div>
              <div className="eyebrow">Check-In</div>
              <h2>{selectedPlayer ? selectedPlayer.name : "Choose a person"}</h2>
            </div>
            <span className="panel-chip">
              {selectedDateKey ? formatDateLabel(selectedDateKey) : formatDateLabel(todayKey)}
            </span>
          </div>

          {selectedStats ? (
            <>
              <div className="date-editor">
                <label className="field-label" htmlFor="practice-date">
                  Practice date
                </label>
                <input
                  id="practice-date"
                  type="date"
                  value={selectedDateKey}
                  min={selectedStats.signupDateKey}
                  max={todayKey}
                  onChange={(event) => setSelectedDateKey(event.target.value)}
                />
              </div>

              <button
                type="button"
                className={`session-button ${
                  selectedDateCompleted ? "completed" : ""
                }`}
                onClick={() => void handleSessionToggle()}
                disabled={isSaving}
              >
                {selectedDateCompleted
                  ? selectedDateKey === todayKey
                    ? "Undo today"
                    : "Undo selected date"
                  : selectedDateKey === todayKey
                    ? "Mark today complete"
                    : "Mark selected date complete"}
              </button>

              <div className="mini-stats">
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">Current streak</span>
                  <strong>{selectedStats.streak}</strong>
                  <span className="summary-footnote">
                    {selectedStats.streak === 1 ? "day" : "days"}
                  </span>
                </div>
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">This week</span>
                  <strong>
                    {selectedStats.weeklySessions}/{selectedStats.weeklyTarget}
                  </strong>
                  <span className="summary-footnote">sessions</span>
                </div>
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">Trend</span>
                  <strong>{getTrendLabel(selectedStats.progress.state)}</strong>
                  <span className="summary-footnote">
                    {getTrendNote(selectedStats.progress)}
                  </span>
                </div>
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">Challenge total</span>
                  <strong>
                    {selectedStats.totalSessions}/{selectedStats.targetTotal}
                  </strong>
                  <span className="summary-footnote">sessions</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Choose a person above or add a new one.
            </div>
          )}
        </article>

        <article className="panel leaderboard-panel">
          <div className="panel-header compact-header">
            <div>
              <div className="eyebrow">Leaderboard</div>
              <h2>Top totals</h2>
            </div>
          </div>

          <div className="leaderboard-list compact-leaderboard-list">
            {playerStats.length ? (
              playerStats.map((entry, index) => (
                <div className="leaderboard-row compact-leaderboard-row" key={entry.player.id}>
                  <div className="leaderboard-rank">{index + 1}</div>
                  <div className="leaderboard-player">
                    <strong>{entry.player.name}</strong>
                    <span>{entry.totalSessions} sessions</span>
                  </div>
                  <div className="leaderboard-score">
                    <strong>{entry.streak}</strong>
                    <span>{entry.streak === 1 ? "day streak" : "day streak"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state compact-empty-state">
                Add someone to start the board.
              </div>
            )}
          </div>
        </article>

        <article className="panel note-panel">
          <div className="panel-header compact-header">
            <div>
              <div className="eyebrow">How It Works</div>
              <h2>Very simple</h2>
            </div>
          </div>
          <p className="panel-note basic-note">
            Do at least 15 minutes of dribbling each day.
          </p>
          <p className="panel-note basic-note">
            Each person starts when they join. Their goal is 4 sessions per week,
            with the first week prorated if there are fewer than 4 days left.
            Everyone still finishes on {formatDateLabel(CHALLENGE_END)}.
          </p>
          <p className="panel-note basic-note">
            Need to fix a missed check-in? Pick an earlier date in the check-in card.
          </p>
        </article>

        <article className="panel routine-panel">
          <div className="panel-header compact-header">
            <div>
              <div className="eyebrow">Suggested Routine</div>
              <h2>15 to 20 minutes</h2>
            </div>
          </div>
          <div className="routine-list">
            <div className="routine-item">
              <strong>Warm-up</strong>
              <span>3 min</span>
              <p>Right hand high and low, left hand high and low, then quick alternating pounds.</p>
            </div>
            <div className="routine-item">
              <strong>Combos</strong>
              <span>5 min</span>
              <p>Crossovers, between the legs, and behind the back. Keep eyes up.</p>
            </div>
            <div className="routine-item">
              <strong>Two-ball</strong>
              <span>5 min</span>
              <p>Pound both together, then alternate to build confidence with both hands.</p>
            </div>
            <div className="routine-item">
              <strong>Game-speed moves</strong>
              <span>5 to 7 min</span>
              <p>Attack a cone or chair, make a move, and explode past it at full speed.</p>
            </div>
          </div>
        </article>
      </section>

      {isLoading ? <div className="toast">Loading...</div> : null}
      {errorMessage ? <div className="toast error">{errorMessage}</div> : null}
    </main>
  );
}
