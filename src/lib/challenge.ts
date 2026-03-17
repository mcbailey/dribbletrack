import type { Session } from "../types";

export const CHALLENGE_START = "2026-03-23";
export const CHALLENGE_END = "2026-04-19";
export const CHALLENGE_TARGET = 16;
export const WEEKLY_TARGET = 4;

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

export function getTodayKey(): string {
  return toDateKey(new Date());
}

export function isWithinChallenge(dateKey: string): boolean {
  return dateKey >= CHALLENGE_START && dateKey <= CHALLENGE_END;
}

export function getChallengeSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => isWithinChallenge(session.practiced_on));
}

export function getCurrentWeekRange(referenceDate = new Date()): {
  start: string;
  end: string;
} {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const mondayDistance = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayDistance);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

export function getWeekIndex(dateKey: string): number {
  const start = fromDateKey(CHALLENGE_START);
  const date = fromDateKey(dateKey);
  const diffMs = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / 7) + 1;
}

export function getChallengePhase(referenceDate = new Date()): "upcoming" | "active" | "complete" {
  const key = toDateKey(referenceDate);

  if (key < CHALLENGE_START) {
    return "upcoming";
  }

  if (key > CHALLENGE_END) {
    return "complete";
  }

  return "active";
}

export function getDaysUntilChallenge(referenceDate = new Date()): number {
  const start = fromDateKey(CHALLENGE_START);
  const current = fromDateKey(toDateKey(referenceDate));
  const diffMs = start.getTime() - current.getTime();

  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getDaysRemaining(referenceDate = new Date()): number {
  const end = fromDateKey(CHALLENGE_END);
  const current = fromDateKey(toDateKey(referenceDate));
  const diffMs = end.getTime() - current.getTime();

  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

export function getWeeklySessionCount(sessions: Session[], referenceDate = new Date()): number {
  const week = getCurrentWeekRange(referenceDate);

  return sessions.filter(
    (session) =>
      session.practiced_on >= week.start && session.practiced_on <= week.end,
  ).length;
}

export function getChallengeProgress(totalSessions: number, referenceDate = new Date()): {
  sessionsLeft: number;
  weeklyAverageNeeded: number;
  state: "ahead" | "on-pace" | "catch-up" | "done";
} {
  if (totalSessions >= CHALLENGE_TARGET) {
    return {
      sessionsLeft: 0,
      weeklyAverageNeeded: 0,
      state: "done",
    };
  }

  const daysRemaining = getDaysRemaining(referenceDate);
  const weeksRemaining = Math.max(daysRemaining / 7, 1 / 7);
  const sessionsLeft = CHALLENGE_TARGET - totalSessions;
  const weeklyAverageNeeded = sessionsLeft / weeksRemaining;

  if (weeklyAverageNeeded < 3.5) {
    return {
      sessionsLeft,
      weeklyAverageNeeded,
      state: "ahead",
    };
  }

  if (weeklyAverageNeeded <= WEEKLY_TARGET) {
    return {
      sessionsLeft,
      weeklyAverageNeeded,
      state: "on-pace",
    };
  }

  return {
    sessionsLeft,
    weeklyAverageNeeded,
    state: "catch-up",
  };
}

export function getCurrentStreak(
  sessions: Session[],
  referenceDate = new Date(),
): number {
  const practicedDays = new Set(sessions.map((session) => session.practiced_on));
  const cursor = fromDateKey(toDateKey(referenceDate));

  if (!practicedDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);

    if (!practicedDays.has(toDateKey(cursor))) {
      return 0;
    }
  }

  let streak = 0;

  while (practicedDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
