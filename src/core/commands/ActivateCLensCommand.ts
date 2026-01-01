import * as vscode from 'vscode';


export const activateCLensCommand = async () => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', true);
};  

export const deactivateCLensCommand = async () => {
    await vscode.commands.executeCommand('setContext', 'linebuzz.isCLensActive', false);
};