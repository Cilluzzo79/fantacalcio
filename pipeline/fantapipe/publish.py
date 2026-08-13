import datetime
import subprocess
from pathlib import Path


class PublishError(Exception):
    pass


def _git(repo_root: Path, *args, check=True):
    proc = subprocess.run(["git", "-C", str(repo_root), *args],
                          capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise PublishError(f"git {' '.join(args)} fallito: {proc.stderr}")
    return proc


def publish_dataset(repo_root: Path, dataset_rel: str = "data/dataset.json",
                    remote: str = "origin", branch: str = "master") -> bool:
    _git(repo_root, "add", dataset_rel)
    diff = _git(repo_root, "diff", "--cached", "--quiet", "--", dataset_rel,
                check=False)
    if diff.returncode == 0:
        return False  # nessuna modifica
    stamp = datetime.date.today().isoformat()
    _git(repo_root, "commit", "-m", f"data: dataset update {stamp}")
    _git(repo_root, "push", remote, branch)
    return True
