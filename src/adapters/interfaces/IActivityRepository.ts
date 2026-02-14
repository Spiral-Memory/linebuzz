export interface TypingPayload {
    userId: string;
    username: string;
}

export interface IActivityRepository {
    sendTypingSignal(teamId: string, userId: string, username: string): Promise<void>;
    subscribeToTyping(teamId: string, userId: string, callback: (payload: TypingPayload) => void): Promise<{ unsubscribe: () => void }>;
}
