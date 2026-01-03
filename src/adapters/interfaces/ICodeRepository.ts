import { Snippet } from "../../types/IAttachment";

export interface CodeDiscussion extends Omit<Snippet, 'file_path' | 'remote_url'> {
    created_at: string;
    message_id: string;
}

export interface ICodeRepository {
    getDiscussionsByFile(file_path: string, remote_url: string, team_id: string): Promise<CodeDiscussion[]>;
}
