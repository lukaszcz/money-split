if (typeof BigInt === 'function') {
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}

global.__DEV__ = true;

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('react-test-renderer is deprecated')
  ) {
    return;
  }
  originalConsoleError(...args);
};
