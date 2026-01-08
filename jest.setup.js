if (typeof BigInt === 'function') {
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}
