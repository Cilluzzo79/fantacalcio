$ErrorActionPreference = "Stop"
$root = "D:\railway\fantacalcio"
$log = "$root\pipeline\data\scheduler_log.txt"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
New-Item -ItemType Directory -Force -Path "$root\pipeline\data" | Out-Null
try {
    Set-Location "$root\pipeline"
    # Il merge stdout+stderr lo fa cmd.exe: in PowerShell 5.1 con EAP=Stop
    # qualsiasi riga stderr benigna rediretta (*>&1) diventerebbe un errore
    # terminante -> falso "ERRORE" nel log a pipeline riuscita.
    cmd /c ".venv\Scripts\python -m fantapipe.cli --max-age-days 6 > $root\pipeline\data\last_run_output.txt 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "pipeline exit code $LASTEXITCODE" }
    Add-Content $log "$stamp OK"
} catch {
    Add-Content $log "$stamp ERRORE: $_"
    exit 1
}
