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
    slackChannel?: string | null;
}

export const ChatInput = ({ stagedSnippet, onClearSnippet, onRemoveSnippet, onOpenSnippet, onTyping, replyingTo, onCancelReply, isSlackConnected, slackChannel }: ChatInputProps) => {
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
                    {slackChannel && (
                        <div class={styles['slack-toggle-container']} title={syncToSlack ? `Sharing to #${slackChannel}` : `Send to #${slackChannel}`}>
                            <label class={styles['switch']}>
                                <input
                                    type="checkbox"
                                    checked={syncToSlack}
                                    onChange={(e: any) => setSyncToSlack(e.target.checked)}
                                />
                                <span class={`${styles['slider']} ${styles['round']}`}>
                                    <svg class={styles['slack-icon-inside']} viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M403.198 225.109C432.661 223.412 464.022 239.591 466.419 271.352C466.818 299.816 481.5 339.966 436.955 335.372C306.918 346.458 326.394 227.606 403.198 225.109Z" fill={syncToSlack ? "#36C5F0" : "currentColor"} />
                                        <path d="M262.273 354.546C316.904 344.958 376.829 341.063 430.862 355.845C485.194 374.621 473.509 455.021 424.57 472.099C402.398 479.79 373.833 472 353.658 476.893C318.602 474.796 282.647 476.394 248.49 466.906C192.76 448.329 213.434 361.837 262.273 354.546Z" fill={syncToSlack ? "#36C5F0" : "currentColor"} />

                                        <path d="M640.301 367.929C672.66 323.584 742.473 360.638 739.577 410.875C739.077 473.197 692.536 477.392 642.298 474.696C614.733 476.493 627.617 381.112 640.301 367.929Z" fill={syncToSlack ? "#2EB67D" : "currentColor"} />
                                        <path d="M608.739 431.748C577.478 511.847 471.91 461.71 486.192 386.604C486.392 342.659 486.392 297.715 496.279 254.769C502.871 231.398 521.648 220.612 544.819 218.914C604.144 216.317 617.927 276.242 615.93 321.585C615.83 358.339 620.424 396.192 608.739 431.748Z" fill={syncToSlack ? "#2EB67D" : "currentColor"} />

                                        <path d="M635.708 617.116C601.351 617.715 565.896 620.711 532.537 610.624C453.636 582.859 500.377 472.297 574.984 486.679C617.731 487.078 660.977 485.58 703.124 493.87C750.964 501.76 758.754 567.578 724.597 595.343C700.328 617.415 666.17 614.919 635.708 617.116Z" fill={syncToSlack ? "#ECB22E" : "currentColor"} />
                                        <path d="M525.044 628.503C648.29 617.017 636.305 734.171 556.205 739.664C528.14 740.962 495.881 726.48 492.685 695.919C492.884 660.763 474.008 624.808 525.044 628.503Z" fill={syncToSlack ? "#ECB22E" : "currentColor"} />

                                        <path d="M300.726 486.383C327.093 483.486 340.776 488.98 337.78 518.443C336.881 552.101 340.377 598.543 300.826 610.827C202.948 628.705 201.35 472.3 300.726 486.383Z" fill={syncToSlack ? "#E01E5A" : "currentColor"} />
                                        <path d="M412.784 487.978C437.853 489.177 470.712 506.755 476.705 537.217C480.899 558.19 474.807 584.757 479.401 603.334C472.809 647.878 491.087 721.087 435.556 738.066C342.572 757.341 349.164 643.883 349.763 583.359C347.566 542.81 362.947 484.782 412.784 487.978Z" fill={syncToSlack ? "#E01E5A" : "currentColor"} />
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