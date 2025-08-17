Run these exact steps in /home/hikit/import/dnsweeper, do not invent extra steps:

1) Build:
   npm run build

2) Analyze:
   node dist/cli/index.js analyze sample.csv --http-check
   - Capture the numeric row count (rows=...)

3) Import to JSON:
   node dist/cli/index.js import sample.csv --pretty > out.json

4) Summarize (one line to stdout):
   node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('out.json','utf8'));console.log('summary=',{rows:a.length,domains:a.map(x=>x.domain)})"
