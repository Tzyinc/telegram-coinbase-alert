import {addReminder} from './userUtils';
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
    this.loopId = setInterval(this.pollPrices, pollingFreq);
    db = new loki('data.db', {
      autoload: true,
      autoloadCallback: databaseInitialize,
      autosave: true,
      autosaveInterval: 500,
    });

    /**
    */
    function databaseInitialize() {
      coin = db.getCollection('coin');
      // console.log(coin.length);
      subs = db.getCollection('subs');

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
  pollPrices() {
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
  * @return {list} list of people to message, together with what they asked for
  */
  checkReminders() {
    let results = [];
    let toRemove = [];
    let ltSubscribers = subs.find({
      type: 'PERCENTAGE_LT',
    });

    // console.log('ltsubs in check', ltSubscribers);
    if ((ltSubscribers != []) && (globalPrices!=null)) {
      ltSubscribers = ltSubscribers.filter((subscriber) => {
        return globalPrices[subscriber.currency].USD <= subscriber.value;
      });
      toRemove = toRemove.concat(ltSubscribers);
      ltSubscribers = ltSubscribers.map((subscriber) => {
        return {
        currentPrice: globalPrices[subscriber.currency].USD,
        type: subscriber.type,
        chatId: subscriber.chatId,
        value: subscriber.value,
        currency: subscriber.currency,
        pcnt: subscriber.pcnt,
        };
      });
    }

    let gtSubscribers = subs.find({
      type: 'PERCENTAGE_GT',
    });

    // console.log('gtsubs in check', gtSubscribers);
    if ((gtSubscribers != []) && (globalPrices!=null)) {
      gtSubscribers = gtSubscribers.filter((subscriber) => {
        return globalPrices[subscriber.currency].USD >= subscriber.value;
      });
      toRemove = toRemove.concat(gtSubscribers);
      gtSubscribers = gtSubscribers.map((subscriber) => {
        return {
          currentPrice: globalPrices[subscriber.currency].USD,
          type: subscriber.type,
          chatId: subscriber.chatId,
          value: subscriber.value,
          currency: subscriber.currency,
          pcnt: subscriber.pcnt,
        };
      });
    }
    results = results.concat(ltSubscribers);
    results = results.concat(gtSubscribers);
    // OR deep copy, but that is slower
    for (let i=0; i< toRemove.length; i++) {
      subs.remove(toRemove[i]);
    }
    return results;
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
  * @param {string} reminderType
  * @param {string} reminderTo
  * @return {number} current percentage
  */
  getWeekPercent(crypto, percent, reminderType, reminderTo) {
    if (globalPrices != null && globalPrices[crypto] != null) {
      let date = new Date();
      const dateInt = date.getTime();
      const weekAgo = dateInt - WEEK_MILLI;
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
      // console.log('max min is', max, min);
      let comparatorValue = mapValues(percent, min.USD, max.USD);
      let query = {
        value: comparatorValue,
        currency: crypto,
        pcnt: percent,
      };
      return addReminder(subs, reminderType, reminderTo, query);
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
