/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    // Keep node-pty as external since it's included in the package
    'node-pty': 'commonjs node-pty',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  mode: 'none',

  entry: './src/webview/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
  },
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      // For xterm.js in the webview
      path: false,
      fs: false,
      os: false,
      crypto: false,
      process: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];
