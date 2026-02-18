module.exports = {
  '*.{ts,tsx}': () => ['tsc --noEmit', 'eslint --fix', 'prettier --write'],
  '*.{js,jsx,json,md,yml,yaml}': ['prettier --write'],
};
