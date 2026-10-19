import { ExtensionContext } from '@earendil-works/pi-coding-agent';

export default function activate(ctx: ExtensionContext) {
    ctx.registerCommand('telegram', {
        description: 'Manage the Telegram bot bridge',
        async run(args) {
            const subCommand = args[0];
            if (subCommand === 'start') {
                ctx.ui.notify('Starting Telegram Bot bridge...');
                // Logic to spawn the bot process
            } else if (subCommand === 'setup') {
                ctx.ui.notify('Use "pi config" to set telegram.botToken and telegram.authorizedUser');
            } else {
                ctx.ui.notify('Usage: /telegram <start|setup>');
            }
        }
    });

    ctx.registerSetting('telegram.botToken', {
        type: 'string',
        description: 'Telegram Bot API Token',
        secret: true
    });

    ctx.registerSetting('telegram.authorizedUser', {
        type: 'number',
        description: 'Telegram User ID authorized to use the bot'
    });

    ctx.registerSetting('telegram.sttUrl', {
        type: 'string',
        description: 'Local STT Gateway URL',
        default: 'http://127.0.0.1:8084/v1/audio/transcriptions'
    });
}
