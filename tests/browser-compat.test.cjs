const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];

for (const engine of ['modern', 'legacy', 'no-change-listener']) {
  test(`contact submission initializes and POSTs with ${engine} matchMedia`, async () => {
    const callbacks = {};
    const calls = [];
    let changed;
    const media = { matches: true };
    if (engine === 'modern') media.addEventListener = (event, cb) => { assert.equal(event, 'change'); changed = cb; };
    if (engine === 'legacy') media.addListener = cb => { changed = cb; };
    const element = () => ({ style: {}, classList: { remove() {}, add() {}, toggle() {} }, addEventListener() {} });
    const form = { ...element(), addEventListener(event, cb) { callbacks[event] = cb; }, reset() { calls.push('reset'); } };
    const elements = { cursor: element(), 'contact-form': form, 'form-status': element(), 'submit-btn': element(), progressBar: element() };
    const document = { getElementById: id => elements[id], querySelectorAll: () => [], addEventListener() {}, documentElement: element(), body: {} };
    vm.runInNewContext(script, {
      document, window: { addEventListener() {} }, matchMedia: () => media,
      IntersectionObserver: class { observe() {} }, requestAnimationFrame() {}, cancelAnimationFrame() {},
      FormData: class { constructor(value) { assert.equal(value, form); } },
      fetch: async (url, options) => { calls.push({url, method: options.method}); return { json: async () => ({success: true}) }; },
    });
    assert.equal(typeof callbacks.submit, 'function', 'initialization must reach the contact form');
    if (engine !== 'no-change-listener') { assert.equal(typeof changed, 'function'); changed(); }
    let prevented = false;
    await callbacks.submit({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(calls, [{url: 'https://api.web3forms.com/submit', method: 'POST'}, 'reset']);
    assert.equal(elements['submit-btn'].disabled, false);
    assert.match(elements['form-status'].innerHTML, /TRANSMISSION SUCCESSFUL/);
  });
}

test('native contact fallback uses POST rather than putting form fields in the URL', () => {
  const form = html.match(/<form\b[^>]*id="contact-form"[^>]*>/)[0];
  assert.match(form, /method="post"/);
  assert.match(form, /action="https:\/\/api\.web3forms\.com\/submit"/);
});
