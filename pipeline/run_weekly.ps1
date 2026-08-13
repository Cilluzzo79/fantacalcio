$ErrorActionPreference = "Stop"
$root = "D:\railway\fantacalcio"
$log = "$root\pipeline\data\scheduler_log.txt"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
try {
    Set-Location "$root\pipeline"
    & .venv\Scripts\python -m fantapipe.cli
    if ($LASTEXITCODE -ne 0) { throw "pipeline exit code $LASTEXITCODE" }
    Add-Content $log "$stamp OK"
} catch {
    Add-Content $log "$stamp ERRORE: $_"
    exit 1
}
