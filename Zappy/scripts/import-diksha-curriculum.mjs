import fs from "node:fs/promises";

const API="https://diksha.gov.in/api";
const boards={
  "CBSE":"CBSE",
  "Karnataka State Board":"State (Karnataka)",
  "Kerala State Board":"State (Kerala)",
  "Tamil Nadu State Board":"State (Tamil Nadu)",
  "Telangana State Board":"State (Telangana)",
};
const wantedGrades=new Set(Array.from({length:12},(_,i)=>`Class ${i+1}`));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function json(url,options,retries=4){
  for(let attempt=0;attempt<retries;attempt++){
    try{
      const response=await fetch(url,options);
      if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    }catch(error){
      if(attempt===retries-1) throw error;
      await sleep(400*(attempt+1));
    }
  }
}

async function searchBoard(dikshaBoard){
  const payload={request:{filters:{contentType:["TextBook"],primaryCategory:["Digital Textbook"],board:[dikshaBoard],status:["Live"]},limit:10000,offset:0,fields:["identifier","name","board","gradeLevel","subject","medium","status","lastUpdatedOn"]}};
  const data=await json(`${API}/content/v1/search`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  return data?.result?.content||[];
}

async function hierarchy(identifier){
  const data=await json(`${API}/course/v1/hierarchy/${identifier}?mode=edit`);
  return data?.result?.content||null;
}

function cleanChapter(name=""){
  return name.replace(/^\s*(chapter|unit|lesson)?\s*\d+[\s.:\-–—)]*/i,"").replace(/\s+/g," ").trim();
}

function chapterRows(root){
  const direct=(root.children||[]).filter(child=>["TextBookUnit","CollectionUnit"].includes(child.contentType)||child.children?.length);
  return direct.map((child,index)=>({order:index+1,title:cleanChapter(child.name)||child.name,identifier:child.identifier,rawTitle:child.name})).filter(row=>row.title);
}

async function pooled(items,limit,task){
  const results=new Array(items.length);
  let cursor=0;
  async function worker(){
    while(cursor<items.length){
      const index=cursor++;
      try{results[index]=await task(items[index],index)}catch(error){results[index]={error:String(error),item:items[index]}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return results;
}

const output=[];
const failures=[];
for(const [appBoard,dikshaBoard] of Object.entries(boards)){
  const books=(await searchBoard(dikshaBoard)).filter(book=>(book.gradeLevel||[]).some(grade=>wantedGrades.has(grade)));
  process.stdout.write(`${appBoard}: ${books.length} live textbooks found\n`);
  const rows=await pooled(books,16,async book=>{
    const root=await hierarchy(book.identifier);
    const chapters=chapterRows(root||{});
    if(!root||!chapters.length) return null;
    return {
      board:appBoard,
      dikshaBoard,
      grades:(book.gradeLevel||[]).filter(grade=>wantedGrades.has(grade)),
      subjects:book.subject||[],
      mediums:book.medium||[],
      book:book.name,
      identifier:book.identifier,
      edition:book.lastUpdatedOn||root.lastUpdatedOn||"Edition date unavailable",
      source:`https://diksha.gov.in/play/collection/${book.identifier}`,
      sourceLabel:"DIKSHA · Government of India",
      chapters,
    };
  });
  for(const row of rows){
    if(row?.error) failures.push(row);
    else if(row) output.push(row);
  }
  process.stdout.write(`${appBoard}: ${output.filter(row=>row.board===appBoard).length} textbooks with chapter hierarchies imported\n`);
}

output.sort((a,b)=>a.board.localeCompare(b.board)||(a.grades[0]||"").localeCompare(b.grades[0]||"",undefined,{numeric:true})||(a.subjects[0]||"").localeCompare(b.subjects[0]||"")||a.book.localeCompare(b.book));
const document={
  generatedAt:new Date().toISOString(),
  authority:"DIKSHA · Ministry of Education, Government of India",
  boards:Object.keys(boards),
  recordCount:output.length,
  chapterCount:output.reduce((total,row)=>total+row.chapters.length,0),
  records:output,
  failures,
};
await fs.writeFile("app/curriculum.generated.json",JSON.stringify(document,null,2));
const compact=new Map();
for(const row of output){
  for(const grade of row.grades) for(const subject of row.subjects){
    const key=`${row.board}\u0000${grade}\u0000${subject}`;
    const current=compact.get(key)||{board:row.board,grade,subject,books:[],chapters:[],source:row.source,sourceLabel:row.sourceLabel};
    current.books.push({name:row.book,mediums:row.mediums,edition:row.edition,source:row.source});
    current.chapters.push(...row.chapters.map(chapter=>chapter.title));
    compact.set(key,current);
  }
}
const compactRecords=[...compact.values()].map(row=>({...row,chapters:[...new Set(row.chapters)]}));
await fs.writeFile("app/curriculum.index.json",JSON.stringify({generatedAt:document.generatedAt,authority:document.authority,recordCount:compactRecords.length,chapterCount:compactRecords.reduce((n,row)=>n+row.chapters.length,0),records:compactRecords}));
process.stdout.write(`Complete: ${document.recordCount} textbooks, ${document.chapterCount} chapters, ${failures.length} failures\n`);
