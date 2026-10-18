const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petMarket", {
  getCatalog: () => ipcRenderer.invoke("market:get-catalog"),
  getArtwork: (id) => ipcRenderer.invoke("market:artwork", id),
  select: (id) => ipcRenderer.invoke("market:select", id),
  importPet: () => ipcRenderer.invoke("market:import"),
  removePet: (id) => ipcRenderer.invoke("market:remove", id),
  renamePet: (id, name) => ipcRenderer.invoke("market:rename", id, name),
  onCatalog: (callback) => {
    const listener = (_event, catalog) => callback(catalog);
    ipcRenderer.on("market:catalog", listener);
    return () => ipcRenderer.off("market:catalog", listener);
  },
});
