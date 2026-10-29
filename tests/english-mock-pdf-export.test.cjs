'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/index.html');
    await page.locator('button[onclick*="setup"][onclick*="mock"]').click();
    await page.selectOption('#mockType', 'common');
    await page.getByRole('button', { name: '開始する' }).click();
    await page.waitForSelector('#mockPdfActions:not(.hidden)');
    const open = async (label) => {
      const pending = page.waitForEvent('popup');
      await page.getByRole('button', { name: label }).click();
      const popup = await pending;
      await popup.waitForLoadState('domcontentloaded');
      const text = await popup.locator('body').innerText();
      const pdf = await popup.pdf({ format: 'A4' });
      assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
      assert.ok(pdf.length > 1000);
      await popup.close();
      return text;
    };
    const questions = await open('問題のみPDF');
    assert.match(questions, /Questions/);
    assert.doesNotMatch(questions, /Answer:|Answers and explanations/);
    assert.match(questions, /Priority|Pass completion/);
    const answers = await open('解答・解説PDF');
    assert.match(answers, /Answer:/);
    assert.match(answers, /Explanation:/);
    const combined = await open('問題＋解答PDF');
    assert.match(combined, /Questions/);
    assert.match(combined, /Answers and explanations/);
    assert.match(combined, /Answer:/);

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const copy = async (label) => {
      await page.getByRole('button', { name: label }).click();
      await page.waitForFunction(() => (document.querySelector('#englishCopyStatus')?.textContent || '').includes('コピーしました'));
      return page.evaluate(() => navigator.clipboard.readText());
    };
    const questionCopy = await copy('問題のみテキスト');
    assert.match(questionCopy, /Questions/);
    assert.doesNotMatch(questionCopy, /Answer:|Answers and explanations/);
    const answerCopy = await copy('解答・解説テキスト');
    assert.match(answerCopy, /Answer:/);
    assert.match(answerCopy, /Explanation:/);
    const combinedCopy = await copy('問題＋解答テキスト');
    assert.match(combinedCopy, /Questions/);
    assert.match(combinedCopy, /Answers and explanations/);
    assert.match(combinedCopy, /Answer:/);
    console.log('PASS English mock PDF exports and answer isolation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
