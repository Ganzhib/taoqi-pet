const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taoqiHome", {
  getState: () => ipcRenderer.invoke("home:get-state"),
  getArtwork: (id) => ipcRenderer.invoke("pet:get-artwork", id),
  setTheme: (id) => ipcRenderer.invoke("home:set-theme", id),
  setFurniture: (id) => ipcRenderer.invoke("home:set-furniture", id),
  saveScore: (score) => ipcRenderer.invoke("home:save-score", score),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("home:state", listener);
    return () => ipcRenderer.off("home:state", listener);
  },
});
