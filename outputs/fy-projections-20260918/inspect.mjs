import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/kk/Downloads/Telegram Desktop/Projections.xlsx'));
console.log((await w.inspect({kind:'workbook,sheet',maxChars:2000})).ndjson);
console.log(w.help('worksheet',{search:'name|position',include:'index,notes',maxChars:3000}).ndjson);
const p=await w.render({sheetName:'Sheet1',range:'A1:K19',scale:1});
await fs.writeFile('D:/Projects/MU-One/outputs/fy-projections-20260918/source-preview.png',new Uint8Array(await p.arrayBuffer()));
await fs.writeFile('D:/Projects/MU-One/outputs/fy-projections-20260918/source.json',JSON.stringify(w.worksheets.getItem('Sheet1').getRange('A1:K19').values));
