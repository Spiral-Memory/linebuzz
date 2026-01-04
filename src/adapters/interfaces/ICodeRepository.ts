import { Snippet } from "../../types/IAttachment";

export interface CodeDiscussion extends Omit<Snippet, 'file_path' | 'remote_url'> {
    id: string;
    message: {
        id: string;
        content: string;
    },
    u: {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string;
    };
    created_at: string;
}

export interface ICodeRepository {
    getDiscussionsByFile(file_path: string, remote_url: string, team_id: string): Promise<CodeDiscussion[]>;
}
