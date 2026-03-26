import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { useI18n } from "../i18n";

type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
type TargetStrategy = "failure_within_6_months" | "remaining_runtime_minutes";

type ModelResult = {
  modelName: string;
  metrics: Record<string, number | null>;
  trainSeconds?: number;
  topFeatures?: { feature: string; importance: number }[];
};

type AnalysisResult = {
  strategy: TargetStrategy;
  comparisonMetric: string;
  datasetSummary: {
    devicesRows: number;
    telemetryRows: number;
    serviceRows: number;
    masterRows: number;
    targetPositiveRate?: number;
    targetMean?: number;
    labelSource: string;
    datasetVersion: string;
  };
  trainingSpec: {
    datasetName: string;
    randomSeed: number;
    testSize: number;
    featureColumns: string[];
    categoricalFeatures: string[];
    numericFeatures: string[];
    modelNames: string[];
  };
  recommendedModel: {
    modelName: string;
    score: number;
  };
  modelResults: ModelResult[];
  warnings: string[];
  artifacts?: {
    summaryPath?: string;
    modelPath?: string | null;
  };
};

type AnalysisJob = {
  id: string;
  status: JobStatus;
  requestedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  input: {
    datasetName?: string;
    targetStrategy?: TargetStrategy;
    randomSeed?: number;
    testSize?: number;
    modelNames?: string[];
    deviceFileName?: string;
    telemetryFileName?: string;
    serviceFileName?: string;
    csvBytes?: {
      deviceCsv?: number;
      telemetryCsv?: number;
      serviceCsv?: number;
    };
  };
  result?: AnalysisResult;
};

export function PowerwatchAnalysisPanel() {
  const { locale, t } = useI18n();
  const targetOptions: { value: TargetStrategy; label: string; helper: string }[] = [
    {
      value: "failure_within_6_months",
      label: "failure_within_6_months",
      helper: t("powerwatchTargetFailureHelper")
    },
    {
      value: "remaining_runtime_minutes",
      label: "remaining_runtime_minutes",
      helper: t("powerwatchTargetRuntimeHelper")
    }
  ];
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState("PowerWatch demo import");
  const [targetStrategy, setTargetStrategy] = useState<TargetStrategy>("failure_within_6_months");
  const [randomSeed, setRandomSeed] = useState("42");
  const [testSize, setTestSize] = useState("0.2");
  const [deviceFile, setDeviceFile] = useState<File | null>(null);
  const [telemetryFile, setTelemetryFile] = useState<File | null>(null);
  const [serviceFile, setServiceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const refresh = async () => {
      try {
        const nextJobs = await apiGet<AnalysisJob[]>("/api/powerwatch/ml/jobs");
        if (disposed) return;
        setJobs(nextJobs);
        setSelectedJobId((current) => current ?? nextJobs[0]?.id ?? null);
      } catch (error) {
        if (!disposed) {
          setErr(String(error));
        }
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );

  async function submit() {
    if (!deviceFile || !telemetryFile) {
      setErr(t("powerwatchMissingFiles"));
      return;
    }

    setIsSubmitting(true);
    setErr(null);

    try {
      const [deviceCsv, telemetryCsv, serviceCsv] = await Promise.all([
        readFileAsText(deviceFile, t),
        readFileAsText(telemetryFile, t),
        serviceFile ? readFileAsText(serviceFile, t) : Promise.resolve(undefined)
      ]);

      const createdJob = await apiPost<AnalysisJob>("/api/powerwatch/ml/jobs", {
        datasetName,
        targetStrategy,
        randomSeed: Number(randomSeed),
        testSize: Number(testSize),
        deviceFileName: deviceFile.name,
        telemetryFileName: telemetryFile.name,
        serviceFileName: serviceFile?.name,
        deviceCsv,
        telemetryCsv,
        serviceCsv
      });

      setSelectedJobId(createdJob.id);
      setJobs((current) => [createdJob, ...current]);
    } catch (error) {
      setErr(String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {err && <InlineError text={err} />}

      <section className="card p-4 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-millet-text">{t("powerwatchTitle")}</h2>
          <p className="text-sm text-millet-muted">{t("powerwatchSubtitle")}</p>
        </div>

        <div className="rounded-xl border border-millet-border bg-millet-surface p-3 text-sm text-millet-muted">
          <div className="font-medium text-millet-text">{t("powerwatchArchitectureTitle")}</div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>{t("powerwatchArchitectureApi")}</li>
            <li>{t("powerwatchArchitectureWorker")}</li>
            <li>{t("powerwatchArchitectureUi")}</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-millet-text mb-1">{t("powerwatchDatasetName")}</div>
            <input className="input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm text-millet-text mb-1">{t("powerwatchTarget")}</div>
            <select
              className="input"
              value={targetStrategy}
              onChange={(event) => setTargetStrategy(event.target.value as TargetStrategy)}
            >
              {targetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-millet-muted">
              {targetOptions.find((option) => option.value === targetStrategy)?.helper}
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-millet-text mb-1">{t("powerwatchSeed")}</div>
            <input className="input" value={randomSeed} onChange={(event) => setRandomSeed(event.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm text-millet-text mb-1">{t("powerwatchTestSize")}</div>
            <input className="input" value={testSize} onChange={(event) => setTestSize(event.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FileField label={t("powerwatchDevicesCsv")} file={deviceFile} onChange={setDeviceFile} required />
          <FileField label={t("powerwatchTelemetryCsv")} file={telemetryFile} onChange={setTelemetryFile} required />
          <FileField label={t("powerwatchServiceCsv")} file={serviceFile} onChange={setServiceFile} />
        </div>

        <div className="rounded-xl border border-millet-border bg-white p-3 text-sm text-millet-muted">
          <div className="font-medium text-millet-text">{t("powerwatchDefaultModels")}</div>
          <div className="mt-1">
            {targetStrategy === "failure_within_6_months"
              ? t("powerwatchModelSetClassification")
              : t("powerwatchModelSetRegression")}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? t("powerwatchUploading") : t("powerwatchStartJob")}
          </button>
          <span className="text-xs text-millet-muted">{t("powerwatchUploadNote")}</span>
        </div>
      </section>

      <section className="card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-millet-text">{t("powerwatchRecentJobs")}</h3>
            <p className="text-sm text-millet-muted">{t("powerwatchRecentJobsSubtitle")}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm text-millet-text">
            <thead className="bg-millet-surface">
              <tr>
                <th className="text-left font-medium p-3">{t("time")}</th>
                <th className="text-left font-medium p-3">{t("powerwatchDataset")}</th>
                <th className="text-left font-medium p-3">{t("powerwatchTarget")}</th>
                <th className="text-left font-medium p-3">{t("status")}</th>
                <th className="text-left font-medium p-3">{t("powerwatchRecommendedModel")}</th>
                <th className="text-left font-medium p-3">{t("powerwatchScore")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={[
                    "border-t border-millet-border/70 cursor-pointer",
                    selectedJob?.id === job.id ? "bg-millet-surface/60" : ""
                  ].join(" ")}
                  onClick={() => setSelectedJobId(job.id)}
                >
                  <td className="p-3 whitespace-nowrap">{new Date(job.requestedAt).toLocaleString(locale)}</td>
                  <td className="p-3 whitespace-nowrap">{job.input.datasetName ?? "-"}</td>
                  <td className="p-3 whitespace-nowrap">{job.input.targetStrategy ?? "-"}</td>
                  <td className="p-3 whitespace-nowrap"><MlStatusBadge status={job.status} /></td>
                  <td className="p-3 whitespace-nowrap">{job.result?.recommendedModel.modelName ?? "-"}</td>
                  <td className="p-3 whitespace-nowrap">
                    {job.result ? formatMetric(job.result.recommendedModel.score) : "-"}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-millet-muted">
                    {t("powerwatchNoJobs")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedJob && (
        <section className="card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-millet-text">{selectedJob.input.datasetName ?? t("powerwatchLatestRun")}</h3>
              <p className="text-sm text-millet-muted">{selectedJob.id}</p>
            </div>
            <MlStatusBadge status={selectedJob.status} />
          </div>

          {selectedJob.errorMessage && <InlineError text={selectedJob.errorMessage} />}

          {selectedJob.result && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <SummaryCard label={t("powerwatchRows")} value={String(selectedJob.result.datasetSummary.masterRows)} />
                <SummaryCard label={t("powerwatchDatasetVersion")} value={selectedJob.result.datasetSummary.datasetVersion.slice(0, 12)} />
                <SummaryCard label={t("powerwatchComparisonMetric")} value={selectedJob.result.comparisonMetric} />
                <SummaryCard label={t("powerwatchRecommendedModel")} value={selectedJob.result.recommendedModel.modelName} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-millet-border p-3">
                  <div className="font-medium text-millet-text">{t("powerwatchDatasetSummary")}</div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <SummaryRow label={t("powerwatchDevicesRows")} value={selectedJob.result.datasetSummary.devicesRows} />
                    <SummaryRow label={t("powerwatchTelemetryRows")} value={selectedJob.result.datasetSummary.telemetryRows} />
                    <SummaryRow label={t("powerwatchServiceRows")} value={selectedJob.result.datasetSummary.serviceRows} />
                    <SummaryRow label={t("powerwatchLabelSource")} value={selectedJob.result.datasetSummary.labelSource} />
                    {selectedJob.result.strategy === "failure_within_6_months" && (
                      <SummaryRow
                        label={t("powerwatchPositiveRate")}
                        value={`${formatMetric(selectedJob.result.datasetSummary.targetPositiveRate ?? 0)} %`}
                      />
                    )}
                  </dl>
                </div>

                <div className="rounded-xl border border-millet-border p-3">
                  <div className="font-medium text-millet-text">{t("powerwatchReproducibility")}</div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <SummaryRow label={t("powerwatchSeed")} value={selectedJob.result.trainingSpec.randomSeed} />
                    <SummaryRow label={t("powerwatchTestSize")} value={selectedJob.result.trainingSpec.testSize} />
                    <SummaryRow label={t("powerwatchFeatureCount")} value={selectedJob.result.trainingSpec.featureColumns.length} />
                    <SummaryRow label={t("powerwatchModelCount")} value={selectedJob.result.trainingSpec.modelNames.length} />
                  </dl>
                </div>
              </div>

              <div className="rounded-xl border border-millet-border p-3 overflow-x-auto">
                <div className="font-medium text-millet-text mb-3">{t("powerwatchComparisonTable")}</div>
                <table className="min-w-[720px] w-full text-sm text-millet-text">
                  <thead className="bg-millet-surface">
                    <tr>
                      <th className="text-left font-medium p-3">{t("model")}</th>
                      <th className="text-left font-medium p-3">{t("powerwatchMetricOne")}</th>
                      <th className="text-left font-medium p-3">{t("powerwatchMetricTwo")}</th>
                      <th className="text-left font-medium p-3">{t("powerwatchMetricThree")}</th>
                      <th className="text-left font-medium p-3">{t("powerwatchTrainTime")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJob.result.modelResults.map((row) => {
                      const metricEntries = Object.entries(row.metrics);
                      return (
                        <tr key={row.modelName} className="border-t border-millet-border/70">
                          <td className="p-3 whitespace-nowrap font-medium">{row.modelName}</td>
                          <td className="p-3 whitespace-nowrap">{formatNamedMetric(metricEntries[0])}</td>
                          <td className="p-3 whitespace-nowrap">{formatNamedMetric(metricEntries[1])}</td>
                          <td className="p-3 whitespace-nowrap">{formatNamedMetric(metricEntries[2])}</td>
                          <td className="p-3 whitespace-nowrap">{formatMetric(row.trainSeconds ?? 0)} s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedJob.result.modelResults[0]?.topFeatures?.length ? (
                <div className="rounded-xl border border-millet-border p-3">
                  <div className="font-medium text-millet-text mb-2">{t("powerwatchTopFeatures")}</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.result.modelResults[0].topFeatures!.map((feature) => (
                      <span key={feature.feature} className="rounded-full border border-millet-border bg-millet-surface px-3 py-1 text-xs text-millet-text">
                        {feature.feature}: {formatMetric(feature.importance)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedJob.result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">{t("powerwatchWarnings")}</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {selectedJob.result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function FileField({
  label,
  file,
  onChange,
  required = false
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  const { t } = useI18n();

  return (
    <label className="block rounded-xl border border-millet-border p-3">
      <div className="text-sm text-millet-text mb-2">{label}</div>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="mt-2 text-xs text-millet-muted">
        {file ? file.name : required ? t("powerwatchRequiredCsv") : t("powerwatchOptionalCsv")}
      </div>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-millet-border bg-millet-surface p-3">
      <div className="text-xs uppercase tracking-wide text-millet-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-millet-text break-all">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-millet-muted">{label}</dt>
      <dd className="font-medium text-millet-text text-right">{value}</dd>
    </div>
  );
}

function InlineError({ text }: { text: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{text}</div>;
}

function MlStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useI18n();
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";

  if (status === "SUCCEEDED") {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>{t("jobSucceeded")}</span>;
  }
  if (status === "FAILED") {
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>{t("jobFailed")}</span>;
  }
  if (status === "RUNNING") {
    return <span className={`${base} border-yellow-300 bg-yellow-50 text-yellow-900`}>{t("jobRunning")}</span>;
  }
  return <span className={`${base} border-millet-border bg-millet-surface text-millet-text`}>{t("jobQueued")}</span>;
}

function formatMetric(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 100) return value.toFixed(1);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function formatNamedMetric(entry?: [string, number | null]) {
  if (!entry) return "-";
  const [name, value] = entry;
  if (value === null || !Number.isFinite(value)) {
    return `${name}: -`;
  }

  return `${name}: ${formatMetric(value)}`;
}

function readFileAsText(file: File, t: (key: string, params?: Record<string, string | number>) => string) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(t("powerwatchFileReadError", { fileName: file.name })));
    reader.readAsText(file, "utf-8");
  });
}
