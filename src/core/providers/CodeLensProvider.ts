import * as vscode from 'vscode';
import { ContextLensService } from '../services/ContextLensService';

export class CodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private service: ContextLensService) { }

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        return this.service.getCodeLenses(document);
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}