Object.defineProperty(window, 'TestAPI', {
  configurable: true,
  get() { return !!window.__sfls_test_api; },
  set(v) { 
    window.__sfls_test_api = v; 
    if(v) window.postMessage({ type: 'SFLS_SHOW_TEST_API' }, window.location.origin);
  }
});
