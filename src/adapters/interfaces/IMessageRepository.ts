import { MessageResponse } from "../../types/IMessage";
import { MessageRequest } from "../../types/IMessage";


export interface IMessageRepository {
    sendMessage(message: MessageRequest, teamId: string): Promise<MessageResponse>;
    getMessages(teamId: string, limit?: number, anchorId?: string, direction?: 'before' | 'after' | 'around'): Promise<MessageResponse[]>;
    subscribeToMessages(teamId: string, userId: string, callback: (message: MessageResponse) => void): Promise<{ unsubscribe: () => void }>;
}
