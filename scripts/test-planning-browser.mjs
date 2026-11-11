import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const browserModules = process.env.FSR_BROWSER_MODULES;
if (!browserModules) throw new Error('Set FSR_BROWSER_MODULES to the isolated pinned Playwright install.');
const require = createRequire(path.join(browserModules, 'package.json'));
const { chromium } = require('playwright');
const origin = 'http://localhost:3037';
const out = 'review-evidence/browser';
fs.mkdirSync(out, {recursive:true});
const log = fs.openSync(`${out}/server.log`, 'w');
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port','3037'], {
  env: {HOME:process.env.HOME,PATH:process.env.PATH,NODE_ENV:'production',CI:'true',NEXT_TELEMETRY_DISABLED:'1'},
  stdio:['ignore',log,log],detached:true,
});
let browser;
let checks=0, blocked=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
try {
  let ready=false;
  for(let i=0;i<60;i++){
    try{const r=await fetch(`${origin}/favicon.ico`);if(r.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  check(ready,'isolated production server must start');
  // Headed Chromium under Xvfb uses its real browser UA and executes the existing
  // site verification normally. No anti-bot/auth code, cookie or UA is overridden.
  browser=await chromium.launch({headless:false});
  for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]] ){
    const context=await browser.newContext({viewport,acceptDownloads:true});
    const errors=[];
    await context.route('**/*',async route=>{
      const request=route.request();const url=new URL(request.url());
      const allowed=url.origin===origin && request.method()==='GET' &&
        (/^\/(?:planning(?:\/|$)|buyer-tools(?:\/|$)|_next\/)/.test(url.pathname)||/\.(?:ico|png|webp|svg|woff2|jpg)$/.test(url.pathname));
      if(allowed) return route.continue();
      blocked++;
      // No contact/analytics POSTs or external/MLS requests leave this test browser.
      if(url.pathname==='/api/analytics')return route.fulfill({status:204,body:''});
      return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
    const scope = () => page.url().includes('/planning/sell') ? page.locator('section[id^="seller-panel-"]:not([hidden])') : page;
    async function go(route){await page.goto(origin+route,{waitUntil:'networkidle'});}
    async function fill(prefix,value){await scope().getByLabel(new RegExp(`^${prefix}`)).fill(String(value));}
    async function shot(name,selector){
      const element=scope().locator(selector).first();await element.scrollIntoViewIfNeeded();
      await element.screenshot({path:`${out}/${label}-${name}.png`});
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${name}: page must not overflow horizontally`);
    }
    async function reportContains(expected){
      const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download report',exact:true}).click();
      const download=await promise;const filename=`${out}/${label}-${checks}-report.txt`;await download.saveAs(filename);
      const text=fs.readFileSync(filename,'utf8');for(const part of expected)check(text.includes(part),`download must include ${part}`);
    }
    await go('/buyer-tools');
    check((await scope().locator('[data-calculator="buyer-monthly-summary"]').innerText()).includes('Not calculated'),'unknown buyer inputs suppress totals');
    for(const [name,value] of [['Purchase price',120000],['Down payment',0],['Interest rate assumption',0],['Loan term',10],['Assumed annual tax',1.2],['Home insurance',100],['Flood insurance',25],['HOA / condo',50],['CDD / assessments',10],['PMI rate assumption',1.2]])await fill(name,value);
    let result=scope().locator('[data-calculator="buyer-monthly-summary"]');
    check((await result.innerText()).includes('$1,425.00'),'buyer monthly includes all seven components');
    await shot('buyer-cost','[data-calculator="buyer-monthly-summary"]');
    await reportContains(['Estimated monthly total of included costs: $1,425.00','Estimated property taxes / month: $120.00','Estimated PMI / month: $120.00']);
    await fill('Home insurance','');check((await result.innerText()).includes('Not calculated'),'clearing a cost does not silently set zero');
    await page.getByRole('tab',{name:'Affordability',exact:true}).click();
    for(const [name,value]of [['Annual household income',150000],['Monthly debt payments',900],['Cash available',0],['Down-payment target',0],['Interest rate assumption',6.5],['Loan term',30],['Assumed annual tax',1.8],['Insurance estimate',650],['Flood estimate',0],['HOA / condo target',0],['CDD / other assessments',0],['PMI rate assumption',0.7],['Housing-income planning assumption',28],['Debt-to-income planning assumption',36],['Closing costs before credits',18000],['Confirmed closing credits',0]])await fill(name,value);
    result=scope().locator('[data-calculator="buyer-budget-summary"]');
    check((await result.innerText()).includes('short by $18,000.00'),'zero down still requires entered net closing costs');
    check(!(await result.innerText()).includes('$339,124.10'),'cash shortfall has no purchase budget');
    await shot('cash-shortfall','[data-calculator="buyer-budget-summary"]');
    await reportContains(['Cash shortfall: $18,000.00','No purchase budget is shown']);
    await fill('Cash available',18000);
    check((await result.innerText()).includes('$339,124.10'),'funded zero-down budget matches independent oracle');
    await reportContains(['Calculated planning price: $339,124.10','Estimated monthly total of included costs: $3,500.00']);
    await fill('Down-payment target',101);
    check((await result.innerText()).includes('Not calculated'),'invalid percentage suppresses budget');
    await fill('Down-payment target',100);await fill('Cash available',518000);
    check((await result.innerText()).includes('$500,000.00'),'cash-purchase budget respects cash minus costs');

    await go('/planning/sell?tool=proceeds');
    await fill('Scenario 1 sale price',500000);
    result=scope().locator('[data-calculator="seller-summary"]').first();
    check((await result.innerText()).includes('Subtotal before missing costs'),'unknown fees produce qualified subtotal');
    check((await result.innerText()).includes('Not entered'),'unknown fee shown as unknown');
    await scope().getByLabel('Who is listing the property?').selectOption('fsr');
    check((await result.innerText()).includes('$2,500.00'),'explicit FSR selection itemizes listing fee');
    for(const name of ['First mortgage payoff','Other loans or liens to pay off','Credit or concessions to buyer','Repair costs due at closing','Title, settlement and recording costs','Transfer taxes','Property-tax proration owed by seller','HOA / condo charges or assessments','Other seller costs','Property-tax credit to seller','Other credits to seller'])await fill(name,0);
    await scope().getByLabel('How is buyer-broker compensation being paid?').selectOption('seller-extra');
    await fill('Additional buyer-broker amount paid by seller',2);
    check((await result.innerText()).includes('$487,500.00'),'separate seller-funded buyer fee deducted once');
    await shot('seller-proceeds','[data-calculator="seller-summary"]');
    await reportContains(['Estimated seller proceeds: $487,500.00','Listing brokerage fee (0.5%): Deduct $2,500.00','Additional seller-paid buyer-broker compensation: Deduct $10,000.00']);
    await scope().getByLabel('Who is listing the property?').selectOption('other');
    check(await scope().getByLabel(/^Listing fee/).inputValue()==='','changing brokerage clears FSR fee');
    await fill('Listing fee',3);
    await scope().getByLabel('How is buyer-broker compensation being paid?').selectOption('listing-fee');
    check((await result.innerText()).includes('$485,000.00'),'included split is not deducted again');
    await scope().getByLabel('Who is listing the property?').selectOption('fsr');
    await scope().getByLabel('How is buyer-broker compensation being paid?').selectOption('seller-extra');await fill('Additional buyer-broker amount paid by seller',2);
    await page.getByRole('button',{name:'Compare offers',exact:true}).click();
    const prices=scope().getByLabel(/^Purchase price/),concessions=scope().getByLabel(/^Seller concessions/),deposits=scope().getByLabel(/^Deposit/);
    await prices.nth(0).fill('500000');await concessions.nth(0).fill('1000');await deposits.nth(0).fill('15000');
    await prices.nth(1).fill('550000');await concessions.nth(1).fill('2000');await deposits.nth(1).fill('50000');
    result=scope().locator('[data-calculator="seller-summary"]');
    check((await result.nth(0).innerText()).includes('$486,500.00'),'offer one proceeds');
    check((await result.nth(1).innerText()).includes('$534,250.00'),'offer two proceeds');
    await deposits.nth(0).fill('90000');check((await result.nth(0).innerText()).includes('$486,500.00'),'deposit change does not alter proceeds');
    await shot('offer-breakdown','[data-calculator="seller-summary"]');
    await reportContains(['Estimated seller proceeds: $486,500.00','Estimated seller proceeds: $534,250.00','Deposit (part of price): $90,000.00']);

    await page.getByRole('button',{name:'Sell & buy timing',exact:true}).click();
    await fill('Target sale closing','2028-02-28');await fill('Target purchase closing','2028-03-01');
    await fill('Temporary housing and storage estimate per day',100);
    check((await page.locator('body').innerText()).includes('2 calendar days'),'leap-year gap is two days');
    await reportContains(['Gap / overlap: 2 days','Entered gap / overlap cost: $200.00']);
    await go('/planning/buy?tool=loans');
    for(const [name,value]of [['Section A: origination charges',2500],['Section B: services you cannot shop for',600],['Lender credits',1000],['Monthly principal and interest',2000],['Monthly mortgage insurance',125],['Monthly estimated escrow',700],['Page 3: total paid in 5 years',150000],['Page 3: principal paid in 5 years',35000]])await fill(name,value);
    await reportContains(['A + B less lender credits: $2,100.00','Monthly P&I + mortgage insurance + escrow: $2,825.00','Five-year borrowing costs (including reported mortgage insurance): $115,000.00']);
    await go('/planning/own');await fill('Maintenance date','2027-04-15');await fill('What needs to be done?','Synthetic maintenance check');
    const calPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download calendar (.ics)',exact:true}).click();
    const cal=await calPromise;const calPath=`${out}/${label}-calendar.ics`;await cal.saveAs(calPath);
    const calText=fs.readFileSync(calPath,'utf8').replace(/\r\n[ \t]/g,'');
    check(calText.includes('DTSTART;VALUE=DATE:20270415'),'exported owner date');
    check(!/(?:\r\n)(?:RRULE|TRIGGER|ATTENDEE)[;:]/.test(calText),'calendar creates no subscription or invitation');
    await shot('owner-calendar','#calendar');
    check(errors.length===0,`${label}: uncaught browser errors: ${errors.join('; ')}`);
    await context.close();
  }
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({checks,viewports:['1440x1000','390x844'],playwright:require('playwright/package.json').version,blockedNonReadOrExternalRequests:blocked,productionMessagesSent:0,productionDataAccessed:false,scope:'Exact-head local production build; not remote preview or live production'},null,2));
  console.log(`PASS ${checks} browser assertions across desktop and mobile; no production data or messages.`);
} finally {
  if(browser)await browser.close();
  try{process.kill(-server.pid,'SIGTERM');}catch{}
  fs.closeSync(log);
}
