# Cleaning price calculator (JavaScript + WordPress plugin)

> Learning/demo project, prices are made up. The interface is in Ukrainian.

The client picks the type of cleaning, the area and extra services and sees the price, the time and how many cleaners will come. Plain JavaScript without libraries, plus a WordPress plugin.

Demo: https://maksimka22.github.io/cleaning-calculator/

## Features
- Live calculation: cleaning type, apartment / house / office, area (slider and input), bathrooms, 6 extra services
- Discounts and surcharges: -10% / -15% for regular cleaning, +20% for urgent, minimum order
- Line-by-line breakdown, estimated time and number of cleaners
- Request form with name and phone check; the calculation is sent with the request
- Mobile: a sticky bar with the current price at the bottom
- Accessibility: labels for all fields, keyboard control, the price is announced to screen readers (`aria-live`)
- Prices, services and discounts are set in one config object

## Embed on any site

```html
<link rel="stylesheet" href="calculator.css">
<div data-cleaning-calculator></div>
<script>
  window.CleaningCalculatorConfig = { minOrder: 1000, endpoint: '/api/lead' };
</script>
<script src="calculator.js"></script>
```

## WordPress
This folder is a ready plugin: zip it, upload it in Plugins, activate, and put `[cleaning_calculator]` on any page. Requests are saved in the admin and emailed to the site owner. They go through `admin-ajax.php` with a nonce check.

## Tests
The calculation is separated from the UI and covered by tests (Node.js 18+):

```bash
node --test tests/
```

## How I made it
Built with Claude Code. I checked the numbers by hand, tested it in the browser on desktop and phone and sent test requests to a local WordPress.

Stack: JavaScript (ES2017), CSS, PHP, WordPress, node:test.
