import { useEffect, useLayoutEffect, useState, useRef } from 'preact/hooks';
import { ChatInput } from '../../components/chat/ChatInput/ChatInput';
import { MessageRow } from '../../components/chat/MessageRow/MessageRow';
import { MessageResponse } from '../../../types/IMessage';
import { WelcomeSplash } from '../../components/chat/WelcomeSplash/WelcomeSplash';
import { LoadingSpinner } from '../../components/ui/Loaders/LoadingSpinner';
import { Snippet } from '../../../types/IAttachment';
import { vscode } from '../../utils/vscode';
import styles from './ChatView.module.css';
import { useTyping } from '../../hooks/useTyping';
import { TypingIndicator } from '../../components/chat/TypingIndicator/TypingIndicator';

interface ChatViewProps {
    stagedSnippet?: Snippet[] | [];
    onClearSnippet?: () => void;
    onRemoveSnippet?: (index: number) => void;
    onOpenSnippet?: (snippet: Snippet, requestId?: string) => void;
}

interface ScrollSnapshot {
    id: string;
    rect: DOMRect;
    scrollTop: number;
}

export const ChatView = ({ stagedSnippet, onClearSnippet, onRemoveSnippet, onOpenSnippet }: ChatViewProps) => {
    const [messages, setMessages] = useState<MessageResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasOlder, setHasOlder] = useState(true);
    const [hasNewer, setHasNewer] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<MessageResponse | null>(null);
    const { typingUsers, sendTyping } = useTyping();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const cachedMessagesRef = useRef<MessageResponse[]>([]);
    const snapshotRef = useRef<ScrollSnapshot | null>(null);
    const isAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);
    const shouldScrollToBottomRef = useRef(false);

    const messagesRef = useRef<MessageResponse[]>([]);
    const isLoadingRef = useRef(false);
    const hasOlderRef = useRef(true);
    const hasNewerRef = useRef(false);
    const jumpRequestRef = useRef<string | null>(null);

    const FETCH_LIMIT = 50;
    const MAX_DOM_MESSAGE = 150;
    const SCROLL_THRESHOLD = 400;

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messageListRef.current) {
            if (behavior === 'auto') {
                messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
            } else if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior });
            }
            setUnreadCount(0);
        }
    };

    useLayoutEffect(() => {
        if (messages.length === 0) return;

        if (shouldScrollToBottomRef.current) {
            snapshotRef.current = null;

            requestAnimationFrame(() => {
                scrollToBottom('auto');
                shouldScrollToBottomRef.current = false;
            });

            return;
        }

        if (isInitialLoadRef.current) {
            snapshotRef.current = null;
            requestAnimationFrame(() => {
                scrollToBottom('auto');
                isInitialLoadRef.current = false;
            });
            return;
        }

        if (snapshotRef.current && messageListRef.current) {
            const { id, rect: prevRect, scrollTop: prevScrollTop } = snapshotRef.current;
            const node = messageListRef.current.querySelector(`[data-id="${id}"]`) as HTMLElement;

            if (node && prevRect) {

                requestAnimationFrame(() => {
                    const currentRect = node.getBoundingClientRect();
                    const scrollDiff = currentRect.top - prevRect.top;
                    if (messageListRef.current) {
                        messageListRef.current.scrollTop = prevScrollTop + scrollDiff;
                    }
                });

            }
            snapshotRef.current = null;
            return;
        }

        if (jumpRequestRef.current && messageListRef.current) {
            const targetId = jumpRequestRef.current;
            jumpRequestRef.current = null;

            requestAnimationFrame(() => {
                const node = messageListRef.current?.querySelector(`[data-id="${targetId}"]`);
                if (node) {
                    node.scrollIntoView({ block: 'center', behavior: 'auto' });
                    setHighlightedMessageId(targetId);
                }
            });

        }
    }, [messages]);

    useEffect(() => {
        if (highlightedMessageId) {
            const timer = setTimeout(() => {
                setHighlightedMessageId(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightedMessageId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    useEffect(() => {
        hasOlderRef.current = hasOlder;
    }, [hasOlder]);

    useEffect(() => {
        hasNewerRef.current = hasNewer;
    }, [hasNewer]);

    const captureSnapshot = (targetMsg: MessageResponse) => {
        if (!messageListRef.current || !targetMsg) return;

        const node = messageListRef.current.querySelector(
            `[data-id="${targetMsg.message_id}"]`
        ) as HTMLElement;

        if (node) {
            snapshotRef.current = {
                id: targetMsg.message_id,
                rect: node.getBoundingClientRect(),
                scrollTop: messageListRef.current.scrollTop
            };
        }
    };

    const handleLoadOlder = () => {
        if (isLoadingRef.current) return;

        const currentMessages = messagesRef.current;
        const topMsgId = currentMessages[0]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === topMsgId);

        if (cacheIndex > 0) {
            const newStartIndex = Math.max(0, cacheIndex - 20);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newStartIndex + MAX_DOM_MESSAGE);
            captureSnapshot(currentMessages[0]);
            setMessages(newSlice);

        } else if (hasOlderRef.current) {
            setIsLoading(true);
            const topMsgId = currentMessages[0]?.message_id;
            captureSnapshot(currentMessages[0]);
            vscode.postMessage({
                command: 'getMessages',
                limit: FETCH_LIMIT,
                anchorId: topMsgId,
                direction: 'before',
                intent: 'paginate-older'
            });
        }
    };

    const handleLoadNewer = () => {
        if (isLoadingRef.current) return;

        const currentMessages = messagesRef.current;
        const bottomMsgId = currentMessages[currentMessages.length - 1]?.message_id;
        const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === bottomMsgId);

        if (cacheIndex !== -1 && cacheIndex < cachedMessagesRef.current.length - 1) {
            const newEndIndex = Math.min(cachedMessagesRef.current.length, cacheIndex + 21);
            const newStartIndex = Math.max(0, newEndIndex - MAX_DOM_MESSAGE);
            const newSlice = cachedMessagesRef.current.slice(newStartIndex, newEndIndex);
            captureSnapshot(newSlice[0]);
            setMessages(newSlice);

        } else if (hasNewerRef.current) {
            setIsLoading(true);
            const bottomMsgId = currentMessages[currentMessages.length - 1]?.message_id;
            vscode.postMessage({
                command: 'getMessages',
                limit: FETCH_LIMIT,
                anchorId: bottomMsgId,
                direction: 'after',
                intent: 'paginate-newer'
            });
        }
    };

    const handleLoadOlderRef = useRef(handleLoadOlder);
    const handleLoadNewerRef = useRef(handleLoadNewer);
    handleLoadOlderRef.current = handleLoadOlder;
    handleLoadNewerRef.current = handleLoadNewer;

    const handleReply = (message: MessageResponse) => {
        setReplyingTo(message);
        // Focus the input
        const input = document.querySelector('textarea');
        if (input) (input as HTMLElement).focus();
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    useEffect(() => {
        if (messages.length === 0) return;
        if (!messageListRef.current || !topSentinelRef.current || !bottomSentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries: IntersectionObserverEntry[]) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    if (isInitialLoadRef.current || shouldScrollToBottomRef.current) return;

                    if (entry.target === topSentinelRef.current && !isLoadingRef.current) {
                        handleLoadOlderRef.current();
                    } else if (entry.target === bottomSentinelRef.current) {
                        handleLoadNewerRef.current();
                    }
                });
            },
            {
                root: messageListRef.current,
                rootMargin: '10px',
                threshold: 0.1
            }
        );

        observer.observe(topSentinelRef.current);
        observer.observe(bottomSentinelRef.current);

        return () => observer.disconnect();
    }, [messages.length > 0]);

    const handleJumpToBottom = () => {
        if (hasNewer) {
            setIsLoading(true);
            vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, intent: 'jump-to-bottom' });
            return;
        }

        const cachedLen = cachedMessagesRef.current.length;
        const currentLen = messagesRef.current.length;
        const lastCachedMsg = cachedMessagesRef.current[cachedLen - 1];
        const lastRenderedMsg = messagesRef.current[currentLen - 1];

        if (lastCachedMsg && lastRenderedMsg && lastCachedMsg.message_id === lastRenderedMsg.message_id) {
            scrollToBottom('auto');
            setUnreadCount(0);
            return;
        }

        const newSlice = cachedMessagesRef.current.slice(-MAX_DOM_MESSAGE);
        shouldScrollToBottomRef.current = true;
        setUnreadCount(0);
        setMessages(newSlice);
    };

    const onScroll = () => {
        if (!messageListRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isAtBottom = distanceFromBottom < 50;
        isAtBottomRef.current = isAtBottom;

        if (!isInitialLoadRef.current) {
            setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD);
        }

        if (isAtBottom && unreadCount > 0) setUnreadCount(0);
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadInitialMessages':
                    cachedMessagesRef.current = message.messages;
                    setMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setHasOlder(message.messages.length >= FETCH_LIMIT);
                    setHasNewer(false);
                    setIsLoading(false);
                    break;

                case 'prependMessages': {
                    const olderMessages = message.messages;
                    const uniqueOlder = olderMessages.filter((newMsg: MessageResponse) =>
                        !cachedMessagesRef.current.some(existing => existing.message_id === newMsg.message_id)
                    );

                    if (uniqueOlder.length === 0) {
                        setIsLoading(false);
                        if (olderMessages.length < FETCH_LIMIT) setHasOlder(false);
                        break;
                    }

                    cachedMessagesRef.current = [...uniqueOlder, ...cachedMessagesRef.current];

                    setMessages(prev => {
                        const combined = [...uniqueOlder, ...prev];
                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(0, MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    setHasOlder(olderMessages.length >= FETCH_LIMIT);
                    setIsLoading(false);
                    break;
                }

                case 'appendMessagesBatch': {
                    const newerMessages = message.messages;
                    const uniqueNewer = newerMessages.filter((newMsg: MessageResponse) =>
                        !cachedMessagesRef.current.some(existing => existing.message_id === newMsg.message_id)
                    );

                    if (uniqueNewer.length === 0) {
                        setIsLoading(false);
                        setHasNewer(false);
                        break;
                    }

                    const lastVisibleMsg = messagesRef.current[messagesRef.current.length - 1];
                    if (lastVisibleMsg && messageListRef.current) {
                        const node = messageListRef.current.querySelector(
                            `[data-id="${lastVisibleMsg.message_id}"]`
                        ) as HTMLElement;
                        if (node) {
                            snapshotRef.current = {
                                id: lastVisibleMsg.message_id,
                                rect: node.getBoundingClientRect(),
                                scrollTop: messageListRef.current.scrollTop
                            };
                        }
                    }

                    cachedMessagesRef.current = [...cachedMessagesRef.current, ...uniqueNewer];

                    setMessages(prev => {
                        const combined = [...prev, ...uniqueNewer];
                        if (combined.length > MAX_DOM_MESSAGE) {
                            return combined.slice(-MAX_DOM_MESSAGE);
                        }
                        return combined;
                    });

                    setHasNewer(newerMessages.length >= FETCH_LIMIT);
                    setIsLoading(false);
                    break;
                }

                case 'appendMessage': {
                    const msg = message.message;
                    if (cachedMessagesRef.current.some(m => m.message_id === msg.message_id)) {
                        return;
                    }

                    const isAtBottom = isAtBottomRef.current;
                    const isMyMessage = msg.userType === 'me';

                    if (isMyMessage && hasNewerRef.current) {
                        setIsLoading(true);
                        vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, intent: 'jump-to-bottom' });
                        return;
                    }

                    cachedMessagesRef.current = [...cachedMessagesRef.current, msg];

                    if (isAtBottom || isMyMessage) {
                        setMessages(prev => {
                            if (prev.some(m => m.message_id === msg.message_id)) return prev;
                            const next = [...prev, msg];
                            if (next.length > MAX_DOM_MESSAGE) {
                                return next.slice(-MAX_DOM_MESSAGE);
                            }
                            return next;
                        });
                        shouldScrollToBottomRef.current = true;
                        isAtBottomRef.current = true;
                    } else {
                        setUnreadCount(prev => prev + 1);
                    }
                    break;
                }

                case 'jumpToBottom': {
                    cachedMessagesRef.current = message.messages;
                    setMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setHasOlder(message.messages.length >= FETCH_LIMIT);
                    setHasNewer(false);
                    setIsLoading(false);
                    shouldScrollToBottomRef.current = true;
                    setUnreadCount(0);
                    break;
                }

                case 'jumpToMessage': {
                    if (message.messages) {
                        cachedMessagesRef.current = message.messages;
                        setMessages(message.messages);
                        setHasOlder(true);
                        setHasNewer(true);
                        setIsLoading(false);
                        setUnreadCount(0);
                        jumpRequestRef.current = message.targetId;
                        return;
                    }

                    const targetId = message.targetId;
                    const cacheIndex = cachedMessagesRef.current.findIndex(m => m.message_id === targetId);

                    if (cacheIndex !== -1) {
                        const half = Math.floor(MAX_DOM_MESSAGE / 2);
                        const start = Math.max(0, cacheIndex - half);
                        const end = Math.min(cachedMessagesRef.current.length, start + MAX_DOM_MESSAGE);
                        const newSlice = cachedMessagesRef.current.slice(start, end);

                        setMessages(newSlice);
                        setHasOlder(true);
                        setHasNewer(true);
                        setUnreadCount(0);
                        jumpRequestRef.current = targetId;
                    } else {
                        setIsLoading(true);
                        vscode.postMessage({
                            command: 'getMessages',
                            limit: FETCH_LIMIT,
                            anchorId: targetId,
                            direction: 'around',
                            intent: 'jump-to-message'
                        });
                    }
                    break;
                }
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ command: 'getMessages', limit: FETCH_LIMIT, intent: 'initial' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    return (
        <div class={styles['chat-view-container']}>
            {messages.length === 0 ? (
                <div class={styles['splash-container']}>
                    <WelcomeSplash />
                </div>
            ) : (
                <>
                    <div class={styles['message-list']} ref={messageListRef} onScroll={onScroll}>
                        <div ref={topSentinelRef} style={{ height: '40px', width: '100%' }} />
                        {isLoading && <LoadingSpinner />}
                        {messages.map((msg) => (
                            <MessageRow
                                message={msg}
                                key={msg.message_id}
                                onOpenSnippet={onOpenSnippet}
                                isHighlighted={msg.message_id === highlightedMessageId}
                                onReply={handleReply}
                            />
                        ))}
                        <div ref={bottomSentinelRef} style={{ height: '40px', width: '100%' }} />
                        <div ref={messagesEndRef} />
                    </div>
                    {(unreadCount > 0 || showScrollButton) && (
                        <div class={styles['new-messages-indicator']} onClick={handleJumpToBottom}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 13L12 18L17 13M7 6L12 11L17 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            {unreadCount > 0 && <span class={styles['indicator-count']}>{unreadCount}</span>}
                        </div>
                    )}
                </>
            )}
            <div class={styles['chat-input-container']}>
                <TypingIndicator typingUsers={typingUsers} />
                <ChatInput
                    stagedSnippet={stagedSnippet}
                    onClearSnippet={onClearSnippet}
                    onRemoveSnippet={onRemoveSnippet}
                    onOpenSnippet={onOpenSnippet}
                    onTyping={sendTyping}
                    replyingTo={replyingTo}
                    onCancelReply={handleCancelReply}
                />
            </div>
        </div>
    );
};
