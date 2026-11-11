import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadPlanningModule } from './planning-test-loader.mjs';
const core = await loadPlanningModule('lib/planning/calculator-core.ts');
const seller = await loadPlanningModule('lib/planning/seller.ts');
const buyer = await loadPlanningModule('lib/planning/buyer.ts');
const planner = await loadPlanningModule('lib/planning/buyer-calculations.ts');
const fixtures = JSON.parse(execFileSync('python3', ['scripts/calculator-decimal-reference.py'], {encoding:'utf8', maxBuffer:8*1024*1024, timeout:45000}));
let comparisons = 0, scenarios = 0;
function verify(actual, expected, path = '') {
  if (expected && typeof expected === 'object') {
    for (const [key,value] of Object.entries(expected)) verify(actual[key],value,`${path}.${key}`);
  } else {
    comparisons++;
    assert.equal(actual,expected,`${path}: expected ${expected}, got ${actual}`);
  }
}
for (const [i,f] of fixtures.buyer.entries()) {verify(core.buyerMonthlyCosts(f.input),f.expected,`monthly[${i}]`);scenarios++;}
for (const [i,f] of fixtures.budget.entries()) {
  const result=core.affordabilityBudget(f.input);verify(result,f.expected,`budget[${i}]`);scenarios++;
  if (result.projected) {
    assert.ok(core.moneyCents(result.projected.total)<=core.moneyCents(result.maxHousing));
    assert.ok(core.moneyCents(result.projected.downPayment)+core.moneyCents(result.netClosingCosts)<=core.moneyCents(f.input.cash));
    if(result.status!=='model-limit') {
      const next=core.buyerMonthlyCosts({...f.input,price:result.affordablePrice+0.01});
      assert.ok(core.moneyCents(next.total)>core.moneyCents(result.maxHousing)||core.moneyCents(next.downPayment)+core.moneyCents(result.netClosingCosts)>core.moneyCents(f.input.cash),'next cent must exceed a budget constraint');
    }
  }
}
for(const [i,f]of fixtures.seller.entries()){verify(seller.calculateSellerProceeds(f.price,f.input),f.expected,`seller[${i}]`);scenarios++;}
for(const [i,f]of fixtures.dates.entries()){
  verify(seller.shiftSellerDate(f.start,f.days),f.end,`date-shift[${i}]`);
  verify(seller.sellerDaysBetween(f.start,f.end),f.days,`date-difference[${i}]`);scenarios++;
}
for(const [i,f]of fixtures.loans.entries()){verify(buyer.loanMetrics({...buyer.emptyLoanEstimate(),...f.input}),f.expected,`loan[${i}]`);scenarios++;}
let regressionGroups=0;
function regression(name,fn){fn();regressionGroups++;console.log(`PASS ${name}`);}
const complete = () => ({...seller.chooseListingBrokerage(seller.newSellerCosts(),'fsr'), ...Object.fromEntries(seller.SELLER_COST_FIELDS.map(f=>[f.key,'0'])),buyerFeeFunding:'seller-extra',buyerFee:'0'});
const base={price:600000,downPercent:20,rate:6.5,years:30,taxRate:1.8,insurance:650,flood:0,hoa:0,cdd:0,pmiRate:0.7};
const budget={...base,income:150000,monthlyDebt:900,cash:120000,dti:36,housingPercent:28,closingCosts:18000,closingCredits:0};
regression('unknown listing does not automatically charge 0.5%',()=>{
  const form=seller.newSellerCosts();assert.equal(form.listingFee,'');assert.equal(form.listingBrokerage,'undecided');
  const result=seller.sellerCalculation(500000,form);assert.equal(result.rows[0].amount,null);assert.equal(result.resultLabel,'Subtotal before missing costs');assert.ok(result.missing.length>0);
});
regression('explicit FSR selection alone supplies editable advertised fee; switching clears it',()=>{
  let form=seller.chooseListingBrokerage(complete(),'fsr');assert.equal(form.listingFee,'0.5');assert.equal(seller.sellerCalculation(500000,form).result.listingFee,2500);
  form=seller.chooseListingBrokerage(form,'other');assert.equal(form.listingFee,'');assert.equal(seller.sellerCalculation(500000,form).rows[0].amount,null);
  form.listingFee='2';assert.equal(seller.sellerCalculation(500000,form).result.listingFee,10000);
  form=seller.chooseListingBrokerage(form,'undecided');assert.equal(form.listingFee,'');
});
regression('seller funding is separate, explicit, and never automatically double-counted',()=>{
  const form={...complete(),buyerFee:'2',sellerConcessions:'10000'};
  assert.equal(seller.sellerCalculation(500000,form).result.netAtClosing,477500);
  for(const buyerFeeFunding of ['listing-fee','seller-credit','other-payer','none']){
    const r=seller.sellerCalculation(500000,{...form,buyerFeeFunding});assert.equal(r.result.buyerFee,0);assert.equal(r.result.netAtClosing,487500);
  }
  const r=seller.sellerCalculation(500000,{...form,buyerFeeFunding:'undecided'});assert.equal(r.rows[1].amount,null);assert.match(r.resultLabel,/Subtotal/);
});
regression('zero is confirmed while missing is unknown; optional reserve is not a closing deduction',()=>{
  const form=complete();const full=seller.sellerCalculation(500000,form);assert.equal(full.result.netAtClosing,497500);assert.equal(full.missing.length,0);
  const missing=seller.sellerCalculation(500000,{...form,mortgagePayoff:''});assert.equal(missing.rows.find(x=>x.label==='First mortgage payoff').amount,null);assert.match(missing.resultLabel,/Subtotal/);
  const reserve=seller.sellerCalculation(500000,{...form,taxReserve:'10000'});assert.equal(reserve.result.netAtClosing,497500);assert.equal(reserve.result.afterTaxReserve,487500);
});
regression('offer deposit is part of price, never another charge; override only concessions',()=>{
  const form={...complete(),sellerConcessions:'10000'};
  assert.equal(seller.sellerCalculation(500000,form,'2500').result.netAtClosing,495000);
  const report=seller.buildSellerOfferReport([{...seller.newSellerOffer(1),price:'500000',concessions:'2500',deposit:'15000'}],form,'','');
  assert.match(report,/\$495,000.00/);assert.match(report,/Deposits are part of the price/);
});
regression('decimal midpoint and totals round consistently at the line-item level',()=>{
  assert.equal(core.moneyCents(1.005),101);assert.equal(core.moneyCents(2.675),268);assert.equal(core.moneyCents(-1.005),-101);
  const r=core.buyerMonthlyCosts({...base,insurance:1.005,flood:.005,hoa:.004});assert.equal(r.insurance,1.01);assert.equal(r.flood,.01);assert.equal(r.hoa,0);
  assert.equal(core.moneyCents(r.total),['principalInterest','taxes','pmi','insurance','flood','hoa','cdd'].reduce((a,k)=>a+core.moneyCents(r[k]),0));
});
regression('zero-down cash shortfall suppresses budget until the stated costs are funded',()=>{
  let r=core.affordabilityBudget({...budget,downPercent:0,cash:0});assert.equal(r.affordablePrice,null);assert.equal(r.cashShortfall,18000);
  r=core.affordabilityBudget({...budget,downPercent:0,cash:18000});assert.equal(r.cashShortfall,0);assert.ok(r.affordablePrice>0);
  r=core.affordabilityBudget({...budget,downPercent:0,cash:0,closingCredits:18000});assert.equal(r.cashShortfall,0);
  assert.throws(()=>core.affordabilityBudget({...budget,closingCredits:18000.01}),/cannot exceed/);
});
regression('zero interest, cash purchase and explicit low-income budgets remain defined',()=>{
  assert.equal(core.fixedMortgagePayment(120000,0,10),1000);
  const cash=core.buyerMonthlyCosts({...base,downPercent:100});assert.equal(cash.loan,0);assert.equal(cash.principalInterest,0);assert.equal(cash.pmi,0);
  assert.equal(core.affordabilityBudget({...budget,income:0}).affordablePrice,0);
  assert.equal(core.affordabilityBudget({...budget,downPercent:100,cash:518000}).affordablePrice,500000);
});
regression('invalid numeric inputs never produce plausible financial totals',()=>{
  for(const x of ['', ' ', '-1','NaN','Infinity','1e9','1,23','1,000,00','12,34.5','$100','1/2'])assert.equal(core.planningNumber(x),null,x);
  assert.equal(core.planningNumber('1,234,567.89'),1234567.89);assert.equal(core.planningNumber('.5'),.5);
  for(const [key,value] of [['price',0],['price',Infinity],['downPercent',101],['downPercent',-1],['rate',-1],['rate',NaN],['years',0],['years',1.5],['years',51],['insurance',-1],['taxRate',101]])assert.throws(()=>core.buyerMonthlyCosts({...base,[key]:value}),RangeError,key);
  assert.throws(()=>seller.calculateSellerProceeds(500000,{...seller.readSellerCosts(complete()).costs,listingFee:{mode:'percent',value:101}}),/Invalid brokerage/);
});
regression('selected listing loads no invented insurance, tax, rate or unknown HOA quote',()=>{
  const raw=planner.newBuyerPlannerInputs({price:500000});assert.equal(raw.price,'500000');for(const key of ['rate','taxRate','insurance','flood','hoa','cdd'])assert.equal(raw[key],'');
  const review=planner.analyzeBuyerPlanner('cost',raw);assert.equal(review.monthly,null);assert.ok(review.missing.length);
  assert.equal(planner.newBuyerPlannerInputs({price:500000,associationFeeMonthly:0}).hoa,'0');
});
regression('screen and export share the same evaluated model and display all included cents',()=>{
  const form=Object.fromEntries(Object.entries({...planner.newBuyerPlannerInputs(),...budget}).map(([k,v])=>[k,String(v)]));
  for(const tool of ['cost','affordability']){
    const review=planner.analyzeBuyerPlanner(tool,form);const result=review.monthly??review.budget.projected;
    const report=planner.buyerPlannerReport(tool,form,'Synthetic review');
    for(const key of ['total','loan','downPayment',...planner.MONTHLY_COST_LABELS.map(x=>x[0])])assert.ok(report.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(result[key])),`${tool} ${key}`);
  }
  const component=fs.readFileSync('components/BuyerTools.tsx','utf8');assert.match(component,/analyzeBuyerPlanner/);assert.match(component,/buyerPlannerReport/);assert.ok(!component.includes('function payment('));assert.ok(!component.includes('cash - 18000'));
  const sellerUI=fs.readFileSync('components/planning/SellerPlanning.tsx','utf8');assert.match(sellerUI,/sellerCalculation\(/);assert.match(sellerUI,/Choose who is listing|Who is listing/);
});
regression('loan comparison preserves negative net lender credits without manufacturing savings',()=>{
  const l={...buyer.emptyLoanEstimate(),originationA:'100.005',servicesB:'20.005',lenderCredits:'250.005',monthlyPI:'1.005',monthlyMI:'0.005',monthlyEscrow:'0.005',fiveYearTotal:'100',fiveYearPrincipal:'101'};
  const r=buyer.loanMetrics(l);assert.equal(r.lenderCosts,-129.99);assert.equal(r.monthlyTotal,1.03);assert.equal(r.fiveYearCost,null);assert.equal(r.fiveYearError,true);
});
regression('dates and gap estimates handle leap years, DST, invalid ranges and cent rounding',()=>{
  for(const x of ['2026-02-29','2026-04-31','bad'])assert.equal(seller.sellerDaysBetween(x,'2026-03-03'),null);
  assert.equal(seller.shiftSellerDate('9999-12-31',1),null);
  const draft={mode:'sell-first',saleDate:'2026-03-07',purchaseDate:'2026-03-09',preparationDays:'10',marketingDays:'20',contractDays:'30',dailyCost:'1.005'};
  const plan=seller.sellerTimingPlan(draft);assert.equal(plan.gapDays,2);assert.equal(plan.estimatedGapCost,2.02);
  assert.equal(seller.sellerTimingPlan({...draft,purchaseDate:'2026-03-06'}).estimatedGapCost,null);
  assert.equal(seller.sellerTimingPlan({...draft,purchaseDate:'2099-01-01'}).estimatedGapCost,null);
});
console.log(JSON.stringify({independentReference:'Python Decimal, precision 80; Python datetime',scenarioCounts:Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,v.length])),scenarios,numericComparisons:comparisons,regressionGroups,networkRequests:0,productionWrites:0},null,2));
