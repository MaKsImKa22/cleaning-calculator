// Запуск: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, DEFAULT_CONFIG } = require('../calculator.js');

const base = { type: 'general', property: 'flat', area: 50, bathrooms: 1, extras: {}, frequency: 'once', urgent: false };

test('генеральне прибирання 50 м² квартири', () => {
	const result = calculate(base);
	assert.equal(result.total, 50 * 35);
	assert.equal(result.lines.length, 1);
});

test('будинок дорожчий на 15%, офіс дешевший на 10%', () => {
	assert.equal(calculate({ ...base, property: 'house' }).total, Math.round((50 * 35 * 1.15) / 10) * 10);
	assert.equal(calculate({ ...base, property: 'office' }).total, Math.round((50 * 35 * 0.9) / 10) * 10);
});

test('додаткові санвузли і послуги з кількістю', () => {
	const result = calculate({ ...base, bathrooms: 2, extras: { windows: 4, fridge: true } });
	assert.equal(result.total, 1750 + 150 + 4 * 80 + 250);
	assert.equal(result.lines.length, 4);
});

test('кількість обмежена максимумом із налаштувань', () => {
	const result = calculate({ ...base, extras: { sofa: 99 } });
	assert.equal(result.total, 1750 + DEFAULT_CONFIG.extras.sofa.max * 400);
});

test('знижка за регулярність лише для підтримувального прибирання', () => {
	assert.equal(calculate({ ...base, type: 'regular', frequency: 'weekly' }).total, Math.round((1000 * 0.85) / 10) * 10);
	assert.equal(calculate({ ...base, frequency: 'weekly' }).total, 1750);
});

test('терміново +20% після знижки', () => {
	const result = calculate({ ...base, type: 'regular', frequency: 'biweekly', urgent: true });
	assert.equal(result.total, Math.round((1000 * 0.9 * 1.2) / 10) * 10);
});

test('мінімальне замовлення', () => {
	const result = calculate({ ...base, type: 'regular', area: 20 });
	assert.equal(result.total, DEFAULT_CONFIG.minOrder);
	assert.equal(result.minApplied, true);
});

test('площа поза межами виправляється', () => {
	assert.equal(calculate({ ...base, area: -5 }).lines[0].label, 'Генеральне прибирання, 10 м²');
	assert.equal(calculate({ ...base, area: 'abc' }).lines[0].label, 'Генеральне прибирання, 10 м²');
});

test('велика площа — більше клінерів', () => {
	const small = calculate({ ...base, area: 40 });
	const big = calculate({ ...base, type: 'renovation', area: 200 });
	assert.equal(small.cleaners, 1);
	assert.ok(big.cleaners >= 4);
	assert.ok(big.hours <= DEFAULT_CONFIG.hoursPerCleaner);
});

test('невідомий тип — зрозуміла помилка', () => {
	assert.throws(() => calculate({ ...base, type: 'space' }), /Невідомий тип/);
});
