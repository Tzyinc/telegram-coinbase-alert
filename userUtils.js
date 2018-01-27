const reminders = ['PERCENTAGE_LT', 'PERCENTAGE_GT', 'VALUE'];

/**
* @param {obj} subs db connection
* @param {string} reminder reminder type, resolve before entering
* @param {obj} reminderTo id of the group
* @param {obj} query values to remember
* @return {boolean} success of operation
*/
export function addReminder(subs, reminder, reminderTo, query) {
  console.log( reminder, reminderTo, query);
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
        return true;
      }
      break;
    default:
      return false;
  }
  return false;
}
