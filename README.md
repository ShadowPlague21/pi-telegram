# 🤖 Pi Agent Telegram Bridge

A robust, feature-rich Telegram bot bridge for the **Pi Coding Agent**. Transform your Telegram chat into a powerful remote terminal for your AI agent with support for Voice, Vision, and custom Personas.

---

## ✨ Features

- ⚡ **Real-time Streaming:** Smooth, throttled message updates that respect Telegram's rate limits.
- 🎤 **Voice Support (STT):** Send voice notes to your agent via local STT Gateway integration.
- 📸 **Vision Support:** Send images (with or without captions) for the agent to analyze.
- 🎭 **Custom Personas:** Inject any personality into your agent using Markdown-based persona files.
- 🧠 **Thinking Control:** Dynamically adjust reasoning levels (Off, Low, Medium, High, etc.) via `/thinking`.
- 🧬 **Model & Provider Management:** Switch between providers (Gemini, NVIDIA, xAI, etc.) and specific models on the fly with a clean UI.
- 🕰 **Session Management:**
  - **Pagination:** View and resume previous sessions with an interactive paged menu.
  - **Isolation:** Dedicated session history for Telegram, separate from your terminal work.
  - **Auto-Timeout:** Automatically starts a fresh session after 15 minutes of inactivity.
- ⏹ **Hard Abort:** Stop the agent immediately mid-task with the `/stop` command.

---

## 🚀 Installation

Install the package directly into your Pi Agent environment:

```bash
pi install git:github.com/ShadowPlague21/pi-telegram
```

---

## ⚙️ Configuration

Before launching, you must configure your Bot Token and Authorized User ID.

1. **Set your Telegram Bot Token:**
   ```bash
   pi config set telegram.botToken "YOUR_BOT_TOKEN"
   ```

2. **Set your Authorized User ID (to prevent others from using your bot):**
   ```bash
   pi config set telegram.authorizedUser 123456789
   ```

3. **(Optional) Set STT Gateway URL:**
   ```bash
   pi config set telegram.sttUrl "http://localhost:8084/v1/audio/transcriptions"
   ```

---

## 🎮 Usage

Once configured, you can start the bridge:

```bash
/telegram start
```

### Available Commands (within Telegram)

| Command | Description |
| :--- | :--- |
| `/start` | Welcome message and initial check. |
| `/help` | List all available bot commands. |
| `/model` | Open the Provider/Model selection menu. |
| `/resume` | Browse and resume previous agent sessions (Paginated). |
| `/reset` | Clear the current conversation and start fresh. |
| `/status` | Check connectivity and current model/thinking level. |
| `/thinking`| Adjust the agent's reasoning depth. |
| `/stop` | Kill the current process and abort generation. |
| `/clear` | Wipe the message queue and re-initialize the client. |

---

## 🎭 Persona Customization

By default, the bot includes a high-quality persona based on **Narberal Gamma** (Battle Maid of the Pleiades), dedicated to serving the Supreme Being of **Redpill Infra**.

To use your own persona, create a `.md` file and update your config:
```bash
pi config set telegram.personaPath "/path/to/your/persona.md"
```

---

## 🛡️ Security

This bridge runs with the full permissions of the user who started the Pi Agent. **Always keep your Bot Token secret and ensure only your User ID is authorized.**

---

## 📄 License

MIT © [ShadowPlague21](https://github.com/ShadowPlague21)
