export const logger = {
    debug: (context: string, message: string, ...args: any[]): void => {
        if (process.env.NODE_ENV !== 'production') {
            log('DEBUG', context, message, args);
        }
    },

    info: (context: string, message: string, ...args: any[]): void => {
        log('INFO', context, message, args);
    },

    warn: (context: string, message: string, ...args: any[]): void => {
        log('WARN', context, message, args);
    },

    error: (context: string, message: string, ...args: any[]): void => {
        log('ERROR', context, message, args);
    }
};

function log(level: string, context: string, message: string, args: any[]): void {
    const formattedMessage = `[LineBuzz] ${level} [${context}] ${message}`;

    if (args.length > 0) {
        console.log(formattedMessage, ...args);
    } else {
        console.log(formattedMessage);
    }
}
