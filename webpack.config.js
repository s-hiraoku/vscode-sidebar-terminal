/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const path = require('path');
const webpack = require('webpack');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: [
          path.resolve(__dirname, 'src'),
        ],
        exclude: [
          path.resolve(__dirname, 'src/test'),
          /node_modules/,
        ],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.production.json'),
              transpileOnly: true,
              compilerOptions: {
                noEmitOnError: false,
              },
            },
          },
        ],
      },
    ],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    // Keep @homebridge/node-pty-prebuilt-multiarch as external since it's included in the package
    '@homebridge/node-pty-prebuilt-multiarch': 'commonjs @homebridge/node-pty-prebuilt-multiarch',
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
        include: [
          path.resolve(__dirname, 'src/webview'),
          path.resolve(__dirname, 'src/types'),
          path.resolve(__dirname, 'src/shared'),
          path.resolve(__dirname, 'src/utils'),
        ],
        exclude: [
          path.resolve(__dirname, 'src/test'),
          /node_modules/,
        ],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.production.json'),
              transpileOnly: true,
              compilerOptions: {
                noEmitOnError: false,
              },
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
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
  },
  optimization: {
    minimize: false,
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
