#!/usr/bin/env node
// Indgangen til installeren. Skrevet i gammel, enkel syntaks, så den kan give en dansk besked, selv på en for gammel Node.
var dele = process.versions.node.split('.').map(Number);
if (dele[0] < 20 || (dele[0] === 20 && dele[1] < 11)) {
  console.error('Din Node.js (' + process.versions.node + ') er for gammel. Progmaskinen kræver Node.js 20.11 eller nyere.');
  console.error('Hent den nyeste LTS-version på https://nodejs.org, installér den, og kør kommandoen igen.');
  process.exit(1);
}
import('../lib/installer.mjs').then(function (m) {
  return m.koer({ argv: process.argv.slice(2) }).then(function (kode) {
    process.exitCode = kode;
  });
});
