const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const base='http://127.0.0.1:3032';
 const errors=[]; const checks=[];
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('page:'+e.message));
 page.on('console',m=>{if(m.type()==='error') errors.push('console:'+m.text())});
 await page.goto(base+'/mission',{waitUntil:'networkidle'});
 checks.push(['onboarding promise',await page.getByText('Ship one meaningful outcome today.').isVisible()]);
 await page.getByRole('button',{name:'Build my workspace'}).click();
 checks.push(['workspace choices',await page.getByRole('button',{name:/Explore sample workspace/}).isVisible()]);
 await page.getByRole('button',{name:/Explore sample workspace/}).click();
 await page.getByRole('button',{name:'Enter ShipOS'}).click();
 checks.push(['sample badge',await page.getByText('Sample workspace',{exact:true}).isVisible()]);
 checks.push(['sample persisted',(await page.evaluate(()=>localStorage.getItem('shipos-sample-workspace')))==='1']);
 await page.keyboard.press('Control+k');
 checks.push(['command palette',await page.getByRole('dialog',{name:'Command palette'}).isVisible()]);
 checks.push(['palette routes',await page.getByRole('button',{name:/Go to Tasks/}).isVisible()]);
 await page.keyboard.press('Escape');
 fs.mkdirSync('qa/shots',{recursive:true}); fs.mkdirSync('qa/results',{recursive:true});
 await page.screenshot({path:'qa/shots/shipos-onboarded-sample-390.png',fullPage:true});
 await context.close();
 const routes=['mission','tasks','focus','blockers','vault','decisions','ship-log','stats','settings'];
 const viewports=[[320,700],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]];
 const matrix=[];
 for(const [width,height] of viewports){
  const c=await browser.newContext({viewport:{width,height}});
  await c.addInitScript(()=>localStorage.setItem('shipos-onboarded','1'));
  const p=await c.newPage(); let localErrors=[];
  p.on('pageerror',e=>localErrors.push(e.message)); p.on('console',m=>{if(m.type()==='error')localErrors.push(m.text())});
  for(const route of routes){
   const response=await p.goto(base+'/'+route,{waitUntil:'networkidle'});
   const size=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   const pass=response?.status()===200&&size.sw<=size.cw&&!localErrors.length;
   matrix.push({route,width,height,status:response?.status(),...size,errors:[...localErrors],pass}); localErrors=[];
  }
  await c.close();
 }
 const result={checks:Object.fromEntries(checks),errors,matrixPass:matrix.filter(x=>x.pass).length,matrixTotal:matrix.length,failures:matrix.filter(x=>!x.pass)};
 fs.writeFileSync('qa/results/shipos-v3-polish.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(errors.length||checks.some(([,v])=>!v)||matrix.some(x=>!x.pass)) process.exit(1);
})();
