import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbookFile,suggestMapping,validateSheetRows,makeDataset,importMessage} from '../src/lib/customImportData.ts';
import {groupGames,aggregatePlayers} from '../src/lib/customImportSummary.ts';
const headers=['ottelu_id','ottelupäivä','joukkue','vastustaja','koti_vieras','vastustajan_pisteet','pelaaja_id','pelaaja','minuutit','pisteet','2PM','2PA','3PM','3PA','FTM','FTA','levypallot','syötöt','menetykset'];
const rows=[['g1','1.10.2026','Oma joukkue','Vastustaja','koti',35,'a','Aino Testi','20:30',20,5,8,2,4,4,4,8,5,2],['g1','1.10.2026','Oma joukkue','Vastustaja','koti',35,'b','Berta Testi','19,5',18,6,10,1,2,3,4,4,3,1],['g2','4.10.2026','Oma joukkue','Toinen','vieras',45,'a','Aino Testi',25,24,6,10,3,5,3,4,9,6,2],['g2','4.10.2026','Oma joukkue','Toinen','vieras',45,'b','Berta Testi',15,16,5,8,1,3,3,4,3,2,1]];
const sheet={name:'Pelaajat',headers,rows};
const mapping=suggestMapping(headers);
test('Finnish CSV headers, decimal commas and minute clocks produce grouped games and pooled player percentages',()=>{
 const validation=validateSheetRows(sheet,mapping);assert.equal(validation.issues.length,0);assert.equal(validation.rows[0].stats.minutes,20.5);assert.equal(validation.rows[1].stats.minutes,19.5);
 const dataset=makeDataset('team.csv',sheet.name,mapping,validation.rows),games=groupGames(dataset.rows),players=aggregatePlayers(dataset.rows,dataset.availableFields);
 assert.equal(games.length,2);assert.equal(games[0].points,38);assert.equal(games[1].points,40);assert.equal(games[0].opponentPoints,35);
 assert.equal(players[0].pointsPerGame,22);assert.equal(players[0].minutesPerGame,22.75);assert.ok(Math.abs(players[0].fgPct-100*16/27)<1e-9);assert.ok(Math.abs(players[0].threePct-100*5/9)<1e-9);
});
test('missing optional values remain missing and DNP rows do not count as games',()=>{
 const copy=structuredClone(sheet);copy.rows[0][16]='';copy.rows.push(['g3','6.10.2026','Oma joukkue','Toinen','','','a','Aino Testi','DNP',0]);
 const v=validateSheetRows(copy,mapping);assert.equal(v.issues.length,0);assert.equal(v.skippedDnp,1);
 const games=groupGames(v.rows),players=aggregatePlayers(v.rows,makeDataset('x','x',mapping,v.rows).availableFields);
 assert.equal(games[0].stats.rebounds,null);assert.equal(players.find(p=>p.id==='a').reboundsPerGame,null);assert.equal(players.find(p=>p.id==='a').games,2);
});
test('duplicate rows, impossible dates, negative/fractional counters, invalid clocks and too many makes block import',()=>{
 for(const [column,value] of [[1,'31.2.2026'],[9,-1],[9,2.5],[8,'20:60'],[10,9]]){
  const bad=structuredClone(sheet);bad.rows[0][column]=value;assert.ok(validateSheetRows(bad,mapping).issues.length>0,`${column}: ${value}`);
 }
 const duplicate=structuredClone(sheet);duplicate.rows.push(duplicate.rows[0]);assert.ok(validateSheetRows(duplicate,mapping).issues.some(issue=>issue.message.includes('useammin')));
 const duplicateMap={...mapping,opponent:mapping.team};assert.ok(validateSheetRows(sheet,duplicateMap).issues.length);
});
test('conflicting game metadata and opponent scores block misleading team results',()=>{
 for(const [column,value] of [[5,40],[1,'2.10.2026'],[3,'Eri vastustaja'],[4,'vieras']]){
  const bad=structuredClone(sheet);bad.rows[1][column]=value;assert.ok(validateSheetRows(bad,mapping).issues.length>0);
 }
});
test('CSV and multi-sheet XLSX parse locally and retain actual spreadsheet row numbers',async()=>{
 const csv='\ufeff'+headers.join(';')+'\r\n'+rows.map(row=>row.join(';')).join('\r\n');
 const noBom=await parseWorkbookFile(new File([csv.slice(1)],'no-bom.csv'));assert.equal(validateSheetRows(noBom[0],suggestMapping(noBom[0].headers)).issues.length,0);
 const parsed=await parseWorkbookFile(new File([csv],'team.csv'));assert.equal(parsed[0].headers[1],'ottelupäivä');assert.equal(validateSheetRows(parsed[0],suggestMapping(parsed[0].headers)).issues.length,0);
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([[],headers,[],...rows]),'Ottelut');XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([headers,...rows]),'Toinen');
 workbook.Sheets.Toinen.I2={t:'n',v:20.5/1440,z:'[m]:ss'};
 const excel=await parseWorkbookFile(new File([XLSX.write(workbook,{type:'array',bookType:'xlsx'})],'team.xlsx'));assert.equal(excel.length,2);assert.equal(validateSheetRows(excel[1],suggestMapping(excel[1].headers)).rows[0].stats.minutes,20.5);assert.equal(excel[0].rowNumbers[0],4);assert.equal(validateSheetRows(excel[0],suggestMapping(excel[0].headers)).issues.length,0);
 await assert.rejects(parseWorkbookFile(new File(['no'],'team.pdf')),/CSV/);await assert.rejects(parseWorkbookFile({size:16*1024*1024,name:'big.xlsx'}),/15 Mt/);
});
test('validation copy is readable in English without changing source values',()=>{
 assert.equal(importMessage('Sama sarake on yhdistetty useaan kenttään.','en'),'The same column is mapped to multiple fields.');
 assert.equal(importMessage('Puuttuva tai virheellinen: ottelupäivä, pisteet','en'),'Missing or invalid: game date, points');
});
