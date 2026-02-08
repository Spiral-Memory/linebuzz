import * as vscode from 'vscode';

export class ReadOnlyContentProvider implements vscode.TextDocumentContentProvider {
    static scheme = 'linebuzz-readonly';
    private static _contentMap = new Map<string, string>();
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return ReadOnlyContentProvider._contentMap.get(uri.path) || '';
    }

    static registerContent(path: string, content: string): vscode.Uri {
        this._contentMap.set(path, content);
        return vscode.Uri.from({ scheme: this.scheme, path });
    }
}
