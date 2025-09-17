import { contextBridge, ipcRenderer } from 'electron';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app-version'),
  getName: () => ipcRenderer.invoke('app-name'),
  getApiBaseUrl: () => ipcRenderer.invoke('get-api-base-url'),
  openWindow: (url: string) => ipcRenderer.invoke('open-win', url),
  
  // Platform info
  platform: process.platform,
  
  // IPC communication
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },
  
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  }
});

// Remove loading screen when page is ready
window.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = 'none';
  }
});

// Log when preload script is loaded
console.log('1SOLUTION Car Wash POS - Preload script loaded');

// Declare global types for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      getName: () => Promise<string>;
      getApiBaseUrl: () => Promise<string>;
      openWindow: (url: string) => void;
      platform: string;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}