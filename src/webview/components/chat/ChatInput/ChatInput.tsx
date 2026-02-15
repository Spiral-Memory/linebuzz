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
    editingMessage?: MessageResponse | null;
    onCancelEdit?: () => void;
}

export const ChatInput = ({ stagedSnippet, onClearSnippet, onRemoveSnippet, onOpenSnippet, onTyping, replyingTo, onCancelReply, editingMessage, onCancelEdit }: ChatInputProps) => {
    const [value, setValue] = useState('');
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

    useEffect(() => {
        if (editingMessage) {
            setValue(editingMessage.content || '');
            if (textareaRef.current) {
                textareaRef.current.focus();
                setTimeout(adjustHeight, 0);
            }
        }
    }, [editingMessage]);

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
        if (editingMessage) {
            vscode.postMessage({
                command: 'editMessage',
                messageId: editingMessage.message_id,
                content: value
            });
            if (onCancelEdit) onCancelEdit();
        } else {
            const messageRequest: MessageRequest = {
                content: value,
                attachments: stagedSnippet || [],
                quoted_id: replyingTo?.message_id
            };
            vscode.postMessage({
                command: 'sendMessage',
                body: messageRequest
            });

            if (onCancelReply) {
                onCancelReply();
            }
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
            {editingMessage && (
                <div class={styles['reply-preview']}>
                    <div class={styles['reply-content']}>
                        <div class={styles['reply-to-text']}>
                            <svg class={styles['reply-icon-small']} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            Editing Message
                        </div>
                        <div class={styles['reply-message-text']}>
                            {editingMessage.content}
                        </div>
                    </div>
                    <button class={styles['cancel-reply-button']} onClick={() => {
                        onCancelEdit?.();
                        setValue('');
                    }} aria-label="Cancel edit">
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
    );
};