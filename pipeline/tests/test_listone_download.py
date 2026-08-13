from fantapipe import listone_download as dl


class FakeResponse:
    def __init__(self, content=b"", status_code=200, ok=True):
        self.content, self.status_code, self.ok = content, status_code, ok


class FakeSession:
    def __init__(self, login_ok=True, export_bytes=b"PK\x03\x04finto-xlsx"):
        self.login_ok, self.export_bytes = login_ok, export_bytes
    def post(self, url, data=None, timeout=None):
        return FakeResponse(ok=self.login_ok,
                            status_code=200 if self.login_ok else 403)
    def get(self, url, timeout=None):
        return FakeResponse(content=self.export_bytes)


CREDS = {"FC_EMAIL": "a@b.it", "FC_PASSWORD": "x"}


def test_download_ok(tmp_path):
    out = dl.download_listone(tmp_path, session=FakeSession(), env=CREDS)
    assert out is not None and out.suffix == ".xlsx"
    assert out.read_bytes().startswith(b"PK")  # firma zip/xlsx


def test_download_fallisce_senza_credenziali(tmp_path):
    assert dl.download_listone(tmp_path, session=FakeSession(), env={}) is None


def test_download_fallisce_su_login_negato(tmp_path):
    assert dl.download_listone(tmp_path, session=FakeSession(login_ok=False),
                               env=CREDS) is None


def test_download_rifiuta_contenuto_non_xlsx(tmp_path):
    s = FakeSession(export_bytes=b"<html>login page</html>")
    assert dl.download_listone(tmp_path, session=s, env=CREDS) is None


def test_latest_listone(tmp_path):
    (tmp_path / "quotazioni_2026-08-01.xlsx").write_bytes(b"PK")
    (tmp_path / "quotazioni_2026-08-10.xlsx").write_bytes(b"PK")
    assert dl.latest_listone(tmp_path).name == "quotazioni_2026-08-10.xlsx"
    assert dl.latest_listone(tmp_path / "vuota") is None
