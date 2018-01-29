const reminders = ['PERCENTAGE_LT', 'PERCENTAGE_GT', 'VALUE'];

/**
* @param {obj} subs db connection
* @param {string} reminder reminder type, resolve before entering
* @param {obj} reminderTo id of the group
* @param {obj} query values to remember
* @return {boolean} success of operation
*/
export function addReminder(subs, reminder, reminderTo, query) {
  // console.log('test2', reminder, reminderTo, query);
  return new Promise(function(resolve, reject) {
    switch (reminder) {
      case reminders[0]:
      case reminders[1]:
        if (query.value) {
          subs.insert({
            type: reminder,
            chatId: reminderTo,
            value: query.value,
            currency: query.currency,
            pcnt: query.pcnt,
          });
          resolve(true);
        }
        break;
      default:
        reject(false);
    }
    reject(false);
  });
}
