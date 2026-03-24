from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

try:
    import joblib
except ImportError:  # pragma: no cover - valfritt beroende
    joblib = None

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


TARGET_FAILURE_WITHIN_6_MONTHS = "failure_within_6_months"
TARGET_REMAINING_RUNTIME = "remaining_runtime_minutes"

DEFAULT_TEST_SIZE = 0.2
DEFAULT_RANDOM_SEED = 42
MAX_CSV_BYTES = 8 * 1024 * 1024
MAX_MASTER_ROWS = 250_000

DEFAULT_MODEL_SETS = {
    TARGET_FAILURE_WITHIN_6_MONTHS: [
        "logistic_regression",
        "random_forest",
        "gradient_boosting",
    ],
    TARGET_REMAINING_RUNTIME: [
        "linear_regression",
        "random_forest_regressor",
        "gradient_boosting_regressor",
    ],
}


def main() -> None:
    """
    Läser ett jobb från stdin, bygger master-tabell, tränar flera modeller och
    returnerar en JSON-sammanfattning på stdout.

    Scriptet är gjort för att köras från worker-processen, inte direkt från API:t.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default="unknown")
    args = parser.parse_args()

    try:
        payload = json.loads(sys.stdin.read())
        result = run_job(payload, args.job_id)
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except Exception as exc:  # pragma: no cover - fångas av worker
        print(f"ML-jobbet misslyckades: {exc}", file=sys.stderr)
        raise


def run_job(payload: dict[str, Any], job_id: str) -> dict[str, Any]:
    target_strategy = payload.get("targetStrategy", TARGET_FAILURE_WITHIN_6_MONTHS)
    if target_strategy not in (TARGET_FAILURE_WITHIN_6_MONTHS, TARGET_REMAINING_RUNTIME):
        raise ValueError(f"Ogiltig target-strategi: {target_strategy}")

    input_summary = build_input_summary(payload)
    validate_csv_payload(payload)

    devices = read_csv_payload(payload, "deviceCsv")
    telemetry = read_csv_payload(payload, "telemetryCsv")
    service = read_csv_payload(payload, "serviceCsv", optional=True)

    master_df, warnings = build_master_table(devices, telemetry, service)
    master_df, strategy_metadata = build_target(master_df, service, target_strategy, warnings)

    numeric_features, categorical_features = choose_features(master_df, target_strategy)
    feature_columns = numeric_features + categorical_features
    if not feature_columns:
        raise ValueError("Inga användbara features hittades i master-tabellen.")

    test_size = float(payload.get("testSize") or DEFAULT_TEST_SIZE)
    random_seed = int(payload.get("randomSeed") or DEFAULT_RANDOM_SEED)
    model_names = payload.get("modelNames") or DEFAULT_MODEL_SETS[target_strategy]

    train_output = train_and_compare_models(
        df=master_df,
        target_strategy=target_strategy,
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        model_names=model_names,
        test_size=test_size,
        random_seed=random_seed,
    )

    artifact_paths = save_artifacts(
        job_id=job_id,
        artifact_dir=payload.get("artifactDir"),
        result=train_output,
    )

    dataset_version = compute_dataset_version(payload)
    dataset_summary = {
        "devicesRows": int(len(devices.index)),
        "telemetryRows": int(len(telemetry.index)),
        "serviceRows": int(len(service.index)),
        "masterRows": int(len(master_df.index)),
        "labelSource": strategy_metadata["label_source"],
        "datasetVersion": dataset_version,
    }

    if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS:
        dataset_summary["targetPositiveRate"] = round(float(master_df["target"].mean()) * 100, 3)
    else:
        dataset_summary["targetMean"] = round(float(master_df["target"].mean()), 3)

    result = {
        "jobId": job_id,
        "strategy": target_strategy,
        "inputSummary": input_summary,
        "datasetSummary": dataset_summary,
        "trainingSpec": {
            "datasetName": input_summary["datasetName"],
            "randomSeed": random_seed,
            "testSize": test_size,
            "featureColumns": feature_columns,
            "numericFeatures": numeric_features,
            "categoricalFeatures": categorical_features,
            "modelNames": model_names,
        },
        "comparisonMetric": train_output["comparison_metric"],
        "recommendedModel": train_output["recommended_model"],
        "modelResults": train_output["model_results"],
        "warnings": warnings,
        "artifacts": artifact_paths,
    }

    return result


def build_input_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "datasetName": payload.get("datasetName") or "PowerWatch analysis",
        "targetStrategy": payload.get("targetStrategy") or TARGET_FAILURE_WITHIN_6_MONTHS,
        "randomSeed": int(payload.get("randomSeed") or DEFAULT_RANDOM_SEED),
        "testSize": float(payload.get("testSize") or DEFAULT_TEST_SIZE),
        "modelNames": payload.get("modelNames") or DEFAULT_MODEL_SETS[payload.get("targetStrategy") or TARGET_FAILURE_WITHIN_6_MONTHS],
        "deviceFileName": payload.get("deviceFileName") or "devices.csv",
        "telemetryFileName": payload.get("telemetryFileName") or "telemetry.csv",
        "serviceFileName": payload.get("serviceFileName"),
    }


def validate_csv_payload(payload: dict[str, Any]) -> None:
    for key in ("deviceCsv", "telemetryCsv"):
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} saknas eller är tom.")
        if len(value.encode("utf-8")) > MAX_CSV_BYTES:
            raise ValueError(f"{key} är för stor för demo-läget.")

    service_csv = payload.get("serviceCsv")
    if isinstance(service_csv, str) and len(service_csv.encode("utf-8")) > MAX_CSV_BYTES:
        raise ValueError("serviceCsv är för stor för demo-läget.")


def read_csv_payload(payload: dict[str, Any], key: str, optional: bool = False) -> pd.DataFrame:
    csv_text = payload.get(key)
    if optional and (csv_text is None or str(csv_text).strip() == ""):
        return pd.DataFrame()

    frame = pd.read_csv(io.StringIO(str(csv_text)))
    frame.columns = [normalize_column_name(column) for column in frame.columns]

    if frame.columns.duplicated().any():
        raise ValueError(f"{key} innehåller dubblettkolumner efter normalisering.")

    return frame


def build_master_table(
    devices: pd.DataFrame,
    telemetry: pd.DataFrame,
    service: pd.DataFrame,
) -> tuple[pd.DataFrame, list[str]]:
    warnings: list[str] = []

    require_columns(devices, ["device_id"], "deviceCsv")
    require_columns(telemetry, ["device_id", "timestamp"], "telemetryCsv")

    telemetry = telemetry.copy()
    devices = devices.copy()
    telemetry["timestamp"] = pd.to_datetime(telemetry["timestamp"], errors="coerce")
    telemetry = telemetry[telemetry["timestamp"].notna()].copy()

    master = telemetry.merge(devices, on="device_id", how="left", suffixes=("", "_device"))
    if len(master.index) > MAX_MASTER_ROWS:
        raise ValueError("Master-tabellen blev för stor för demo-läget. Filtrera eller dela upp data först.")

    if master["device_id"].isna().any():
        warnings.append("Några rader saknar device_id efter merge och ignoreras.")
        master = master[master["device_id"].notna()].copy()

    if "install_date" in master.columns:
        master["install_date"] = pd.to_datetime(master["install_date"], errors="coerce")
        master["days_since_install"] = (master["timestamp"] - master["install_date"]).dt.days.clip(lower=0)

    master["observation_month"] = master["timestamp"].dt.month
    master["observation_year"] = master["timestamp"].dt.year

    if service.empty:
        master["service_events"] = 0
        return master.sort_values(["device_id", "timestamp"]).reset_index(drop=True), warnings

    service = service.copy()
    if "device_id" not in service.columns:
        warnings.append("Service-CSV saknar device_id. Servicehistoriken används inte.")
        master["service_events"] = 0
        return master.sort_values(["device_id", "timestamp"]).reset_index(drop=True), warnings

    service_count = service.groupby("device_id").size().reset_index(name="service_events")
    master = master.merge(service_count, on="device_id", how="left")
    master["service_events"] = master["service_events"].fillna(0)
    return master.sort_values(["device_id", "timestamp"]).reset_index(drop=True), warnings


def build_target(
    master_df: pd.DataFrame,
    service_df: pd.DataFrame,
    target_strategy: str,
    warnings: list[str],
) -> tuple[pd.DataFrame, dict[str, str]]:
    df = master_df.copy()

    if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS:
        label_source = add_failure_within_six_months_target(df, service_df, warnings)
    elif target_strategy == TARGET_REMAINING_RUNTIME:
        label_source = add_remaining_runtime_target(df, warnings)
    else:  # pragma: no cover - skydd även om upstream validerar
        raise ValueError(f"Okänd target-strategi: {target_strategy}")

    df = df[df["target"].notna()].copy()
    return df, {"label_source": label_source}


def add_failure_within_six_months_target(
    df: pd.DataFrame,
    service_df: pd.DataFrame,
    warnings: list[str],
) -> str:
    label_source = "proxy_rule"

    if not service_df.empty and {"device_id", "event_type"}.issubset(service_df.columns):
        service_df = service_df.copy()
        event_date_column = pick_first_column(service_df, ["event_date", "service_date", "timestamp"])
        if event_date_column:
            service_df[event_date_column] = pd.to_datetime(service_df[event_date_column], errors="coerce")
            replacement_events = service_df[
                service_df["event_type"].astype(str).str.contains("battery|replace", case=False, na=False)
                & service_df[event_date_column].notna()
            ].copy()

            if not replacement_events.empty:
                grouped_events = {
                    device_id: list(group[event_date_column].sort_values())
                    for device_id, group in replacement_events.groupby("device_id")
                }

                def label_row(row: pd.Series) -> int:
                    dates = grouped_events.get(row["device_id"], [])
                    if not dates:
                        return 0
                    upper_bound = row["timestamp"] + pd.Timedelta(days=183)
                    return int(any(row["timestamp"] < date <= upper_bound for date in dates))

                df["target"] = df.apply(label_row, axis=1)
                if df["target"].nunique() > 1:
                    return "service_history"
                warnings.append("Servicehistoriken gav bara en klass. Växlar till proxy-target för demo.")

    # Fallback för demo om servicehistorik saknas eller är för tunn.
    risk_score = pd.Series(0, index=df.index, dtype=float)
    if "battery_health_pct" in df.columns:
        health = pd.to_numeric(df["battery_health_pct"], errors="coerce")
        risk_score += (health <= 65).fillna(False).astype(int)
        risk_score += (health <= 50).fillna(False).astype(int)

    if "alarm_events" in df.columns:
        alarms = pd.to_numeric(df["alarm_events"], errors="coerce")
        risk_score += (alarms >= 2).fillna(False).astype(int)

    for flag_column in ("low_battery_alarm", "high_temp_alarm"):
        if flag_column in df.columns:
            flag = pd.to_numeric(df[flag_column], errors="coerce")
            risk_score += (flag >= 1).fillna(False).astype(int)

    if "internal_resistance_mohm" in df.columns:
        resistance = pd.to_numeric(df["internal_resistance_mohm"], errors="coerce")
        threshold = resistance.quantile(0.75)
        risk_score += (resistance >= threshold).fillna(False).astype(int)

    if "age_years_at_2026_03_24" in df.columns:
        age = pd.to_numeric(df["age_years_at_2026_03_24"], errors="coerce")
        risk_score += (age >= 6).fillna(False).astype(int)

    df["target"] = (risk_score >= 2).astype(int)

    if df["target"].nunique() < 2:
        if "battery_health_pct" not in df.columns:
            raise ValueError("Kunde inte skapa en binär target. Lägg till servicehistorik eller battery_health_pct.")
        health = pd.to_numeric(df["battery_health_pct"], errors="coerce")
        fallback_threshold = health.quantile(0.25)
        df["target"] = (health <= fallback_threshold).fillna(False).astype(int)
        label_source = "proxy_quantile"
        warnings.append("Proxy-targeten var för jämn. Använder lägsta kvartilen av battery_health_pct som fallback-label.")

    positive_rate = float(df["target"].mean()) * 100
    if positive_rate < 5 or positive_rate > 95:
        warnings.append("Targeten är starkt obalanserad. Resultatet är främst för demo och bör kompletteras med riktig service-labeling.")

    return label_source


def add_remaining_runtime_target(df: pd.DataFrame, warnings: list[str]) -> str:
    target_column = pick_first_column(
        df,
        [
            "remaining_runtime_minutes",
            "estimated_runtime_minutes",
            "nominal_runtime_minutes_new",
        ],
    )

    if not target_column:
        raise ValueError(
            "Regression kräver en target-kolumn som remaining_runtime_minutes, estimated_runtime_minutes eller nominal_runtime_minutes_new."
        )

    df["target"] = pd.to_numeric(df[target_column], errors="coerce")
    warnings.append(f"Regressionstarget hämtas från kolumnen {target_column}.")
    return target_column


def choose_features(df: pd.DataFrame, target_strategy: str) -> tuple[list[str], list[str]]:
    numeric_candidates = [
        "temperature_c",
        "ambient_temperature_c",
        "load_current_a",
        "load_utilization_pct",
        "battery_health_pct",
        "age_years_at_2026_03_24",
        "battery_capacity_ah",
        "nominal_runtime_minutes_new",
        "typical_load_a",
        "voltage_v",
        "max_current_a",
        "recharge_time_h",
        "internal_resistance_mohm",
        "outage_cycles_month",
        "discharge_depth_pct",
        "alarm_events",
        "low_battery_alarm",
        "high_temp_alarm",
        "service_events",
        "days_since_install",
        "observation_month",
        "observation_year",
    ]

    categorical_candidates = [
        "product_type",
        "series",
        "city",
        "site_name",
        "location_type",
        "room_type",
        "service_contract",
    ]

    leakage_columns = {"target", "device_id", "timestamp", "install_date"}
    if target_strategy == TARGET_REMAINING_RUNTIME:
        leakage_columns.update({"remaining_runtime_minutes", "estimated_runtime_minutes", "nominal_runtime_minutes_new"})

    numeric_features = []
    for column in numeric_candidates:
        if column in df.columns and column not in leakage_columns:
            series = pd.to_numeric(df[column], errors="coerce")
            if series.notna().sum() >= 5:
                df[column] = series
                numeric_features.append(column)

    categorical_features = []
    for column in categorical_candidates:
        if column in df.columns and column not in leakage_columns:
            if df[column].dropna().astype(str).nunique() >= 2:
                categorical_features.append(column)

    return numeric_features, categorical_features


def train_and_compare_models(
    df: pd.DataFrame,
    target_strategy: str,
    numeric_features: list[str],
    categorical_features: list[str],
    model_names: list[str],
    test_size: float,
    random_seed: int,
) -> dict[str, Any]:
    X = df[numeric_features + categorical_features].copy()
    y = df["target"].copy()

    stratify = y if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS and y.nunique() > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_seed,
        stratify=stratify,
    )

    comparison_metric = "f1" if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS else "rmse"
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_features,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", build_one_hot_encoder()),
                    ]
                ),
                categorical_features,
            ),
        ],
        remainder="drop",
    )

    results: list[dict[str, Any]] = []
    best_index = -1
    best_score = None
    best_pipeline: Pipeline | None = None

    for model_name in model_names:
        estimator = create_estimator(model_name, target_strategy, random_seed)
        pipeline = Pipeline(steps=[("preprocess", preprocessor), ("model", estimator)])

        start = time.perf_counter()
        pipeline.fit(X_train, y_train)
        train_seconds = time.perf_counter() - start

        if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS:
            metrics = evaluate_classifier(pipeline, X_test, y_test)
            candidate_score = metrics[comparison_metric]
        else:
            metrics = evaluate_regressor(pipeline, X_test, y_test)
            candidate_score = metrics[comparison_metric]

        result_row = {
            "modelName": model_name,
            "metrics": metrics,
            "trainSeconds": round(train_seconds, 4),
            "topFeatures": extract_top_features(pipeline),
        }
        results.append(result_row)

        if best_score is None:
            best_score = candidate_score
            best_index = len(results) - 1
            best_pipeline = pipeline
            continue

        if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS and candidate_score > best_score:
            best_score = candidate_score
            best_index = len(results) - 1
            best_pipeline = pipeline
        if target_strategy == TARGET_REMAINING_RUNTIME and candidate_score < best_score:
            best_score = candidate_score
            best_index = len(results) - 1
            best_pipeline = pipeline

    if best_index < 0 or best_pipeline is None:
        raise ValueError("Ingen modell kunde tränas.")

    return {
        "comparison_metric": comparison_metric,
        "recommended_model": {
            "modelName": results[best_index]["modelName"],
            "score": round(float(best_score), 6),
        },
        "model_results": results,
        "best_pipeline": best_pipeline,
    }


def build_one_hot_encoder() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:  # pragma: no cover - äldre sklearn
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def create_estimator(model_name: str, target_strategy: str, random_seed: int):
    if target_strategy == TARGET_FAILURE_WITHIN_6_MONTHS:
        mapping = {
            "logistic_regression": LogisticRegression(max_iter=1_000, class_weight="balanced", random_state=random_seed),
            "random_forest": RandomForestClassifier(
                n_estimators=250,
                max_depth=10,
                min_samples_leaf=3,
                class_weight="balanced_subsample",
                random_state=random_seed,
                n_jobs=1,
            ),
            "gradient_boosting": GradientBoostingClassifier(random_state=random_seed),
        }
    else:
        mapping = {
            "linear_regression": LinearRegression(),
            "random_forest_regressor": RandomForestRegressor(
                n_estimators=250,
                max_depth=12,
                min_samples_leaf=3,
                random_state=random_seed,
                n_jobs=1,
            ),
            "gradient_boosting_regressor": GradientBoostingRegressor(random_state=random_seed),
        }

    if model_name not in mapping:
        raise ValueError(f"Modellen {model_name} stöds inte för target-strategin {target_strategy}.")

    return mapping[model_name]


def evaluate_classifier(pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float | None]:
    predictions = pipeline.predict(X_test)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 6),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 6),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 6),
        "f1": round(float(f1_score(y_test, predictions, zero_division=0)), 6),
        "roc_auc": None,
    }

    if y_test.nunique() > 1 and hasattr(pipeline, "predict_proba"):
        probabilities = pipeline.predict_proba(X_test)[:, 1]
        metrics["roc_auc"] = round(float(roc_auc_score(y_test, probabilities)), 6)

    return metrics


def evaluate_regressor(pipeline: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float | None]:
    predictions = pipeline.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    return {
        "mae": round(float(mean_absolute_error(y_test, predictions)), 6),
        "rmse": round(float(np.sqrt(mse)), 6),
        "r2": round(float(r2_score(y_test, predictions)), 6),
    }


def extract_top_features(pipeline: Pipeline, top_n: int = 8) -> list[dict[str, float]]:
    model = pipeline.named_steps["model"]
    preprocess = pipeline.named_steps["preprocess"]

    if not hasattr(preprocess, "get_feature_names_out"):
        return []

    feature_names = list(preprocess.get_feature_names_out())
    importances: np.ndarray | None = None

    if hasattr(model, "feature_importances_"):
        importances = np.asarray(model.feature_importances_)
    elif hasattr(model, "coef_"):
        coefficients = np.asarray(model.coef_)
        importances = np.abs(coefficients[0] if coefficients.ndim > 1 else coefficients)

    if importances is None or len(importances) != len(feature_names):
        return []

    ranking = pd.DataFrame({"feature": feature_names, "importance": importances})
    ranking = ranking.sort_values("importance", ascending=False).head(top_n)
    return [
        {"feature": simplify_feature_name(row.feature), "importance": round(float(row.importance), 6)}
        for row in ranking.itertuples()
    ]


def save_artifacts(job_id: str, artifact_dir: str | None, result: dict[str, Any]) -> dict[str, str | None]:
    output_dir = Path(artifact_dir or Path(__file__).resolve().parent / "artifacts" / job_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    summary_path = output_dir / "summary.json"
    serializable_result = {key: value for key, value in result.items() if key != "best_pipeline"}
    summary_path.write_text(json.dumps(serializable_result, ensure_ascii=False, indent=2), encoding="utf-8")

    model_path: Path | None = None
    if joblib is not None:
        model_path = output_dir / "best_model.joblib"
        joblib.dump(result["best_pipeline"], model_path)

    return {
        "summaryPath": str(summary_path),
        "modelPath": str(model_path) if model_path else None,
    }


def compute_dataset_version(payload: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    for key in ("deviceCsv", "telemetryCsv", "serviceCsv"):
        value = payload.get(key)
        if isinstance(value, str):
            digest.update(value.encode("utf-8"))
    return digest.hexdigest()


def require_columns(df: pd.DataFrame, columns: list[str], name: str) -> None:
    missing = [column for column in columns if column not in df.columns]
    if missing:
        raise ValueError(f"{name} saknar kolumnerna: {', '.join(missing)}")


def pick_first_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
    return None


def normalize_column_name(name: str) -> str:
    value = "".join(character.lower() if character.isalnum() else "_" for character in str(name).strip())
    while "__" in value:
        value = value.replace("__", "_")
    return value.strip("_")


def simplify_feature_name(name: str) -> str:
    return name.replace("num__", "").replace("cat__", "")


if __name__ == "__main__":
    main()

