/**
 * Session Management Module
 *
 * Provides utilities for managing client sessions, including session storage,
 * lazy initialization of target clients, and session ID generation.
 * Each session maintains its own connection to the target MCP server.
 */

import { createTargetClient } from "../client/client.js";
import type { ClientFactory, PassthroughClient } from "../types/client.js";
import type { Config } from "./config.js";

export interface SessionData {
  id: string;
  targetClient: PassthroughClient;
  requestCount: number;
}

// Global session store
const sessions = new Map<string, SessionData>();
// Default Session ID for client operations that are not associated with
// one (stdio or start-up client)
export const DEFAULT_SESSION_ID = "default";

// Global client factory
let clientFactory: ClientFactory | undefined = undefined;

/**
 * Set the client factory and config for session management
 */
export function setSessionClientFactory(
  factory: ClientFactory | undefined,
): void {
  clientFactory = factory;
}

/**
 * Create a client using the configured factory or default implementation
 */
async function createClientForSession(
  sessionId: string,
  config: Config,
): Promise<PassthroughClient> {
  if (!config) {
    throw new Error(
      "Session config not set. Call setSessionClientFactory first.",
    );
  }

  return clientFactory
    ? clientFactory(config.target, sessionId, config.clientInfo)
    : createTargetClient(config.target, sessionId, config.clientInfo);
}

/**
 * Get or create session data for a given session ID
 */
export async function getOrCreateSession(
  sessionId: string,
  config: Config,
): Promise<SessionData> {
  if (!sessions.has(sessionId)) {
    const targetClient = await createClientForSession(sessionId, config);
    sessions.set(sessionId, {
      id: sessionId,
      targetClient,
      requestCount: 0,
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Session should exist after creation");
  }
  return session;
}

/**
 * Get or create session, increase request count and return targetClient
 */
export async function getOrCreateSessionForRequest(
  sessionId: string,
  config: Config,
): Promise<SessionData> {
  // Get or create session with target client
  const sessionData = await getOrCreateSession(sessionId, config);

  // Increment request counter
  sessionData.requestCount += 1;

  return sessionData;
}

/**
 * Clear a specific session
 */
export async function clearSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session) {
    await session.targetClient.close();
  }
  sessions.delete(sessionId);
}

/**
 * Clear all sessions
 */
export async function clearAllSessions(): Promise<void> {
  await Promise.all(
    Array.from(sessions.values()).map((session) =>
      session.targetClient.close(),
    ),
  );
  sessions.clear();
}

/**
 * Get session count (useful for testing)
 */
export function getSessionCount(): number {
  return sessions.size;
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  return `session-${Math.random().toString(36).substring(2, 15)}`;
}
