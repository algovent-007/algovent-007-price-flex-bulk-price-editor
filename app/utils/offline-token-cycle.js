export function needsOfflineTokenCycle(session) {
  if (!session?.shop || !session.accessToken) return false;
  if (session.isOnline) return false;
  return !session.refreshToken;
}
