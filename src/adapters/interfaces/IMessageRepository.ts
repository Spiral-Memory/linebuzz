import { MessageResponse } from "../../types/IMessage";
import { MessageRequest } from "../../types/IMessage";


export interface IMessageRepository {
    sendMessage(message: MessageRequest, teamId: string): Promise<MessageResponse>;
    getMessages(teamId: string, limit?: number, anchorId?: string, direction?: 'before' | 'after' | 'around'): Promise<MessageResponse[]>;
    getThreadMessages(teamId: string, threadId: string, limit?: number, anchorId?: string, direction?: 'before' | 'after' | 'around'): Promise<MessageResponse[]>;
    getMessageById(teamId: string, messageId: string): Promise<MessageResponse | null>;
    subscribeToMessages(teamId: string, userId: string, callback: (message: MessageResponse) => void): Promise<{ unsubscribe: () => void }>;
}

