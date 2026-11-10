#!/bin/bash
# SPIKE: 60 parallel requests mixing en-US, th-TH and de-DE; each must come back in its own language.
declare -A want=( [en-US]="Streamed after the shell" [th-TH]="ส่งตามมาหลังเชลล์" [de-DE]="Nach der Shell gestreamt" )
declare -A title=( [en-US]="Hello world" [th-TH]="สวัสดีชาวโลก" [de-DE]="Hallo Welt" )
locs=(en-US th-TH de-DE); mkdir -p ${OUT:-../../.e2e-work/concurrency}; rm -f ${OUT:-../../.e2e-work/concurrency}/*
for i in $(seq 1 60); do l=${locs[$((i%3))]}; curl -s ${BASE:-http://localhost:5173}/$l/stream -o ${OUT:-../../.e2e-work/concurrency}/$i.$l & done; wait
ok=0; bad=0
for f in ${OUT:-../../.e2e-work/concurrency}/*; do l=${f##*.}
  if grep -q "data-testid=\"streamed\">${want[$l]}<" $f && grep -q "data-testid=\"title\">${title[$l]}<" $f && grep -q "<html lang=\"$l\">" $f; then ok=$((ok+1)); else bad=$((bad+1)); echo "BAD $f"; fi
done; echo "ok=$ok bad=$bad"
