import {addReminder} from './userUtils';
global.fetch = require('node-fetch');
const cc = require('cryptocompare');
const loki = require('lokijs');
const WEEK_MILLI = 604800000;

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
    try {
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
    } catch (err) {
      console.error(err);
    }
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

    if ((ltSubscribers != []) && (globalPrices!=null)) {
      ltSubscribers = ltSubscribers.filter((subscriber) => {
        return globalPrices[subscriber.currency].SGD <= subscriber.value;
      });
      toRemove = toRemove.concat(ltSubscribers);
      ltSubscribers = ltSubscribers.map((subscriber) => {
        return {
        currentPrice: globalPrices[subscriber.currency].SGD,
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

    if ((gtSubscribers != []) && (globalPrices!=null)) {
      gtSubscribers = gtSubscribers.filter((subscriber) => {
        return globalPrices[subscriber.currency].SGD >= subscriber.value;
      });
      toRemove = toRemove.concat(gtSubscribers);
      gtSubscribers = gtSubscribers.map((subscriber) => {
        return {
          currentPrice: globalPrices[subscriber.currency].SGD,
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
  * @param {contenxt} ctx
  * @param {string} crypto
  * @param {number} percent
  * @param {string} reminderType
  * @param {string} reminderTo
  */
  getWeekPercent(ctx, crypto, percent, reminderType, reminderTo) {
    if (globalPrices != null && globalPrices[crypto] != null) {
      cc.histoDay(crypto, 'SGD', {limit: 7}).then((prices) => {
        const max = prices.reduce((prev, current) => {
          if (current != null) {
            return (prev.high > current.high) ? prev : current;
          } else {
            return prev;
          }
        });
        const min = prices.reduce((prev, current) => {
          if (current != null) {
            return (prev.low < current.low) ? prev : current;
          } else {
            return prev;
          }
        });

        let comparatorValue = mapValues(percent, min.low, max.high);
        let query = {
          value: comparatorValue,
          currency: crypto,
          pcnt: percent,
        };
        addReminder(subs, reminderType, reminderTo, query)
        .then(
          (result) => {
          if (result) {
            ctx.reply('got it!');
          } else {
            ctx.reply('reminder failed! please remember to enter '
             + 'currency, gt or lt, and percent with the %');
          }
        })
        .catch((err) => {
          console.error(err);
          ctx.reply('reminder failed! please remember to enter '
           + 'currency, gt or lt, and percent with the %');
        });
      });
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
