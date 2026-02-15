import { MessageContent } from '../MessageContent/MessageContent';
import { getInitials } from '../../../utils/getInitials';
import { formatTime } from '../../../utils/formatTime';
import { getAvatarColor } from '../../../utils/getAvatarColor';
import styles from './MessageRow.module.css';

import { SnippetAttachment } from '../MessageAttachment/SnippetAttachment';
import { Snippet } from '../../../../types/IAttachment';

import { MessageResponse } from '../../../../types/IMessage';

interface MessageRowProps {
    message: MessageResponse;
    onOpenSnippet?: (snippet: Snippet, requestId?: string) => void;
    isHighlighted?: boolean;
    onReply?: (message: MessageResponse) => void;
}

export const MessageRow = ({ message, onOpenSnippet, isHighlighted, onReply }: MessageRowProps) => {
    const displayName = message.u?.display_name || message.u?.username || 'Unknown';
    const avatarUrl = message.u?.avatar_url;
    const initials = getInitials(displayName);
    const avatarColor = getAvatarColor(displayName);
    const isMe = message.userType === 'me';

    return (
        <div
            class={`${styles['message-row']} ${isMe ? styles['message-row-me'] : ''} ${isHighlighted ? styles['message-row-highlighted'] : ''}`}
            key={message.message_id}
            data-id={message.message_id}
        >
            <div class={styles['reply-button']} onClick={() => onReply?.(message)} title="Reply">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 14L4 9L9 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M4 9H14C18.4183 9 22 12.5817 22 17V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
            <div class={styles['avatar-container']}>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        class={styles['avatar-image']}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = 'flex';
                        }}
                    />
                ) : null}
                <div
                    class={styles['avatar-fallback']}
                    style={{
                        display: avatarUrl ? 'none' : 'flex',
                        backgroundColor: avatarColor,
                        color: '#fff'
                    }}
                >
                    {initials}
                </div>
            </div>
            <div class={styles['message-body']}>
                <div class={styles['message-header']}>
                    {!isMe && <span class={styles['user-name']}>{displayName}</span>}
                    <span class={styles['message-time']}>{formatTime(message.created_at)}</span>
                </div>
                {message.quoted_message && (
                    <div class={styles['quoted-message']}>
                        <div class={styles['quoted-user']}>
                            {message.quoted_message.u.display_name || message.quoted_message.u.username}
                        </div>
                        <div class={styles['quoted-content']}>
                            {message.quoted_message.content}
                        </div>
                    </div>
                )}
                <MessageContent content={message.content} isMe={isMe} />
                {message.attachments && message.attachments.length > 0 && (
                    <div class={styles['attachments-container']}>
                        {message.attachments.map((attachment: any, index: number) => {
                            if (attachment.type === 'code') {
                                return (
                                    <SnippetAttachment
                                        key={index}
                                        snippet={attachment as Snippet}
                                        onNavigate={(s, rid) => onOpenSnippet?.(s, rid)}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
