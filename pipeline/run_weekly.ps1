$ErrorActionPreference = "Stop"
$root = "D:\railway\fantacalcio"
$log = "$root\pipeline\data\scheduler_log.txt"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
New-Item -ItemType Directory -Force -Path "$root\pipeline\data" | Out-Null
try {
    Set-Location "$root\pipeline"
    & .venv\Scripts\python -m fantapipe.cli --max-age-days 6 *>&1 |
        Tee-Object -FilePath "$root\pipeline\data\last_run_output.txt"
    if ($LASTEXITCODE -ne 0) { throw "pipeline exit code $LASTEXITCODE" }
    Add-Content $log "$stamp OK"
} catch {
    Add-Content $log "$stamp ERRORE: $_"
    exit 1
}
