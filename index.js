require('dotenv').config();
const { initializeOpenTelemetry } = require('./opentelemetry');

initializeOpenTelemetry().then(async () => {
	const { startServer } = require('./server');
	await startServer();
});
