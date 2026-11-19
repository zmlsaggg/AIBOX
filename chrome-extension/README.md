# AIBOX Chrome Session Connector

This unpacked Chrome extension lets AIBOX work in your **normal Chrome profile**. It does not launch a private Chromium window, create a separate browser profile, copy cookies, or ask you to sign in again in an AIBOX-owned browser.

## One-time installation

1. In AIBOX, click **INSTALL CHROME CONNECTOR**. The app copies this extension to its user-data folder.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder path shown by AIBOX.
5. Open ChatGPT, DeepSeek, Qwen, Gemini or Claude in your usual Chrome profile and sign in normally.

After that, AIBOX opens the selected provider in Chrome and uses the session from that same profile. Existing cookies stay in Chrome; AIBOX does not read or export the Chrome cookie database.

## Local development

Load this folder directly using **Load unpacked**. The extension ID is pinned by the public key in `manifest.json`, so it matches the local bridge allowlist in Electron.

The connector only communicates with the AIBOX process on `127.0.0.1:3210` and the five provider sites listed in the manifest. It is not a general-purpose page scraper.

Provider sites may change their DOM, require a fresh login, or enforce their own rate limits. An expired session must be renewed by signing in to the provider in Chrome.
