const { NodeSDK } = require('@opentelemetry/sdk-node')
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { BatchSpanProcessor, SamplingDecision } = require('@opentelemetry/sdk-trace-base')
const { trace } = require('@opentelemetry/api')
const { Resource } = require('@opentelemetry/resources')
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, } = require('@opentelemetry/semantic-conventions')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

const exporter = new OTLPTraceExporter({
  timeoutMillis: 2000,
})

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-net': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-dns': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-http': {
      enabled: true,
    },
  })],
  spanProcessors: [new BatchSpanProcessor(exporter)],
  sampler: {
    shouldSample: (context, traceId, spanName, spanKind, attributes, links) => {
      const isChecklySpan = trace.getSpan(context)?.spanContext()?.traceState?.get('checkly')
      if (isChecklySpan) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED }
      } else {
        return { decision: SamplingDecision.NOT_RECORD }
      }
    },
  },
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'dice-server',
    [SEMRESATTRS_SERVICE_VERSION]: '0.1.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `http://${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
        url: `http://${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
      }),
  })
})

sdk.start()

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OTel Tracing terminated'))
    .catch((error) => console.log('Error terminating OTel tracing', error))
    .finally(() => process.exit(0))
})