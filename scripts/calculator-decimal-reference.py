"""Independent deterministic oracle: Python Decimal (80 digits) and datetime.
No imports from the application, no web requests, and no production data.
"""
import json
import random
from datetime import date, timedelta
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_FLOOR, getcontext

getcontext().prec = 80
rng = random.Random(20261111)
CENT = D('0.01')
def d(value): return D(str(value))
def money(value): return d(value).quantize(CENT, rounding=ROUND_HALF_UP)
def number(value): return float(value)
def convert(value):
    if isinstance(value, D): return number(value)
    if isinstance(value, dict): return {k: convert(v) for k, v in value.items()}
    if isinstance(value, list): return [convert(v) for v in value]
    return value

def monthly(x):
    price = money(x['price'])
    down = money(price*d(x['downPercent'])/100)
    loan = price-down
    n = int(x['years'])*12
    r = d(x['rate'])/1200
    pi = loan/D(n) if r == 0 else loan*r*(1+r)**n/((1+r)**n-1)
    out = {'downPayment':down,'loan':loan,'principalInterest':money(pi),
        'taxes':money(price*d(x['taxRate'])/1200),
        'pmi':money(loan*d(x['pmiRate'])/1200) if d(x['downPercent'])<20 else D(0)}
    out.update({k:money(x[k]) for k in ['insurance','flood','hoa','cdd']})
    out['total']=sum(out[k] for k in ['principalInterest','taxes','pmi','insurance','flood','hoa','cdd'])
    return out

def budget(x):
    cash=money(x['cash']); net=money(x['closingCosts'])-money(x['closingCredits'])
    monthly_limit=max(D(0),min(d(x['income'])/12*d(x['housingPercent'])/100,d(x['income'])/12*d(x['dti'])/100-d(x['monthlyDebt'])))
    monthly_limit=monthly_limit.quantize(CENT,rounding=ROUND_FLOOR)
    out={'maxHousing':monthly_limit,'netClosingCosts':net,'cashForDownPayment':max(D(0),cash-net),'cashShortfall':max(D(0),net-cash)}
    if cash<net: return {**out,'affordablePrice':None,'projected':None,'status':'cash-shortfall'}
    # Bisection of the explicitly defined cent-rounded budget constraints.
    # Decimal amortization is independent from the JS log/expm1 implementation.
    lo=0; hi=100_000_000_000
    while lo<hi:
        p=(lo+hi+1)//2
        cost=monthly({**x,'price':D(p)/100})
        if cost['total']<=monthly_limit and cost['downPayment']+net<=cash: lo=p
        else: hi=p-1
    return {**out,'affordablePrice':D(lo)/100,'projected':monthly({**x,'price':D(lo)/100}) if lo else None,'status':'model-limit' if lo==100_000_000_000 else 'calculated'}

CHARGES=['mortgagePayoff','otherLiens','sellerConcessions','repairs','titleSettlement','transferTaxes','propertyTaxDebit','hoaCosts','otherCosts']
CREDITS=['propertyTaxCredit','otherCredits']
def proceeds(price,x):
    p=money(price)
    fees={k:money(p*d(x[k]['value'])/100 if x[k]['mode']=='percent' else x[k]['value']) for k in ['listingFee','buyerFee']}
    charges=sum(fees.values())+sum(money(x[k]) for k in CHARGES)
    credits=sum(money(x[k]) for k in CREDITS)
    return {**fees,'charges':charges,'credits':credits,'netAtClosing':p-charges+credits,'afterTaxReserve':p-charges+credits-money(x['taxReserve'])}

def amount(maximum=2_000_000,places=3): return rng.randint(0,maximum*10**places)/10**places
BASE={'price':600000,'downPercent':20,'rate':6.5,'years':30,'taxRate':1.8,'insurance':650,'flood':0,'hoa':0,'cdd':0,'pmiRate':0.7}
buyer_cases=[]
for index in range(260):
    x={**BASE,'price':rng.randint(1,99_000_000_000)/100,'downPercent':rng.choice([0,3.5,5,19.999,20,25,50,99.999,100]),
       'rate':rng.choice([0,0.0000000001,0.125,1.5,5.875,6.5,9.99,25,100]),'years':rng.choice([1,5,10,15,30,40,50]),
       'taxRate':rng.choice([0,0.25,1.2345,1.8,2,5]),'pmiRate':rng.choice([0,0.3,0.7,1.235,3]),
       **{k:amount(3000) for k in ['insurance','flood','hoa','cdd']}}
    buyer_cases.append({'input':x,'expected':monthly(x)})
# Deliberate halfway-cent and zero-interest cases.
for price in [0.01,0.03,0.29,1.005,120.6,1200.6,1000000.01,999999999.99]:
    x={**BASE,'price':price,'rate':0,'downPercent':0,'taxRate':0,'insurance':1.005,'flood':2.675,'hoa':0.005,'cdd':0.004}
    buyer_cases.append({'input':x,'expected':monthly(x)})

budget_cases=[]
for index in range(85):
    x={**BASE,'income':amount(1000000,2),'monthlyDebt':amount(5000,2),'cash':amount(600000,2),
       'downPercent':rng.choice([0,3.5,5,19.999,20,50,100]),'rate':rng.choice([0,1e-10,3.25,6.5,12]),
       'years':rng.choice([5,15,30,50]),'dti':rng.choice([20,28,36,43,50]),'housingPercent':rng.choice([20,28,35,100]),
       'closingCosts':amount(50000,2),'closingCredits':0,'taxRate':rng.choice([0,1,1.8,3])}
    x.pop('price')
    if index%3==0: x['closingCredits']=float(money(d(x['closingCosts'])/2))
    if index%5==0: x['cash']=0
    budget_cases.append({'input':x,'expected':budget(x)})
for down,cash,closing,credits in [(0,0,18000,0),(0,18000,18000,0),(0,0,18000,18000),(20,18000,18000,0),(100,518000,18000,0),(100,0,0,0)]:
    x={**BASE,'income':150000,'monthlyDebt':900,'cash':cash,'downPercent':down,'dti':36,'housingPercent':28,'closingCosts':closing,'closingCredits':credits}
    x.pop('price');budget_cases.append({'input':x,'expected':budget(x)})

seller_cases=[]
for index in range(220):
    price=amount(1000000000,2) or .01
    x={k:amount(300000) for k in CHARGES+CREDITS+['taxReserve']}
    for key in ['listingFee','buyerFee']:
        mode=rng.choice(['flat','percent'])
        x[key]={'mode':mode,'value':rng.choice([0,0.5,1.25,2,3.14159,100]) if mode=='percent' else amount(10000)}
    seller_cases.append({'price':price,'input':x,'expected':proceeds(price,x)})

date_cases=[]
for index in range(310):
    start=date(1990,1,1)+timedelta(days=rng.randint(0,30000));days=rng.randint(-3650,3650);end=start+timedelta(days=days)
    date_cases.append({'start':start.isoformat(),'days':days,'end':end.isoformat()})
for start,days in [('2024-02-28',2),('2026-03-07',2),('2026-10-31',2),('2026-12-31',1),('2000-02-28',2),('2100-02-28',2)]:
    date_cases.append({'start':start,'days':days,'end':(date.fromisoformat(start)+timedelta(days=days)).isoformat()})

loan_cases=[]
for index in range(190):
    x={k:str(amount(100000)) for k in ['originationA','servicesB','lenderCredits','monthlyPI','monthlyMI','monthlyEscrow','fiveYearTotal','fiveYearPrincipal']}
    t=d(x['fiveYearTotal']);p=d(x['fiveYearPrincipal'])
    loan_cases.append({'input':x,'expected':{'lenderCosts':money(x['originationA'])+money(x['servicesB'])-money(x['lenderCredits']),
        'monthlyTotal':money(x['monthlyPI'])+money(x['monthlyMI'])+money(x['monthlyEscrow']),
        'fiveYearCost':money(t)-money(p) if p<=t else None,'fiveYearError':p>t}})
print(json.dumps(convert({'buyer':buyer_cases,'budget':budget_cases,'seller':seller_cases,'dates':date_cases,'loans':loan_cases}),separators=(',',':')))
