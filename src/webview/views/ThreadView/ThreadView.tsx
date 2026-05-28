import { useEffect, useLayoutEffect, useState, useRef } from 'preact/hooks';
import { MessageRow } from '../../components/chat/MessageRow/MessageRow';
import { MessageResponse } from '../../../types/IMessage';
import { LoadingSpinner } from '../../components/ui/Loaders/LoadingSpinner';
import { Snippet } from '../../../types/IAttachment';
import { vscode } from '../../utils/vscode';
import styles from '../ChatView/ChatView.module.css';

interface ThreadViewProps {
    activeThreadParent: MessageResponse;
    onClose: () => void;
    onOpenSnippet?: (snippet: Snippet, requestId?: string) => void;
    highlightedMessageId: string | null;
    setHighlightedMessageId: (id: string | null) => void;
    handleReply: (message: MessageResponse) => void;
    initialMessages?: MessageResponse[];
    onCacheMessages: (messages: MessageResponse[]) => void;
}

interface ScrollSnapshot {
    id: string;
    rect: DOMRect;
    scrollTop: number;
}

const FETCH_LIMIT = 50;
const MAX_DOM_MESSAGE = 150;
const SCROLL_THRESHOLD = 400;

export const ThreadView = ({
    activeThreadParent,
    onClose,
    onOpenSnippet,
    highlightedMessageId,
    setHighlightedMessageId,
    handleReply,
    initialMessages,
    onCacheMessages
}: ThreadViewProps) => {
    const [threadMessages, setThreadMessages] = useState<MessageResponse[]>([]);
    const [isThreadLoading, setIsThreadLoading] = useState(false);
    const [threadHasOlder, setThreadHasOlder] = useState(true);
    const [threadHasNewer, setThreadHasNewer] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const messageListRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);

    const threadCachedRef = useRef<MessageResponse[]>([]);
    const threadMessagesRef = useRef<MessageResponse[]>([]);
    const isThreadLoadingRef = useRef(false);
    const threadHasOlderRef = useRef(true);
    const threadHasNewerRef = useRef(false);

    const snapshotRef = useRef<ScrollSnapshot | null>(null);
    const isAtBottomRef = useRef(true);
    const isInitialLoadRef = useRef(true);
    const shouldScrollToBottomRef = useRef(false);
    const jumpRequestRef = useRef<string | null>(null);

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
        if (threadMessages.length === 0) return;

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
    }, [threadMessages]);

    useEffect(() => {
        threadMessagesRef.current = threadMessages;
    }, [threadMessages]);

    useEffect(() => {
        isThreadLoadingRef.current = isThreadLoading;
    }, [isThreadLoading]);

    useEffect(() => {
        threadHasOlderRef.current = threadHasOlder;
    }, [threadHasOlder]);

    useEffect(() => {
        threadHasNewerRef.current = threadHasNewer;
    }, [threadHasNewer]);

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

    const handleLoadOlderThread = () => {
        if (isThreadLoadingRef.current) return;

        const currentMsgs = threadMessagesRef.current;
        const topMsgId = currentMsgs[0]?.message_id;
        if (!topMsgId) return;

        const cacheIndex = threadCachedRef.current.findIndex(m => m.message_id === topMsgId);

        if (cacheIndex > 0) {
            const newStartIndex = Math.max(0, cacheIndex - 20);
            const newSlice = threadCachedRef.current.slice(newStartIndex, newStartIndex + MAX_DOM_MESSAGE);
            captureSnapshot(currentMsgs[0]);
            setThreadMessages(newSlice);
        } else if (threadHasOlderRef.current) {
            setIsThreadLoading(true);
            captureSnapshot(currentMsgs[0]);
            vscode.postMessage({
                command: 'getThreadMessages',
                threadId: activeThreadParent.message_id,
                limit: FETCH_LIMIT,
                anchorId: topMsgId,
                direction: 'before',
                intent: 'paginate-older'
            });
        }
    };

    const handleLoadNewerThread = () => {
        if (isThreadLoadingRef.current) return;

        const currentMsgs = threadMessagesRef.current;
        const bottomMsgId = currentMsgs[currentMsgs.length - 1]?.message_id;
        if (!bottomMsgId) return;

        const cacheIndex = threadCachedRef.current.findIndex(m => m.message_id === bottomMsgId);

        if (cacheIndex !== -1 && cacheIndex < threadCachedRef.current.length - 1) {
            const newEndIndex = Math.min(threadCachedRef.current.length, cacheIndex + 21);
            const newStartIndex = Math.max(0, newEndIndex - MAX_DOM_MESSAGE);
            const newSlice = threadCachedRef.current.slice(newStartIndex, newEndIndex);
            captureSnapshot(newSlice[0]);
            setThreadMessages(newSlice);
        } else if (threadHasNewerRef.current) {
            setIsThreadLoading(true);
            vscode.postMessage({
                command: 'getThreadMessages',
                threadId: activeThreadParent.message_id,
                limit: FETCH_LIMIT,
                anchorId: bottomMsgId,
                direction: 'after',
                intent: 'paginate-newer'
            });
        }
    };

    const handleLoadOlderThreadRef = useRef(handleLoadOlderThread);
    const handleLoadNewerThreadRef = useRef(handleLoadNewerThread);
    handleLoadOlderThreadRef.current = handleLoadOlderThread;
    handleLoadNewerThreadRef.current = handleLoadNewerThread;

    useEffect(() => {
        if (threadMessages.length === 0) return;
        if (!messageListRef.current || !topSentinelRef.current || !bottomSentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries: IntersectionObserverEntry[]) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    if (isInitialLoadRef.current || shouldScrollToBottomRef.current) return;

                    if (entry.target === topSentinelRef.current) {
                        if (!isThreadLoadingRef.current) handleLoadOlderThreadRef.current();
                    } else if (entry.target === bottomSentinelRef.current) {
                        if (!isThreadLoadingRef.current) handleLoadNewerThreadRef.current();
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
    }, [threadMessages.length > 0]);

    const handleQuoteClick = (messageId: string) => {
        const node = messageListRef.current?.querySelector(`[data-id="${messageId}"]`);
        if (node) {
            node.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setHighlightedMessageId(messageId);
            return;
        }

        const cacheIndex = threadCachedRef.current.findIndex(m => m.message_id === messageId);

        if (cacheIndex !== -1) {
            const half = Math.floor(MAX_DOM_MESSAGE / 2);
            const start = Math.max(0, cacheIndex - half);
            const end = Math.min(threadCachedRef.current.length, start + MAX_DOM_MESSAGE);
            const newSlice = threadCachedRef.current.slice(start, end);

            setThreadMessages(newSlice);
            setThreadHasOlder(true);
            setThreadHasNewer(true);
            setUnreadCount(0);
            jumpRequestRef.current = messageId;
            return;
        }

        setIsThreadLoading(true);
        vscode.postMessage({
            command: 'getThreadMessages',
            threadId: activeThreadParent.message_id,
            limit: FETCH_LIMIT,
            anchorId: messageId,
            direction: 'around',
            intent: 'jump-to-message'
        });
    };

    const handleJumpToBottom = () => {
        if (threadHasNewer) {
            setIsThreadLoading(true);
            vscode.postMessage({
                command: 'getThreadMessages',
                threadId: activeThreadParent.message_id,
                limit: FETCH_LIMIT,
                intent: 'jump-to-bottom'
            });
            return;
        }

        const cachedLen = threadCachedRef.current.length;
        const currentLen = threadMessagesRef.current.length;
        const lastCachedMsg = threadCachedRef.current[cachedLen - 1];
        const lastRenderedMsg = threadMessagesRef.current[currentLen - 1];

        if (lastCachedMsg && lastRenderedMsg && lastCachedMsg.message_id === lastRenderedMsg.message_id) {
            scrollToBottom('auto');
            setUnreadCount(0);
            return;
        }

        const newSlice = threadCachedRef.current.slice(-MAX_DOM_MESSAGE);
        shouldScrollToBottomRef.current = true;
        setUnreadCount(0);
        setThreadMessages(newSlice);
    };

    const onScroll = () => {
        if (!messageListRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isAtBottom = distanceFromBottom < 50;
        isAtBottomRef.current = isAtBottom;

        setShowScrollButton(distanceFromBottom > SCROLL_THRESHOLD);

        if (isAtBottom && unreadCount > 0) setUnreadCount(0);
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'loadThreadMessages': {
                    if (message.error) {
                        setIsThreadLoading(false);
                        break;
                    }
                    threadCachedRef.current = message.messages;
                    onCacheMessages(message.messages);
                    setThreadMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setThreadHasOlder(message.messages.length >= FETCH_LIMIT);
                    setThreadHasNewer(false);
                    setIsThreadLoading(false);
                    isInitialLoadRef.current = true;
                    shouldScrollToBottomRef.current = true;
                    break;
                }

                case 'prependThreadMessages': {
                    if (message.error) {
                        setIsThreadLoading(false);
                        setThreadHasOlder(false);
                        break;
                    }
                    const olderMsgs = message.messages;
                    const uniqueOlder = olderMsgs.filter((m: MessageResponse) =>
                        !threadCachedRef.current.some(e => e.message_id === m.message_id)
                    );
                    if (uniqueOlder.length === 0) {
                        setIsThreadLoading(false);
                        if (olderMsgs.length < FETCH_LIMIT) setThreadHasOlder(false);
                        break;
                    }
                    threadCachedRef.current = [...uniqueOlder, ...threadCachedRef.current];
                    onCacheMessages(threadCachedRef.current);
                    setThreadMessages(prev => {
                        const combined = [...uniqueOlder, ...prev];
                        return combined.length > MAX_DOM_MESSAGE ? combined.slice(0, MAX_DOM_MESSAGE) : combined;
                    });
                    setThreadHasOlder(olderMsgs.length >= FETCH_LIMIT);
                    setIsThreadLoading(false);
                    break;
                }

                case 'appendThreadMessagesBatch': {
                    if (message.error) {
                        setIsThreadLoading(false);
                        setThreadHasNewer(false);
                        break;
                    }
                    const newerMsgs = message.messages;
                    const uniqueNewer = newerMsgs.filter((m: MessageResponse) =>
                        !threadCachedRef.current.some(e => e.message_id === m.message_id)
                    );
                    if (uniqueNewer.length === 0) {
                        setIsThreadLoading(false);
                        setThreadHasNewer(false);
                        break;
                    }
                    const lastVisible = threadMessagesRef.current[threadMessagesRef.current.length - 1];
                    if (lastVisible && messageListRef.current) {
                        const node = messageListRef.current.querySelector(`[data-id="${lastVisible.message_id}"]`) as HTMLElement;
                        if (node) {
                            snapshotRef.current = {
                                id: lastVisible.message_id,
                                rect: node.getBoundingClientRect(),
                                scrollTop: messageListRef.current.scrollTop
                            };
                        }
                    }
                    threadCachedRef.current = [...threadCachedRef.current, ...uniqueNewer];
                    onCacheMessages(threadCachedRef.current);
                    setThreadMessages(prev => {
                        const combined = [...prev, ...uniqueNewer];
                        return combined.length > MAX_DOM_MESSAGE ? combined.slice(-MAX_DOM_MESSAGE) : combined;
                    });
                    setThreadHasNewer(newerMsgs.length >= FETCH_LIMIT);
                    setIsThreadLoading(false);
                    break;
                }

                case 'jumpThreadToBottom': {
                    if (message.error) {
                        setIsThreadLoading(false);
                        break;
                    }
                    threadCachedRef.current = message.messages;
                    onCacheMessages(message.messages);
                    setThreadMessages(message.messages.slice(-MAX_DOM_MESSAGE));
                    setThreadHasOlder(message.messages.length >= FETCH_LIMIT);
                    setThreadHasNewer(false);
                    setIsThreadLoading(false);
                    shouldScrollToBottomRef.current = true;
                    break;
                }

                case 'jumpThreadToMessage': {
                    if (message.error) {
                        setIsThreadLoading(false);
                        break;
                    }
                    const targetId = message.targetId;
                    if (message.messages) {
                        threadCachedRef.current = message.messages;
                        onCacheMessages(message.messages);
                        setThreadMessages(message.messages);
                        setThreadHasOlder(true);
                        setThreadHasNewer(true);
                        setIsThreadLoading(false);
                        jumpRequestRef.current = targetId;
                        break;
                    }
                    const cacheIdx = threadCachedRef.current.findIndex(m => m.message_id === targetId);
                    if (cacheIdx !== -1) {
                        const half = Math.floor(MAX_DOM_MESSAGE / 2);
                        const s = Math.max(0, cacheIdx - half);
                        const e = Math.min(threadCachedRef.current.length, s + MAX_DOM_MESSAGE);
                        setThreadMessages(threadCachedRef.current.slice(s, e));
                        setThreadHasOlder(true);
                        setThreadHasNewer(true);
                        jumpRequestRef.current = targetId;
                    } else {
                        setIsThreadLoading(true);
                        vscode.postMessage({
                            command: 'getThreadMessages',
                            threadId: activeThreadParent.message_id,
                            limit: FETCH_LIMIT,
                            anchorId: targetId,
                            direction: 'around',
                            intent: 'jump-to-message'
                        });
                    }
                    break;
                }

                case 'appendMessage': {
                    const msg = message.message;
                    const isThreadReply = !!msg.parent_id;
                    const isActiveThreadReply = msg.parent_id === activeThreadParent.message_id;

                    if (isThreadReply && isActiveThreadReply) {
                        if (threadCachedRef.current.some(m => m.message_id === msg.message_id)) return;
                        
                        const isAtBottom = isAtBottomRef.current;
                        const isMyMessage = msg.userType === 'me';
                        
                        threadCachedRef.current = [...threadCachedRef.current, msg];
                        onCacheMessages(threadCachedRef.current);
                        
                        if (isAtBottom || isMyMessage) {
                            setThreadMessages(prev => {
                                if (prev.some(m => m.message_id === msg.message_id)) return prev;
                                const next = [...prev, msg];
                                return next.length > MAX_DOM_MESSAGE ? next.slice(-MAX_DOM_MESSAGE) : next;
                            });
                            shouldScrollToBottomRef.current = true;
                            isAtBottomRef.current = true;
                        } else {
                            setUnreadCount(prev => prev + 1);
                        }
                    }
                    break;
                }
            }
        };

        window.addEventListener('message', handleMessage);

        const cached = initialMessages;
        if (cached && cached.length > 0) {
            threadCachedRef.current = cached;
            setThreadMessages(cached.slice(-MAX_DOM_MESSAGE));
            setThreadHasOlder(cached.length >= FETCH_LIMIT);
            setThreadHasNewer(false);
            setIsThreadLoading(false);
            isInitialLoadRef.current = true;
            shouldScrollToBottomRef.current = true;
            if (highlightedMessageId && highlightedMessageId !== activeThreadParent.message_id) {
                jumpRequestRef.current = highlightedMessageId;
            }
        } else {
            setIsThreadLoading(true);
            if (highlightedMessageId && highlightedMessageId !== activeThreadParent.message_id) {
                vscode.postMessage({
                    command: 'getThreadMessages',
                    threadId: activeThreadParent.message_id,
                    limit: FETCH_LIMIT,
                    anchorId: highlightedMessageId,
                    direction: 'around',
                    intent: 'jump-to-message'
                });
            } else {
                vscode.postMessage({
                    command: 'getThreadMessages',
                    threadId: activeThreadParent.message_id,
                    limit: FETCH_LIMIT,
                    intent: 'initial'
                });
            }
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [activeThreadParent.message_id]);

    return (
        <>
            <div class={styles['thread-nav-header']}>
                <span class={styles['thread-back-link']} onClick={onClose}>
                    <svg class={styles['back-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                </span>
            </div>

            <div class={styles['message-list']} ref={messageListRef} onScroll={onScroll}>
                <div ref={topSentinelRef} style={{ height: threadHasOlder ? '40px' : '0px', width: '100%' }} />
                {isThreadLoading && <LoadingSpinner />}

                <MessageRow
                    message={activeThreadParent}
                    onOpenSnippet={onOpenSnippet}
                    onReply={handleReply}
                    onQuoteClick={handleQuoteClick}
                    isThreadView={true}
                />
                {threadMessages.map((msg) => (
                    <MessageRow
                        message={msg}
                        key={msg.message_id}
                        onOpenSnippet={onOpenSnippet}
                        isHighlighted={msg.message_id === highlightedMessageId}
                        onReply={handleReply}
                        onQuoteClick={handleQuoteClick}
                        isThreadView={true}
                    />
                ))}

                <div ref={bottomSentinelRef} style={{ height: threadHasNewer ? '40px' : '0px', width: '100%' }} />
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
    );
};