module.exports = {
  getFormattedDate: (date) => {
    const formatNumber = (number) => {
      let numberFormat;
      if (number < 10) {
        numberFormat = `0${number}`;
      } else {
        numberFormat = number.toString();
      }
      return numberFormat;
    };
    const day = formatNumber(date.getDay());
    const month = formatNumber(date.getMonth());
    const year = formatNumber(date.getFullYear());

    return `${day}.${month}.${year}`;
  },
  getPageTitle: title => `${title} | Georgi Nikolov`,
};
