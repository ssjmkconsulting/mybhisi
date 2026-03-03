function toCurrency(value) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function toDate(value) {
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

module.exports = { toCurrency, toDate };
