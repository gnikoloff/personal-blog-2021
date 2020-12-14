const HTML_ENTITIES = {
  'amp': '&',
  'apos': '\'',
  '#x27': '\'',
  '#x2F': '/',
  '#39': '\'',
  '#47': '/',
  'lt': '<',
  'gt': '>',
  'nbsp': ' ',
  'quot': '"'
}

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

  decodeHTMLEntities: text => {
    var entities = [
      ['amp', '&'],
      ['apos', '\''],
      ['#x27', '\''],
      ['#x2F', '/'],
      ['#39', '\''],
      ['#47', '/'],
      ['lt', '<'],
      ['gt', '>'],
      ['nbsp', ' '],
      ['quot', '"']
    ]

    for (var i = 0, max = entities.length; i < max; ++i) {
      text = text.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1])
    }

    return text
  },

  getPageTitle: title => `${title} | Georgi Nikolov`,
};
