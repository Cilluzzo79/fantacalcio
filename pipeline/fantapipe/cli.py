import argparse
import datetime
import sys
from pathlib import Path
from fantapipe import config, sofa_client
from fantapipe.career import fetch_career
from fantapipe.dataset import build_dataset, validate_dataset, write_dataset
from fantapipe.listone import load_listone
from fantapipe.listone_gazzetta import load_listone_gazzetta
from fantapipe.matching import (build_sofa_index, load_overrides,
                                match_players, write_report)


def _load_any(path: Path):
    """Dispatch per estensione: .pdf = Gazzetta (con allenatori), altro = xlsx."""
    if path.suffix.lower() == ".pdf":
        return load_listone_gazzetta(path)
    return load_listone(path), []


def _season_label(now: datetime.date) -> str:
    y = now.year if now.month >= 7 else now.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


def run_pipeline(listone_path: Path, client=sofa_client, cache_dir=None,
                 out_path=None, now_iso=None, max_age_days=7, data_dir=None,
                 publish: bool = False):
    out_path = out_path or config.DATASET_OUT
    data_dir = data_dir or config.PIPE_DATA
    now = datetime.datetime.fromisoformat(now_iso) if now_iso else datetime.datetime.now(datetime.UTC)
    now_iso = now.isoformat(timespec="seconds")
    log = []

    df, coaches = _load_any(listone_path)
    log.append(f"listone: {len(df)} giocatori"
               + (f" + {len(coaches)} allenatori" if coaches else "")
               + f" da {listone_path.name}")

    index, warns = build_sofa_index(sorted(df.squadra.unique()), client=client)
    log.extend(warns)
    overrides = load_overrides(data_dir / "matching_overrides.csv")
    matched = match_players(df, index, overrides)
    write_report(matched, data_dir / "matching_report.csv")
    n_ok = int(matched.sofa_id.notna().sum())
    log.append(f"matching: {n_ok}/{len(matched)} matchati "
               f"({(matched.match_status == 'dubbio').sum()} dubbi)")
    for squadra in sorted(matched.squadra.unique()):
        grp = matched[matched.squadra == squadra]
        matchati = int(grp.sofa_id.notna().sum())
        log.append(f"matching {squadra}: {matchati}/{len(grp)}")

    careers = {}
    for sofa_id in matched.sofa_id.dropna().astype(int).unique():
        try:
            careers[int(sofa_id)] = fetch_career(int(sofa_id), client=client,
                                                 cache_dir=cache_dir,
                                                 max_age_days=max_age_days)
        except Exception as e:  # un giocatore fallito non ferma la pipeline
            log.append(f"carriera fallita per sofaId={sofa_id}: {e}")
            careers[int(sofa_id)] = []

    with_seasons = sum(1 for v in careers.values() if v)
    match_rate = n_ok / max(1, len(matched))
    season_rate = with_seasons / max(1, len(matched))
    log.append(f"carriere: {with_seasons}/{len(careers)} con almeno una stagione")
    if publish and (match_rate < 0.70 or season_rate < 0.60):
        publish = False
        log.append(f"publish SALTATO: copertura anomala (match {match_rate:.0%}, "
                   f"carriere {season_rate:.0%})")

    ds = build_dataset(matched, careers, _season_label(now.date()),
                       listone_path.name, now_iso, coaches=coaches)
    problems = validate_dataset(ds)
    if problems:
        log.append("dataset non valido:\n" + "\n".join(problems))
        data_dir.mkdir(parents=True, exist_ok=True)
        (data_dir / "run_log.txt").write_text("\n".join(log), encoding="utf-8")
        raise SystemExit("dataset non valido:\n" + "\n".join(problems))
    write_dataset(ds, out_path)
    log.append(f"dataset scritto: {out_path} ({len(ds['players'])} giocatori)")

    if publish:
        from fantapipe.publish import publish_dataset
        pushed = publish_dataset(config.ROOT)
        log.append("publish: pushed" if pushed else "publish: nessuna modifica")

    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "run_log.txt").write_text("\n".join(log), encoding="utf-8")
    print("\n".join(log))
    return ds


def main(argv=None):
    ap = argparse.ArgumentParser(prog="fantapipe")
    ap.add_argument("--listone", type=Path, required=False, default=None)
    ap.add_argument("--max-age-days", type=int, default=7)
    ap.add_argument("--skip-publish", action="store_true")
    args = ap.parse_args(argv)

    listone = args.listone
    if listone is None:
        from fantapipe import listone_download as dl
        listone_dir = config.PIPE_DATA / "listone"
        listone = (dl.download_gazzetta(listone_dir)
                   or dl.download_listone(listone_dir)
                   or dl.latest_listone(listone_dir))
        if listone is None:
            sys.exit("Nessun listone: download fallito e nessun file in "
                     f"{listone_dir}. Scarica l'export a mano e riprova con --listone.")

    run_pipeline(listone, max_age_days=args.max_age_days,
                publish=not args.skip_publish)


if __name__ == "__main__":
    main()
