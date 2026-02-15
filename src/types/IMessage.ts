import { Attachment } from "./IAttachment";

export interface MessageResponse {
    message_id: string;
    team_id: string;
    thread_id: string;
    parent_id: string | null;
    content: string | null;
    created_at: string;
    u: {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string;
    };
    userType?: 'me' | 'other';
    quoted_id?: string;
    quoted_message?: MessageResponse;
    attachments?: any[];
}

export interface MessageRequest {
    content: string;
    attachments: Attachment[];
    quoted_id?: string;
}