import * as vscode from 'vscode';
import { Container } from '../services/ServiceContainer';
import { CodeLensProvider } from '../providers/CodeLensProvider';

export const activateCLensCommand = async (codeLensProvider: CodeLensProvider) => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', true);
    Container.get('ContextLensService').toggleCodeLens(true);
    codeLensProvider.refresh();
};  

export const deactivateCLensCommand = async (codeLensProvider: CodeLensProvider) => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', false);
    Container.get('ContextLensService').toggleCodeLens(false);
    codeLensProvider.refresh();
};