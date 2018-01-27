require('dotenv').config();
const Telegraf = require('telegraf');
const token = process.env.BOT_API_KEY;
const bot = new Telegraf(token);
const apiai = require('apiai');
const pollingFreq = 1000;

let ai = apiai(process.env.APIAI_KEY);

import CryptoPoller from './cryptoPoll';
let cp = new CryptoPoller(pollingFreq);
setInterval(checkReminders, pollingFreq);
/**
* @param {context} ctx
*/
bot.start((ctx) => {
  console.log('started:', ctx.from.id);
  return ctx.reply('Welcome!');
});

bot.mention('@tencoinbot', (ctx) => parseCommand(ctx, '@tencoinbot'));
bot.hears(/@bot/, (ctx) => parseCommand(ctx, '@bot'));

/**
* @param {context} ctx
* @param {text} nameString
*/
function parseCommand(ctx, nameString) {
  {
    let chatId = ctx.message.chat.id;
    let input = ctx.message.text.replace(nameString, '');
    let request = ai.textRequest(input, {
        sessionId: chatId,
    });

    request.on('response', function(response) {
        console.log(response);
        if (response.result.action != 'input.unknown') {
          let params = response.result.parameters;
          let action = response.result.action;
           handleResponse(action, params, ctx);
        } else {
          ctx.reply('Error with dialog parsing');
        }
    });

    request.on('error', function(error) {
        console.log(error);
        ctx.reply('Error with dialog parsing');
    });

    request.end();
  }
}


/**
* @param {obj} action
* @param {obj} params
* @param {obj} ctx
*/
function handleResponse(action, params, ctx) {
  switch (action) {
    case 'map_fiat_to_crypto':
      if (params.fiat == '') {
        // assume SGD
        ctx.reply(cp.getPriceString(params.crypto, 'SGD'));
      } else {
        ctx.reply(cp.getPriceString(params.crypto, params.fiat));
      }
      break;
    case 'percent_reminder':
      let crypto = params.crypto;
      let percent = parseInt(params.pcnt.replace('%', ''));
      let reminderType = null;
      if (params.comp === 'lt') {
        reminderType = 'PERCENTAGE_LT';
      } else if (params.comp === 'gt') {
        reminderType = 'PERCENTAGE_GT';
      }
      let reminderTo = ctx.message.chat.id;
      let success = cp.getWeekPercent(crypto,
        percent, reminderType, reminderTo);
      if (success) {
        ctx.reply('got it!');
      } else {
        ctx.reply('reminder failed! please remember to enter '
         + 'currency, gt or lt, and percent with the %');
      }

      break;
    default:
      ctx.reply('Error with dialog parsing');
  }
}

/**
*/
function checkReminders() {
  let listOfSubs = cp.checkReminders();
  // console.log('subs', listOfSubs);
  for (let i=0; i < listOfSubs.length; i++) {
    let sub = listOfSubs[i];
    // console.log(sub);
    /*
      currentPrice: globalPrices[subscriber.currency].USD,
      type: subscriber.type,
      chatId: subscriber.chatId,
      value: subscriber.value,
      currency: subscriber.currency,
    */
    let replyText = 'REMINDER: \n';
    replyText += sub.currency + ' is ';
    switch (sub.type) {
      case 'PERCENTAGE_LT':
        replyText += 'lower than the weeks\' ';
        break;
      case 'PERCENTAGE_GT':
        replyText += 'higher than the weeks\' ';
        break;
    }
    replyText += sub.pcnt + '%!\n';
    replyText += '(dev notes: s-' + sub.value + 'c-' + sub.currentPrice + ' )';
    bot.telegram.sendMessage(sub.chatId, replyText);
  }
}
/* ai request response
{ id: 'c4125a07-7b2d-4d62-a8d5-9f40fc98454d',
  timestamp: '2018-01-26T15:25:28.447Z',
  lang: 'en',
  result:
   { source: 'agent',
     resolvedQuery: ' how much is ltc',
     action: 'map_fiat_to_crypto',
     actionIncomplete: false,
     parameters: { crypto: 'LTC', fiat: '' },
     contexts: [],
     metadata:
      { intentId: '85987bc9-9da1-4881-b5c9-8f5207313b10',
        webhookUsed: 'false',
        webhookForSlotFillingUsed: 'false',
        intentName: 'what is the price of' },
     fulfillment: { speech: '', messages: [Object] },
     score: 1 },
  status: { code: 200, errorType: 'success', webhookTimedOut: false },
  sessionId: '226902385' }
*/
bot.startPolling();
