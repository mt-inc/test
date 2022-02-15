import { constants } from '@mt-inc/utils';
import Positions, { Candle } from '@mt-inc/bot';
import fs from 'fs';
import { Math as MathHelper, Time, getFileLinesSync } from '@mt-inc/utils';
import { TrixBot, TRIXSimulation, MAbot, MASimulation } from '@mt-inc/strategy';
import Binance from 'binance-api-node';
import testSettings from './test.settings.json';
//import { Telegraf } from 'telegraf';
import type { PositionType } from '@mt-inc/bot/dist/esm/src/positions';
import type { EMAStrategy, EMARSIStartegy, SMAStrategy, SMARSIStartegy } from '@mt-inc/strategy/dist/esm/src/ma';
import type { TRIXStartegyType } from '@mt-inc/strategy/dist/esm/src/trix';
import type { trixSettings, TRIXResult, SettTRIX } from '@mt-inc/strategy/dist/esm/src/trix/simulation';
import type { maSettings, MAResult, SettMA } from '@mt-inc/strategy/dist/esm/src/ma/simulation';

type Pairs = constants.Pairs;

type StrategyType = EMAStrategy | EMARSIStartegy | SMAStrategy | SMARSIStartegy | TRIXStartegyType;

type Sett = SettTRIX | SettMA;

type Result = TRIXResult | MAResult;

type Score = {
  id: string;
  settings: Omit<Sett, 'id'>;
  res: Result;
};
type newRunOneOptions = {
  pair?: Pairs;
  startFrom?: number;
  timeEnd?: number;
  sett: Sett;
};
class Test {
  private positions?: Positions;
  private math: MathHelper;
  private bot: MAbot | TrixBot | null;
  private simulateBot: TRIXSimulation | MASimulation | null;
  private time: Time;
  private score: Score[];
  private type: StrategyType;
  constructor(type?: StrategyType) {
    this.type = type || 'trix';
    this.math = new MathHelper();
    this.bot = null;
    this.simulateBot = null;
    this.time = new Time();
    this.score = [];
  }
  async log(log: string, push = false) {
    let pair = log.split('/')[1].split('-')[0];
    const translate = {
      ada: 'ADAUSDT',
      bnb: 'BNBUSDT',
      bnbb: 'BNBBUSD',
      btc: 'BTCUSDT',
      btcb: 'BTCBUSD',
      doge: 'DOGEUSDT',
      dogeb: 'DOGEBUSD',
      dot: 'DOTUSDT',
      eth: 'ETHUSDT',
      ehtb: 'ETHBUSD',
      sol: 'SOLUSDT',
      xrp: 'XRPUSDT',
      '1000shib': '1000SHIBUSDT',
      link: 'LINKUSDT',
      atom: 'ATOMUSDT',
      ftm: 'FTMUSDT',
      near: 'NEARUSDT',
      luna: 'LUNAUSDT',
    };
    fs.readFile(log ? `simulate/${log}` : '', async (err, d) => {
      if (!err) {
        if (!push) {
          if (testSettings.fhLog) {
            this.logger2(JSON.parse(`${d}`) as Result[], log);
          } else {
            this.logger(JSON.parse(`${d}`) as Score[], log);
          }
          console.log(pair);
        } else {
          const res = testSettings.fhLog
            ? this.logger2(JSON.parse(`${d}`), undefined, 100, false)
            : this.logger(JSON.parse(`${d}`) as Score[], undefined, 100, false);
          const split = log.split('-');
          const from = parseInt(split[2]);
          const to = parseInt(split[3].split('.')[0]);
          const req = await fetch('https://mt.raptom.com.ua/api/data', {
            method: 'post',
            headers: {
              'Content-type': 'application/json',
            },
            body: JSON.stringify({
              //@ts-ignore
              pair: translate[pair],
              results: res,
              from,
              to,
              leverage: testSettings.leverage,
              wallet: testSettings.wallet,
            }),
          }).then((res) => res.json());
          console.log(req);
          /*if (req.status === 'OK') {
            const bot = new Telegraf('1963525675:AAFrHLlWq7UEgkalnV0-OhIi8G4W-j1mYYY');
            await bot.launch();
            await bot.telegram.sendMessage(
              '-1001515842380',
              //@ts-ignore
              `🤘 Нові значення для ${translate[pair]} додано на сайт\n<a href="https://mt.raptom.com.ua/${translate[pair]}">mt.raptom.com.ua/${translate[pair]}</a>`,
              {
                parse_mode: 'HTML',
              },
            );
            bot.stop('SIGINT');
          }*/
        }
      } else {
        console.log(err);
      }
    });
  }
  private logger(res: Score[], log?: string, best = 100, con = true) {
    const exist: {
      net: number;
      ap: number | null;
      sett: Score['settings'];
    }[] = [];
    const filtered = res.filter((item) => {
      return item.res.net > 0;
    });
    const sorted = filtered
      .sort((a, b) => {
        return b.res.net + b.res.ap - (a.res.net + a.res.ap);
      })
      .filter((item) => {
        const find = exist.find((ex) => ex.net === item.res.net && ex.ap === item.res.ap);
        if (find) {
          return false;
        }
        for (let a = 0; a < exist.length; a++) {
          let c = 0;
          let d = 0;
          Object.keys(exist[a].sett.opts).map((key) => {
            if (exist[a].sett.opts[key] === item.settings.opts[key]) {
              c++;
            }
          });
          if (c > Object.keys(exist[a].sett.opts).length / 1) {
            return false;
          }
          Object.keys(exist[a].sett).map((key) => {
            if (key !== 'opts') {
              if (exist[a].sett[key] === item.settings[key]) {
                d++;
              }
            }
          });
          if (d > 5) {
            return false;
          }
        }
        exist.push({
          net: item.res.net,
          ap: item.res.ap,
          sett: item.settings,
        });
        return true;
      })
      .slice(0, best)
      .reverse()
      .map((item) => {
        if (
          item.res.type === 'ema+rsi' ||
          item.res.type === 'sma+rsi' ||
          item.res.type === 'ema' ||
          item.res.type === 'sma'
        ) {
          return new MASimulation().formatResult(item.res);
        }
        if (item.res.type === 'trix') {
          return new TRIXSimulation().formatResult(item.res);
        }
        return item.res;
      });
    if (con) {
      console.log(sorted, filtered.length, res.filter((item) => item.res.net !== 0).length, res.length);
      const split = log?.split('-');
      if (split && split.length > 2) {
        const from = new Date(parseInt(split[2]));
        const to = new Date(parseInt(split[3].split('.')[0]));
        let str = '';
        if (from.getTime() === from.getTime() && to.getTime() === to.getTime()) {
          str = `from ${this.time.format(from.getTime())} to ${this.time.format(to.getTime())}`;
        }
        console.log(str);
      }
    } else {
      return sorted;
    }
  }
  private logger2(res: Result[], log?: string, best = 100, con = true) {
    const filtered = res.filter((item) => {
      return item.net > 0;
    });
    const sorted = filtered
      .sort((a, b) => {
        return b.net + b.ap - (a.net + a.ap);
      })
      .slice(0, best)
      .reverse()
      .map((item) => {
        if (item.type === 'ema+rsi' || item.type === 'sma+rsi' || item.type === 'ema' || item.type === 'sma') {
          return new MASimulation().formatResult(item);
        }
        if (item.type === 'trix') {
          return new TRIXSimulation().formatResult(item);
        }
        return item;
      });
    if (con) {
      console.log(sorted, filtered.length, res.filter((item) => item.net !== 0).length, res.length);
      const split = log?.split('-');
      if (split && split.length > 2) {
        const from = new Date(parseInt(split[2]));
        const to = new Date(parseInt(split[3].split('.')[0]));
        let str = '';
        if (from.getTime() === from.getTime() && to.getTime() === to.getTime()) {
          str = `from ${this.time.format(from.getTime())} to ${this.time.format(to.getTime())}`;
        }
        console.log(str);
      }
    } else {
      return sorted;
    }
  }
  async newRun(
    options: {
      pair?: Pairs;
      population?: number;
      bestPerc?: number;
      gen?: number;
      mutations?: number;
      mutationPerc?: number;
      crossoverPerc?: number;
      old?: boolean;
      startFrom?: number;
      timeEnd?: number;
    },
    simulateOptions?: Partial<trixSettings> | Partial<maSettings>,
  ) {
    const def = {
      pair: 'BTCUSDT' as Pairs,
      population: 100,
      bestPerc: 10,
      gen: 50,
      mutations: 3,
      mutationPerc: 20,
      crossoverPerc: 20,
      old: false,
      startFrom: 0,
      timeEnd: new Date().getTime(),
    };
    const { pair, population, bestPerc, gen, mutations, mutationPerc, crossoverPerc, old, startFrom, timeEnd } = {
      ...def,
      ...options,
    };
    let trimmed = pair.replace('USDT', '').replace('BUSD', 'b').toLowerCase();
    if (trimmed === 'ethb') {
      trimmed = 'ehtb';
    }
    const dir = `../trades/${trimmed}${old ? '/old' : ''}`;
    if (fs.existsSync(dir)) {
      fs.readdir(dir, async (err, file) => {
        if (err) {
          console.log(err);
        }
        if (file.length > 0) {
          if (!fs.existsSync('simulate')) {
            fs.mkdirSync('simulate');
          }
          if (!fs.existsSync('simulate/genetic')) {
            fs.mkdirSync('simulate/genetic');
          }
          let c = 0;
          let start = 0;
          let end = 0;
          console.log(`Start: ${this.time.format(new Date().getTime())}`);
          console.log('Loading data');
          for (let i = 0; i < file.length; i++) {
            const item = file[i];
            if (item.indexOf('.tmp') === -1 && item.indexOf('old') === -1) {
              const data = getFileLinesSync(`${dir}/${item}`, 'utf8');
              for (const d of data) {
                let [_aggId, _p, _v, _firstId, _lastId, time, _wasMaker] = d.split(',');
                const t = parseInt(time);
                if (t) {
                  if (c === 0) {
                    start = t;
                  }
                  if (t >= startFrom && t <= timeEnd) {
                    end = t;
                    c++;
                  }
                }
              }
            }
          }
          console.log('Data loaded');
          console.log(`Data count: ${c}`);
          console.log('Start working');
          console.log(`from ${this.time.format(start)} to ${this.time.format(end)}`);
          const filename = `simulate/genetic/${trimmed}-${new Date().getTime()}-${start}-${end}-${this.type}.json`;
          console.log(`${filename}\n`);
          if (this.type === 'trix') {
            this.simulateBot = new TRIXSimulation(simulateOptions as trixSettings, {
              population,
              bestPerc,
              crossoverPerc,
              mutationPerc,
              mutations,
            });
          }
          if (this.type === 'ema' || this.type === 'sma' || this.type === 'ema+rsi' || this.type === 'sma+rsi') {
            this.simulateBot = new MASimulation(simulateOptions as maSettings, {
              population,
              bestPerc,
              crossoverPerc,
              mutationPerc,
              mutations,
            });
          }
          if (this.simulateBot) {
            let settings = this.simulateBot.fill(population);
            for (let g = 1; g <= gen; g++) {
              const popRes: Result[] = [];

              settings
                .map((sett) => sett)
                .filter((sett) => {
                  const find = this.score.find((score) => score.id === sett.id);
                  if (find) {
                    popRes.push(find.res);
                    return false;
                  }
                  return true;
                })
                .map((sett, ind) => {
                  if (typeof process.stdout.clearLine === 'function') {
                    process.stdout.cursorTo(0);
                    process.stdout.clearLine(1);
                    process.stdout.cursorTo(0);
                    process.stdout.write(`pair: ${pair}, gen: ${g} of ${gen}, member: ${ind + 1} of ${population}`);
                  }
                  if (sett.type === 'trix') {
                    this.bot = new TrixBot({
                      trixPeriod: sett.opts.trix,
                      smaPeriod: sett.opts.sma,
                      upper: sett.opts.upper,
                      lower: -sett.opts.lower,
                      type: sett.type,
                      history: sett.history,
                    });
                  }
                  if (
                    sett.type === 'sma' ||
                    sett.type === 'ema' ||
                    sett.type === 'sma+rsi' ||
                    sett.type === 'ema+rsi'
                  ) {
                    this.bot = new MAbot({
                      ...sett.opts,
                      type: sett.type,
                      history: sett.history,
                    });
                  }
                  let w = testSettings.wallet;
                  let next = false;
                  this.positions = new Positions(
                    testSettings.wallet,
                    0,
                    testSettings.leverage,
                    null,
                    pair,
                    undefined,
                    false,
                    undefined,
                    undefined,
                    (net: number) => {
                      w = w + net;
                      if (w / testSettings.wallet < 0.01) {
                        next = true;
                      }
                    },
                    undefined,
                    { tpP: sett.tp, slP: sett.sl },
                    { tSlP: sett.tsl },
                    true,
                    true,
                  );
                  const candles = new Candle(sett.candle, (data: number[]) => {
                    if (this.positions) {
                      this.bot?.work(data, now, this.positions);
                    }
                  });
                  let now = 0;
                  for (let i = 0; i < file.length; i++) {
                    const item = file[i];
                    if (item.indexOf('.tmp') === -1 && item.indexOf('old') === -1 && !next) {
                      const data = getFileLinesSync(`${dir}/${item}`, 'utf8');
                      for (const d of data) {
                        if (!next) {
                          let [_aggId, p, v, _firstId, _lastId, time, _wasMaker] = d.split(',');
                          const t = parseInt(time);
                          if (p && v && t) {
                            if (t >= startFrom && t <= timeEnd) {
                              now = parseFloat(p);
                              candles.push(now, parseFloat(v), t);
                              if (this.positions) {
                                this.positions.checkPositionRt(now);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  const posRes = this.positions.currentResult;
                  posRes.all = this.positions.currentPosition ? posRes.all - 1 : posRes.all;
                  const probProfit = this.math.round((posRes.profit.buy + posRes.profit.sell) / posRes.all) || 0;
                  const probLoss = posRes.all > 0 ? this.math.round(1 - probProfit) || 0 : 0;
                  const avgProfit =
                    this.math.round(posRes.profit.amount / (posRes.profit.buy + posRes.profit.sell)) || 0;
                  const avgLoss = -this.math.round(posRes.loss.amount / (posRes.loss.buy + posRes.loss.sell)) || 0;
                  const buyRatio = this.math.round(posRes.profit.buy / (posRes.profit.buy + posRes.loss.buy)) || 0;
                  const sellRatio = this.math.round(posRes.profit.sell / (posRes.profit.sell + posRes.loss.sell)) || 0;
                  const ap = this.positions.currentPosition?.status || 0;
                  const fallToProfit = this.math.round(posRes.net / posRes.fall);
                  const fall = this.math.round(posRes.fall * 100, 0);
                  const res = {
                    ...sett.opts,
                    id: sett.id,
                    candle: sett.candle,
                    type: sett.type,
                    history: sett.history,
                    sl: sett.sl,
                    tp: sett.tp,
                    tsl: sett.tsl,
                    from: sett.from,
                    positions: posRes.all,
                    net: posRes.net,
                    buyRatio,
                    sellRatio,
                    probProfit,
                    probLoss,
                    avgProfit,
                    avgLoss,
                    expectation: this.math.round(probProfit * avgProfit - probLoss * avgLoss) || 0,
                    ap: parseFloat(`${ap}`) || 0,
                    fallToProfit,
                    fall: `${fall}%`,
                  };
                  //@ts-ignore
                  popRes.push(res);
                  this.score.push({
                    id: res.id,
                    settings: {
                      ...sett,
                    },
                    //@ts-ignore
                    res,
                  });
                  fs.writeFileSync(filename, JSON.stringify(this.score), 'utf-8');
                });
              settings = [];
              //@ts-ignore
              const crossover = this.simulateBot.crossover(popRes);
              //@ts-ignore
              const mutation = this.simulateBot.mutation(popRes);
              const bestRes = popRes
                .filter((item) => item.positions > 0)
                .sort((a, b) => (b.net || 0) - (a.net || 0))
                .slice(0, parseInt(`${(population * bestPerc) / 100}`))
                .map((item) => {
                  const find = this.score.find((score) => score.id === item.id);
                  if (find) {
                    settings.push({
                      ...find.settings,
                      //@ts-ignore
                      id: item.id,
                    });
                  }
                });

              let restSettings: Sett[] = [];
              const restSize = population - bestRes.length - mutation.length - crossover.length;
              if (restSize > 0) {
                restSettings = this.simulateBot.fill(restSize);
              }
              //@ts-ignore
              settings = [...settings, ...mutation, ...crossover, ...restSettings];
            }
          }
          console.log(`End: ${this.time.format(new Date().getTime())}`);
        }
      });
    }
  }
  async newRunFromHistory(options: {
    pair?: Pairs;
    file: string;
    best?: number;
    old?: boolean;
    startFrom?: number;
    timeEnd?: number;
  }) {
    const def = {
      pair: 'BTCUSDT' as Pairs,
      best: 10,
      old: false,
      startFrom: 0,
      timeEnd: 1831283418000,
    };
    const { pair, file, best, old, startFrom, timeEnd } = { ...def, ...options };
    const fromFile = fs.readFileSync(`simulate/${file}`, 'utf-8');
    const res = JSON.parse(`${fromFile}`) as any;
    const sorted = testSettings.fhLog
      ? this.logger2(res, undefined, best, false)
      : this.logger(res, undefined, best, false);
    if (sorted && sorted.length > 0) {
      let trimmed = pair.replace('USDT', '').replace('BUSD', 'b').toLowerCase();
      if (trimmed === 'ethb') {
        trimmed = 'ehtb';
      }
      const dir = `../trades/${trimmed}${old ? '/old' : ''}`;
      if (fs.existsSync(dir)) {
        fs.readdir(dir, async (err, file) => {
          if (err) {
            console.log(err);
          }
          if (file.length > 0) {
            console.log('Start working');
            const filename = `simulate/genetic/${trimmed}-${new Date().getTime()}-fromHistory-${this.type}.json`;
            let settings = sorted;
            const popRes: Result[] = [];
            let c = 0;
            let start = 0;
            let end = 0;
            settings.map((sett, ind) => {
              if (typeof process.stdout.clearLine === 'function') {
                process.stdout.cursorTo(0);
                process.stdout.clearLine(1);
                process.stdout.cursorTo(0);
                process.stdout.write(`pair: ${pair}, member: ${ind + 1} of ${sorted.length}`);
              }
              if (sett.type === 'trix') {
                this.bot = new TrixBot({
                  trixPeriod: sett.trix,
                  smaPeriod: sett.sma,
                  upper: sett.upper,
                  lower: Math.abs(sett.lower) * -1,
                  type: sett.type,
                  history: sett.history,
                });
              }
              if (sett.type === 'sma' || sett.type === 'ema' || sett.type === 'sma+rsi' || sett.type === 'ema+rsi') {
                this.bot = new MAbot({
                  ...sett,
                });
              }
              this.positions = new Positions(
                testSettings.wallet,
                0,
                testSettings.leverage,
                null,
                pair,
                undefined,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                { tpP: sett.tp, slP: sett.sl },
                { tSlP: sett.tsl },
                true,
                true,
              );
              const candles = new Candle(sett.candle, (data: number[]) => {
                if (this.positions) {
                  this.bot?.work(data, now, this.positions);
                }
              });
              let now = 0;
              for (let i = 0; i < file.length; i++) {
                const item = file[i];
                const fTime = fs.statSync(`${dir}/${item}`).mtime;
                if (fTime.getTime() >= startFrom) {
                  if (item.indexOf('.tmp') === -1 && item.indexOf('old') === -1) {
                    const data = getFileLinesSync(`${dir}/${item}`, 'utf8');
                    for (const d of data) {
                      let [_aggId, p, v, _firstId, _lastId, time, _wasMaker] = d.split(',');
                      const t = parseInt(time);
                      if (p && v && t) {
                        if (t >= startFrom && t <= timeEnd) {
                          if (c === 0 && ind === 0) {
                            start = t;
                          }
                          now = parseFloat(p);
                          candles.push(now, parseFloat(v), t);
                          if (this.positions) {
                            this.positions.checkPositionRt(now);
                          }
                          if (ind === 0) {
                            c++;
                            end = t;
                          }
                        }
                      }
                    }
                  }
                }
              }
              const posRes = this.positions.currentResult;
              posRes.all = this.positions.currentPosition ? posRes.all - 1 : posRes.all;
              const probProfit = this.math.round((posRes.profit.buy + posRes.profit.sell) / posRes.all) || 0;
              const probLoss = posRes.all > 0 ? this.math.round(1 - probProfit) || 0 : 0;
              const avgProfit = this.math.round(posRes.profit.amount / (posRes.profit.buy + posRes.profit.sell)) || 0;
              const avgLoss = -this.math.round(posRes.loss.amount / (posRes.loss.buy + posRes.loss.sell)) || 0;
              const buyRatio = this.math.round(posRes.profit.buy / (posRes.profit.buy + posRes.loss.buy)) || 0;
              const sellRatio = this.math.round(posRes.profit.sell / (posRes.profit.sell + posRes.loss.sell)) || 0;
              const ap = this.positions.currentPosition?.status || 0;
              const fallToProfit = this.math.round(posRes.net / posRes.fall);
              const fall = this.math.round(posRes.fall * 100, 0);
              const res = {
                ...sett,
                //@ts-ignore
                lower: Math.abs(sett.lower || 0),
                positions: posRes.all,
                profit: posRes.net,
                net: posRes.net,
                buyRatio,
                sellRatio,
                probProfit,
                probLoss,
                avgProfit,
                avgLoss,
                expectation: this.math.round(probProfit * avgProfit - probLoss * avgLoss) || 0,
                ap: parseFloat(`${ap}`) || 0,
                fallToProfit,
                fall: `${fall}%`,
              };
              //@ts-ignore
              popRes.push(res);
              fs.writeFileSync(filename, JSON.stringify(popRes), 'utf-8');
            });
            /*console.log(
              popRes
                .filter((item) => item.net > 0)
                .sort((a, b) => {
                  return a.net + a.ap - (b.net + b.ap);
                }),
            );*/
            if (testSettings.pushLog) {
              const req = await fetch('https://mt.raptom.com.ua/api/data', {
                method: 'post',
                headers: {
                  'Content-type': 'application/json',
                },
                body: JSON.stringify({ pair, results: popRes, from: start, to: end }),
              }).then((res) => res.json());
              console.log(req);
            }
            console.log(`End: ${this.time.format(new Date().getTime())}`);
            console.log(`Data count: ${c}`);
            console.log(`from ${this.time.format(start)} to ${this.time.format(end)}`);
          }
        });
      }
    }
  }
  async newRunOne(options: newRunOneOptions) {
    const def = {
      pair: 'BTCUSDT' as Pairs,
      startFrom: 0,
      timeEnd: new Date().getTime(),
    };
    const { pair, startFrom, timeEnd, sett } = {
      ...def,
      ...options,
    };
    let trimmed = pair.replace('USDT', '').replace('BUSD', 'b').toLowerCase();
    if (trimmed === 'ethb') {
      trimmed = 'ehtb';
    }
    const dir = `../trades/${trimmed}`;
    if (fs.existsSync(dir)) {
      fs.readdir(dir, async (err, file) => {
        if (err) {
          console.log(err);
        }
        if (file.length > 0) {
          console.log('Start working');
          if (sett.type === 'trix') {
            this.bot = new TrixBot({
              trixPeriod: sett.opts.trix,
              smaPeriod: sett.opts.sma,
              upper: sett.opts.upper,
              lower: sett.opts.lower,
              type: sett.type,
              history: sett.history,
            });
          }
          if (sett.type === 'sma' || sett.type === 'ema' || sett.type === 'sma+rsi' || sett.type === 'ema+rsi') {
            this.bot = new MAbot({
              ...sett.opts,
              type: sett.type,
              history: sett.history,
            });
          }
          const candles = new Candle(sett.candle, (data: number[]) => {
            this.bot?.work(data, now, this.positions);
          });
          this.positions = new Positions(
            testSettings.wallet,
            0,
            testSettings.leverage,
            null,
            pair,
            undefined,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            { tpP: sett.tp, slP: sett.sl },
            { tSlP: sett.tsl },
            true,
            true,
          );
          let now = 0;
          let c = 0;
          let start = 0;
          let end = 0;
          for (let i = 0; i < file.length; i++) {
            const item = file[i];
            if (item.indexOf('.tmp') === -1 && item.indexOf('old') === -1) {
              const data = getFileLinesSync(`${dir}/${item}`, 'utf8');
              for (const d of data) {
                let [_aggId, p, v, _firstId, _lastId, time, _wasMaker] = d.split(',');
                const t = parseInt(time);
                if (p && v && t) {
                  if (t >= startFrom && t <= timeEnd) {
                    if (c === 0) {
                      start = t;
                    }
                    now = parseFloat(p);
                    candles.push(now, parseFloat(v), t);
                    if (this.positions) {
                      this.positions.checkPositionRt(now);
                    }
                    c++;
                    end = t;
                  }
                }
              }
            }
          }
          console.log(`Data count: ${c}`);
          console.log(`from ${this.time.format(start)} to ${this.time.format(end)}`);
          const { hist, ...rest } = this.positions.currentResult;
          console.log(rest);
          console.log(this.positions.currentPosition);
        }
      });
    }
  }
  cleanPos() {
    type User = {
      bots: {
        name: string;
      }[];
    };
    type PosType = {
      name?: string;
    };
    const dev = JSON.parse(fs.readFileSync('db/users.dev.json', 'utf-8')) as User[];
    const test = JSON.parse(fs.readFileSync('db/users.test.json', 'utf-8')) as User[];
    const prod = JSON.parse(fs.readFileSync('db/users.json', 'utf-8')) as User[];
    const bots: string[] = [];
    dev.map((item) => {
      item.bots.map((bot) => {
        bots.push(bot.name);
      });
    });
    test.map((item) => {
      item.bots.map((bot) => {
        bots.push(bot.name);
      });
    });
    prod.map((item) => {
      item.bots.map((bot) => {
        bots.push(bot.name);
      });
    });
    const posDev = JSON.parse(fs.readFileSync('db/positions.dev.json', 'utf-8')) as PosType[];
    const posTest = JSON.parse(fs.readFileSync('db/positions.test.json', 'utf-8')) as PosType[];
    const posProd = JSON.parse(fs.readFileSync('db/positions.json', 'utf-8')) as PosType[];
    const newPosDev = posDev.filter((item) => bots.includes(item.name || ''));
    const newPosTest = posTest.filter((item) => bots.includes(item.name || ''));
    const newPosProd = posProd.filter((item) => bots.includes(item.name || ''));
    fs.writeFileSync('db/positions.dev.json', JSON.stringify(newPosDev));
    fs.writeFileSync('db/positions.test.json', JSON.stringify(newPosTest));
    fs.writeFileSync('db/positions.json', JSON.stringify(newPosProd));
  }
  findPos(suffix?: 'dev' | 'test', name?: string, after?: number) {
    const find = fs.readFileSync(`db/positions.${suffix ? `${suffix}.` : ''}json`, 'utf-8');
    if (find) {
      const res = JSON.parse(find) as PositionType[];
      return res
        .filter((item) => {
          if (after) {
            return item.name === name && item.time >= after;
          }
          return item.name === name;
        })
        .sort((a, b) => a.closeTime || 0 - (b.closeTime || 0));
      /*.map((item) => ({
          'Ціна відкриття': item.price,
          Тип: item.type === 'SELL' ? 'продажа' : 'покупка',
          Кількість: item.amount,
          'Ціна закриття': item.closePrice,
          Плечо: item.leverage,
          'Час відкриття': item.humanTime,
          'Час закриття': item.humanCloseTime,
          Прибуток: item.net,
        }));*/
    }
  }
  async loadData(options: { startTime: number; endTime: number; pair: string; file: string }, c = 0) {
    const def = {
      startTime: 1632235756205,
      endTime: 1632240531915,
      pair: 'XRPUSDT',
      file: 'xrp/xrpusdt-1632214507679',
    };
    const { startTime, endTime, pair, file } = { ...def, ...options };
    const client = Binance();
    if (startTime < endTime) {
      try {
        const res = await client.futuresAggTrades({ symbol: pair, startTime, limit: 1000 });
        const lastTime = res[res.length - 1].timestamp;
        const toWrite = res.filter((item) => item.timestamp < lastTime && item.timestamp < endTime);
        c += toWrite.length;
        const fileName = `../trades/${file}-${Math.trunc(c / 200000)}.csv`;
        fs.appendFileSync(
          fileName,
          `${toWrite.map((item) => `${item.price},${item.quantity},${item.timestamp}`).join('\n')}\n`,
        );
        console.log(`${toWrite.length} saved. last: ${lastTime}. total: ${c}, file: ${file}`);
        await new Promise((res) => res(this.loadData({ startTime: lastTime, endTime, pair, file }, c)));
      } catch (e) {
        await new Promise((res) => setTimeout(() => res(this.loadData({ startTime, endTime, pair, file }, c)), 5000));
      }
    } else {
      console.log('end');
    }
  }
}

if (testSettings.todo === 'log') {
  new Test().log(testSettings.log, testSettings.pushLog);
} else if (testSettings.todo === 'test') {
  new Test(testSettings.type as StrategyType).newRun(
    {
      ...testSettings.geneticSettings,
      pair: testSettings.geneticSettings.pair as Pairs,
    },
    testSettings.simulateOptions,
  );
} else if (testSettings.todo === 'findPos') {
  const findPos = { ...testSettings.findPos } as {
    name: string;
    suffix?: 'dev' | 'test';
    after?: number;
  };
  console.log(new Test().findPos(findPos.suffix, findPos.name, findPos.after));
} else if (testSettings.todo === 'cleanPos') {
  new Test().cleanPos();
} else if (testSettings.todo === 'runOne') {
  //@ts-ignore
  new Test().newRunOne({ ...testSettings.runOne } as newRunOneOptions);
} else if (testSettings.todo === 'fromHistory') {
  const runOneFromHistory = { ...testSettings.fromHistory } as {
    pair?: Pairs;
    file: string;
    best?: number;
    old?: boolean;
  };
  new Test().newRunFromHistory(runOneFromHistory);
} else if (testSettings.todo === 'loadData') {
  new Test().loadData(testSettings.loadData);
}

//new Test().binance();
