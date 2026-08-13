import argparse
import datetime
import sys
from pathlib import Path
from fantapipe import config, sofa_client
from fantapipe.career import fetch_career
from fantapipe.dataset import build_dataset, validate_dataset, write_dataset
from fantapipe.listone import load_listone
from fantapipe.matching import (build_sofa_index, load_overrides,
                                match_players, write_report)


def _season_label(now: datetime.date) -> str:
    y = now.year if now.month >= 7 else now.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


def run_pipeline(listone_path: Path, client=sofa_client, cache_dir=None,
                 out_path=None, now_iso=None, max_age_days=7):
    out_path = out_path or config.DATASET_OUT
    now = datetime.datetime.now(datetime.UTC)
    now_iso = now_iso or now.isoformat(timespec="seconds")
    log = []

    df = load_listone(listone_path)
    log.append(f"listone: {len(df)} giocatori da {listone_path.name}")

    index, warns = build_sofa_index(sorted(df.squadra.unique()), client=client)
    log.extend(warns)
    overrides = load_overrides(config.PIPE_DATA / "matching_overrides.csv")
    matched = match_players(df, index, overrides)
    write_report(matched, config.PIPE_DATA / "matching_report.csv")
    n_ok = int(matched.sofa_id.notna().sum())
    log.append(f"matching: {n_ok}/{len(matched)} matchati "
               f"({(matched.match_status == 'dubbio').sum()} dubbi)")

    careers = {}
    for sofa_id in matched.sofa_id.dropna().astype(int).unique():
        try:
            careers[int(sofa_id)] = fetch_career(int(sofa_id), client=client,
                                                 cache_dir=cache_dir,
                                                 max_age_days=max_age_days)
        except Exception as e:  # un giocatore fallito non ferma la pipeline
            log.append(f"carriera fallita per sofaId={sofa_id}: {e}")
            careers[int(sofa_id)] = []

    ds = build_dataset(matched, careers, _season_label(now.date()),
                       listone_path.name, now_iso)
    problems = validate_dataset(ds)
    if problems:
        raise SystemExit("dataset non valido:\n" + "\n".join(problems))
    write_dataset(ds, out_path)
    log.append(f"dataset scritto: {out_path} ({len(ds['players'])} giocatori)")

    config.PIPE_DATA.mkdir(parents=True, exist_ok=True)
    (config.PIPE_DATA / "run_log.txt").write_text("\n".join(log), encoding="utf-8")
    print("\n".join(log))
    return ds


def main(argv=None):
    ap = argparse.ArgumentParser(prog="fantapipe")
    ap.add_argument("--listone", type=Path, required=True)
    ap.add_argument("--max-age-days", type=int, default=7)
    args = ap.parse_args(argv)
    run_pipeline(args.listone, max_age_days=args.max_age_days)


if __name__ == "__main__":
    main()
