const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

// instrumentation libraries
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { MongooseInstrumentation } = require('@opentelemetry/instrumentation-mongoose');
const axios = require('axios');

const fetchInstanceId = async () => {
	let _instanceId;
	try {
		// Fetch the token
		const tokenResponse = await axios.put('http://169.254.169.254/latest/api/token', null, {
			headers: {
				'X-aws-ec2-metadata-token-ttl-seconds': '21600', // Set the token TTL (6 hours in this case)
			},
			timeout: 3000, // 3 seconds timeout
		});
		const token = tokenResponse.data;
		// Use the token to fetch instance ID
		const response = await axios.get('http://169.254.169.254/latest/meta-data/instance-id', {
			headers: {
				'X-aws-ec2-metadata-token': token,
			},
			timeout: 3000, // 3 seconds timeout
		});
		_instanceId = response.data;
	} catch (error) {
		console.error('Error retrieving instance ID:', error.message);
	}
	return _instanceId || 'localhost';
};

async function createTracerProvider() {
	const _instanceId = await fetchInstanceId();

	const provider = new NodeTracerProvider({
		resource: new Resource({
			[SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME,
			[SemanticResourceAttributes.SERVICE_INSTANCE_ID]: _instanceId,
		}),
	});

	return provider;
}

const initializeOpenTelemetry = async () => {
	try {
		const provider = await createTracerProvider();
		provider.register();
		provider.addSpanProcessor(
			new BatchSpanProcessor(
				new OTLPTraceExporter({
					url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
					headers: {
						'api-key': process.env.NEW_RELIC_LICENSE_KEY,
					},
				})
			)
		);
		registerInstrumentations({
			instrumentations: [
				getNodeAutoInstrumentations({
					// Some instrumentation is noisy and commonly not useful
					'@opentelemetry/instrumentation-fs': {
						enabled: false,
					},
					'@opentelemetry/instrumentation-net': {
						enabled: false,
					},
					'@opentelemetry/instrumentation-dns': {
						enabled: false,
					},
					'@opentelemetry/instrumentation-express': {
						enabled: false,
					},
				}),
				new MongooseInstrumentation({ suppressInternalInstrumentation: true }),
			],
		});
		console.log('OpenTelemetry initialized successfully');
	} catch (error) {
		console.error('Error initializing OpenTelemetry:', error);
	}
};

module.exports = {
	initializeOpenTelemetry,
};
