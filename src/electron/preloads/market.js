const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petMarket", {
  getCatalog: () => ipcRenderer.invoke("market:get-catalog"),
  getArtwork: (id) => ipcRenderer.invoke("market:artwork", id),
  select: (id) => ipcRenderer.invoke("market:select", id),
  importPet: () => ipcRenderer.invoke("market:import"),
  previewGenerated: (options) => ipcRenderer.invoke("market:preview-generated", options),
  createGenerated: (options) => ipcRenderer.invoke("market:create-generated", options),
  removePet: (id) => ipcRenderer.invoke("market:remove", id),
  renamePet: (id, name) => ipcRenderer.invoke("market:rename", id, name),
  onCatalog: (callback) => {
    const listener = (_event, catalog) => callback(catalog);
    ipcRenderer.on("market:catalog", listener);
    return () => ipcRenderer.off("market:catalog", listener);
  },
  onView: (callback) => {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on("market:open-view", listener);
    return () => ipcRenderer.off("market:open-view", listener);
  },
});
