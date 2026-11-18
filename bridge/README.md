# AIBOX Browser Bridge

A local Playwright companion that drives a visible, persistent Chromium profile. It uses the provider's normal website UI; no API keys are required.

## Setup

```powershell
cd bridge
npm install
npx playwright install chromium
npm start
```

Copy the pairing token printed in the terminal into AIBOX. The first launch opens Chromium; sign in to ChatGPT manually. Repeat with another provider from the in-game provider selector.

Supported initial targets: ChatGPT, DeepSeek, Qwen Chat, Gemini and Claude. Provider websites can change their DOM, so selectors may need maintenance.

## Safety and limits

- The bridge binds only to 127.0.0.1 and checks the browser game's origin.
- A random pairing token is required for every action except health status.
- Chromium uses a dedicated `~/.aibox/browser-profile`; it does not read your normal browser cookies.
- The bridge never reads passwords, cookies or local storage and does not solve CAPTCHAs.
- Website usage limits, account quotas, safety rules and provider policies still apply. Browser automation does not create unlimited access.
- Provider switching is manual. A refusal is a model response, not a technical error to route around.
- AI output remains untrusted text and is parsed by the game's allow-listed action parser.
