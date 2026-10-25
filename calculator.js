/*!
 * Калькулятор вартості прибирання.
 * Чистий JavaScript без бібліотек: працює на будь-якому сайті й у WordPress (див. cleaning-calculator.php).
 *
 * Вбудовування:
 *   <link rel="stylesheet" href="calculator.css">
 *   <div data-cleaning-calculator></div>
 *   <script src="calculator.js"></script>
 */
(function (root, factory) {
	const api = factory();
	if (typeof module === 'object' && module.exports) {
		module.exports = api;
	} else {
		root.CleaningCalculator = api;
	}
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	const DEFAULT_CONFIG = {
		currency: 'грн',
		minOrder: 800,
		types: {
			regular: { label: 'Підтримувальне', perM2: 20, minutesPerM2: 3 },
			general: { label: 'Генеральне', perM2: 35, minutesPerM2: 6 },
			renovation: { label: 'Після ремонту', perM2: 50, minutesPerM2: 9 },
		},
		property: {
			flat: { label: 'Квартира', k: 1 },
			house: { label: 'Будинок', k: 1.15 },
			office: { label: 'Офіс', k: 0.9 },
		},
		extraBathroom: 150,
		extras: {
			windows: { label: 'Миття вікон', unit: 'стулк.', price: 80, minutes: 15, counted: true, max: 30 },
			fridge: { label: 'Холодильник усередині', price: 250, minutes: 30 },
			oven: { label: 'Духовка усередині', price: 250, minutes: 30 },
			balcony: { label: 'Балкон або лоджія', price: 200, minutes: 30 },
			sofa: { label: 'Хімчистка дивана', unit: 'шт.', price: 400, minutes: 60, counted: true, max: 5 },
			ironing: { label: 'Прасування', unit: 'год', price: 200, minutes: 60, counted: true, max: 5 },
		},
		frequency: {
			once: { label: 'Разово', discount: 0 },
			biweekly: { label: 'Раз на 2 тижні', discount: 0.1 },
			weekly: { label: 'Щотижня', discount: 0.15 },
		},
		urgentMarkup: 0.2,
		hoursPerCleaner: 6,
		// Куди надсилати заявку. Без endpoint калькулятор працює в демо-режимі.
		endpoint: '',
		extraFields: {},
	};

	const DEFAULT_INPUT = {
		type: 'general',
		property: 'flat',
		area: 50,
		bathrooms: 1,
		extras: {},
		frequency: 'once',
		urgent: false,
	};

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function sum(lines) {
		return lines.reduce((total, line) => total + line.amount, 0);
	}

	/**
	 * Розрахунок без жодної роботи з DOM — його легко протестувати.
	 *
	 * @returns {{lines: {label: string, amount: number}[], total: number, minApplied: boolean, cleaners: number, hours: number}}
	 */
	function calculate(input, config = DEFAULT_CONFIG) {
		const type = config.types[input.type];
		const property = config.property[input.property];
		if (!type || !property) {
			throw new Error('Невідомий тип прибирання або приміщення');
		}

		const area = clamp(Math.round(Number(input.area) || 0), 10, 1000);
		const bathrooms = clamp(Math.floor(Number(input.bathrooms) || 1), 1, 10);
		const extras = input.extras || {};
		const lines = [];
		let minutes = area * type.minutesPerM2;

		const propertyNote = property.k === 1 ? '' : `, ${property.label.toLowerCase()}`;
		lines.push({ label: `${type.label} прибирання, ${area} м²${propertyNote}`, amount: area * type.perM2 * property.k });

		if (bathrooms > 1) {
			lines.push({ label: `Додаткові санвузли: ${bathrooms - 1}`, amount: (bathrooms - 1) * config.extraBathroom });
			minutes += (bathrooms - 1) * 30;
		}

		for (const [key, extra] of Object.entries(config.extras)) {
			const qty = extra.counted
				? clamp(Math.floor(Number(extras[key]) || 0), 0, extra.max)
				: (extras[key] ? 1 : 0);
			if (!qty) {
				continue;
			}
			lines.push({
				label: extra.counted ? `${extra.label}: ${qty} ${extra.unit}` : extra.label,
				amount: qty * extra.price,
			});
			minutes += qty * extra.minutes;
		}

		// Знижка за регулярність діє лише для підтримувального прибирання.
		const frequency = input.type === 'regular' ? config.frequency[input.frequency] : null;
		if (frequency && frequency.discount) {
			lines.push({
				label: `Знижка «${frequency.label}» −${Math.round(frequency.discount * 100)}%`,
				amount: -sum(lines) * frequency.discount,
			});
		}

		if (input.urgent) {
			lines.push({
				label: `Терміново, сьогодні +${Math.round(config.urgentMarkup * 100)}%`,
				amount: sum(lines) * config.urgentMarkup,
			});
		}

		let total = Math.round(sum(lines) / 10) * 10;
		const minApplied = total < config.minOrder;
		if (minApplied) {
			total = config.minOrder;
		}

		const workHours = minutes / 60;
		const cleaners = Math.max(1, Math.ceil(workHours / config.hoursPerCleaner));
		const hours = Math.max(1, Math.round((workHours / cleaners) * 2) / 2);

		return {
			lines: lines.map((line) => ({ label: line.label, amount: Math.round(line.amount) })),
			total,
			minApplied,
			cleaners,
			hours,
		};
	}

	/* ---------- Інтерфейс ---------- */

	function escapeHtml(text) {
		return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
	}

	function money(amount, config) {
		const sign = amount < 0 ? '−' : '';
		return `${sign}${Math.abs(amount).toLocaleString('uk-UA')} ${config.currency}`;
	}

	function plural(n, one, few, many) {
		const mod10 = n % 10;
		const mod100 = n % 100;
		if (mod10 === 1 && mod100 !== 11) return one;
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
		return many;
	}

	function stepper(name, value, min, max, label) {
		return `
			<div class="cc-stepper" data-stepper>
				<button type="button" class="cc-step" data-step="-1" aria-label="Менше: ${escapeHtml(label)}">−</button>
				<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" inputmode="numeric" aria-label="${escapeHtml(label)}">
				<button type="button" class="cc-step" data-step="1" aria-label="Більше: ${escapeHtml(label)}">+</button>
			</div>`;
	}

	function radios(name, options, selected, render) {
		return Object.entries(options).map(([key, option]) => `
			<label class="cc-option">
				<input type="radio" name="${name}" value="${key}" ${key === selected ? 'checked' : ''}>
				<span>${render(option)}</span>
			</label>`).join('');
	}

	function template(config, input, uid) {
		const extras = Object.entries(config.extras).map(([key, extra]) => {
			const price = `${extra.price} ${config.currency}${extra.counted ? '/' + extra.unit : ''}`;
			const control = extra.counted
				? stepper(`extra-${key}`, input.extras[key] || 0, 0, extra.max, extra.label)
				: `<input type="checkbox" name="extra-${key}" ${input.extras[key] ? 'checked' : ''} aria-label="${escapeHtml(extra.label)}">`;
			return `
				<div class="cc-extra">
					<span class="cc-extra-name">${escapeHtml(extra.label)}<small>${escapeHtml(price)}</small></span>
					${control}
				</div>`;
		}).join('');

		return `
			<form class="cc-form" novalidate>
				<fieldset class="cc-group">
					<legend>Тип прибирання</legend>
					<div class="cc-cards">
						${radios('type', config.types, input.type, (t) => `<b>${escapeHtml(t.label)}</b><small>${t.perM2} ${config.currency}/м²</small>`)}
					</div>
				</fieldset>

				<fieldset class="cc-group">
					<legend>Приміщення</legend>
					<div class="cc-segmented">
						${radios('property', config.property, input.property, (p) => escapeHtml(p.label))}
					</div>
				</fieldset>

				<div class="cc-group">
					<label class="cc-label" for="${uid}-area">Площа, м²</label>
					<div class="cc-area">
						<input type="range" id="${uid}-area" name="area-range" min="10" max="300" step="5" value="${input.area}">
						<input type="number" name="area" min="10" max="1000" value="${input.area}" inputmode="numeric" aria-label="Площа, м²">
					</div>
				</div>

				<div class="cc-group cc-inline">
					<span class="cc-label">Санвузли</span>
					${stepper('bathrooms', input.bathrooms, 1, 10, 'Кількість санвузлів')}
				</div>

				<fieldset class="cc-group">
					<legend>Додатково</legend>
					<div class="cc-extras">${extras}</div>
				</fieldset>

				<fieldset class="cc-group" data-frequency ${input.type === 'regular' ? '' : 'hidden'}>
					<legend>Як часто</legend>
					<div class="cc-segmented">
						${radios('frequency', config.frequency, input.frequency, (f) => escapeHtml(f.label) + (f.discount ? ` <small>−${Math.round(f.discount * 100)}%</small>` : ''))}
					</div>
				</fieldset>

				<label class="cc-check">
					<input type="checkbox" name="urgent" ${input.urgent ? 'checked' : ''}>
					<span>Терміново, сьогодні <small>+${Math.round(config.urgentMarkup * 100)}%</small></span>
				</label>
			</form>

			<a class="cc-bar" href="#${uid}-summary">
				<span>Разом: <b data-bar-total></b></span>
				<span>Замовити ↓</span>
			</a>

			<aside class="cc-summary" id="${uid}-summary">
				<p class="cc-summary-title">Орієнтовна вартість</p>
				<p class="cc-total" aria-live="polite" data-total></p>
				<p class="cc-meta" data-meta></p>
				<ul class="cc-lines" data-lines></ul>
				<p class="cc-min" data-min hidden>Мінімальне замовлення — ${money(config.minOrder, config)}</p>
				<p class="cc-note" data-rounded hidden>Разом округлено до 10 ${escapeHtml(config.currency)}</p>

				<form class="cc-lead" data-lead novalidate>
					<p class="cc-lead-title">Зафіксувати ціну</p>
					<input type="text" name="name" placeholder="Ваше ім’я" autocomplete="name" required maxlength="80" aria-label="Ваше ім’я">
					<input type="tel" name="phone" placeholder="Телефон" autocomplete="tel" required aria-label="Телефон">
					<button type="submit" class="cc-button">Замовити прибирання</button>
					<p class="cc-status" role="status" data-status></p>
				</form>
			</aside>`;
	}

	function readInput(form, config) {
		const data = new FormData(form);
		const extras = {};
		for (const [key, extra] of Object.entries(config.extras)) {
			extras[key] = extra.counted ? Number(data.get(`extra-${key}`)) || 0 : data.get(`extra-${key}`) === 'on';
		}
		return {
			type: data.get('type'),
			property: data.get('property'),
			area: Number(data.get('area')),
			bathrooms: Number(data.get('bathrooms')),
			extras,
			frequency: data.get('frequency') || 'once',
			urgent: data.get('urgent') === 'on',
		};
	}

	function summaryText(result, config) {
		const lines = result.lines.map((line) => `${line.label}: ${money(line.amount, config)}`);
		lines.push(`Разом: ${money(result.total, config)}`);
		return lines.join('\n');
	}

	/**
	 * Створює калькулятор у вказаному елементі.
	 */
	function mount(element, userConfig = {}) {
		const config = Object.assign({}, DEFAULT_CONFIG, userConfig);
		const uid = 'cc' + Math.random().toString(36).slice(2, 8);
		element.classList.add('cc');
		element.innerHTML = template(config, Object.assign({}, DEFAULT_INPUT, { extras: {} }), uid);

		const form = element.querySelector('.cc-form');
		const lead = element.querySelector('[data-lead]');
		const status = element.querySelector('[data-status]');
		const range = form.elements['area-range'];
		const area = form.elements.area;
		let result = null;

		function render() {
			const input = readInput(form, config);
			element.querySelector('[data-frequency]').hidden = input.type !== 'regular';
			result = calculate(input, config);

			element.querySelector('[data-total]').textContent = money(result.total, config);
			element.querySelector('[data-bar-total]').textContent = money(result.total, config);
			element.querySelector('[data-meta]').textContent =
				`≈ ${String(result.hours).replace('.', ',')} год · ${result.cleaners} ${plural(result.cleaners, 'клінер', 'клінери', 'клінерів')}`;
			element.querySelector('[data-lines]').innerHTML = result.lines
				.map((line) => `<li><span>${escapeHtml(line.label)}</span><b>${money(line.amount, config)}</b></li>`)
				.join('');
			element.querySelector('[data-min]').hidden = !result.minApplied;
			element.querySelector('[data-rounded]').hidden = result.minApplied || sum(result.lines) === result.total;
		}

		form.addEventListener('input', (event) => {
			if (event.target === range) {
				area.value = range.value;
			} else if (event.target === area) {
				range.value = area.value;
			}
			render();
		});

		form.addEventListener('click', (event) => {
			const button = event.target.closest('[data-step]');
			if (!button) {
				return;
			}
			const field = button.parentElement.querySelector('input');
			const next = (Number(field.value) || 0) + Number(button.dataset.step);
			field.value = clamp(next, Number(field.min), Number(field.max));
			render();
		});

		// Порожнє або завелике число виправляємо, коли користувач вийшов з поля.
		form.addEventListener('change', (event) => {
			const field = event.target;
			if (field.type === 'number') {
				field.value = clamp(Math.round(Number(field.value) || Number(field.min)), Number(field.min), Number(field.max));
				if (field === area) {
					range.value = area.value;
				}
				render();
			}
		});

		lead.addEventListener('submit', async (event) => {
			event.preventDefault();
			const name = lead.elements.name.value.trim();
			const phone = lead.elements.phone.value.trim();
			const digits = phone.replace(/\D/g, '');
			status.className = 'cc-status';

			if (!name || digits.length < 10 || digits.length > 13) {
				status.classList.add('cc-error');
				status.textContent = 'Вкажіть ім’я та номер телефону, наприклад +380 67 123 45 67.';
				return;
			}

			if (!config.endpoint) {
				status.classList.add('cc-ok');
				status.textContent = `Демо-режим: заявку на ${money(result.total, config)} сформовано, але нікуди не надіслано.`;
				lead.reset();
				return;
			}

			const body = new FormData();
			Object.entries(config.extraFields).forEach(([key, value]) => body.append(key, value));
			body.append('name', name);
			body.append('phone', phone);
			body.append('total', String(result.total));
			body.append('summary', summaryText(result, config));

			lead.querySelector('button').disabled = true;
			try {
				const response = await fetch(config.endpoint, { method: 'POST', body, credentials: 'same-origin' });
				if (!response.ok) {
					throw new Error(String(response.status));
				}
				status.classList.add('cc-ok');
				status.textContent = 'Дякуємо! Ціну зафіксовано, менеджер передзвонить найближчим часом.';
				lead.reset();
			} catch (error) {
				status.classList.add('cc-error');
				status.textContent = 'Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте нам.';
			} finally {
				lead.querySelector('button').disabled = false;
			}
		});

		render();
		return { recalculate: render };
	}

	function autoMount() {
		document.querySelectorAll('[data-cleaning-calculator]').forEach((element) => {
			const fromAttr = element.dataset.config ? JSON.parse(element.dataset.config) : {};
			mount(element, Object.assign({}, window.CleaningCalculatorConfig || {}, fromAttr));
		});
	}

	if (typeof document !== 'undefined') {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', autoMount);
		} else {
			autoMount();
		}
	}

	return { calculate, mount, DEFAULT_CONFIG };
});
