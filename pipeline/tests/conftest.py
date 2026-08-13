import pytest
from fantapipe import sofa_client


@pytest.fixture(autouse=True)
def _no_call_spacing(monkeypatch):
    # sofa_client.CALL_SPACING_S adds a real time.sleep() before every CLI
    # invocation (rate-limit insurance in production). Zero it out for the
    # whole test suite so tests that exercise run_cli/get_* don't pay real
    # wall-clock time for a production-only safeguard.
    monkeypatch.setattr(sofa_client, "CALL_SPACING_S", 0)
