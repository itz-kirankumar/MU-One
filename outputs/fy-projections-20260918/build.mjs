import fs from 'node:fs/promises';
import {Workbook,SpreadsheetFile,FileBlob} from '@oai/artifact-tool';
const dir='D:/Projects/MU-One/outputs/fy-projections-20260918';
const input=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/kk/Downloads/Telegram Desktop/Projections.xlsx'));
const wb=Workbook.create();
const p=wb.worksheets.add('Annual projections');
const a=wb.worksheets.add('Forecast workings');
const s=wb.worksheets.add('Source actuals');
const source=JSON.parse(await fs.readFile(`${dir}/source.json`,'utf8'));
s.getRange('A1:K19').copyFrom(input.worksheets.getItem('Sheet1').getRange('A1:K19'),'all');
// Explicit values also preserve every supplied number without external links.
s.getRange('A1:K19').values=source;
const dark='#334A2F',pale='#EAF0E4',green='#008000',blue='#0000FF';
const num='#,##0.0;(#,##0.0);"-"';
function value(sh,cell,v){sh.getRange(cell).values=[[v]];}
function formula(sh,cell,f){sh.getRange(cell).formulas=[[f]];sh.getRange(cell).format.font.color=f.includes("'!")?green:'#000000';}
function base(sh,range){sh.showGridLines=false;sh.getRange(range).format.font={name:'Arial',size:10,color:'#202520'};sh.getRange(range).format.rowHeight=21;sh.getRange(range).format.verticalAlignment='center';}
function band(sh,range){sh.getRange(range).format.fill=pale;sh.getRange(range).format.font.bold=true;}
function header(sh,range){sh.getRange(range).format={fill:dark,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:36};}
base(p,'A1:H36');p.tabColor=dark;
p.getRange('A1:A36').format.columnWidth=43;p.getRange('B1:B36').format.columnWidth=9;p.getRange('C1:H36').format.columnWidth=19;
p.getRange('C6:H28').setNumberFormat(num);p.getRange('C6:H28').format.horizontalAlignment='right';
value(p,'A2','Annual financial projections');p.getRange('A2').format.font={size:14,bold:true};
value(p,'A3','Amounts in $000. Fiscal year ends in March. FY26 actuals cover April–November 2025.');
p.getRange('A3').format.font={size:10,italic:true,color:'#626962'};
p.getRange('A5:H5').values=[['Particulars','UoM','FY25\nActual','FY26\nActual • 8 months','Estimate FY26\nFull year','FY27\nProjection','FY28\nProjection','FY29\nProjection']];header(p,'A5:H5');
const rowMap={3:7,4:8,5:9,6:10,7:11,8:12,11:15,12:16,13:17,14:18,15:19,16:20,18:22,19:23};
value(p,'A6','Revenue contributors');band(p,'A6:H6');value(p,'A14','Operating expenses');band(p,'A14:H14');
for(const [sr,pr] of Object.entries(rowMap)){
 value(p,`A${pr}`,source[Number(sr)-1][0]);value(p,`B${pr}`,source[Number(sr)-1][1]);
 formula(p,`C${pr}`,`='Source actuals'!G${sr}`);formula(p,`D${pr}`,`='Source actuals'!K${sr}`);
}
const remaining={7:27,8:28,9:29,11:30,15:32,16:33,17:34,18:35,19:36};
for(const [r,wr] of Object.entries(remaining))formula(p,`E${r}`,`=D${r}+'Forecast workings'!F${wr}`);
for(const c of ['E','F','G','H']){
 formula(p,`${c}10`,`=SUM(${c}7:${c}9)`);formula(p,`${c}12`,`=${c}10-${c}11`);
 formula(p,`${c}20`,`=SUM(${c}15:${c}19)`);formula(p,`${c}22`,`=${c}12-${c}20`);formula(p,`${c}23`,`=${c}22/${c}12`);
}
for(const [col,prev,ac] of [['F','E','D'],['G','F','E'],['H','G','F']]){
 formula(p,`${col}7`,`=${prev}7*(1+'Forecast workings'!${ac}11)`);
 formula(p,`${col}8`,`=${col}7*'Forecast workings'!${ac}13`);
 formula(p,`${col}9`,col==='F'?`='Forecast workings'!E29*'Forecast workings'!$C$10*(1+'Forecast workings'!${ac}14)`:`=${prev}9*(1+'Forecast workings'!${ac}14)`);
 formula(p,`${col}11`,`=${col}10*'Forecast workings'!${ac}15`);
 for(const [r,ar] of [[15,17],[16,18],[18,21],[19,22]])formula(p,`${col}${r}`,`=${prev}${r}*(1+'Forecast workings'!${ac}${ar})`);
 formula(p,`${col}17`,`=${col}12*'Forecast workings'!${ac}20`);
}
for(const r of [10,12,20,22]){p.getRange(`A${r}:H${r}`).format.font.bold=true;p.getRange(`A${r}:H${r}`).format.borders={top:{style:'thin',color:'#ADB9A6'}};}
band(p,'A22:H22');p.getRange('C23:H23').setNumberFormat('0.0%;(0.0%);"-"');p.getRange('A23:H23').format.font.italic=true;
value(p,'A25','Net revenue growth');value(p,'B25','%');value(p,'C25','n.a.');value(p,'D25','n.a.');
for(const [c,prior] of [['E','C'],['F','E'],['G','F'],['H','G']])formula(p,`${c}25`,`=${c}12/${prior}12-1`);
p.getRange('E25:H25').setNumberFormat('0.0%');p.getRange('A25:H25').format.font.italic=true;
p.getRange('C6:H25').format.font.color='#202520';
value(p,'A28','Basis of preparation');band(p,'A28:H28');
const notes=[
 'FY26 = eight months as supplied + a separate estimate for the remaining four months.',
 'Revenue uses the October–November monthly rate. Costs use July–November averages plus a buffer.',
 'FY27–FY29 costs grow from the full FY26 estimate, retaining an allowance for earlier high spending.',
 'Growth and cost rates are planning judgments based on this sheet, not an approved company budget.',
 'The source does not explain the earlier cost spikes. Their full recurrence would worsen these results.',
 'Edit blue inputs in Forecast workings. All forecast amounts are live formulas; select any cell to inspect.',
 'A formula guide and the supporting assumptions are included in Forecast workings.'
];notes.forEach((x,i)=>value(p,`A${29+i}`,x));

base(a,'A1:H66');a.tabColor='#819968';a.getRange('A1:A66').format.columnWidth=40;a.getRange('B1:B66').format.columnWidth=10;a.getRange('C1:F66').format.columnWidth=18;a.getRange('G1:G66').format.columnWidth=3;a.getRange('H1:H66').format.columnWidth=79;
value(a,'A2','Forecast assumptions and workings');a.getRange('A2').format.font={size:14,bold:true};
value(a,'A3','Blue / pale yellow = editable assumptions. Green = links. Black = calculations.');
a.getRange('A5:F5').values=[['Driver','UoM','FY26\nDec–Mar','FY27','FY28','FY29']];header(a,'A5:F5');value(a,'H5','Reason for assumption');a.getRange('H5').format.font.bold=true;
const drivers={6:['Actual months','months',8],7:['Months remaining','months',null],8:['Recent revenue period','months',2],9:['Recent cost period','months',5],10:['Full financial year','months',12],11:['Subscription growth / uplift','%',.05,.35,.25,.18],12:['Micro-transactions: remainder uplift','%',.05],13:['Micro-transactions / subscription','%',null,.105,.108,.11],14:['Ad revenue growth / uplift','%',-.10,0,.05,.05],15:['Refunds / gross revenue','%',.015,.015,.016,.016],17:['Content cost uplift / growth','%',.15,.20,.20,.15],18:['Salary uplift / growth','%',.15,.10,.12,.10],19:['Marketing: remainder uplift','%',.05],20:['Marketing / net revenue','%',null,.38,.36,.34],21:['Tech & Product uplift / growth','%',.10,.18,.15,.12],22:['G&A uplift / growth','%',.15,.10,.10,.08]};
for(const [r,vs] of Object.entries(drivers)){
 a.getRange(`A${r}:F${r}`).values=[[...vs,...Array(6-vs.length).fill(null)]];
 for(let i=2;i<vs.length;i++)if(typeof vs[i]==='number'){const cell=`${String.fromCharCode(65+i)}${r}`;a.getRange(cell).format.font.color=blue;a.getRange(cell).format.fill='#FFF5D6';}
 a.getRange(`C${r}:F${r}`).setNumberFormat(Number(r)<=10?'0':'0.0%');
}
formula(a,'C7','=C10-C6');
const reasons={6:'April–November actuals: eight months, as specified by the user.',7:'December–March: full year less months already reported.',8:'October–November is the latest revenue run rate in the source.',9:'July–November smooths unusually low latest-month costs.',10:'April–March fiscal year, as labelled in the supplied sheet.',11:'FY26 remainder: 5% above recent monthly sales. Annual growth then eases to 35%, 25%, 18%.',12:'FY26 remainder: 5% above the recent monthly average; no compounding within four months.',13:'Recent ratio is about 10.5%. Modest improvement to 11% by FY29; no separate volume data.',14:'Remainder falls 10%. FY27 resets to that monthly rate × 12; then only 5% annual recovery.',15:'Recent refunds are about 1.3% of gross sales. Allow 1.5%, increasing to 1.6%.',17:'Remainder: five-month cost average +15%. Later years grow the entire prior-year cost base.',18:'Remainder: five-month average +15%. Full-year base retained for hiring and pay increases.',19:'Remainder: five-month average +5%; recent monthly marketing spend has been fairly stable.',20:'Recent ratio is about 43%. Gradual efficiency to 38%, 36%, 34%, rather than a sudden cut.',21:'Remainder: five-month average +10%. Annual growth of 18%, 15%, 12% allows for scaling.',22:'Remainder: five-month average +15%. Prior full-year base grows 10%, 10%, 8% thereafter.'};
for(const [r,t] of Object.entries(reasons)){value(a,`H${r}`,t);a.getRange(`H${r}`).format.wrapText=true;a.getRange(`A${r}:H${r}`).format.rowHeight=32;}
a.getRange('C6:F22').format.horizontalAlignment='right';
value(a,'A24','FY26 remaining four months');band(a,'A24:F24');
a.getRange('A26:F26').values=[['Particulars','UoM','Monthly base','Uplift / rate','Monthly estimate','Four-month total']];header(a,'A26:F26');
const items={27:['Subscription revenue',3,11,'revenue'],28:['Micro-transactions',4,12,'revenue'],29:['Ad revenue',5,14,'revenue'],32:['Content development costs',11,17,'cost'],33:['Salary',12,18,'cost'],34:['Marketing',13,19,'cost'],35:['Tech & Product',14,21,'cost'],36:['Other G&A',15,22,'cost']};
for(const [r,[name,sr,ar,type]] of Object.entries(items)){
 value(a,`A${r}`,name);value(a,`B${r}`,'$000');
 formula(a,`C${r}`,type==='revenue'?`='Source actuals'!J${sr}/$C$8`:`=SUM('Source actuals'!I${sr}:J${sr})/$C$9`);
 formula(a,`D${r}`,`=C${ar}`);formula(a,`E${r}`,`=C${r}*(1+D${r})`);formula(a,`F${r}`,`=E${r}*$C$7`);
}
value(a,'A30','Refunds');value(a,'B30','$000');formula(a,'D30','=C15');formula(a,'E30','=SUM(E27:E29)*D30');formula(a,'F30','=E30*$C$7');
for(const [r,label,f] of [[38,'Gross revenue','=SUM(F27:F29)'],[39,'Net revenue','=F38-F30'],[40,'Total Opex','=SUM(F32:F36)'],[41,'EBITDA','=F39-F40']]){value(a,`A${r}`,label);value(a,`B${r}`,'$000');formula(a,`F${r}`,f);a.getRange(`A${r}:F${r}`).format.font.bold=true;}
a.getRange('C27:F41').setNumberFormat(num);a.getRange('D27:D36').setNumberFormat('0.0%');
value(a,'H27','Revenue base: Oct–Nov total ÷ 2 months.');value(a,'H30','Refund rate applies to incremental gross revenue; actual refunds stay unchanged.');value(a,'H32','Cost base: Jul–Sep + Oct–Nov totals, divided by 5 months.');value(a,'H35','No repetition of the earlier spikes is claimed as fact; the buffers are planning allowances.');
for(const r of [27,30,32,35]){a.getRange(`H${r}`).format.wrapText=true;a.getRange(`A${r}:H${r}`).format.rowHeight=32;}
value(a,'A44','Formula guide');band(a,'A44:F44');
const guide=[
 ['FY26 subscription (Annual projections!E7)',"'=D7+'Forecast workings'!F27"],
 ['FY26 monthly cost base (C32)',"'=SUM('Source actuals'!I11:J11)/$C$9"],
 ['FY26 remaining content costs (F32)',"'=E32*$C$7"],
 ['FY27 subscription (Annual projections!F7)',"'=E7*(1+'Forecast workings'!D11)"],
 ['FY27 micro-transactions (Annual projections!F8)',"'=F7*'Forecast workings'!D13"],
 ['FY27 marketing (Annual projections!F17)',"'=F12*'Forecast workings'!D20"],
 ['FY27 EBITDA (Annual projections!F22)',"'=F12-F20"],
 ['FY27 EBITDA margin (Annual projections!F23)',"'=F22/F12"]
];guide.forEach(([label,f],i)=>{value(a,`A${45+i}`,label);value(a,`D${45+i}`,f);});
value(a,'A54','Source and limitations');band(a,'A54:F54');
const limits=[
 'Source: Projections.xlsx, Sheet1, A1:K19. Supplied values are retained on Source actuals.',
 'Model cutoff is November 2025. No later actuals, budget, headcount or customer data were supplied.',
 'Revenue growth and expense assumptions are estimates, not external industry benchmarks.',
 'EBITDA follows the source definition: net revenue less the five stated operating cost categories.',
 'No additional tax, interest, depreciation, capex or cash-flow forecast is inferred from this sheet.',
 'The user selected a cautious recent-cost forecast with an allowance for costs returning.'
];limits.forEach((t,i)=>value(a,`A${55+i}`,t));
value(a,'A62','Historical reconciliation');band(a,'A62:F62');
value(a,'A63','FY25 source EBITDA difference');formula(a,'C63',"='Source actuals'!G8-'Source actuals'!G16-'Source actuals'!G18");
value(a,'A64','FY26 YTD source EBITDA difference');formula(a,'C64',"='Source actuals'!K8-'Source actuals'!K16-'Source actuals'!K18");
a.getRange('C63:C64').setNumberFormat('0.00;(0.00);0.00');a.getRange('C63:C64').format.font.color='#202520';
a.getRange('C63:C64').conditionalFormats.add('cellIs',{operator:'notBetween',formula:[-.01,.01],format:{fill:'#FCE4D6',font:{color:'#9C0006',bold:true}}});
a.freezePanes.freezeRows(5);
// Preserve the source table's presentation, with enough width to read the original labels.
s.getRange('A1:A19').format.columnWidth=47;s.getRange('C1:K19').format.columnWidth=18;s.getRange('B1:B19').format.columnWidth=9;s.showGridLines=false;s.tabColor='#D9CDB4';
// Cross-workbook copying does not retain all source style records in this runtime.
// Restore the supplied green header, total emphasis and numeric display explicitly.
s.getRange('A1:K21').format.font={name:'Arial',size:10,color:'#000000'};
s.getRange('A1:K21').format.rowHeight=21;
s.getRange('A1:K1').format={fill:'#92D050',font:{name:'Arial',size:10,bold:true,color:'#000000'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeight:48};
s.getRange('C3:K18').setNumberFormat(num);
s.getRange('C19:K19').setNumberFormat('0.0%;(0.0%);"-"');
for(const r of [2,6,8,10,16,18,19])s.getRange(`A${r}:K${r}`).format.font.bold=true;
for(const r of [6,8,16,18])s.getRange(`A${r}:K${r}`).format.borders={top:{style:'thin',color:'#BFC5BD'}};
value(s,'A21','Source: supplied Projections.xlsx, Sheet1. Original values and period labels retained.');
// Recalculate and exercise a driver before restoring it.
wb.recalculate();
const before=p.getRange('F7').values[0][0],historical=p.getRange('C7:D7').values[0];
value(a,'D11',.36);wb.recalculate();const after=p.getRange('F7').values[0][0];
if(Math.abs(after-before-p.getRange('E7').values[0][0]*.01)>.0001)throw Error('Growth input did not recalculate');
if(JSON.stringify(historical)!==JSON.stringify(p.getRange('C7:D7').values[0]))throw Error('Actuals changed');
value(a,'D11',.35);wb.recalculate();
const out=p.getRange('C7:H25').values;
await fs.writeFile(`${dir}/calculated.json`,JSON.stringify(out));
console.log((await wb.inspect({kind:'table',range:'Annual projections!C20:H25',include:'values,formulas',tableMaxRows:6,tableMaxCols:6,maxChars:4000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Formula error scan',maxChars:1500})).ndjson);
for(const [sheet,range,name] of [['Source actuals','A1:K21','source-final']]){
 const preview=await wb.render({sheetName:sheet,range,scale:1.3});await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await preview.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(`${dir}/Annual_Projections_FY25-FY29.xlsx`);
console.log('EXPORTED '+`${dir}/Annual_Projections_FY25-FY29.xlsx`);
