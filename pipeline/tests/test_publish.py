import subprocess
from pathlib import Path
import pytest
from fantapipe.publish import publish_dataset, PublishError


def _git(cwd, *args):
    return subprocess.run(["git", "-C", str(cwd), *args],
                          capture_output=True, text=True, check=True)


@pytest.fixture
def repo_con_remote(tmp_path):
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", str(remote)], check=True,
                   capture_output=True)
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-b", "master")
    _git(repo, "config", "user.email", "t@t.it")
    _git(repo, "config", "user.name", "t")
    _git(repo, "remote", "add", "origin", str(remote))
    (repo / "data").mkdir()
    (repo / "data" / "dataset.json").write_text('{"v":1}', encoding="utf-8")
    _git(repo, "add", "."); _git(repo, "commit", "-m", "init")
    _git(repo, "push", "-u", "origin", "master")
    return repo


def test_publish_con_modifiche(repo_con_remote):
    (repo_con_remote / "data" / "dataset.json").write_text('{"v":2}',
                                                           encoding="utf-8")
    assert publish_dataset(repo_con_remote) is True
    log = _git(repo_con_remote, "log", "--oneline", "origin/master").stdout
    assert "data: dataset update" in log


def test_publish_senza_modifiche(repo_con_remote):
    assert publish_dataset(repo_con_remote) is False


def test_publish_push_fallito(repo_con_remote):
    _git(repo_con_remote, "remote", "set-url", "origin",
         str(repo_con_remote / "inesistente.git"))
    (repo_con_remote / "data" / "dataset.json").write_text('{"v":3}',
                                                           encoding="utf-8")
    with pytest.raises(PublishError):
        publish_dataset(repo_con_remote)
