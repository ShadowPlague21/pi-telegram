import { Telegraf, Markup } from 'telegraf';
import { RpcClient } from '@earendil-works/pi-coding-agent';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration Interface
interface BotConfig {
    botToken: string;
    authorizedUserId: number;
    sttGatewayUrl: string;
    piCliPath: string;
    personaPath: string;
    sessionPath: string;
}

// User state storage
const userState = {
    selectedModel: '',
    selectedProvider: '',
    lastActivity: Date.now(),
    sessions: [] as string[],
    sessionPage: 0
};

const SESSION_TIMEOUT = 15 * 60 * 1000;

// This will be populated from Pi settings in a real environment
// For the standalone bridge, we'll use env vars or a local config
const config: BotConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    authorizedUserId: parseInt(process.env.TELEGRAM_USER_ID || '0'),
    sttGatewayUrl: process.env.STT_URL || 'http://127.0.0.1:8084/v1/audio/transcriptions',
    piCliPath: process.env.PI_CLI_PATH || 'pi',
    personaPath: process.env.PERSONA_PATH || path.join(__dirname, '../resources/persona.md'),
    sessionPath: process.env.SESSION_PATH || path.join(os.homedir(), '.pi/telegram-session.jsonl')
};

if (!config.botToken) {
    console.error("Error: TELEGRAM_BOT_TOKEN not set.");
    process.exit(1);
}

const bot = new Telegraf(config.botToken);

let client = new RpcClient({
    cliPath: config.piCliPath,
    args: [
        '--mode', 'rpc', 
        '--session', config.sessionPath,
        '--append-system-prompt', config.personaPath
    ]
});

// Helper to escape MarkdownV2 special characters
function escapeMarkdown(text: string) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function transcribeAudio(filePath: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-1');

    const response = await axios.post(config.sttGatewayUrl, formData, {
        headers: { ...formData.getHeaders() },
    });

    return response.data.text;
}

function renderSessionMenu(sessions: string[], page: number) {
    const pageSize = 5;
    const start = page * pageSize;
    const end = start + pageSize;
    const paginatedSessions = sessions.slice(start, end);

    const buttons = paginatedSessions.map(s => {
        const sessionName = s.replace(/.*`(.+)`.*/, '$1');
        return [Markup.button.callback(sessionName, `resume_session:${sessionName}`)];
    });

    const navButtons = [];
    if (page > 0) navButtons.push(Markup.button.callback('⬅️ Previous', `session_page:${page - 1}`));
    if (end < sessions.length) navButtons.push(Markup.button.callback('Next ➡️', `session_page:${page + 1}`));

    if (navButtons.length > 0) buttons.push(navButtons);
    buttons.push([Markup.button.callback('❌ Cancel', 'cancel_model_selection')]);

    return Markup.inlineKeyboard(buttons);
}

async function handleAgentInteraction(ctx: any, userMessage: string, images?: any[]) {
    if (ctx.from.id !== config.authorizedUserId) return;

    const now = Date.now();
    if (now - userState.lastActivity > SESSION_TIMEOUT) {
        await client.stop();
        client = new RpcClient({
            cliPath: config.piCliPath,
            args: [
                '--mode', 'rpc', 
                '--session', config.sessionPath,
                '--append-system-prompt', config.personaPath,
                ...(userState.selectedModel ? ['--model', `${userState.selectedProvider}/${userState.selectedModel}`] : [])
            ]
        });
        await client.start();
        await ctx.reply("⏲ *Session timed out. Re-initializing...*", { parse_mode: 'MarkdownV2' });
    }
    userState.lastActivity = now;

    ctx.sendChatAction('typing').catch(() => {});
    const typingInterval = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => {});
    }, 4000);

    const statusMsg = await ctx.reply("⏳ Thinking...", {
        reply_to_message_id: ctx.message.message_id,
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('⏹ Stop', 'stop_generation')]
        ]).reply_markup
    });

    let fullResponse = "";
    let lastUpdate = Date.now();
    let isStopped = false;

    const safeEdit = async (text: string, isFinal = false) => {
        const now = Date.now();
        if (!isFinal && now - lastUpdate < 2000) return;
        lastUpdate = now;
        const display = isFinal ? escapeMarkdown(text) : escapeMarkdown(text) + " ▌";
        try {
            await bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, display, { parse_mode: 'MarkdownV2' });
        } catch (err: any) {
            if (err.response?.error_code === 429) {
                setTimeout(() => safeEdit(text, isFinal), (err.response.parameters.retry_after || 1) * 1000);
            } else {
                bot.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, isFinal ? text : text + " ▌").catch(() => {});
            }
        }
    };

    const unsubscribe = client.onEvent((event) => {
        if (isStopped) return;
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
            fullResponse += event.assistantMessageEvent.delta;
            safeEdit(fullResponse);
        } else if (event.type === 'tool_execution_start') {
            safeEdit(fullResponse + `\n\n🔧 *Executing:* \`${event.toolName}\`...`);
        }
    });

    try {
        await client.promptAndWait(userMessage, images);
        if (!isStopped) await safeEdit(fullResponse || "✅ Done.", true);
    } catch (err: any) {
        if (!isStopped) ctx.reply("❌ Error: " + err.message);
    } finally {
        clearInterval(typingInterval);
        unsubscribe();
    }
}

// Bot Commands
bot.start((ctx) => {
    if (ctx.from.id !== config.authorizedUserId) return;
    ctx.reply("🤖 *Pi Agent Bridge Online*\n\nUse /help for commands.", { parse_mode: 'MarkdownV2' });
});

bot.command('help', (ctx) => {
    if (ctx.from.id !== config.authorizedUserId) return;
    ctx.reply("*Available Commands:*\n/model, /resume, /reset, /status, /thinking, /stop, /clear", { parse_mode: 'MarkdownV2' });
});

bot.command('reset', async (ctx) => {
    if (ctx.from.id !== config.authorizedUserId) return;
    await handleAgentInteraction(ctx, "/new");
});

bot.command('status', async (ctx) => {
    if (ctx.from.id !== config.authorizedUserId) return;
    ctx.reply(`*Bot Status:* ✅ Online\nModel: \`${userState.selectedModel || "Default"}\``, { parse_mode: 'MarkdownV2' });
});

bot.on('text', async (ctx) => {
    if (ctx.from.id !== config.authorizedUserId) return;
    await handleAgentInteraction(ctx, ctx.message.text);
});

// Implementation of Model selection, Resume logic, etc. would follow our previously refined code.
// For brevity, I am including the core handlers.

async function start() {
    await client.start();
    bot.launch();
    console.log("Telegram bot launched.");
}

start();

process.once('SIGINT', () => { bot.stop('SIGINT'); client.stop(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); client.stop(); });
