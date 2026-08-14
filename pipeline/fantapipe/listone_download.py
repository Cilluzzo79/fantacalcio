import datetime
import os
from pathlib import Path
import requests
from dotenv import load_dotenv

# Valori reali annotati nello Step 1 (aggiorna se il sito cambia)
# EXPORT_URL verificato live 2026-08-13: la pagina quotazioni referenzia
# /api/v1/Excel/prices/21/1 (stagione 2026-27 = id 21); risponde 401 senza login.
# LOGIN_URL resta best-guess: verificato solo al primo tentativo con credenziali.
LOGIN_URL = "https://www.fantacalcio.it/api/v1/User/login"
EXPORT_URL = "https://www.fantacalcio.it/api/v1/Excel/prices/21/1"
LOGIN_FIELDS = ("username", "password")
XLSX_MAGIC = b"PK\x03\x04"

# Listone Gazzetta (fantacampionato): PDF pubblico, niente credenziali.
# Il parametro ?v= è un cache-buster: se Gazzetta pubblica un listone
# aggiornato con un ?v= diverso, aggiornare qui.
GAZZETTA_URL = ("https://static2.gazzettaobjects.it/static_images/"
                "infografiche/FREEMIUM/fantacampionato_listone_26-27.pdf"
                "?v=20260722")
PDF_MAGIC = b"%PDF"


def download_gazzetta(dest_dir: Path, session=None) -> Path | None:
    s = session or requests.Session()
    try:
        resp = s.get(GAZZETTA_URL, timeout=60)
        if not resp.ok or not resp.content.startswith(PDF_MAGIC):
            print("WARN: il listone Gazzetta scaricato non è un PDF valido")
            return None
    except requests.RequestException as e:
        print(f"WARN: download listone Gazzetta fallito: {e}")
        return None
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / f"listone_gazzetta_{datetime.date.today().isoformat()}.pdf"
    out.write_bytes(resp.content)
    return out


def download_listone(dest_dir: Path, session=None, env: dict | None = None) -> Path | None:
    if env is None:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        env = dict(os.environ)
    email, password = env.get("FC_EMAIL"), env.get("FC_PASSWORD")
    if not email or not password:
        print("WARN: FC_EMAIL/FC_PASSWORD mancanti in pipeline/.env — salto download")
        return None
    s = session or requests.Session()
    try:
        login = s.post(LOGIN_URL,
                       data={LOGIN_FIELDS[0]: email, LOGIN_FIELDS[1]: password},
                       timeout=30)
        if not login.ok:
            print(f"WARN: login fantacalcio.it fallito ({login.status_code})")
            return None
        resp = s.get(EXPORT_URL, timeout=60)
        if not resp.content.startswith(XLSX_MAGIC):
            print("WARN: l'export non è un file xlsx (struttura sito cambiata?)")
            return None
    except requests.RequestException as e:
        print(f"WARN: download listone fallito: {e}")
        return None
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = dest_dir / f"quotazioni_{datetime.date.today().isoformat()}.xlsx"
    out.write_bytes(resp.content)
    return out


def latest_listone(dest_dir: Path) -> Path | None:
    if not dest_dir.exists():
        return None
    files = [*dest_dir.glob("quotazioni_*.xlsx"),
             *dest_dir.glob("listone_gazzetta_*.pdf")]
    if not files:
        return None
    return max(files, key=lambda p: (p.stat().st_mtime, p.name))
