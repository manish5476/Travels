
// ── ROOM NAMING CONVENTIONS ─────────────────────────────────
// Each room has a specific purpose and membership rule.
// Rooms are namespaced to prevent collisions.

export const Rooms = {
    // Personal room: user's own notifications, DMs, system events
    // Joined automatically on connect. All devices of this user are in it.
    user: (userId: string) => `user:${userId}`,

    // Conversation room: all participants of a conversation
    // Joined when client calls 'join:conversation' event.
    // Messages, read receipts, typing are broadcast here.
    conversation: (convId: string) => `conv:${convId}`,

    // Trip room: all active collaborators of a trip
    // Receives: trip state changes, waypoint check-ins, expense events.
    trip: (tripId: string) => `trip:${tripId}`,

    // Vendor room: vendor dashboard real-time updates
    vendor: (vendorId: string) => `vendor:${vendorId}`,
};

// ── SOCKET.IO EVENT NAMES ────────────────────────────────────
// Client → Server events
export const ClientEvents = {
    JOIN_CONVERSATION: 'join:conversation',
    LEAVE_CONVERSATION: 'leave:conversation',
    SEND_MESSAGE: 'message:send',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    MARK_READ: 'messages:read',
    MARK_DELIVERED: 'messages:delivered',
    REACT_MESSAGE: 'message:react',
    JOIN_TRIP: 'join:trip',
} as const;

// Server → Client events
export const ServerEvents = {
    MESSAGE_NEW: 'message:new',
    MESSAGE_DELETED: 'message:deleted',
    MESSAGE_EDITED: 'message:edited',
    TYPING_UPDATE: 'typing:update',
    READ_UPDATE: 'messages:read:update',
    DELIVERED_UPDATE: 'messages:delivered:update',
    REACTION_UPDATE: 'message:reaction:update',
    PRESENCE_UPDATE: 'presence:update',
    CONVERSATION_UPDATED: 'conversation:updated',
    TRIP_EVENT: 'trip:event',
    NOTIFICATION: 'notification:new',
    ERROR: 'error',
} as const;
