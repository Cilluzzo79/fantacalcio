# fantapipe

Pipeline for processing Fantacalcio (Italian fantasy football) data from SofaScore and generating player ratings.

Run the pipeline: `.venv\Scripts\python -m fantapipe.cli --listone <file.xlsx>`

Run tests: `.venv\Scripts\python -m pytest tests -v`

## Dataset URL

Il dataset generato viene pubblicato su GitHub (repo `Cilluzzo79/fantacalcio`, branch `master`)
ed è consumabile via raw URL:

```
https://raw.githubusercontent.com/Cilluzzo79/fantacalcio/master/data/dataset.json
```

Nota: `data/dataset.json` non esiste ancora nel repo (la prima run reale della pipeline è
pendente), quindi l'URL sopra risponde 404 per ora — è atteso. Diventerà disponibile dopo la
prima run reale che esegue `fantapipe.cli` con `--skip-publish` omesso (pubblicazione attiva).
