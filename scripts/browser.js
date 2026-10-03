// Startar en Chromium utan att ladda ner någon: först en lokalt förinstallerad, sedan systemets Chrome
// (finns på GitHubs ubuntu-runners), sist Playwrights egen om den är installerad.
const { chromium } = require('playwright');
const tries = [{ executablePath: '/opt/pw-browsers/chromium' }, { channel: 'chrome' }, {}];
module.exports = async function launch() {
  let err;
  for (const opts of tries) {
    try { return await chromium.launch(opts); } catch (e) { err = e; }
  }
  throw err;
};
