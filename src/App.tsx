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
  getCurrentWeekRange,
  getDaysUntilChallenge,
  getTodayKey,
  getWeeklySessionCount,
} from "./lib/challenge";
import {
  addPlayer,
  getStorageMode,
  listPlayers,
  listSessions,
  setSessionComplete,
} from "./lib/storage";
import type { Player, Session } from "./types";

const PASSCODE_STORAGE_KEY = "dribbletrack.unlocked";
const APP_PASSCODE = import.meta.env.VITE_APP_PASSCODE?.trim() || "highhoops";

function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function formatDateRange(start: string, end: string): string {
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}

function getMotivationLabel(state: ReturnType<typeof getChallengeProgress>["state"]): string {
  if (state === "done") {
    return "Prize pace locked in";
  }

  if (state === "ahead") {
    return "Ahead of pace";
  }

  if (state === "on-pace") {
    return "On pace";
  }

  return "Catch-up mode";
}

function getWeeklyMessage(count: number): string {
  if (count >= WEEKLY_TARGET + 2) {
    return "Huge week. The handles are humming.";
  }

  if (count >= WEEKLY_TARGET) {
    return "Weekly target reached. Anything extra is leaderboard fuel.";
  }

  if (count === 3) {
    return "One more session gets this week over the line.";
  }

  if (count === 0) {
    return "First session of the week starts the climb.";
  }

  return "Steady reps stack up quickly.";
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
  const storageMode = getStorageMode();
  const weekRange = getCurrentWeekRange();

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
        const playerSessions = challengeSessions.filter(
          (session) => session.player_id === player.id,
        );
        const totalSessions = playerSessions.length;
        const weeklySessions = getWeeklySessionCount(playerSessions);
        const progress = getChallengeProgress(totalSessions);

        return {
          player,
          totalSessions,
          weeklySessions,
          completedToday: sessions.some(
            (session) =>
              session.player_id === player.id && session.practiced_on === todayKey,
          ),
          progress,
        };
      })
      .sort((left, right) => {
        if (right.totalSessions !== left.totalSessions) {
          return right.totalSessions - left.totalSessions;
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
      setErrorMessage("Add a player name before stepping onto the court.");
      return;
    }

    const duplicate = players.some(
      (player) => player.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      setErrorMessage("That player is already on the roster.");
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
        error instanceof Error ? error.message : "That player could not be added.",
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
          <h1>Daily reps. Friendly race. Big confidence.</h1>
          <p className="lead">
            Use the shared passcode to open the challenge board and keep the
            leaderboard on track.
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
            <button type="submit">Enter the gym</button>
          </form>
          <div className="unlock-footnote">
            Casual lock only. Perfect for a fun family challenge.
          </div>
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="background-orb background-orb-left" />
      <div className="background-orb background-orb-right" />

      <section className="hero-card">
        <div className="hero-copy">
          <div className="eyebrow">4-Week Handle Challenge</div>
          <h1>Build the habit. Chase the leaderboard. Keep the ball alive.</h1>
          <p className="lead">
            Challenge window: {formatDateLabel(CHALLENGE_START)} to{" "}
            {formatDateLabel(CHALLENGE_END)}. One prize is for reaching the
            4-sessions-per-week average. The other is for finishing on top of
            the board.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-pill">
            <span className="stat-label">Consistency goal</span>
            <strong>{CHALLENGE_TARGET} total sessions</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Weekly rhythm</span>
            <strong>{WEEKLY_TARGET} sessions per week</strong>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Storage mode</span>
            <strong>{storageMode === "supabase" ? "Shared board" : "This device"}</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <article className="panel panel-tall">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Team Setup</div>
              <h2>Add a player</h2>
            </div>
            <span className="panel-chip">{players.length} on the roster</span>
          </div>

          <form className="inline-form" onSubmit={handleAddPlayer}>
            <input
              type="text"
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              placeholder="Add your child"
              maxLength={30}
            />
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Add player"}
            </button>
          </form>

          <div className="player-grid">
            {players.map((player) => {
              const stats = playerStats.find((entry) => entry.player.id === player.id);

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`player-card ${
                    selectedPlayerId === player.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  <span className="player-name">{player.name}</span>
                  <span className="player-meta">
                    {stats?.totalSessions ?? 0} challenge sessions
                  </span>
                  <span className="player-meta">
                    {stats?.completedToday ? "Checked in today" : "Ready for today"}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel panel-tall">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Today&apos;s Checkoff</div>
              <h2>{selectedPlayer ? selectedPlayer.name : "Choose a player"}</h2>
            </div>
            <span className="panel-chip">{formatDateLabel(todayKey)}</span>
          </div>

          {selectedStats ? (
            <>
              <div className="goal-band">
                <div>
                  <span className="goal-band-label">Challenge pace</span>
                  <strong>{getMotivationLabel(selectedStats.progress.state)}</strong>
                </div>
                <div>
                  <span className="goal-band-label">This week</span>
                  <strong>{selectedStats.weeklySessions} / {WEEKLY_TARGET}</strong>
                </div>
              </div>

              <button
                type="button"
                className={`session-button ${
                  selectedStats.completedToday ? "completed" : ""
                }`}
                onClick={() => void handleSessionToggle()}
                disabled={isSaving}
              >
                {selectedStats.completedToday
                  ? "Undo today's session"
                  : "I finished today's dribbling"}
              </button>

              <div className="selected-summary">
                <div className="summary-card">
                  <span className="summary-label">Challenge total</span>
                  <strong>{selectedStats.totalSessions}</strong>
                  <span className="summary-footnote">
                    Out of {CHALLENGE_TARGET} needed for the average goal
                  </span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Sessions left</span>
                  <strong>{selectedStats.progress.sessionsLeft}</strong>
                  <span className="summary-footnote">
                    {selectedStats.progress.state === "done"
                      ? "Consistency prize pace is locked."
                      : `${selectedStats.progress.weeklyAverageNeeded.toFixed(
                          1,
                        )} per week needed from here`}
                  </span>
                </div>
              </div>

              <p className="panel-note">
                {getWeeklyMessage(selectedStats.weeklySessions)}
              </p>
            </>
          ) : (
            <div className="empty-state">
              Add a player to unlock the daily checkoff and leaderboard.
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Consistency Prize</div>
              <h2>Average 4 sessions per week</h2>
            </div>
            <span className="panel-chip">
              {phase === "upcoming"
                ? `${getDaysUntilChallenge()} days to go`
                : "16 total sessions"}
            </span>
          </div>

          {selectedStats ? (
            <>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      (selectedStats.totalSessions / CHALLENGE_TARGET) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="panel-note">
                {phase === "upcoming"
                  ? "Warm-up week is open. Challenge scoring begins next Monday."
                  : `${selectedPlayer?.name} has ${selectedStats.totalSessions} of ${CHALLENGE_TARGET} sessions needed.`}
              </p>
              <p className="tiny-note">
                Challenge window: {formatDateRange(CHALLENGE_START, CHALLENGE_END)}
              </p>
            </>
          ) : (
            <div className="empty-state">Select a player to see goal progress.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Weekly Target</div>
              <h2>{formatDateRange(weekRange.start, weekRange.end)}</h2>
            </div>
            <span className="panel-chip">{WEEKLY_TARGET} sessions goal</span>
          </div>

          {selectedStats ? (
            <>
              <div className="progress-bar progress-bar-warm">
                <div
                  className="progress-fill progress-fill-warm"
                  style={{
                    width: `${Math.min(
                      100,
                      (selectedStats.weeklySessions / WEEKLY_TARGET) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="panel-note">
                {selectedPlayer?.name} has {selectedStats.weeklySessions} session
                {selectedStats.weeklySessions === 1 ? "" : "s"} logged this week.
              </p>
              <p className="tiny-note">
                Falling short one week does not knock anyone out. They can catch up
                with a stronger week later in the challenge.
              </p>
            </>
          ) : (
            <div className="empty-state">Weekly progress will show up here.</div>
          )}
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Leaderboard Prize</div>
              <h2>Top total over the 4-week challenge</h2>
            </div>
            <span className="panel-chip">{playerStats.length} competing</span>
          </div>

          <div className="leaderboard-list">
            {playerStats.length ? (
              playerStats.map((entry, index) => (
                <div className="leaderboard-row" key={entry.player.id}>
                  <div className="leaderboard-rank">{index + 1}</div>
                  <div className="leaderboard-player">
                    <strong>{entry.player.name}</strong>
                    <span>{getMotivationLabel(entry.progress.state)}</span>
                  </div>
                  <div className="leaderboard-score">
                    <strong>{entry.totalSessions}</strong>
                    <span>challenge sessions</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                Add players to start the friendly competition.
              </div>
            )}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Suggested Daily Routine</div>
              <h2>15 to 20 minutes of concentrated dribbling</h2>
            </div>
            <span className="panel-chip">Any 15-minute session counts</span>
          </div>

          <div className="routine-grid">
            <div className="routine-card">
              <strong>Warm-Up</strong>
              <span>3 minutes</span>
              <p>
                Stationary pound dribbles: right high, right low, left high, left
                low, then rapid-fire machine gun dribbles.
              </p>
            </div>
            <div className="routine-card">
              <strong>Stationary Combos</strong>
              <span>5 minutes</span>
              <p>
                Continuous crossovers, between the legs, and behind the back with
                eyes up.
              </p>
            </div>
            <div className="routine-card">
              <strong>Two-Ball Work</strong>
              <span>5 minutes</span>
              <p>
                Pound both balls together, then alternate. It builds weak-hand
                confidence fast.
              </p>
            </div>
            <div className="routine-card">
              <strong>Game-Speed Movement</strong>
              <span>7 minutes</span>
              <p>
                Attack a cone or chair, hit a move, and explode past it. Add
                retreat dribbles to protect the ball under pressure.
              </p>
            </div>
          </div>

          <blockquote className="coach-quote">
            Push hard enough to lose the ball sometimes. Perfect reps do not build
            confidence. Full-speed mistakes do.
          </blockquote>
        </article>
      </section>

      {isLoading ? <div className="toast">Loading court data...</div> : null}
      {errorMessage ? <div className="toast error">{errorMessage}</div> : null}
    </main>
  );
}
