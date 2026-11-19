# Legacy AIBOX Browser Bridge

The Windows game no longer needs this script. The installer now opens provider websites inside Electron using the app's built-in Chromium and Node runtime. Players do not install Node.js, clone the repository, run PowerShell or copy pairing tokens.

This folder is retained temporarily as a developer-only experiment for the old Vite/browser workflow. It is not packaged into the Windows installer. New gameplay and AI integration should target the Electron IPC interface and the native Godot project, not this bridge.

Provider usage limits, sign-in requirements and website terms still apply.
