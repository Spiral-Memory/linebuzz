import * as vscode from 'vscode';
import { ContextLensService } from '../services/ContextLensService';

export class CodeLensProvider implements vscode.CodeLensProvider {

    constructor(private service: ContextLensService) { }

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        return this.service.getCodeLenses(document);
    }
}