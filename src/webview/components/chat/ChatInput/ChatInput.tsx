import { useState, useRef, useEffect } from 'preact/hooks';
import { vscode } from '../../../utils/vscode';
import { Snippet } from '../../../../types/IAttachment';
import { CodeInput } from './CodeInput';
import { MessageRequest, MessageResponse } from '../../../../types/IMessage';
import styles from './ChatInput.module.css';

interface ChatInputProps {
    stagedSnippet?: Snippet[] | [];
    onClearSnippet?: () => void;
    onRemoveSnippet?: (index: number) => void;
    onOpenSnippet?: (snippet: Snippet, requestId?: string) => void;
    onTyping?: () => void;
    replyingTo?: MessageResponse | null;
    onCancelReply?: () => void;
    isSlackConnected?: boolean;
}

export const ChatInput = ({ stagedSnippet, onClearSnippet, onRemoveSnippet, onOpenSnippet, onTyping, replyingTo, onCancelReply, isSlackConnected }: ChatInputProps) => {
    const [value, setValue] = useState('');
    const [syncToSlack, setSyncToSlack] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const handleFocus = () => {
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const handleInput = (e: any) => {
        setValue(e.target.value);
        adjustHeight();
        if (onTyping) {
            onTyping();
        }
    };

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
        }
    };

    const handleSend = () => {
        if (!value.trim() && (!stagedSnippet || stagedSnippet.length === 0)) return;
        const messageRequest: MessageRequest = {
            content: value,
            attachments: stagedSnippet || [],
            quoted_id: replyingTo?.message_id,
            sync_to_slack: syncToSlack
        };
        vscode.postMessage({
            command: 'sendMessage',
            body: messageRequest
        });

        if (onCancelReply) {
            onCancelReply();
        }

        setValue('');
        if (onClearSnippet) {
            onClearSnippet();
        }

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.overflowY = 'hidden';
            textareaRef.current.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasAttachments = stagedSnippet && stagedSnippet.length > 0;

    return (
        <div class={styles['input-container']}>
            {replyingTo && (
                <div class={styles['reply-preview']}>
                    <div class={styles['reply-content']}>
                        <div class={styles['reply-to-text']}>
                            <svg class={styles['reply-icon-small']} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 14L4 9L9 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M4 9H14C18.4183 9 22 12.5817 22 17V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            Replying to {replyingTo.u?.display_name || replyingTo.u?.username || 'Unknown'}
                        </div>
                        <div class={styles['reply-message-text']}>
                            {replyingTo.content}
                        </div>
                    </div>
                    <button class={styles['cancel-reply-button']} onClick={onCancelReply} aria-label="Cancel reply">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                </div>
            )}
            <textarea
                ref={textareaRef}
                class={styles['chat-input']}
                value={value}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
            />

            <div class={styles['composer-tools']}>
                <div class={styles['input-attachments']}>
                    {hasAttachments && onRemoveSnippet && stagedSnippet.map((snippet, index) => (
                        <CodeInput
                            key={`${snippet.file_path}-${index}`}
                            snippet={snippet}
                            onRemove={() => onRemoveSnippet(index)}
                            onOpen={() => {
                                const requestId = Math.random().toString(36).substring(7);
                                onOpenSnippet && onOpenSnippet(snippet, requestId);
                            }}
                        />
                    ))}
                </div>
                <div class={styles['action-buttons']}>
                    {isSlackConnected && (
                        <div class={styles['slack-toggle-container']} title={syncToSlack ? "Syncing to Slack (ON)" : "Sync to Slack (OFF)"}>
                            <label class={styles['switch']}>
                                <input
                                    type="checkbox"
                                    checked={syncToSlack}
                                    onChange={(e: any) => setSyncToSlack(e.target.checked)}
                                />
                                <span class={`${styles['slider']} ${styles['round']}`}>
                                    <svg class={styles['slack-icon-inside']} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042zM8.823 5.043a2.528 2.528 0 0 1-2.52-2.52 2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522zm0 1.262a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H3.78a2.528 2.528 0 0 1-2.52-2.52V8.825a2.528 2.528 0 0 1 2.52-2.52h5.043zm10.135 3.78a2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.262 0a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.78a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043zm-3.78 10.134a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.522zm0-1.261a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52h-5.043z" fill="currentColor"/>
                                    </svg>
                                </span>
                            </label>
                        </div>
                    )}
                    <button class={`${styles['send-button-icon']} ${value.trim() || hasAttachments ? styles['has-text'] : ''}`} onClick={handleSend} aria-label="Send">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                            <path
                                d="m18.6357 15.6701 1.7164 -5.1493c1.4995 -4.49838 2.2492 -6.74758 1.0619 -7.93485 -1.1872 -1.18726 -3.4364 -0.43753 -7.9348 1.06193L8.32987 5.36432C4.69923 6.57453 2.88392 7.17964 2.36806 8.06698c-0.49075 0.84414 -0.49075 1.88671 0 2.73082 0.51586 0.8874 2.33117 1.4925 5.96181 2.7027 0.58295 0.1943 0.87443 0.2915 1.11806 0.4546 0.23611 0.158 0.43894 0.3609 0.59697 0.597 0.1631 0.2436 0.2603 0.5351 0.4546 1.118 1.2102 3.6307 1.8153 5.446 2.7027 5.9618 0.8441 0.4908 1.8867 0.4908 2.7308 0 0.8874 -0.5158 1.4925 -2.3311 2.7027 -5.9618Z"
                                stroke="currentColor"
                                stroke-width="2"
                            />
                            <path
                                d="M16.2116 8.84823c0.2945 -0.29127 0.2971 -0.76613 0.0058 -1.06065 -0.2912 -0.29451 -0.7661 -0.29714 -1.0606 -0.00587l1.0548 1.06652Zm-5.549 5.48777 5.549 -5.48777 -1.0548 -1.06652 -5.54893 5.48779 1.05473 1.0665Z"
                                fill="currentColor"
                                stroke-width="2"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};