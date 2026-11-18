#!/usr/bin/env bash
# Proves the runner route to the two US government survey services the
# terrain build needs (a cloud session's own network refuses both). Prints
# one line per service: its address and the HTTP status of its ?f=json page.
# Run by .github/workflows/terrain.yml; exits 1 unless both answer 200.
set -u
ok=0
for u in \
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer?f=json" \
  "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer?f=json"; do
  code=$(curl -sS -m 30 -o /dev/null -w "%{http_code}" "$u" 2>&1 || true)
  echo "$code $u"
  [ "$code" = "200" ] && ok=$((ok + 1))
done
[ "$ok" = "2" ]
