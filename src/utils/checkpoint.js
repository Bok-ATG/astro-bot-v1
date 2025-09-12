const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return {}; }
}

function writeJson(p, obj) {
  ensureDir(p);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

class Checkpoints {
  constructor(filePath) { this.filePath = filePath; }
  load() { this.data = readJson(this.filePath); return this.data; }
  save() { writeJson(this.filePath, this.data || {}); }
  get(key) { this.load(); return this.data?.[key] || null; }
  set(key, value) { this.load(); this.data[key] = value; this.save(); }
}

module.exports = Checkpoints;
