global.fetch = require('node-fetch');
const cc = require('cryptocompare');
const loki = require('lokijs');
const WEEK_MILLI = 604800000;

// console.log(coin.length);
let coin = null;
let subs = null;
let db = null;
let globalPrices = null;
/**
*/
export default class CryptoPoller {
  /**
  * @param {number} pollingFreq
  */
  constructor(pollingFreq) {
    this.loopId = setInterval(this.loopCallback, pollingFreq);
    db = new loki('data.db', {
      autoload: true,
      autoloadCallback: databaseInitialize,
      autosave: true,
      autosaveInterval: 5000,
    });

    /**
    */
    function databaseInitialize() {
      coin = db.getCollection('coin');
      // console.log(coin.length);
      subs = db.getCollection('subscribers');

      if (coin === null) {
        coin = db.addCollection('coin');
      }
      if (subs === null) {
        subs = db.addCollection('subs');
      }
    }
  }

  /**
  */
  loopCallback() {
    cc.priceMulti(['BTC', 'ETH', 'LTC'], ['USD', 'SGD'])
    .then((prices) => {
      let date = new Date();
      let dateInt = date.getTime();
      coin.insert({
        coin: 'LTC',
        date: dateInt,
        USD: prices.LTC.USD,
        SGD: prices.LTC.SGD,
      });
      coin.insert({
        coin: 'BTC',
        date: dateInt,
        USD: prices.BTC.USD,
        SGD: prices.BTC.SGD,
      });
      coin.insert({
        coin: 'ETH',
        date: dateInt,
        USD: prices.ETH.USD,
        SGD: prices.ETH.SGD,
      });
      globalPrices = prices;
    // -> { BTC: { USD: 1114.63, EUR: 1055.82 },
    //      ETH: { USD: 12.74, EUR: 12.06 } }
    }).catch(console.error);
  }

  /**
  * @param {string} crypto
  * @param {string} fiat
  * @return {string}
  */
  getPriceString(crypto, fiat) {
    if (globalPrices != null && globalPrices[crypto] != null) {
      return globalPrices[crypto][fiat] + ' ' + fiat + ' : ' + '1 '+ crypto;
    } else {
      return 'No data';
    }
  }

  /**
  * @param {string} crypto
  * @param {number} percent
  * @return {number} current percentage
  */
  getWeekPercent(crypto, percent) {
    if (globalPrices != null && globalPrices[crypto] != null) {
      let date = new Date();
      const dateInt = date.getTime();
      const weekAgo = dateInt - WEEK_MILLI;
      // let usdPrice = globalPrices[crypto].USD;
      let results = coin.find({
        coin: crypto,
        date: {'$between': [weekAgo, dateInt]},
      });
      const max = results.reduce((prev, current) => {
        if (current != null) {
          return (prev.USD > current.USD) ? prev : current;
        } else {
          return prev;
        }
      });
      const min = results.reduce((prev, current) => {
        if (current != null) {
          return (prev.USD < current.USD) ? prev : current;
        } else {
          return prev;
        }
      });
      console.log('max min is', max, min);
      return mapValues(percent, min.USD, max.USD);
    } else {
      return null;
    }
  }
}

/** helper function to map pecent from 0 to 100
* @param {num} input
* @param {num} outMin
* @param {num} outMax
* @return {num}
*/
function mapValues(input, outMin, outMax) {
  return (input - 0) * (outMax - outMin) / (100 - 0) + outMin;
}
