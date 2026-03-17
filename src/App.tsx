import { FormEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  CHALLENGE_END,
  CHALLENGE_START,
  CHALLENGE_TARGET,
  WEEKLY_TARGET,
  getChallengePhase,
  getChallengeProgress,
  getChallengeSessions,
  getCurrentStreak,
  getTodayKey,
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
  phase: ReturnType<typeof getChallengePhase>,
  state: ReturnType<typeof getChallengeProgress>["state"],
): string {
  if (phase === "upcoming") {
    return "Starts Monday";
  }

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
  phase: ReturnType<typeof getChallengePhase>,
  progress: ReturnType<typeof getChallengeProgress>,
): string {
  if (phase === "upcoming") {
    return `Challenge starts ${formatDateLabel(CHALLENGE_START)}.`;
  }

  if (progress.state === "done") {
    return "Already above the 4-per-week average.";
  }

  return `${progress.sessionsLeft} more sessions to reach ${CHALLENGE_TARGET}.`;
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [unlocked, setUnlocked] = useState(
    window.localStorage.getItem(PASSCODE_STORAGE_KEY) === "yes",
  );
  const [newPlayerName, setNewPlayerName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const todayKey = getTodayKey();
  const phase = getChallengePhase();

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
    const challengeSessions = getChallengeSessions(sessions);

    return players
      .map((player) => {
        const allPlayerSessions = sessions.filter(
          (session) => session.player_id === player.id,
        );
        const challengePlayerSessions = challengeSessions.filter(
          (session) => session.player_id === player.id,
        );
        const totalSessions = challengePlayerSessions.length;
        const weeklySessions = getWeeklySessionCount(allPlayerSessions);
        const progress = getChallengeProgress(totalSessions);
        const streak = getCurrentStreak(allPlayerSessions);

        return {
          player,
          totalSessions,
          weeklySessions,
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
    if (!selectedPlayer || !selectedStats) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      await setSessionComplete(
        selectedPlayer.id,
        todayKey,
        !selectedStats.completedToday,
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
            Goal: at least 15 minutes of dribbling each day.
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
              <div className="eyebrow">Today</div>
              <h2>{selectedPlayer ? selectedPlayer.name : "Choose a person"}</h2>
            </div>
            <span className="panel-chip">{formatDateLabel(todayKey)}</span>
          </div>

          {selectedStats ? (
            <>
              <button
                type="button"
                className={`session-button ${
                  selectedStats.completedToday ? "completed" : ""
                }`}
                onClick={() => void handleSessionToggle()}
                disabled={isSaving}
              >
                {selectedStats.completedToday ? "Undo today" : "Mark today complete"}
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
                    {selectedStats.weeklySessions}/{WEEKLY_TARGET}
                  </strong>
                  <span className="summary-footnote">sessions</span>
                </div>
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">Trend</span>
                  <strong>{getTrendLabel(phase, selectedStats.progress.state)}</strong>
                  <span className="summary-footnote">
                    {getTrendNote(phase, selectedStats.progress)}
                  </span>
                </div>
                <div className="summary-card mini-stat-card">
                  <span className="summary-label">Challenge total</span>
                  <strong>
                    {selectedStats.totalSessions}/{CHALLENGE_TARGET}
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
            Goal one is averaging 4 sessions per week across the challenge, which
            means {CHALLENGE_TARGET} total by {formatDateLabel(CHALLENGE_END)}.
            Goal two is finishing first on the leaderboard.
          </p>
        </article>
      </section>

      {isLoading ? <div className="toast">Loading...</div> : null}
      {errorMessage ? <div className="toast error">{errorMessage}</div> : null}
    </main>
  );
}
