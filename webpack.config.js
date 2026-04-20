/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const shouldAnalyzeBundle = process.env.ANALYZE_BUNDLE === 'true';

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'none',

  entry: './src/extension.ts',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: [path.resolve(__dirname, 'src')],
        exclude: [path.resolve(__dirname, 'src/test'), /node_modules/],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.production.json'),
              transpileOnly: true,
              ignoreDiagnostics: [5011],
              compilerOptions: {
                noEmitOnError: false,
                rootDir: path.resolve(__dirname, 'src'),
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
    // Keep node-pty as external since it's included in the package
    'node-pty': 'commonjs node-pty',
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    ...(process.env.NODE_ENV === 'production' && {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              // Remove console.log, console.debug in production
              pure_funcs: ['console.log', 'console.debug', 'console.info'],
              // Keep console.error and console.warn for critical logging
              drop_debugger: true,
            },
            mangle: {
              // Keep class names for better debugging
              keep_classnames: true,
              keep_fnames: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    }),
  },
  devtool: 'nosources-source-map',
  performance: {
    maxEntrypointSize: 1024000, // 1MB
    maxAssetSize: 1024000, // 1MB
    hints: 'warning',
  },
  infrastructureLogging: {
    level: 'log',
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'none',

  entry: {
    webview: './src/webview/main.ts',
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
        include: [
          path.resolve(__dirname, 'src/webview'),
          path.resolve(__dirname, 'src/types'),
          path.resolve(__dirname, 'src/shared'),
          path.resolve(__dirname, 'src/utils'),
          path.resolve(__dirname, 'src/constants'),
        ],
        exclude: [path.resolve(__dirname, 'src/test'), /node_modules/],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.production.json'),
              transpileOnly: true,
              ignoreDiagnostics: [5011],
              compilerOptions: {
                noEmitOnError: false,
                rootDir: path.resolve(__dirname, 'src'),
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
    filename: '[name].js',
    chunkFilename: '[name].js',
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      cacheGroups: {
        xterm: {
          test: /[\\/]node_modules[\\/]@xterm[\\/]/,
          name: 'xterm-vendor',
          priority: 10,
          enforce: true,
        },
        webviewManagers: {
          test: /[\\/]src[\\/]webview[\\/]managers[\\/]/,
          name: 'webview-managers',
          priority: 5,
          enforce: true,
        },
        webviewServices: {
          test: /[\\/]src[\\/]webview[\\/]services[\\/]/,
          name: 'webview-services',
          priority: 4,
          enforce: true,
        },
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
          enforce: true,
        },
      },
    },
    ...(process.env.NODE_ENV === 'production' && {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              // Remove console.log, console.debug in production
              pure_funcs: ['console.log', 'console.debug', 'console.info'],
              // Keep console.error and console.warn for critical logging
              drop_debugger: true,
            },
            mangle: {
              // Keep class names for better debugging
              keep_classnames: true,
              keep_fnames: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    }),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.env.CI': JSON.stringify(process.env.CI || ''),
      'process.env.BUILD_ARTIFACTSTAGINGDIRECTORY': JSON.stringify(
        process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || ''
      ),
      'process.env.SNAP': JSON.stringify(''),
      'process.env.SNAP_REVISION': JSON.stringify(''),
      'process.env.VSCODE_NLS_CONFIG': JSON.stringify(''),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    ...(shouldAnalyzeBundle
      ? [
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: path.resolve(__dirname, 'report', 'webview-bundle-report.html'),
            statsFilename: path.resolve(__dirname, 'report', 'webview-bundle-stats.json'),
            generateStatsFile: true,
            logLevel: 'info',
          }),
        ]
      : []),
  ],
  devtool: 'nosources-source-map',
  performance: {
    maxEntrypointSize: 819200, // 800KB
    maxAssetSize: 819200, // 800KB
    hints: 'warning',
  },
};

module.exports = [extensionConfig, webviewConfig];
