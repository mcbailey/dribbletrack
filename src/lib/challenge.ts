import type { Session } from "../types";

export const CHALLENGE_START = "2026-03-23";
export const CHALLENGE_END = "2026-04-30";
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

export function getDatePart(value: string): string {
  return value.slice(0, 10);
}

export function isWithinChallenge(dateKey: string, startDateKey: string): boolean {
  return dateKey >= startDateKey && dateKey <= CHALLENGE_END;
}

export function getChallengeSessions(
  sessions: Session[],
  startDateKey: string,
): Session[] {
  return sessions.filter((session) =>
    isWithinChallenge(session.practiced_on, startDateKey),
  );
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

function daysBetweenInclusive(startDateKey: string, endDateKey: string): number {
  const start = fromDateKey(startDateKey);
  const end = fromDateKey(endDateKey);
  const diffMs = end.getTime() - start.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getTargetTotal(
  startDateKey: string,
  endDateKey = CHALLENGE_END,
): number {
  if (startDateKey > endDateKey) {
    return 0;
  }

  let cursor = fromDateKey(startDateKey);
  let total = 0;

  while (toDateKey(cursor) <= endDateKey) {
    const week = getCurrentWeekRange(cursor);
    const segmentStart = toDateKey(cursor);
    const segmentEnd = week.end < endDateKey ? week.end : endDateKey;
    const daysAvailable = daysBetweenInclusive(segmentStart, segmentEnd);

    total += Math.min(WEEKLY_TARGET, daysAvailable);

    cursor = fromDateKey(segmentEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function getWeeklyTarget(
  startDateKey: string,
  referenceDate = new Date(),
): number {
  const week = getCurrentWeekRange(referenceDate);
  const segmentStart = startDateKey > week.start ? startDateKey : week.start;
  const segmentEnd = week.end < CHALLENGE_END ? week.end : CHALLENGE_END;

  if (segmentStart > segmentEnd) {
    return 0;
  }

  return Math.min(WEEKLY_TARGET, daysBetweenInclusive(segmentStart, segmentEnd));
}

export function getChallengeProgress(
  totalSessions: number,
  startDateKey: string,
  referenceDate = new Date(),
): {
  sessionsLeft: number;
  targetTotal: number;
  state: "ahead" | "on-pace" | "catch-up" | "done";
} {
  const todayKey = toDateKey(referenceDate);
  const targetTotal = getTargetTotal(startDateKey);
  const targetByToday = getTargetTotal(
    startDateKey,
    todayKey < CHALLENGE_END ? todayKey : CHALLENGE_END,
  );
  const sessionsLeft = Math.max(0, targetTotal - totalSessions);

  if (totalSessions >= targetTotal) {
    return {
      sessionsLeft,
      targetTotal,
      state: "done",
    };
  }

  if (totalSessions > targetByToday) {
    return {
      sessionsLeft,
      targetTotal,
      state: "ahead",
    };
  }

  if (totalSessions >= targetByToday) {
    return {
      sessionsLeft,
      targetTotal,
      state: "on-pace",
    };
  }

  return {
    sessionsLeft,
    targetTotal,
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
