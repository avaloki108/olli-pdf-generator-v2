// Polyfill for global variable in browser/Electron renderer
if (typeof global === 'undefined') {
  window.global = window;
}

export {};
