// The MCP SDK attaches process-level listeners (uncaughtException,
// unhandledRejection) per server/transport connection. In the test suite
// multiple connections are created, which triggers MaxListenersExceededWarning.
process.setMaxListeners(20);
