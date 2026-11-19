const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aiboxAI", {
  connect: (providerId) => ipcRenderer.invoke("aibox:ai:connect", providerId),
  generate: (prompt) => ipcRenderer.invoke("aibox:ai:generate", prompt),
  interrupt: () => ipcRenderer.invoke("aibox:ai:interrupt"),
});
