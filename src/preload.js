const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taoqiPet", {
  getState: () => ipcRenderer.invoke("pet:get-state"),
  getArtwork: (id) => ipcRenderer.invoke("pet:get-artwork", id),
  showMenu: () => ipcRenderer.send("pet:show-menu"),
  dragStart: () => ipcRenderer.send("pet:drag-start"),
  dragMove: () => ipcRenderer.send("pet:drag-move"),
  dragEnd: () => ipcRenderer.send("pet:drag-end"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("pet:state", listener);
    return () => ipcRenderer.off("pet:state", listener);
  },
  onMotion: (callback) => {
    const listener = (_event, motion) => callback(motion);
    ipcRenderer.on("pet:motion", listener);
    return () => ipcRenderer.off("pet:motion", listener);
  },
  onAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on("pet:action", listener);
    return () => ipcRenderer.off("pet:action", listener);
  },
  onNotice: (callback) => {
    const listener = (_event, notice) => callback(notice);
    ipcRenderer.on("pet:notice", listener);
    return () => ipcRenderer.off("pet:notice", listener);
  },
});
