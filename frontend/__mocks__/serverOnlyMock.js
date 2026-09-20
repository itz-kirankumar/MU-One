// `server-only` throws by design outside a server bundle. Jest has no such
// bundler condition, so server modules are mapped past it to be unit-tested.
module.exports = {};
