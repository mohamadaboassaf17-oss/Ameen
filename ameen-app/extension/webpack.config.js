const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const TARGET = process.env.TARGET || 'chrome';
const VALID_TARGETS = ['chrome', 'firefox', 'edge', 'brave'];

if (!VALID_TARGETS.includes(TARGET)) {
  console.warn(`⚠️  تحذير: TARGET غير معروف '${TARGET}'، استخدام 'chrome'`);
}

const manifestFile = `manifest/manifest.${TARGET}.json`;
const distDir = path.resolve(__dirname, 'dist', TARGET);

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/index.ts',
    onboarding: './src/popup/onboarding.ts',
    settings: './src/popup/settings.ts',
  },
  output: {
    path: distDir,
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              module: 'ESNext',
            },
          },
        },
        exclude: /node_modules/,
        include: [
          path.resolve(__dirname, 'src'),
          path.resolve(__dirname, '..', 'shared-crypto', 'src'),
        ],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/popup/*.html', to: 'popup/[name][ext]' },
        { from: 'assets', to: 'assets', noErrorOnMissing: true },
        { from: manifestFile, to: 'manifest.json' },
      ],
    }),
  ],
  target: 'web',
  devtool: 'source-map',
};
