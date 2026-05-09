import * as vscode from "vscode";

export interface QuickPickOption {
    label: string;
    description?: string;
    detail?: string;
    data?: any;
}

export class QuickPick {
    public static async showQuickPick(options: QuickPickOption[], placeholder?: string): Promise<QuickPickOption | undefined> {
        const items = options.map(option => ({
            label: option.label,
            description: option.description,
            detail: option.detail,
            data: option.data
        }));

        return await vscode.window.showQuickPick(items, {
            placeHolder: placeholder,
            ignoreFocusOut: true
        });
    }
}
