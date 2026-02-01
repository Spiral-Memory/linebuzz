import { Snippet } from '../../../../types/IAttachment';
import { useState } from 'preact/hooks';
import hljs from 'highlight.js';
import { encode as htmlEncode } from 'he';
import dedent from 'dedent';

interface SnippetAttachmentProps {
    snippet: Snippet;
    onNavigate: (snippet: Snippet, requestId: string) => void;
}

export const SnippetAttachment = ({ snippet, onNavigate }: SnippetAttachmentProps) => {

    const _dedent = (text: string): string => {
        if (!text) return '';

        try {
            return dedent(text);
        } catch (error) {
            console.warn('SnippetAttachment', 'Dedent failed, falling back to raw text', error);
            return text;
        }
    }

    const snippetContent = _dedent(snippet.content);
    const [isLoading, setIsLoading] = useState(false);
    let highlightedText: string;
    const lang = snippet.file_path.split('.').pop() || 'text';

    try {
        if (lang && hljs.getLanguage(lang)) {
            highlightedText = hljs.highlight(snippetContent, { language: lang }).value;
        } else {
            highlightedText = htmlEncode(snippetContent);
        }
    } catch (e) {
        highlightedText = htmlEncode(snippetContent);
    }

    const handleClick = async (e: Event) => {
        const target = e.target as Element;
        if (target.closest('.copy-code-btn') || target.closest('.toggle-code-btn')) {
            return;
        }
        if (isLoading) return;

        setIsLoading(true);
        const requestId = Math.random().toString(36).substring(7);
        const safetyTimeout = setTimeout(() => {
            if (isLoading) setIsLoading(false);
        }, 5000);

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'openSnippetCompleted' && message.requestId === requestId) {
                clearTimeout(safetyTimeout);
                setIsLoading(false);
                window.removeEventListener('message', handleMessage);
            }
        };

        window.addEventListener('message', handleMessage);
        onNavigate(snippet, requestId);
    };

    return (
        <div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-metadata" onClick={handleClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} title="Jump to Source">
                    {isLoading && (
                        <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-opacity="0.3" stroke-width="3" fill="none" />
                            <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" />
                        </svg>
                    )}
                    {snippet.file_path.split('/').pop() || snippet.file_path}:{snippet.start_line}-{snippet.end_line}
                </span>
                <div class="header-actions">
                    <button
                        class="copy-code-btn"
                        aria-label="Copy code"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(snippetContent);
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.innerHTML = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M13.2929 4.29289C13.6834 4.68342 13.6834 5.31658 13.2929 5.70711L7.29289 11.7071C6.90237 12.0976 6.2692 12.0976 5.87868 11.7071L2.70711 8.53553C2.31658 8.14501 2.31658 7.51184 2.70711 7.12132C3.09763 6.7308 3.7308 6.7308 4.12132 7.12132L6.58579 9.58579L11.8787 4.29289C12.2692 3.90237 12.9024 3.90237 13.2929 4.29289Z" fill="currentColor"></path></svg>`;
                            setTimeout(() => {
                                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" ><path d="M6 11c0 -2.82843 0 -4.24264 0.87868 -5.12132C7.75736 5 9.17157 5 12 5h3c2.8284 0 4.2426 0 5.1213 0.87868C21 6.75736 21 8.17157 21 11v5c0 2.8284 0 4.2426 -0.8787 5.1213C19.2426 22 17.8284 22 15 22h-3c-2.82843 0 -4.24264 0 -5.12132 -0.8787C6 20.2426 6 18.8284 6 16v-5Z" stroke="currentColor" stroke-width="1.5"></path><path d="M6 19c-1.65685 0 -3 -1.3431 -3 -3v-6c0 -3.77124 0 -5.65685 1.17157 -6.82843C5.34315 2 7.22876 2 11 2h4c1.6569 0 3 1.34315 3 3" stroke="currentColor" stroke-width="1.5"></path></svg>`;
                            }, 2000);
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" >
                            <path d="M6 11c0 -2.82843 0 -4.24264 0.87868 -5.12132C7.75736 5 9.17157 5 12 5h3c2.8284 0 4.2426 0 5.1213 0.87868C21 6.75736 21 8.17157 21 11v5c0 2.8284 0 4.2426 -0.8787 5.1213C19.2426 22 17.8284 22 15 22h-3c-2.82843 0 -4.24264 0 -5.12132 -0.8787C6 20.2426 6 18.8284 6 16v-5Z" stroke="currentColor" stroke-width="1.5"></path>
                            <path d="M6 19c-1.65685 0 -3 -1.3431 -3 -3v-6c0 -3.77124 0 -5.65685 1.17157 -6.82843C5.34315 2 7.22876 2 11 2h4c1.6569 0 3 1.34315 3 3" stroke="currentColor" stroke-width="1.5"></path>
                        </svg>
                    </button>

                    <button
                        class="toggle-code-btn"
                        aria-label="Toggle code visibility"
                        onClick={(e) => {
                            e.stopPropagation();
                            const btn = e.currentTarget as HTMLButtonElement;
                            const wrapper = btn.closest('.code-block-wrapper');
                            if (wrapper) {
                                wrapper.classList.toggle('collapsed');
                                const isCollapsed = wrapper.classList.contains('collapsed');
                                btn.innerHTML = isCollapsed
                                    ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                                    : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                            }
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="code-block-content">
                <pre><code class={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: highlightedText }}></code></pre>
            </div>
        </div>
    );
};
