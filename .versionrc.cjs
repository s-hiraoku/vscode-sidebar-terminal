module.exports = {
  tagPrefix: 'v',
  skip: {
    tag: true,
    push: true,
  },
  header:
    '# Changelog\n\nAll notable changes to the "Secondary Terminal" extension will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n',
  types: [
    { type: 'feat', section: 'Added' },
    { type: 'fix', section: 'Fixed' },
    { type: 'perf', section: 'Changed' },
    { type: 'refactor', section: 'Changed' },
    { type: 'docs', section: 'Changed' },
    { type: 'revert', section: 'Reverted' },
    { type: 'style', hidden: true },
    { type: 'test', hidden: true },
    { type: 'chore', hidden: true },
    { type: 'ci', hidden: true },
  ],
  commitUrlFormat: 'https://github.com/s-hiraoku/vscode-sidebar-terminal/commit/{{hash}}',
  compareUrlFormat:
    'https://github.com/s-hiraoku/vscode-sidebar-terminal/compare/{{previousTag}}...{{currentTag}}',
  issueUrlFormat: 'https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/{{id}}',
};
