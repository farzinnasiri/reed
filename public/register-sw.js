// Keep development hot reload outside the worker. Only exported production HTML has this script.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Installation is optional; a worker failure must not block the app.
    });
  });
}
