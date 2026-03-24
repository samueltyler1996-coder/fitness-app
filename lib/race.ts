export function getDaysToRace(eventDate: string): number | null {
  if (!eventDate) return null;
  const race = new Date(eventDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / 86400000);
}

export function isRaceWeek(eventDate: string): boolean {
  const days = getDaysToRace(eventDate);
  if (days === null) return false;
  return days >= 0 && days <= 7;
}

export function isRaceDay(eventDate: string): boolean {
  const days = getDaysToRace(eventDate);
  return days === 0;
}

export function isPostRace(eventDate: string): boolean {
  const days = getDaysToRace(eventDate);
  if (days === null) return false;
  return days < 0;
}
