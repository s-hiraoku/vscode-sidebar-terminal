module.exports = {
  '*.{ts,tsx}': (filenames) => [
    'tsc --noEmit',
    `eslint --fix ${filenames.join(' ')}`,
    `prettier --write ${filenames.join(' ')}`,
  ],
  '*.{js,jsx,json,md,yml,yaml}': ['prettier --write'],
};
